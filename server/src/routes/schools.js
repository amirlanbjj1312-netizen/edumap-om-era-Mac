const express = require('express');
const {
  readStore,
  upsertSchool,
  deleteSchool,
} = require('../services/schoolsStore');

const buildSchoolsRouter = () => {
  const router = express.Router();

  router.get('/', async (req, res, next) => {
    try {
      const data = await readStore();
      res.json({ data });
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
