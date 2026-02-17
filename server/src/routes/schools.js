const express = require('express');
const {
  readStore,
  upsertSchool,
  deleteSchool,
} = require('../services/schoolsStore');

const buildSchoolsRouter = () => {
  const router = express.Router();

  const isTrue = (value) =>
    value === true ||
    value === 'true' ||
    value === '1' ||
    value === 1;

  router.get('/', async (req, res, next) => {
    try {
      const data = await readStore();
      const includeInactive = isTrue(req.query.include_inactive);
      const includeHidden = isTrue(req.query.include_hidden);
      const filtered = data.filter((item) => {
        const isActive = item?.system?.is_active !== false;
        const isVisible = item?.system?.hidden_from_users !== true;
        if (!includeInactive && !isActive) return false;
        if (!includeHidden && !isVisible) return false;
        return true;
      });
      res.json({ data: filtered });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const data = await readStore();
      const school = data.find((item) => item.school_id === req.params.id);
      if (!school) {
        return res.status(404).json({ error: 'School not found' });
      }
      res.json({ data: school });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const profile = req.body;
      const saved = await upsertSchool(profile);
      res.json({ data: saved });
    } catch (error) {
      next(error);
    }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const profile = {
        ...req.body,
        school_id: req.body?.school_id || req.params.id,
      };
      const saved = await upsertSchool(profile);
      res.json({ data: saved });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const data = await deleteSchool(req.params.id);
      res.json({ data });
    } catch (error) {
      next(error);
    }
  });

  return router;
};

module.exports = { buildSchoolsRouter };
