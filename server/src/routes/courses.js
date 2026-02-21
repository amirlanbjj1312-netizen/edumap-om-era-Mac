const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { buildConfig } = require('../utils/config');
const {
  readCoursesTests,
  upsertCourseTest,
  upsertCourseQuestion,
  deleteCourseTest,
} = require('../services/coursesStore');

const buildCoursesRouter = (configArg) => {
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
      res
        .status(403)
        .json({ error: 'Only moderator or superadmin can manage courses' });
      return null;
    }
    return data.user;
  };

  router.get('/tests', async (req, res, next) => {
    try {
      const data = await readCoursesTests();
      res.json({ data });
    } catch (error) {
      next(error);
    }
  });

  router.post('/tests', async (req, res, next) => {
    try {
      const actor = await requireModerator(req, res);
      if (!actor) return;
      const subjectId = req.body?.subjectId;
      const test = req.body?.test;
      const data = await upsertCourseTest({ subjectId, test });
      res.json({ data });
    } catch (error) {
      next(error);
    }
  });

  router.post('/questions', async (req, res, next) => {
    try {
      const actor = await requireModerator(req, res);
      if (!actor) return;
      const subjectId = req.body?.subjectId;
      const testId = req.body?.testId;
      const question = req.body?.question;
      const data = await upsertCourseQuestion({ subjectId, testId, question });
      res.json({ data });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/tests/:subjectId/:testId', async (req, res, next) => {
    try {
      const actor = await requireModerator(req, res);
      if (!actor) return;
      const data = await deleteCourseTest({
        subjectId: req.params?.subjectId,
        testId: req.params?.testId,
      });
      res.json({ data });
    } catch (error) {
      next(error);
    }
  });

  return router;
};

module.exports = { buildCoursesRouter };
