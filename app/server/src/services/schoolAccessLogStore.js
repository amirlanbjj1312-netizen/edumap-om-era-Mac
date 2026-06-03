const fs = require('fs/promises');
const path = require('path');
const { Pool } = require('pg');

const STORAGE_DIR = path.resolve(__dirname, '../data');
const STORAGE_PATH = path.join(STORAGE_DIR, 'school-access-log.json');
const MAX_ITEMS = 5000;
const ALLOWED_STATUSES = new Set(['создан', 'выдан', 'заполнен']);
const TABLE = 'school_access_log';

let pool = null;
let initPromise = null;
let warnedFallback = false;
let bootstrapPromise = null;

const warnFallback = (reason) => {
  if (warnedFallback) return;
  warnedFallback = true;
  console.warn(`[schoolAccessLogStore] fallback to file storage: ${reason}`);
};

const isSslDbUrl = (databaseUrl) => {
  const value = String(databaseUrl || '').toLowerCase();
  return value.includes('render.com') || value.includes('supabase.co');
};

const getPool = () => {
  if (pool) return pool;
  const databaseUrl = String(process.env.DATABASE_URL || '').trim();
  if (!databaseUrl) return null;
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: isSslDbUrl(databaseUrl) ? { rejectUnauthorized: false } : undefined,
  });
  return pool;
};

const ensurePostgresTable = async () => {
  const pg = getPool();
  if (!pg) return false;
  if (!initPromise) {
    initPromise = pg.query(
      `
        create table if not exists ${TABLE} (
          id text primary key,
          email text not null,
          password text not null default '',
          school_id text not null default '',
          created_at timestamptz not null default now(),
          actor text not null default '',
          status text not null default 'создан',
          updated_at timestamptz not null default now(),
          constraint school_access_log_status_check
            check (status in ('создан', 'выдан', 'заполнен'))
        );
        create index if not exists idx_school_access_log_created_at
          on ${TABLE} (created_at desc);
      `
    );
  }
  try {
    await initPromise;
    return true;
  } catch (error) {
    initPromise = null;
    warnFallback(error?.message || 'postgres init failed');
    return false;
  }
};

const ensureStorageDir = async () => {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
};

const normalizeLogItem = (value = {}) => ({
  id: String(value.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).trim(),
  email: String(value.email || '').trim().toLowerCase(),
  password: String(value.password || ''),
  schoolId: String(value.schoolId || value.school_id || '').trim(),
  createdAt: String(value.createdAt || value.created_at || new Date().toISOString()),
  actor: String(value.actor || '').trim(),
  status: ALLOWED_STATUSES.has(String(value.status || '').trim().toLowerCase())
    ? String(value.status || '').trim().toLowerCase()
    : 'создан',
});

const isPlaceholderSchoolId = (schoolId = '') => {
  const value = String(schoolId || '').trim().toLowerCase();
  return !value || value.startsWith('school-astana.private');
};

const chooseBetterLogItem = (current, candidate) => {
  const currentScore =
    (current?.password ? 1 : 0) + (isPlaceholderSchoolId(current?.schoolId) ? 0 : 1);
  const candidateScore =
    (candidate?.password ? 1 : 0) + (isPlaceholderSchoolId(candidate?.schoolId) ? 0 : 1);
  if (candidateScore > currentScore) return candidate;
  if (candidateScore < currentScore) return current;
  const currentTs = new Date(current?.createdAt || 0).getTime();
  const candidateTs = new Date(candidate?.createdAt || 0).getTime();
  if (Number.isFinite(candidateTs) && Number.isFinite(currentTs) && candidateTs > currentTs) {
    return candidate;
  }
  return current;
};

const dedupeByEmail = (items = []) => {
  const map = new Map();
  for (const rawItem of items) {
    const item = normalizeLogItem(rawItem);
    const key = item.email;
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, item);
      continue;
    }
    map.set(key, chooseBetterLogItem(map.get(key), item));
  }
  return [...map.values()]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, MAX_ITEMS);
};

const readSchoolAccessLogFile = async () => {
  try {
    await ensureStorageDir();
    const raw = await fs.readFile(STORAGE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return dedupeByEmail(
      parsed
      .map((item) => normalizeLogItem(item))
      .filter((item) => item.id && item.email)
      .slice(0, MAX_ITEMS)
    );
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
};

const writeSchoolAccessLogFile = async (items = []) => {
  await ensureStorageDir();
  await fs.writeFile(STORAGE_PATH, JSON.stringify(dedupeByEmail(items), null, 2));
};

const bootstrapFromFileToPostgres = async () => {
  const postgresReady = await ensurePostgresTable();
  if (!postgresReady) return false;
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const pg = getPool();
      const countResult = await pg.query(`select count(*)::int as count from ${TABLE}`);
      const count = Number(countResult.rows?.[0]?.count || 0);
      if (count > 0) return true;
      const fileItems = await readSchoolAccessLogFile();
      if (!fileItems.length) return true;
      for (const item of fileItems) {
        const row = normalizeLogItem(item);
        await pg.query(
          `
            insert into ${TABLE} (id, email, password, school_id, created_at, actor, status, updated_at)
            values ($1, $2, $3, $4, $5::timestamptz, $6, $7, now())
            on conflict (id) do nothing
          `,
          [row.id, row.email, row.password, row.schoolId, row.createdAt, row.actor, row.status]
        );
      }
      return true;
    })();
  }
  try {
    await bootstrapPromise;
    return true;
  } catch (error) {
    warnFallback(error?.message || 'postgres bootstrap failed');
    return false;
  }
};

const readSchoolAccessLog = async () => {
  const postgresReady = await bootstrapFromFileToPostgres();
  if (!postgresReady) return readSchoolAccessLogFile();
  try {
    const pg = getPool();
    const { rows } = await pg.query(
      `
        select id, email, password, school_id, created_at, actor, status
        from ${TABLE}
        order by created_at desc
        limit $1
      `,
      [MAX_ITEMS]
    );
    const normalized = rows.map((row) => normalizeLogItem(row));
    const deduped = dedupeByEmail(normalized);
    if (deduped.length !== normalized.length) {
      const pg = getPool();
      await pg.query('begin');
      try {
        await pg.query(`delete from ${TABLE}`);
        for (const row of deduped) {
          await pg.query(
            `
              insert into ${TABLE} (id, email, password, school_id, created_at, actor, status, updated_at)
              values ($1, $2, $3, $4, $5::timestamptz, $6, $7, now())
            `,
            [
              row.id,
              row.email,
              row.password,
              row.schoolId,
              row.createdAt,
              row.actor,
              row.status,
            ]
          );
        }
        await pg.query('commit');
      } catch (error) {
        await pg.query('rollback');
        throw error;
      }
    }
    return deduped;
  } catch (error) {
    warnFallback(error?.message || 'postgres read failed');
    return readSchoolAccessLogFile();
  }
};

const appendSchoolAccessLog = async (entry = {}) => {
  const normalized = normalizeLogItem(entry);
  const postgresReady = await ensurePostgresTable();
  if (postgresReady) {
    try {
      const pg = getPool();
      const existing = await pg.query(
        `
          select id, email, password, school_id, created_at, actor, status
          from ${TABLE}
          where lower(email) = lower($1)
          order by created_at desc
          limit 1
        `,
        [normalized.email]
      );
      if (existing.rows?.length) {
        const chosen = chooseBetterLogItem(normalizeLogItem(existing.rows[0]), normalized);
        await pg.query(
          `
            update ${TABLE}
            set email = $2,
                password = $3,
                school_id = $4,
                created_at = $5::timestamptz,
                actor = $6,
                status = $7,
                updated_at = now()
            where id = $1
          `,
          [
            existing.rows[0].id,
            chosen.email,
            chosen.password,
            chosen.schoolId,
            chosen.createdAt,
            chosen.actor,
            chosen.status,
          ]
        );
      } else {
        await pg.query(
          `
            insert into ${TABLE} (id, email, password, school_id, created_at, actor, status, updated_at)
            values ($1, $2, $3, $4, $5::timestamptz, $6, $7, now())
          `,
          [
            normalized.id,
            normalized.email,
            normalized.password,
            normalized.schoolId,
            normalized.createdAt,
            normalized.actor,
            normalized.status,
          ]
        );
      }
      return readSchoolAccessLog();
    } catch (error) {
      warnFallback(error?.message || 'postgres append failed');
    }
  }
  const current = await readSchoolAccessLogFile();
  const next = dedupeByEmail([normalized, ...current]).slice(0, MAX_ITEMS);
  await writeSchoolAccessLogFile(next);
  return next;
};

const clearSchoolAccessLog = async () => {
  const postgresReady = await ensurePostgresTable();
  if (postgresReady) {
    try {
      const pg = getPool();
      await pg.query(`delete from ${TABLE}`);
      return [];
    } catch (error) {
      warnFallback(error?.message || 'postgres clear failed');
    }
  }
  await writeSchoolAccessLogFile([]);
  return [];
};

const upsertSchoolAccessLogEntry = async (entry = {}) => {
  const normalized = normalizeLogItem(entry);
  const postgresReady = await ensurePostgresTable();
  if (postgresReady) {
    try {
      const pg = getPool();
      const { rows } = await pg.query(
        `
          insert into ${TABLE} (id, email, password, school_id, created_at, actor, status, updated_at)
          values ($1, $2, $3, $4, $5::timestamptz, $6, $7, now())
          on conflict (id) do update set
            email = excluded.email,
            password = excluded.password,
            school_id = excluded.school_id,
            created_at = excluded.created_at,
            actor = excluded.actor,
            status = excluded.status,
            updated_at = now()
          returning id, email, password, school_id, created_at, actor, status
        `,
        [
          normalized.id,
          normalized.email,
          normalized.password,
          normalized.schoolId,
          normalized.createdAt,
          normalized.actor,
          normalized.status,
        ]
      );
      return normalizeLogItem(rows[0] || normalized);
    } catch (error) {
      warnFallback(error?.message || 'postgres upsert failed');
    }
  }
  const current = await readSchoolAccessLogFile();
  const index = current.findIndex((item) => item.id === normalized.id);
  if (index === -1) {
    const next = [normalized, ...current].slice(0, MAX_ITEMS);
    await writeSchoolAccessLogFile(next);
    return normalized;
  }
  const updated = { ...current[index], ...normalized };
  const next = [...current];
  next[index] = updated;
  await writeSchoolAccessLogFile(next);
  return updated;
};

const updateSchoolAccessLogStatus = async (id, status) => {
  const targetId = String(id || '').trim();
  const nextStatus = String(status || '').trim().toLowerCase();
  if (!targetId) return null;
  if (!ALLOWED_STATUSES.has(nextStatus)) return null;

  const postgresReady = await ensurePostgresTable();
  if (postgresReady) {
    try {
      const pg = getPool();
      const { rows } = await pg.query(
        `
          update ${TABLE}
          set status = $2, updated_at = now()
          where id = $1
          returning id, email, password, school_id, created_at, actor, status
        `,
        [targetId, nextStatus]
      );
      if (!rows.length) return null;
      return normalizeLogItem(rows[0]);
    } catch (error) {
      warnFallback(error?.message || 'postgres update status failed');
    }
  }

  const current = await readSchoolAccessLogFile();
  const index = current.findIndex((item) => item.id === targetId);
  if (index === -1) return null;
  const updated = { ...current[index], status: nextStatus };
  const next = [...current];
  next[index] = updated;
  await writeSchoolAccessLogFile(next);
  return updated;
};

const deleteSchoolAccessLogEntry = async (id) => {
  const targetId = String(id || '').trim();
  if (!targetId) return false;

  const postgresReady = await ensurePostgresTable();
  if (postgresReady) {
    try {
      const pg = getPool();
      const result = await pg.query(`delete from ${TABLE} where id = $1`, [targetId]);
      return (result.rowCount || 0) > 0;
    } catch (error) {
      warnFallback(error?.message || 'postgres delete failed');
    }
  }

  const current = await readSchoolAccessLogFile();
  const next = current.filter((item) => item.id !== targetId);
  if (next.length === current.length) return false;
  await writeSchoolAccessLogFile(next);
  return true;
};

module.exports = {
  readSchoolAccessLog,
  appendSchoolAccessLog,
  clearSchoolAccessLog,
  updateSchoolAccessLogStatus,
  upsertSchoolAccessLogEntry,
  deleteSchoolAccessLogEntry,
  ALLOWED_STATUSES,
};
