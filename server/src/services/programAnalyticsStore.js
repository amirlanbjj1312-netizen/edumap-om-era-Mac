const fs = require('fs/promises');
const path = require('path');
const { buildConfig } = require('../utils/config');
const { getPool, ensureProgramAnalyticsTable } = require('./db');

const config = buildConfig();
const STORAGE_DIR = path.resolve(__dirname, '../data');
const STORAGE_PATH = path.join(STORAGE_DIR, 'program-analytics.json');
const MAX_FILE_EVENTS = 50000;

const ensureStorage = async () => {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
};

const readFileEvents = async () => {
  try {
    await ensureStorage();
    const raw = await fs.readFile(STORAGE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
};

const writeFileEvents = async (events) => {
  await ensureStorage();
  await fs.writeFile(STORAGE_PATH, JSON.stringify(events, null, 2));
};

const cleanString = (value, maxLength = 160) =>
  String(value || '')
    .trim()
    .slice(0, maxLength);

const EVENT_TYPES = new Set(['open', 'read_more', 'close']);

const normalizeEvent = (input) => {
  const eventType = cleanString(input?.eventType, 24);
  if (!EVENT_TYPES.has(eventType)) {
    throw new Error('Invalid eventType');
  }
  const schoolId = cleanString(input?.schoolId, 120);
  const programName = cleanString(input?.programName, 180);
  if (!schoolId || !programName) {
    throw new Error('schoolId and programName are required');
  }
  return {
    schoolId,
    programName,
    eventType,
    locale: cleanString(input?.locale, 10) || null,
    expanded: Boolean(input?.expanded),
    source: cleanString(input?.source, 32) || 'mobile',
    createdAt: new Date().toISOString(),
  };
};

const aggregateEvents = (events, { days = 30, limit = 10 } = {}) => {
  const now = Date.now();
  const lookback = Math.max(1, Math.min(365, Number(days) || 30));
  const maxRows = Math.max(1, Math.min(50, Number(limit) || 10));
  const cutoff = now - lookback * 24 * 60 * 60 * 1000;

  const filtered = events.filter((event) => {
    const ts = new Date(event.createdAt || event.created_at || 0).getTime();
    return Number.isFinite(ts) && ts >= cutoff;
  });

  const totals = { open: 0, read_more: 0, close: 0 };
  const byProgram = new Map();
  const bySchool = new Map();

  filtered.forEach((event) => {
    const eventType = event.eventType || event.event_type;
    const programName = event.programName || event.program_name;
    const schoolId = event.schoolId || event.school_id;

    if (!EVENT_TYPES.has(eventType)) return;
    totals[eventType] += 1;

    const currentProgram = byProgram.get(programName) || {
      program_name: programName,
      open: 0,
      read_more: 0,
      close: 0,
    };
    currentProgram[eventType] += 1;
    byProgram.set(programName, currentProgram);

    const currentSchool = bySchool.get(schoolId) || {
      school_id: schoolId,
      open: 0,
      read_more: 0,
      close: 0,
    };
    currentSchool[eventType] += 1;
    bySchool.set(schoolId, currentSchool);
  });

  const topPrograms = Array.from(byProgram.values())
    .filter((item) => item.open > 0)
    .sort((a, b) => b.open - a.open || b.read_more - a.read_more)
    .slice(0, maxRows);

  const topSchools = Array.from(bySchool.values())
    .filter((item) => item.open > 0)
    .sort((a, b) => b.open - a.open || b.read_more - a.read_more)
    .slice(0, maxRows);

  return {
    days: lookback,
    totals,
    topPrograms,
    topSchools,
    sampled_events: filtered.length,
  };
};

const recordProgramAnalyticsEvent = async (input) => {
  const event = normalizeEvent(input);
  if (!config.databaseUrl) {
    const current = await readFileEvents();
    current.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      school_id: event.schoolId,
      program_name: event.programName,
      event_type: event.eventType,
      locale: event.locale,
      expanded: event.expanded,
      source: event.source,
      created_at: event.createdAt,
    });
    const trimmed =
      current.length > MAX_FILE_EVENTS
        ? current.slice(current.length - MAX_FILE_EVENTS)
        : current;
    await writeFileEvents(trimmed);
    return { ok: true };
  }

  const db = getPool();
  await ensureProgramAnalyticsTable();
  await db.query(
    `
      INSERT INTO program_analytics_events
      (school_id, program_name, event_type, locale, expanded, source, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `,
    [
      event.schoolId,
      event.programName,
      event.eventType,
      event.locale,
      event.expanded,
      event.source,
    ]
  );
  return { ok: true };
};

const getProgramAnalyticsSummary = async ({ days = 30, limit = 10 } = {}) => {
  const lookback = Math.max(1, Math.min(365, Number(days) || 30));
  const maxRows = Math.max(1, Math.min(50, Number(limit) || 10));

  if (!config.databaseUrl) {
    const events = await readFileEvents();
    return aggregateEvents(events, { days: lookback, limit: maxRows });
  }

  const db = getPool();
  await ensureProgramAnalyticsTable();
  const intervalLiteral = `${lookback} days`;

  const totalsQuery = db.query(
    `
      SELECT
        COUNT(*) FILTER (WHERE event_type = 'open')::INT AS open,
        COUNT(*) FILTER (WHERE event_type = 'read_more')::INT AS read_more,
        COUNT(*) FILTER (WHERE event_type = 'close')::INT AS close
      FROM program_analytics_events
      WHERE created_at >= NOW() - $1::interval
    `,
    [intervalLiteral]
  );

  const topProgramsQuery = db.query(
    `
      SELECT
        program_name,
        COUNT(*) FILTER (WHERE event_type = 'open')::INT AS open,
        COUNT(*) FILTER (WHERE event_type = 'read_more')::INT AS read_more,
        COUNT(*) FILTER (WHERE event_type = 'close')::INT AS close
      FROM program_analytics_events
      WHERE created_at >= NOW() - $1::interval
      GROUP BY program_name
      HAVING COUNT(*) FILTER (WHERE event_type = 'open') > 0
      ORDER BY open DESC, read_more DESC, program_name ASC
      LIMIT $2
    `,
    [intervalLiteral, maxRows]
  );

  const topSchoolsQuery = db.query(
    `
      SELECT
        school_id,
        COUNT(*) FILTER (WHERE event_type = 'open')::INT AS open,
        COUNT(*) FILTER (WHERE event_type = 'read_more')::INT AS read_more,
        COUNT(*) FILTER (WHERE event_type = 'close')::INT AS close
      FROM program_analytics_events
      WHERE created_at >= NOW() - $1::interval
      GROUP BY school_id
      HAVING COUNT(*) FILTER (WHERE event_type = 'open') > 0
      ORDER BY open DESC, read_more DESC, school_id ASC
      LIMIT $2
    `,
    [intervalLiteral, maxRows]
  );

  const sampledQuery = db.query(
    `
      SELECT COUNT(*)::INT AS total
      FROM program_analytics_events
      WHERE created_at >= NOW() - $1::interval
    `,
    [intervalLiteral]
  );

  const [totalsRes, topProgramsRes, topSchoolsRes, sampledRes] = await Promise.all([
    totalsQuery,
    topProgramsQuery,
    topSchoolsQuery,
    sampledQuery,
  ]);

  return {
    days: lookback,
    totals: totalsRes.rows[0] || { open: 0, read_more: 0, close: 0 },
    topPrograms: topProgramsRes.rows || [],
    topSchools: topSchoolsRes.rows || [],
    sampled_events: sampledRes.rows?.[0]?.total || 0,
  };
};

module.exports = {
  recordProgramAnalyticsEvent,
  getProgramAnalyticsSummary,
};
