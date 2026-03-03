const crypto = require('crypto');
const { getPool, ensureChatTables } = require('./db');
const GENERAL_ROOM_ID = 'general';

const ensureGeneralRoomForUser = async ({ userId }) => {
  const db = getPool();
  if (!db) throw new Error('Database is not configured');
  await ensureChatTables();

  await db.query('BEGIN');
  try {
    await db.query(
      `
        INSERT INTO chat_rooms (id, type, created_by, created_at, updated_at)
        VALUES ($1, 'group', $2, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `,
      [GENERAL_ROOM_ID, userId]
    );
    await db.query(
      `
        INSERT INTO chat_room_members (room_id, user_id, joined_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (room_id, user_id) DO NOTHING
      `,
      [GENERAL_ROOM_ID, userId]
    );
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
  return GENERAL_ROOM_ID;
};

const getOrCreateDirectRoom = async ({ userId, targetUserId }) => {
  const db = getPool();
  if (!db) throw new Error('Database is not configured');
  await ensureChatTables();

  const existing = await db.query(
    `
      SELECT r.id
      FROM chat_rooms r
      JOIN chat_room_members m1 ON m1.room_id = r.id AND m1.user_id = $1
      JOIN chat_room_members m2 ON m2.room_id = r.id AND m2.user_id = $2
      WHERE r.type = 'direct'
      LIMIT 1
    `,
    [userId, targetUserId]
  );
  if (existing.rows[0]?.id) {
    return existing.rows[0].id;
  }

  const roomId = crypto.randomUUID();
  await db.query('BEGIN');
  try {
    await db.query(
      `
        INSERT INTO chat_rooms (id, type, created_by, created_at, updated_at)
        VALUES ($1, 'direct', $2, NOW(), NOW())
      `,
      [roomId, userId]
    );
    await db.query(
      `
        INSERT INTO chat_room_members (room_id, user_id, joined_at)
        VALUES ($1, $2, NOW()), ($1, $3, NOW())
      `,
      [roomId, userId, targetUserId]
    );
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
  return roomId;
};

const listUserRooms = async ({ userId, limit = 50, offset = 0 }) => {
  const db = getPool();
  if (!db) throw new Error('Database is not configured');
  await ensureChatTables();

  const { rows } = await db.query(
    `
      SELECT
        r.id,
        r.type,
        r.last_message_at,
        r.updated_at,
        lm.body AS last_message_body,
        lm.created_at AS last_message_created_at,
        lm.sender_id AS last_message_sender_id
      FROM chat_rooms r
      JOIN chat_room_members me ON me.room_id = r.id AND me.user_id = $1
      LEFT JOIN LATERAL (
        SELECT m.body, m.created_at, m.sender_id
        FROM chat_messages m
        WHERE m.room_id = r.id
        ORDER BY m.created_at DESC
        LIMIT 1
      ) lm ON TRUE
      ORDER BY COALESCE(r.last_message_at, r.updated_at) DESC
      LIMIT $2 OFFSET $3
    `,
    [userId, limit, offset]
  );
  return rows;
};

const listRoomMembers = async (roomId) => {
  const db = getPool();
  if (!db) throw new Error('Database is not configured');
  await ensureChatTables();
  const { rows } = await db.query(
    `
      SELECT user_id
      FROM chat_room_members
      WHERE room_id = $1
      ORDER BY joined_at ASC
    `,
    [roomId]
  );
  return rows.map((row) => row.user_id);
};

const isRoomMember = async ({ roomId, userId }) => {
  const db = getPool();
  if (!db) throw new Error('Database is not configured');
  await ensureChatTables();
  const { rows } = await db.query(
    `
      SELECT 1
      FROM chat_room_members
      WHERE room_id = $1 AND user_id = $2
      LIMIT 1
    `,
    [roomId, userId]
  );
  return Boolean(rows[0]);
};

const listRoomMessages = async ({ roomId, limit = 50, before }) => {
  const db = getPool();
  if (!db) throw new Error('Database is not configured');
  await ensureChatTables();

  const args = [roomId, limit];
  let whereExtra = '';
  if (before) {
    args.push(before);
    whereExtra = ` AND created_at < $${args.length}`;
  }

  const { rows } = await db.query(
    `
      SELECT id, room_id, sender_id, body, created_at
      FROM chat_messages
      WHERE room_id = $1 ${whereExtra}
      ORDER BY created_at DESC
      LIMIT $2
    `,
    args
  );
  return rows.reverse();
};

const createMessage = async ({ roomId, senderId, body }) => {
  const db = getPool();
  if (!db) throw new Error('Database is not configured');
  await ensureChatTables();

  const messageId = crypto.randomUUID();
  await db.query('BEGIN');
  try {
    const inserted = await db.query(
      `
        INSERT INTO chat_messages (id, room_id, sender_id, body, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING id, room_id, sender_id, body, created_at
      `,
      [messageId, roomId, senderId, body]
    );
    await db.query(
      `
        UPDATE chat_rooms
        SET updated_at = NOW(), last_message_at = NOW()
        WHERE id = $1
      `,
      [roomId]
    );
    await db.query('COMMIT');
    return inserted.rows[0];
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
};

module.exports = {
  GENERAL_ROOM_ID,
  ensureGeneralRoomForUser,
  getOrCreateDirectRoom,
  listUserRooms,
  listRoomMembers,
  isRoomMember,
  listRoomMessages,
  createMessage,
};
