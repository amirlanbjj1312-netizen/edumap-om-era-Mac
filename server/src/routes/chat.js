const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { buildConfig } = require('../utils/config');
const {
  ValidationError,
  validateListRoomMessagesPayload,
  validateCreateChatMessagePayload,
} = require('../validation');
const {
  GENERAL_ROOM_ID,
  ensureGeneralRoomForUser,
  listRoomMessages,
  createMessage,
} = require('../services/chatStore');

const buildChatRouter = (config = buildConfig()) => {
  const router = express.Router();
  const supabaseAdmin =
    config.supabase?.url && config.supabase?.serviceRoleKey
      ? createClient(config.supabase.url, config.supabase.serviceRoleKey, {
          auth: { persistSession: false },
        })
      : null;

  const getBearerToken = (req) => {
    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) {
      return header.slice(7).trim();
    }
    return null;
  };

  const roleWeight = {
    user: 0,
    admin: 1,
    moderator: 2,
    superadmin: 3,
  };

  const userRole = (user) =>
    String(user?.user_metadata?.role || user?.app_metadata?.role || 'user')
      .trim()
      .toLowerCase();

  const requireRegisteredUser = async (req, res) => {
    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Supabase admin is not configured' });
      return null;
    }
    const token = getBearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'Authorization token is required' });
      return null;
    }
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      res.status(401).json({ error: 'Invalid token' });
      return null;
    }
    const role = userRole(data.user);
    if (!Object.hasOwn(roleWeight, role)) {
      res.status(403).json({ error: 'Unsupported role for chat' });
      return null;
    }
    return { user: data.user, role };
  };

  const userMapByIds = async (ids = []) => {
    const target = new Set(ids.filter(Boolean));
    if (!target.size) return {};
    const found = {};
    let page = 1;
    while (page <= 10 && Object.keys(found).length < target.size) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error) throw error;
      const users = data?.users || [];
      users.forEach((item) => {
        if (!target.has(item.id)) return;
        found[item.id] = item;
      });
      if (users.length < 200) break;
      page += 1;
    }
    return found;
  };

  const senderName = (user = {}) => {
    const firstName = String(
      user?.user_metadata?.firstName || user?.user_metadata?.name || ''
    ).trim();
    const lastName = String(user?.user_metadata?.lastName || '').trim();
    const full = [firstName, lastName].filter(Boolean).join(' ').trim();
    return full || String(user?.email || 'User').trim() || 'User';
  };

  const enrichMessagesWithSender = async (rows = []) => {
    const senderIds = [...new Set(rows.map((row) => row.sender_id).filter(Boolean))];
    const users = await userMapByIds(senderIds);
    return rows.map((row) => ({
      ...row,
      sender_name: senderName(users[row.sender_id]),
    }));
  };

  router.get('/users', async (_req, res) => {
    res.status(410).json({ error: 'Direct chat is disabled. Use group chat.' });
  });

  router.get('/rooms', async (_req, res) => {
    res.status(410).json({ error: 'Direct chat is disabled. Use group chat.' });
  });

  router.post('/rooms/direct', async (_req, res) => {
    res.status(410).json({ error: 'Direct chat is disabled. Use group chat.' });
  });

  router.get('/general', async (req, res, next) => {
    try {
      const actorPayload = await requireRegisteredUser(req, res);
      if (!actorPayload) return;
      await ensureGeneralRoomForUser({ userId: actorPayload.user.id });
      res.json({
        data: {
          roomId: GENERAL_ROOM_ID,
          type: 'group',
          title: 'General chat',
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/general/messages', async (req, res, next) => {
    try {
      const actorPayload = await requireRegisteredUser(req, res);
      if (!actorPayload) return;
      await ensureGeneralRoomForUser({ userId: actorPayload.user.id });
      const { limit, before } = validateListRoomMessagesPayload(req.query || {});
      const rows = await listRoomMessages({
        roomId: GENERAL_ROOM_ID,
        limit,
        before,
      });
      const data = await enrichMessagesWithSender(rows);
      res.json({ data });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  });

  router.post('/general/messages', async (req, res, next) => {
    try {
      const actorPayload = await requireRegisteredUser(req, res);
      if (!actorPayload) return;
      await ensureGeneralRoomForUser({ userId: actorPayload.user.id });
      const { body } = validateCreateChatMessagePayload(req.body || {});
      const message = await createMessage({
        roomId: GENERAL_ROOM_ID,
        senderId: actorPayload.user.id,
        body,
      });
      const data = (
        await enrichMessagesWithSender([message])
      )[0];
      res.json({ data });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  });

  router.get('/rooms/:roomId/messages', async (req, res, next) => {
    try {
      const actorPayload = await requireRegisteredUser(req, res);
      if (!actorPayload) return;
      const roomId = String(req.params.roomId || '').trim();
      if (roomId !== GENERAL_ROOM_ID) {
        return res
          .status(410)
          .json({ error: 'Direct chat is disabled. Use group chat.' });
      }
      await ensureGeneralRoomForUser({ userId: actorPayload.user.id });
      const { limit, before } = validateListRoomMessagesPayload(req.query || {});
      const rows = await listRoomMessages({ roomId, limit, before });
      const data = await enrichMessagesWithSender(rows);
      res.json({ data });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  });

  router.post('/rooms/:roomId/messages', async (req, res, next) => {
    try {
      const actorPayload = await requireRegisteredUser(req, res);
      if (!actorPayload) return;
      const roomId = String(req.params.roomId || '').trim();
      if (roomId !== GENERAL_ROOM_ID) {
        return res
          .status(410)
          .json({ error: 'Direct chat is disabled. Use group chat.' });
      }
      await ensureGeneralRoomForUser({ userId: actorPayload.user.id });
      const { body } = validateCreateChatMessagePayload(req.body || {});
      const message = await createMessage({
        roomId,
        senderId: actorPayload.user.id,
        body,
      });
      const data = (
        await enrichMessagesWithSender([message])
      )[0];
      res.json({ data });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  });

  return router;
};

module.exports = {
  buildChatRouter,
};

