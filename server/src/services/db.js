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

const ensureProgramAnalyticsTable = async () => {
  const db = getPool();
  if (!db) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS program_analytics_events (
      id BIGSERIAL PRIMARY KEY,
      school_id TEXT NOT NULL,
      program_name TEXT NOT NULL,
      event_type TEXT NOT NULL,
      locale TEXT,
      expanded BOOLEAN NOT NULL DEFAULT FALSE,
      source TEXT NOT NULL DEFAULT 'mobile',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_program_analytics_events_created_at
    ON program_analytics_events (created_at DESC);
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_program_analytics_events_school_event
    ON program_analytics_events (school_id, event_type);
  `);
};

module.exports = {
  getPool,
  ensureSchoolsTable,
  ensureProgramAnalyticsTable,
};
