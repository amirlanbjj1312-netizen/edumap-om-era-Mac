const fs = require('fs/promises');
const path = require('path');
const { buildConfig } = require('../utils/config');
const { getPool, ensureEngagementAnalyticsTables } = require('./db');

const config = buildConfig();
const STORAGE_DIR = path.resolve(__dirname, '../data');
const STORAGE_PATH = path.join(STORAGE_DIR, 'engagement-analytics.json');
const MAX_FILE_EVENTS = 100000;

const EVENT_TYPE_LIST = [
  'school_card_view',
  'compare_add',
  'favorite_add',
  'school_map_open',
  'contact_phone_click',
  'contact_whatsapp_click',
  'contact_website_click',
  'price_open',
  'admission_open',
  'ai_school_mention',
  'ai_match_run',
  'ai_chat_open',
  'ai_chat_message',
  'guest_gate_click',
];

const EVENT_TYPES = new Set(EVENT_TYPE_LIST);

const ensureStorage = async () => {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
};

const readState = async () => {
  try {
    await ensureStorage();
    const raw = await fs.readFile(STORAGE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return { events: parsed, resetAt: null };
    }
    return {
      events: Array.isArray(parsed?.events) ? parsed.events : [],
      resetAt: parsed?.resetAt ? String(parsed.resetAt) : null,
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { events: [], resetAt: null };
    }
    throw error;
  }
};

const writeState = async (state) => {
  await ensureStorage();
  await fs.writeFile(STORAGE_PATH, JSON.stringify(state, null, 2));
};

const cleanString = (value, maxLength = 160) =>
  String(value || '')
    .trim()
    .slice(0, maxLength);

const normalizeLocale = (value) => {
  const locale = cleanString(value, 10).toLowerCase();
  if (!locale) return null;
  return ['ru', 'kk', 'en'].includes(locale) ? locale : null;
};

const normalizeEvent = (input) => {
  const eventType = cleanString(input?.eventType, 40);
  if (!EVENT_TYPES.has(eventType)) {
    throw new Error('Invalid eventType');
  }
  const actorType = cleanString(input?.actorType, 16) === 'auth' ? 'auth' : 'guest';
  const schoolId = cleanString(input?.schoolId, 120) || null;
  const source = cleanString(input?.source, 40) || 'parent_web';
  const actorUserId = cleanString(input?.actorUserId, 120) || null;
  return {
    eventType,
    schoolId,
    actorType,
    actorUserId,
    locale: normalizeLocale(input?.locale),
    source,
    metadata: input?.metadata && typeof input.metadata === 'object' ? input.metadata : {},
    createdAt: new Date().toISOString(),
  };
};

const pickCutoff = (days, resetAt) => {
  const lookback = Math.max(1, Math.min(365, Number(days) || 30));
  const lookbackTs = Date.now() - lookback * 24 * 60 * 60 * 1000;
  const resetTs = resetAt ? new Date(resetAt).getTime() : 0;
  const cutoffTs = Math.max(lookbackTs, Number.isFinite(resetTs) ? resetTs : 0);
  return {
    days: lookback,
    cutoffTs,
  };
};

const buildEmptyTotals = () => ({
  all: 0,
  guest: 0,
  auth: 0,
});

const createTimelineRow = (date) => ({
  date,
  school_card_view: 0,
  compare_add: 0,
  favorite_add: 0,
  school_map_open: 0,
  contact_phone_click: 0,
  contact_whatsapp_click: 0,
  contact_website_click: 0,
  price_open: 0,
  admission_open: 0,
  ai_school_mention: 0,
  ai_match_run: 0,
  ai_chat_open: 0,
  ai_chat_message: 0,
  guest_gate_click: 0,
});

const buildSchoolTotals = () => ({
  school_card_view: 0,
  unique_auth_parents: 0,
  compare_add: 0,
  favorite_add: 0,
  school_map_open: 0,
  contact_phone_click: 0,
  contact_whatsapp_click: 0,
  contact_website_click: 0,
  contact_click_total: 0,
  price_open: 0,
  admission_open: 0,
  ai_school_mention: 0,
});

const aggregateEvents = (events, { days = 30, limit = 10, resetAt = null } = {}) => {
  const maxRows = Math.max(1, Math.min(50, Number(limit) || 10));
  const { days: lookback, cutoffTs } = pickCutoff(days, resetAt);
  const filtered = events.filter((event) => {
    const ts = new Date(event.createdAt || event.created_at || 0).getTime();
    const actorType = event.actorType || event.actor_type;
    return Number.isFinite(ts) && ts >= cutoffTs && actorType === 'auth';
  });

  const totalsByType = {};
  const topSchoolsMap = new Map();
  const timelineMap = new Map();

  for (const event of filtered) {
    const eventType = event.eventType || event.event_type;
    if (!EVENT_TYPES.has(eventType)) continue;
    const actorType = 'auth';
    const schoolId = cleanString(event.schoolId || event.school_id, 120) || null;
    const dayKey = new Date(event.createdAt || event.created_at || Date.now())
      .toISOString()
      .slice(0, 10);

    if (!totalsByType[eventType]) {
      totalsByType[eventType] = buildEmptyTotals();
    }
    totalsByType[eventType].all += 1;
    totalsByType[eventType][actorType] += 1;

    if (!timelineMap.has(dayKey)) {
      timelineMap.set(dayKey, createTimelineRow(dayKey));
    }
    timelineMap.get(dayKey)[eventType] += 1;

    if (schoolId) {
      const row = topSchoolsMap.get(schoolId) || {
        school_id: schoolId,
        views: 0,
        compare_adds: 0,
        guest_views: 0,
        auth_views: 0,
      };
      if (eventType === 'school_card_view') {
        row.views += 1;
        if (actorType === 'guest') row.guest_views += 1;
        if (actorType === 'auth') row.auth_views += 1;
      }
      if (eventType === 'compare_add') {
        row.compare_adds += 1;
      }
      topSchoolsMap.set(schoolId, row);
    }
  }

  const topEvents = EVENT_TYPE_LIST.map((eventType) => ({
    event_type: eventType,
    ...(totalsByType[eventType] || buildEmptyTotals()),
  }));

  const topSchools = Array.from(topSchoolsMap.values())
    .filter((row) => row.views > 0 || row.compare_adds > 0)
    .sort((a, b) => b.views - a.views || b.compare_adds - a.compare_adds || a.school_id.localeCompare(b.school_id))
    .slice(0, maxRows);

  const timeline = Array.from(timelineMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  return {
    days: lookback,
    reset_at: resetAt,
    sampled_events: filtered.length,
    topEvents,
    topSchools,
    timeline,
  };
};

const aggregateSchoolEvents = (events, { schoolId, days = 30, resetAt = null } = {}) => {
  const normalizedSchoolId = cleanString(schoolId, 120);
  if (!normalizedSchoolId) {
    return {
      mode: 'school',
      school_id: '',
      days: Math.max(1, Math.min(365, Number(days) || 30)),
      reset_at: resetAt,
      sampled_events: 0,
      unique_auth_parents: 0,
      totals: buildSchoolTotals(),
      topEvents: EVENT_TYPE_LIST.map((eventType) => ({
        event_type: eventType,
        ...buildEmptyTotals(),
      })),
      timeline: [],
    };
  }

  const { days: lookback, cutoffTs } = pickCutoff(days, resetAt);
  const filtered = events.filter((event) => {
    const ts = new Date(event.createdAt || event.created_at || 0).getTime();
    const actorType = event.actorType || event.actor_type;
    const eventSchoolId = cleanString(event.schoolId || event.school_id, 120);
    return (
      Number.isFinite(ts) &&
      ts >= cutoffTs &&
      actorType === 'auth' &&
      eventSchoolId === normalizedSchoolId
    );
  });

  const totalsByType = {};
  const timelineMap = new Map();
  const actorIds = new Set();

  for (const event of filtered) {
    const eventType = event.eventType || event.event_type;
    if (!EVENT_TYPES.has(eventType)) continue;
    const actorUserId = cleanString(event.actorUserId || event.actor_user_id, 120);
    const dayKey = new Date(event.createdAt || event.created_at || Date.now())
      .toISOString()
      .slice(0, 10);

    if (!totalsByType[eventType]) {
      totalsByType[eventType] = buildEmptyTotals();
    }
    totalsByType[eventType].all += 1;
    totalsByType[eventType].auth += 1;

    if (!timelineMap.has(dayKey)) {
      timelineMap.set(dayKey, createTimelineRow(dayKey));
    }
    timelineMap.get(dayKey)[eventType] += 1;

    if (actorUserId) actorIds.add(actorUserId);
  }

  const totals = buildSchoolTotals();
  Object.keys(totals).forEach((key) => {
    if (key === 'unique_auth_parents' || key === 'contact_click_total') return;
    totals[key] = Number(totalsByType[key]?.all || 0);
  });
  totals.unique_auth_parents = actorIds.size;
  totals.contact_click_total =
    totals.contact_phone_click + totals.contact_whatsapp_click + totals.contact_website_click;

  return {
    mode: 'school',
    school_id: normalizedSchoolId,
    days: lookback,
    reset_at: resetAt,
    sampled_events: filtered.length,
    unique_auth_parents: actorIds.size,
    totals,
    topEvents: EVENT_TYPE_LIST.map((eventType) => ({
      event_type: eventType,
      ...(totalsByType[eventType] || buildEmptyTotals()),
    })),
    timeline: Array.from(timelineMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
  };
};

const recordEngagementAnalyticsEvent = async (input) => {
  const event = normalizeEvent(input);
  if (!config.databaseUrl) {
    const state = await readState();
    const nextEvents = [
      ...state.events,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        event_type: event.eventType,
        school_id: event.schoolId,
        actor_type: event.actorType,
        actor_user_id: event.actorUserId,
        locale: event.locale,
        source: event.source,
        metadata: event.metadata,
        created_at: event.createdAt,
      },
    ];
    const trimmed =
      nextEvents.length > MAX_FILE_EVENTS
        ? nextEvents.slice(nextEvents.length - MAX_FILE_EVENTS)
        : nextEvents;
    await writeState({ events: trimmed, resetAt: state.resetAt });
    return { ok: true };
  }

  const db = getPool();
  await ensureEngagementAnalyticsTables();
  await db.query(
    `
      INSERT INTO engagement_analytics_events
      (event_type, school_id, actor_type, actor_user_id, locale, source, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
    `,
    [
      event.eventType,
      event.schoolId,
      event.actorType,
      event.actorUserId,
      event.locale,
      event.source,
      JSON.stringify(event.metadata || {}),
    ]
  );
  return { ok: true };
};

const getLastResetAt = async () => {
  if (!config.databaseUrl) {
    const state = await readState();
    return state.resetAt || null;
  }
  const db = getPool();
  await ensureEngagementAnalyticsTables();
  const result = await db.query(`
    SELECT reset_at
    FROM engagement_analytics_resets
    ORDER BY reset_at DESC
    LIMIT 1
  `);
  return result.rows[0]?.reset_at || null;
};

const getEngagementAnalyticsSummary = async ({ days = 30, limit = 10 } = {}) => {
  const resetAt = await getLastResetAt();
  if (!config.databaseUrl) {
    const state = await readState();
    return aggregateEvents(state.events, { days, limit, resetAt: state.resetAt || resetAt });
  }

  const db = getPool();
  await ensureEngagementAnalyticsTables();
  const { days: lookback, cutoffTs } = pickCutoff(days, resetAt);
  const cutoffIso = new Date(cutoffTs).toISOString();
  const maxRows = Math.max(1, Math.min(50, Number(limit) || 10));

  const [topEventsRes, topSchoolsRes, timelineRes, sampledRes] = await Promise.all([
    db.query(
      `
        SELECT
          event_type,
          COUNT(*)::INT AS all,
          0::INT AS guest,
          COUNT(*) FILTER (WHERE actor_type = 'auth')::INT AS auth
        FROM engagement_analytics_events
        WHERE created_at >= $1::timestamptz
          AND actor_type = 'auth'
        GROUP BY event_type
      `,
      [cutoffIso]
    ),
    db.query(
      `
        SELECT
          school_id,
          COUNT(*) FILTER (WHERE event_type = 'school_card_view')::INT AS views,
          COUNT(*) FILTER (WHERE event_type = 'compare_add')::INT AS compare_adds,
          0::INT AS guest_views,
          COUNT(*) FILTER (WHERE event_type = 'school_card_view' AND actor_type = 'auth')::INT AS auth_views
        FROM engagement_analytics_events
        WHERE created_at >= $1::timestamptz
          AND actor_type = 'auth'
          AND school_id IS NOT NULL
        GROUP BY school_id
        HAVING COUNT(*) FILTER (WHERE event_type = 'school_card_view') > 0
           OR COUNT(*) FILTER (WHERE event_type = 'compare_add') > 0
        ORDER BY views DESC, compare_adds DESC, school_id ASC
        LIMIT $2
      `,
      [cutoffIso, maxRows]
    ),
    db.query(
      `
        SELECT
          TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS date,
          COUNT(*) FILTER (WHERE event_type = 'school_card_view')::INT AS school_card_view,
          COUNT(*) FILTER (WHERE event_type = 'compare_add')::INT AS compare_add,
          COUNT(*) FILTER (WHERE event_type = 'ai_match_run')::INT AS ai_match_run,
          COUNT(*) FILTER (WHERE event_type = 'ai_chat_open')::INT AS ai_chat_open,
          COUNT(*) FILTER (WHERE event_type = 'ai_chat_message')::INT AS ai_chat_message,
          COUNT(*) FILTER (WHERE event_type = 'guest_gate_click')::INT AS guest_gate_click
        FROM engagement_analytics_events
        WHERE created_at >= $1::timestamptz
          AND actor_type = 'auth'
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY DATE_TRUNC('day', created_at) ASC
      `,
      [cutoffIso]
    ),
    db.query(
      `
        SELECT COUNT(*)::INT AS total
        FROM engagement_analytics_events
        WHERE created_at >= $1::timestamptz
          AND actor_type = 'auth'
      `,
      [cutoffIso]
    ),
  ]);

  const topEventsMap = new Map(
    topEventsRes.rows.map((row) => [
      row.event_type,
      {
        event_type: row.event_type,
        all: Number(row.all || 0),
        guest: Number(row.guest || 0),
        auth: Number(row.auth || 0),
      },
    ])
  );

  return {
    days: lookback,
    reset_at: resetAt,
    sampled_events: Number(sampledRes.rows[0]?.total || 0),
    topEvents: EVENT_TYPE_LIST.map((eventType) => ({
      event_type: eventType,
      ...(topEventsMap.get(eventType) || buildEmptyTotals()),
    })),
    topSchools: topSchoolsRes.rows.map((row) => ({
      school_id: row.school_id,
      views: Number(row.views || 0),
      compare_adds: Number(row.compare_adds || 0),
      guest_views: Number(row.guest_views || 0),
      auth_views: Number(row.auth_views || 0),
    })),
    timeline: timelineRes.rows.map((row) => ({
      date: row.date,
      school_card_view: Number(row.school_card_view || 0),
      compare_add: Number(row.compare_add || 0),
      ai_match_run: Number(row.ai_match_run || 0),
      ai_chat_open: Number(row.ai_chat_open || 0),
      ai_chat_message: Number(row.ai_chat_message || 0),
      guest_gate_click: Number(row.guest_gate_click || 0),
    })),
  };
};

const getSchoolEngagementAnalyticsSummary = async ({ schoolId, days = 30 } = {}) => {
  const resetAt = await getLastResetAt();
  const normalizedSchoolId = cleanString(schoolId, 120);
  if (!config.databaseUrl) {
    const state = await readState();
    return aggregateSchoolEvents(state.events, {
      schoolId: normalizedSchoolId,
      days,
      resetAt: state.resetAt || resetAt,
    });
  }

  const db = getPool();
  await ensureEngagementAnalyticsTables();
  const { days: lookback, cutoffTs } = pickCutoff(days, resetAt);
  const cutoffIso = new Date(cutoffTs).toISOString();

  const [topEventsRes, timelineRes, sampledRes, uniqueRes] = await Promise.all([
    db.query(
      `
        SELECT
          event_type,
          COUNT(*)::INT AS all,
          0::INT AS guest,
          COUNT(*) FILTER (WHERE actor_type = 'auth')::INT AS auth
        FROM engagement_analytics_events
        WHERE created_at >= $1::timestamptz
          AND actor_type = 'auth'
          AND school_id = $2
        GROUP BY event_type
      `,
      [cutoffIso, normalizedSchoolId]
    ),
    db.query(
      `
        SELECT
          TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS date,
          COUNT(*) FILTER (WHERE event_type = 'school_card_view')::INT AS school_card_view,
          COUNT(*) FILTER (WHERE event_type = 'compare_add')::INT AS compare_add,
          COUNT(*) FILTER (WHERE event_type = 'favorite_add')::INT AS favorite_add,
          COUNT(*) FILTER (WHERE event_type = 'school_map_open')::INT AS school_map_open,
          COUNT(*) FILTER (WHERE event_type = 'contact_phone_click')::INT AS contact_phone_click,
          COUNT(*) FILTER (WHERE event_type = 'contact_whatsapp_click')::INT AS contact_whatsapp_click,
          COUNT(*) FILTER (WHERE event_type = 'contact_website_click')::INT AS contact_website_click,
          COUNT(*) FILTER (WHERE event_type = 'price_open')::INT AS price_open,
          COUNT(*) FILTER (WHERE event_type = 'admission_open')::INT AS admission_open,
          COUNT(*) FILTER (WHERE event_type = 'ai_school_mention')::INT AS ai_school_mention,
          COUNT(*) FILTER (WHERE event_type = 'ai_match_run')::INT AS ai_match_run,
          COUNT(*) FILTER (WHERE event_type = 'ai_chat_open')::INT AS ai_chat_open,
          COUNT(*) FILTER (WHERE event_type = 'ai_chat_message')::INT AS ai_chat_message,
          COUNT(*) FILTER (WHERE event_type = 'guest_gate_click')::INT AS guest_gate_click
        FROM engagement_analytics_events
        WHERE created_at >= $1::timestamptz
          AND actor_type = 'auth'
          AND school_id = $2
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY DATE_TRUNC('day', created_at) ASC
      `,
      [cutoffIso, normalizedSchoolId]
    ),
    db.query(
      `
        SELECT COUNT(*)::INT AS total
        FROM engagement_analytics_events
        WHERE created_at >= $1::timestamptz
          AND actor_type = 'auth'
          AND school_id = $2
      `,
      [cutoffIso, normalizedSchoolId]
    ),
    db.query(
      `
        SELECT COUNT(DISTINCT actor_user_id)::INT AS unique_auth_parents
        FROM engagement_analytics_events
        WHERE created_at >= $1::timestamptz
          AND actor_type = 'auth'
          AND school_id = $2
          AND actor_user_id IS NOT NULL
      `,
      [cutoffIso, normalizedSchoolId]
    ),
  ]);

  const topEventsMap = new Map(
    topEventsRes.rows.map((row) => [
      row.event_type,
      {
        event_type: row.event_type,
        all: Number(row.all || 0),
        guest: Number(row.guest || 0),
        auth: Number(row.auth || 0),
      },
    ])
  );

  const totals = buildSchoolTotals();
  EVENT_TYPE_LIST.forEach((eventType) => {
    if (eventType in totals) {
      totals[eventType] = Number(topEventsMap.get(eventType)?.all || 0);
    }
  });
  totals.unique_auth_parents = Number(uniqueRes.rows[0]?.unique_auth_parents || 0);
  totals.contact_click_total =
    totals.contact_phone_click + totals.contact_whatsapp_click + totals.contact_website_click;

  return {
    mode: 'school',
    school_id: normalizedSchoolId,
    days: lookback,
    reset_at: resetAt,
    sampled_events: Number(sampledRes.rows[0]?.total || 0),
    unique_auth_parents: totals.unique_auth_parents,
    totals,
    topEvents: EVENT_TYPE_LIST.map((eventType) => ({
      event_type: eventType,
      ...(topEventsMap.get(eventType) || buildEmptyTotals()),
    })),
    timeline: timelineRes.rows.map((row) => ({
      date: row.date,
      school_card_view: Number(row.school_card_view || 0),
      compare_add: Number(row.compare_add || 0),
      favorite_add: Number(row.favorite_add || 0),
      school_map_open: Number(row.school_map_open || 0),
      contact_phone_click: Number(row.contact_phone_click || 0),
      contact_whatsapp_click: Number(row.contact_whatsapp_click || 0),
      contact_website_click: Number(row.contact_website_click || 0),
      price_open: Number(row.price_open || 0),
      admission_open: Number(row.admission_open || 0),
      ai_school_mention: Number(row.ai_school_mention || 0),
      ai_match_run: Number(row.ai_match_run || 0),
      ai_chat_open: Number(row.ai_chat_open || 0),
      ai_chat_message: Number(row.ai_chat_message || 0),
      guest_gate_click: Number(row.guest_gate_click || 0),
    })),
  };
};

const resetEngagementAnalytics = async ({ actorEmail } = {}) => {
  const resetAt = new Date().toISOString();
  if (!config.databaseUrl) {
    const state = await readState();
    await writeState({ events: state.events, resetAt });
    return { ok: true, resetAt };
  }

  const db = getPool();
  await ensureEngagementAnalyticsTables();
  await db.query(
    `
      INSERT INTO engagement_analytics_resets (actor_email, reset_at)
      VALUES ($1, NOW())
    `,
    [cleanString(actorEmail, 160) || null]
  );
  return { ok: true, resetAt };
};

module.exports = {
  recordEngagementAnalyticsEvent,
  getEngagementAnalyticsSummary,
  getSchoolEngagementAnalyticsSummary,
  resetEngagementAnalytics,
};
