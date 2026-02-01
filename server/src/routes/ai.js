const express = require('express');
const { parseSchoolQueryWithLlm } = require('../services/llmSchoolParser');
const { chatWithSchools } = require('../services/llmSchoolChat');

const buildAiRouter = (config) => {
  const router = express.Router();

  router.post('/school-query', async (req, res, next) => {
    const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    if (!query) {
      return res.status(400).json({ error: 'Query is required.' });
    }

    try {
      const parsed = await parseSchoolQueryWithLlm(config, query);
      return res.json({ data: parsed });
    } catch (error) {
      if (error.code === 'LLM_NOT_CONFIGURED') {
        return res.status(501).json({ error: 'LLM is not configured.' });
      }
      if (error.status === 429) {
        return res
          .status(429)
          .json({ error: 'LLM rate limit exceeded. Try again later.' });
      }
      if (error.status === 401 || error.status === 403) {
        return res.status(502).json({ error: 'LLM authorization failed.' });
      }
      console.warn('LLM parse failed:', error.cause?.message || error.message);
      return res.status(502).json({ error: 'LLM request failed.' });
    }
  });

  router.post('/school-chat', async (req, res, next) => {
    const message =
      typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    const schools = Array.isArray(req.body?.schools) ? req.body.schools : [];
    if (!message) {
      return res.status(400).json({ error: 'Message is required.' });
    }
    if (!schools.length) {
      return res.status(400).json({ error: 'Schools data is required.' });
    }

    const trimmedSchools = schools.slice(0, 12);

    try {
      const data = await chatWithSchools(config, message, trimmedSchools);
      return res.json({ data });
    } catch (error) {
      if (error.code === 'LLM_NOT_CONFIGURED') {
        return res.status(501).json({ error: 'LLM is not configured.' });
      }
      if (error.status === 429) {
        return res
          .status(429)
          .json({ error: 'LLM rate limit exceeded. Try again later.' });
      }
      if (error.status === 401 || error.status === 403) {
        return res.status(502).json({ error: 'LLM authorization failed.' });
      }
      const errorDetails = error.cause?.response?.data;
      const errorMessage =
        errorDetails?.error?.message ||
        errorDetails?.error ||
        error.cause?.message ||
        error.message;
      console.warn('LLM chat failed:', errorMessage);
      return res.status(502).json({ error: errorMessage || 'LLM request failed.' });
    }
  });

  return router;
};

module.exports = {
  buildAiRouter,
};
