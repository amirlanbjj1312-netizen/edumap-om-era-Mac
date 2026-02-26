const express = require('express');
const { parseSchoolQueryWithLlm } = require('../services/llmSchoolParser');
const { chatWithSchools } = require('../services/llmSchoolChat');
const { readStore } = require('../services/schoolsStore');

const normalizeText = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    return String(value.ru || value.en || '').trim();
  }
  return String(value).trim();
};

const toChatSchoolPayload = (school) => ({
  school_id: String(school?.school_id || '').trim(),
  name: normalizeText(school?.basic_info?.name),
  type: normalizeText(school?.basic_info?.type),
  city: normalizeText(school?.basic_info?.city),
  district: normalizeText(school?.basic_info?.district),
  address: normalizeText(school?.basic_info?.address),
  monthly_fee: school?.finance?.monthly_fee ?? '',
  languages: normalizeText(school?.education?.languages),
  programs: normalizeText(school?.education?.programs),
  curricula: [
    ...(school?.education?.curricula?.national || []),
    ...(school?.education?.curricula?.international || []),
    ...(school?.education?.curricula?.additional || []),
    normalizeText(school?.education?.curricula?.other),
  ]
    .filter(Boolean)
    .join(', '),
  advanced_subjects: [
    normalizeText(school?.education?.advanced_subjects),
    normalizeText(school?.education?.advanced_subjects_other),
  ]
    .filter(Boolean)
    .join(', '),
  clubs: [
    normalizeText(school?.services?.clubs),
    normalizeText(school?.services?.clubs_other),
  ]
    .filter(Boolean)
    .join(', '),
  meals: normalizeText(school?.services?.meals),
  specialists: [
    normalizeText(school?.services?.specialists),
    normalizeText(school?.services?.specialists_other),
  ]
    .filter(Boolean)
    .join(', '),
  rating: school?.reviews?.average_rating ?? school?.system?.rating ?? '',
  reviews_count: school?.reviews?.count ?? school?.system?.reviews_count ?? '',
});

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
    const schoolIds = Array.isArray(req.body?.schoolIds)
      ? req.body.schoolIds
          .map((value) => String(value || '').trim())
          .filter(Boolean)
      : [];
    const schools = Array.isArray(req.body?.schools) ? req.body.schools : [];
    if (!message) {
      return res.status(400).json({ error: 'Message is required.' });
    }
    const MAX_SCHOOLS = 12;

    let trimmedSchools = [];
    if (schoolIds.length) {
      try {
        const store = await readStore();
        const byId = new Map(
          (store || []).map((item) => [String(item?.school_id || '').trim(), item])
        );
        const selected = Array.from(new Set(schoolIds))
          .map((id) => byId.get(id))
          .filter(Boolean)
          .slice(0, MAX_SCHOOLS)
          .map((profile) => toChatSchoolPayload(profile));
        if (!selected.length) {
          return res.status(400).json({ error: 'No valid schoolIds found.' });
        }
        trimmedSchools = selected;
      } catch (error) {
        return next(error);
      }
    } else if (schools.length) {
      // Backward compatibility for older clients.
      trimmedSchools = schools.slice(0, MAX_SCHOOLS);
    } else {
      return res
        .status(400)
        .json({ error: 'schoolIds (preferred) or schools data is required.' });
    }

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
