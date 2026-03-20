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
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_schools_updated_at
    ON schools (updated_at DESC);
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_schools_city
    ON schools ((profile->'basic_info'->>'city'));
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_schools_district
    ON schools ((profile->'basic_info'->>'district'));
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_schools_type
    ON schools ((profile->'basic_info'->>'type'));
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_schools_subtype
    ON schools ((profile->'basic_info'->>'school_subtype'));
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_schools_is_active
    ON schools (((COALESCE(profile->'system'->>'is_active', 'true'))));
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_schools_hidden_from_users
    ON schools (((COALESCE(profile->'system'->>'hidden_from_users', 'false'))));
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
  await db.query(`
    CREATE TABLE IF NOT EXISTS program_analytics_resets (
      id BIGSERIAL PRIMARY KEY,
      actor_email TEXT,
      reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_program_analytics_resets_reset_at
    ON program_analytics_resets (reset_at DESC);
  `);
};

const ensureEngagementAnalyticsTables = async () => {
  const db = getPool();
  if (!db) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS engagement_analytics_events (
      id BIGSERIAL PRIMARY KEY,
      event_type TEXT NOT NULL,
      school_id TEXT,
      actor_type TEXT NOT NULL DEFAULT 'guest',
      actor_user_id TEXT,
      locale TEXT,
      source TEXT NOT NULL DEFAULT 'parent_web',
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_engagement_analytics_events_created_at
    ON engagement_analytics_events (created_at DESC);
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_engagement_analytics_events_type
    ON engagement_analytics_events (event_type, created_at DESC);
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_engagement_analytics_events_school
    ON engagement_analytics_events (school_id, created_at DESC);
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS engagement_analytics_resets (
      id BIGSERIAL PRIMARY KEY,
      actor_email TEXT,
      reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_engagement_analytics_resets_reset_at
    ON engagement_analytics_resets (reset_at DESC);
  `);
};

const ensureNewsTable = async () => {
  const db = getPool();
  if (!db) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS news (
      id TEXT PRIMARY KEY,
      item JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_news_updated_at
    ON news (updated_at DESC);
  `);
};

const ensureCoursesTestsTable = async () => {
  const db = getPool();
  if (!db) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS courses_tests (
      id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_courses_tests_updated_at
    ON courses_tests (updated_at DESC);
  `);
};

const ensureChatTables = async () => {
  const db = getPool();
  if (!db) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS chat_rooms (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'direct',
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_message_at TIMESTAMPTZ
    );
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS chat_room_members (
      room_id TEXT NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (room_id, user_id)
    );
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
      sender_id TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_chat_room_members_user
    ON chat_room_members (user_id);
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created
    ON chat_messages (room_id, created_at DESC);
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_chat_rooms_last_message
    ON chat_rooms (last_message_at DESC NULLS LAST, updated_at DESC);
  `);
};

module.exports = {
  getPool,
  ensureSchoolsTable,
  ensureProgramAnalyticsTable,
  ensureEngagementAnalyticsTables,
  ensureNewsTable,
  ensureCoursesTestsTable,
  ensureChatTables,
};
