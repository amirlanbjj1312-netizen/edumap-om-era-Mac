const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { buildConfig } = require('../utils/config');
const { readNews, upsertNewsItem, deleteNewsItem } = require('../services/newsStore');

const buildNewsRouter = (configArg) => {
  const router = express.Router();
  const config = configArg || buildConfig();

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

  const ROLE_PRIORITY = {
    user: 0,
    admin: 1,
    moderator: 2,
    superadmin: 3,
  };

  const hasMinRole = (role, minRole) =>
    (ROLE_PRIORITY[role] || 0) >= (ROLE_PRIORITY[minRole] || 0);

  const requireModerator = async (req, res) => {
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
    const role =
      data.user?.user_metadata?.role || data.user?.app_metadata?.role || '';
    if (!hasMinRole(role, 'moderator')) {
      res.status(403).json({ error: 'Only moderator or superadmin can manage news' });
      return null;
    }
    return data.user;
  };

  router.get('/', async (req, res, next) => {
    try {
      const data = await readNews();
      res.json({ data });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const actor = await requireModerator(req, res);
      if (!actor) return;
      const item = await upsertNewsItem({
        ...req.body,
        author: req.body?.author || actor.email || actor.id || 'Moderator',
      });
      res.json({ data: item });
    } catch (error) {
      if (String(error?.message || '').includes('title is required')) {
        return res.status(400).json({ error: 'title is required' });
      }
      next(error);
    }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const actor = await requireModerator(req, res);
      if (!actor) return;
      const item = await upsertNewsItem({
        ...req.body,
        id: String(req.params?.id || req.body?.id || '').trim(),
        author: req.body?.author || actor.email || actor.id || 'Moderator',
      });
      res.json({ data: item });
    } catch (error) {
      if (String(error?.message || '').includes('title is required')) {
        return res.status(400).json({ error: 'title is required' });
      }
      next(error);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const actor = await requireModerator(req, res);
      if (!actor) return;
      const data = await deleteNewsItem(req.params?.id);
      res.json({ data });
    } catch (error) {
      next(error);
    }
  });

  return router;
};

module.exports = { buildNewsRouter };
