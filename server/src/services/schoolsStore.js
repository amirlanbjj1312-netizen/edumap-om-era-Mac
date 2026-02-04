const fs = require('fs/promises');
const path = require('path');
const { buildConfig } = require('../utils/config');
const { getPool, ensureSchoolsTable } = require('./db');

const config = buildConfig();
const STORAGE_DIR = path.resolve(__dirname, '../data');
const STORAGE_PATH = path.join(STORAGE_DIR, 'schools.json');

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

const readStore = async () => {
  if (!config.databaseUrl) {
    return readFileStore();
  }
  const db = getPool();
  await ensureSchoolsTable();
  const { rows } = await db.query('SELECT profile FROM schools ORDER BY updated_at DESC');
  return rows.map((row) => row.profile);
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
    return next;
  }
  const db = getPool();
  await ensureSchoolsTable();
  await db.query('DELETE FROM schools WHERE school_id = $1', [schoolId]);
  return readStore();
};

module.exports = {
  readStore,
  upsertSchool,
  deleteSchool,
};
