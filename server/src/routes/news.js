const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { buildConfig } = require('../utils/config');
const { readNews, upsertNewsItem, deleteNewsItem } = require('../services/newsStore');
const { translateTexts } = require('../services/schoolLocaleTranslator');
const { ValidationError, validateNewsPayload } = require('../validation');

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

  const toText = (value) => (typeof value === 'string' ? value.trim() : '');
  const pickLocaleGroup = (payload, key) => ({
    ru: toText(payload?.[key] || payload?.[`${key}_ru`] || ''),
    en: toText(payload?.[`${key}En`] || payload?.[`${key}_en`] || ''),
    kk: toText(payload?.[`${key}Kk`] || payload?.[`${key}_kk`] || ''),
  });

  router.post('/translate-locales', async (req, res, next) => {
    try {
      const actor = await requireModerator(req, res);
      if (!actor) return;
      const payload = req.body || {};
      const groups = {
        title: pickLocaleGroup(payload, 'title'),
        summary: pickLocaleGroup(payload, 'summary'),
        content: pickLocaleGroup(payload, 'content'),
      };
      const needed = Object.values(groups).filter(
        (group) => group.ru && (!group.en || !group.kk)
      );
      if (!needed.length) {
        return res.json({ data: payload });
      }
      const uniqueTexts = Array.from(new Set(needed.map((item) => item.ru)));
      const translated = await translateTexts(config, uniqueTexts);
      const byRu = new Map(translated.map((item) => [item.ru, item]));

      const fillGroup = (group) => {
        if (!group.ru) return group;
        const translation = byRu.get(group.ru);
        if (!translation) return group;
        return {
          ...group,
          en: group.en || translation.en || '',
          kk: group.kk || translation.kk || '',
        };
      };

      const filled = {
        title: fillGroup(groups.title),
        summary: fillGroup(groups.summary),
        content: fillGroup(groups.content),
      };

      return res.json({
        data: {
          ...payload,
          titleEn: filled.title.en,
          titleKk: filled.title.kk,
          summaryEn: filled.summary.en,
          summaryKk: filled.summary.kk,
          contentEn: filled.content.en,
          contentKk: filled.content.kk,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const actor = await requireModerator(req, res);
      if (!actor) return;
      const validated = validateNewsPayload(req.body || {});
      const item = await upsertNewsItem({
        ...validated,
        author: validated?.author || actor.email || actor.id || 'Moderator',
      });
      res.json({ data: item });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
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
      const validated = validateNewsPayload({
        ...(req.body || {}),
        id: String(req.params?.id || req.body?.id || '').trim(),
      });
      const item = await upsertNewsItem({
        ...validated,
        author: validated?.author || actor.email || actor.id || 'Moderator',
      });
      res.json({ data: item });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
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
