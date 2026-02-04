const { Pool } = require('pg');
const { buildConfig } = require('../utils/config');

const config = buildConfig();
const connectionString = config.databaseUrl;

let pool = null;

const getPool = () => {
  if (!connectionString) {
    return null;
  }
  if (!pool) {
    const ssl =
      connectionString.includes('render.com') ||
      connectionString.includes('postgres.render.com')
        ? { rejectUnauthorized: false }
        : undefined;
    pool = new Pool({ connectionString, ssl });
  }
  return pool;
};

const ensureSchoolsTable = async () => {
  const db = getPool();
  if (!db) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS schools (
      school_id TEXT PRIMARY KEY,
      profile JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
};

module.exports = {
  getPool,
  ensureSchoolsTable,
};
