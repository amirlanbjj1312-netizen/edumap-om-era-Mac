const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { parseSchoolQueryWithLlm } = require('../services/llmSchoolParser');
const { chatWithSchools } = require('../services/llmSchoolChat');
const { readStore } = require('../services/schoolsStore');
const {
  ValidationError,
  validateAiSchoolQueryPayload,
  validateAiSchoolChatPayload,
} = require('../validation');

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
const RATE_LIMITS = {
  school_query: { windowMs: 60 * 1000, max: 20 },
  school_chat: { windowMs: 60 * 1000, max: 10 },
};
const rateBuckets = new Map();

const buildAiRouter = (config) => {
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
  const requireActor = async (req, res) => {
    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Supabase admin is not configured.' });
      return null;
    }
    const token = getBearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'Authorization token is required.' });
      return null;
    }
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      res.status(401).json({ error: 'Invalid token.' });
      return null;
    }
    return data.user;
  };
  const getRateLimitState = (actorId, key) => {
    const policy = RATE_LIMITS[key];
    if (!policy) return { ok: true, limit: 0, windowMs: 0, used: 0, remaining: 0, retryAfterSec: 0 };
    const now = Date.now();
    const bucketKey = `${actorId}:${key}`;
    const existing = rateBuckets.get(bucketKey) || [];
    const recent = existing.filter((ts) => now - ts < policy.windowMs);
    rateBuckets.set(bucketKey, recent);
    const used = recent.length;
    const remaining = Math.max(0, policy.max - used);
    const retryAfterSec =
      used > 0
        ? Math.max(1, Math.ceil((policy.windowMs - (now - recent[0])) / 1000))
        : 0;
    return {
      ok: used < policy.max,
      limit: policy.max,
      windowMs: policy.windowMs,
      used,
      remaining,
      retryAfterSec,
    };
  };
  const consumeRateLimit = (actorId, key) => {
    const state = getRateLimitState(actorId, key);
    if (!state.ok) {
      return { ok: false, retryAfterSec: state.retryAfterSec };
    }
    const bucketKey = `${actorId}:${key}`;
    const recent = rateBuckets.get(bucketKey) || [];
    recent.push(Date.now());
    rateBuckets.set(bucketKey, recent);
    return { ok: true };
  };

  router.get('/limits', async (req, res) => {
    const actor = await requireActor(req, res);
    if (!actor) return;
    const queryState = getRateLimitState(actor.id, 'school_query');
    const chatState = getRateLimitState(actor.id, 'school_chat');
    return res.json({
      data: {
        school_query: {
          limit: queryState.limit,
          window_sec: Math.floor(queryState.windowMs / 1000),
          used: queryState.used,
          remaining: queryState.remaining,
          retry_after_sec: queryState.ok ? 0 : queryState.retryAfterSec,
        },
        school_chat: {
          limit: chatState.limit,
          window_sec: Math.floor(chatState.windowMs / 1000),
          used: chatState.used,
          remaining: chatState.remaining,
          retry_after_sec: chatState.ok ? 0 : chatState.retryAfterSec,
        },
      },
    });
  });

  router.post('/school-query', async (req, res, next) => {
    const actor = await requireActor(req, res);
    if (!actor) return;
    const rate = consumeRateLimit(actor.id, 'school_query');
    if (!rate.ok) {
      res.setHeader('Retry-After', String(rate.retryAfterSec));
      return res.status(429).json({ error: 'Too many AI requests. Try again later.' });
    }
    let query;
    try {
      query = validateAiSchoolQueryPayload(req.body || {}).query;
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(400).json({ error: 'Invalid request payload.' });
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
    const actor = await requireActor(req, res);
    if (!actor) return;
    const rate = consumeRateLimit(actor.id, 'school_chat');
    if (!rate.ok) {
      res.setHeader('Retry-After', String(rate.retryAfterSec));
      return res.status(429).json({ error: 'Too many AI requests. Try again later.' });
    }
    let validated;
    try {
      validated = validateAiSchoolChatPayload(req.body || {});
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(400).json({ error: 'Invalid request payload.' });
    }
    const { message, schoolIds, schools } = validated;
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
