const fs = require('fs/promises');
const path = require('path');
const { buildConfig } = require('../utils/config');
const { getPool, ensureSchoolsTable } = require('./db');

const config = buildConfig();
const STORAGE_DIR = path.resolve(__dirname, '../data');
const STORAGE_PATH = path.join(STORAGE_DIR, 'schools.json');
const CACHE_TTL_MS = 60 * 1000;
const listCache = new Map();
const schoolCache = new Map();

const ensureStorage = async () => {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
};

const readFileStore = async () => {
  try {
    await ensureStorage();
    const raw = await fs.readFile(STORAGE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
};

const writeFileStore = async (schools) => {
  await ensureStorage();
  await fs.writeFile(STORAGE_PATH, JSON.stringify(schools, null, 2));
};

const now = () => Date.now();

const getCacheValue = (store, key) => {
  const hit = store.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= now()) {
    store.delete(key);
    return null;
  }
  return hit.value;
};

const setCacheValue = (store, key, value) => {
  store.set(key, { value, expiresAt: now() + CACHE_TTL_MS });
  return value;
};

const clearSchoolCaches = () => {
  listCache.clear();
  schoolCache.clear();
};

const toBooleanFlag = (value, fallback) => {
  if (value == null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

const toText = (value) => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    const picked = value.ru ?? value.kk ?? value.en;
    if (typeof picked === 'string') return picked.trim();
    if (typeof picked === 'number') return String(picked);
  }
  return '';
};

const normalizeString = (value) => String(value || '').trim().toLowerCase();

const matchesSchoolFilters = (profile, options = {}) => {
  const includeInactive = toBooleanFlag(options.includeInactive, false);
  const includeHidden = toBooleanFlag(options.includeHidden, false);
  const isActive = profile?.system?.is_active !== false;
  const isVisible = profile?.system?.hidden_from_users !== true;
  if (!includeInactive && !isActive) return false;
  if (!includeHidden && !isVisible) return false;

  const city = normalizeString(options.city);
  const district = normalizeString(options.district);
  const type = normalizeString(options.type);
  const subtype = normalizeString(options.subtype);
  const q = normalizeString(options.q);

  if (city && normalizeString(profile?.basic_info?.city) !== city) return false;
  if (district && normalizeString(profile?.basic_info?.district) !== district) return false;
  if (type && normalizeString(profile?.basic_info?.type) !== type) return false;
  if (subtype && normalizeString(profile?.basic_info?.school_subtype) !== subtype) return false;

  if (q) {
    const haystack = [
      profile?.school_id,
      profile?.basic_info?.display_name,
      profile?.basic_info?.brand_name,
      profile?.basic_info?.short_name,
      profile?.basic_info?.name,
      profile?.basic_info?.city,
      profile?.basic_info?.district,
      profile?.basic_info?.address,
      profile?.basic_info?.type,
      profile?.basic_info?.school_subtype,
    ]
      .map((item) => normalizeString(toText(item)))
      .join(' ');
    if (!haystack.includes(q)) return false;
  }

  return true;
};

const buildCacheKey = (prefix, options = {}) =>
  `${prefix}:${JSON.stringify({
    includeInactive: toBooleanFlag(options.includeInactive, false),
    includeHidden: toBooleanFlag(options.includeHidden, false),
    city: normalizeString(options.city),
    district: normalizeString(options.district),
    type: normalizeString(options.type),
    subtype: normalizeString(options.subtype),
    q: normalizeString(options.q),
    limit: Number(options.limit) || 0,
    offset: Number(options.offset) || 0,
    schoolId: String(options.schoolId || '').trim(),
  })}`;

const readStore = async () => {
  if (!config.databaseUrl) {
    return readFileStore();
  }
  const db = getPool();
  await ensureSchoolsTable();
  const { rows } = await db.query('SELECT profile FROM schools ORDER BY updated_at DESC');
  return rows.map((row) => row.profile);
};

const listSchools = async (options = {}) => {
  const limitRaw = Number(options.limit);
  const offsetRaw = Number(options.offset);
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(100, Math.floor(limitRaw)) : 0;
  const offset =
    Number.isFinite(offsetRaw) && offsetRaw >= 0 ? Math.floor(offsetRaw) : 0;
  const cacheKey = buildCacheKey('list', { ...options, limit, offset });
  const cached = getCacheValue(listCache, cacheKey);
  if (cached) return cached;

  if (!config.databaseUrl) {
    const items = (await readFileStore()).filter((profile) => matchesSchoolFilters(profile, options));
    const total = items.length;
    const data = limit ? items.slice(offset, offset + limit) : items;
    return setCacheValue(listCache, cacheKey, { data, total, limit, offset });
  }

  const db = getPool();
  await ensureSchoolsTable();

  const values = [];
  const where = [];
  const push = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (!toBooleanFlag(options.includeInactive, false)) {
    where.push(`COALESCE((profile->'system'->>'is_active')::boolean, true) = true`);
  }
  if (!toBooleanFlag(options.includeHidden, false)) {
    where.push(`COALESCE((profile->'system'->>'hidden_from_users')::boolean, false) = false`);
  }
  if (normalizeString(options.city)) {
    where.push(`LOWER(COALESCE(profile->'basic_info'->>'city', '')) = ${push(normalizeString(options.city))}`);
  }
  if (normalizeString(options.district)) {
    where.push(`LOWER(COALESCE(profile->'basic_info'->>'district', '')) = ${push(normalizeString(options.district))}`);
  }
  if (normalizeString(options.type)) {
    where.push(`LOWER(COALESCE(profile->'basic_info'->>'type', '')) = ${push(normalizeString(options.type))}`);
  }
  if (normalizeString(options.subtype)) {
    where.push(`LOWER(COALESCE(profile->'basic_info'->>'school_subtype', '')) = ${push(normalizeString(options.subtype))}`);
  }
  if (normalizeString(options.q)) {
    const qLike = `%${normalizeString(options.q)}%`;
    const slot = push(qLike);
    where.push(`(
      LOWER(COALESCE(school_id, '')) LIKE ${slot}
      OR LOWER(COALESCE(profile->'basic_info'->>'display_name', '')) LIKE ${slot}
      OR LOWER(COALESCE(profile->'basic_info'->>'brand_name', '')) LIKE ${slot}
      OR LOWER(COALESCE(profile->'basic_info'->>'short_name', '')) LIKE ${slot}
      OR LOWER(COALESCE(profile->'basic_info'->>'name', '')) LIKE ${slot}
      OR LOWER(COALESCE(profile->'basic_info'->>'city', '')) LIKE ${slot}
      OR LOWER(COALESCE(profile->'basic_info'->>'district', '')) LIKE ${slot}
      OR LOWER(COALESCE(profile->'basic_info'->>'address', '')) LIKE ${slot}
    )`);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const pagination = limit ? `LIMIT ${push(limit)} OFFSET ${push(offset)}` : '';
  const query = `
    SELECT profile, COUNT(*) OVER() AS total
    FROM schools
    ${whereClause}
    ORDER BY updated_at DESC
    ${pagination}
  `;
  const { rows } = await db.query(query, values);
  const data = rows.map((row) => row.profile);
  const total = rows[0] ? Number(rows[0].total) || 0 : 0;
  return setCacheValue(listCache, cacheKey, { data, total, limit, offset });
};

const getSchoolById = async (schoolId, options = {}) => {
  const normalizedId = String(schoolId || '').trim();
  if (!normalizedId) return null;
  const cacheKey = buildCacheKey('school', { ...options, schoolId: normalizedId });
  const cached = getCacheValue(schoolCache, cacheKey);
  if (cached !== null) return cached;

  const includeInactive = toBooleanFlag(options.includeInactive, false);
  const includeHidden = toBooleanFlag(options.includeHidden, false);

  if (!config.databaseUrl) {
    const school =
      (await readFileStore()).find((item) => item.school_id === normalizedId) || null;
    const visible = school && matchesSchoolFilters(school, { includeInactive, includeHidden });
    return setCacheValue(schoolCache, cacheKey, visible ? school : null);
  }

  const db = getPool();
  await ensureSchoolsTable();
  const { rows } = await db.query(
    `
      SELECT profile
      FROM schools
      WHERE school_id = $1
      LIMIT 1
    `,
    [normalizedId]
  );
  const school = rows[0]?.profile || null;
  const visible = school && matchesSchoolFilters(school, { includeInactive, includeHidden });
  return setCacheValue(schoolCache, cacheKey, visible ? school : null);
};

const upsertSchool = async (profile) => {
  if (!profile?.school_id) {
    throw new Error('school_id is required');
  }
  if (!config.databaseUrl) {
    const current = await readFileStore();
    const next = [...current];
    const index = next.findIndex((item) => item.school_id === profile.school_id);
    if (index === -1) {
      next.push(profile);
    } else {
      next[index] = profile;
    }
    await writeFileStore(next);
    clearSchoolCaches();
    return profile;
  }
  const db = getPool();
  await ensureSchoolsTable();
  await db.query(
    `
      INSERT INTO schools (school_id, profile, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (school_id)
      DO UPDATE SET profile = EXCLUDED.profile, updated_at = NOW()
    `,
    [profile.school_id, profile]
  );
  clearSchoolCaches();
  return profile;
};

const deleteSchool = async (schoolId) => {
  if (!schoolId) {
    throw new Error('schoolId is required');
  }
  if (!config.databaseUrl) {
    const current = await readFileStore();
    const next = current.filter((item) => item.school_id !== schoolId);
    await writeFileStore(next);
    clearSchoolCaches();
    return next;
  }
  const db = getPool();
  await ensureSchoolsTable();
  await db.query('DELETE FROM schools WHERE school_id = $1', [schoolId]);
  clearSchoolCaches();
  return readStore();
};

module.exports = {
  listSchools,
  getSchoolById,
  readStore,
  upsertSchool,
  deleteSchool,
};
