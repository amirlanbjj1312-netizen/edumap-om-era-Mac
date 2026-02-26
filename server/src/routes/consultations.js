const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { ConsultationStore } = require('../services/consultationStore');
const { sendWhatsAppMessage } = require('../services/whatsappService');
const { readStore } = require('../services/schoolsStore');

const REQUIRED_FIELDS = [
  'schoolId',
  'schoolName',
  'parentName',
  'parentPhone',
  'childName',
  'childGrade',
];
const POST_RATE_LIMITS = {
  byIp: { windowMs: 15 * 60 * 1000, max: 10 },
  byPhone: { windowMs: 60 * 60 * 1000, max: 3 },
};
const DEDUPE_WINDOW_MS = 60 * 60 * 1000;
const postBuckets = new Map();

const validatePayload = (body = {}) => {
  for (const field of REQUIRED_FIELDS) {
    if (!body[field] || !String(body[field]).trim()) {
      return `Field "${field}" is required.`;
    }
  }
  return null;
};
const normalizePhone = (value) => String(value || '').replace(/\D/g, '');
const normalizeText = (value) => String(value || '').trim().toLowerCase();
const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  const candidate = req.ip || req.socket?.remoteAddress || '';
  return String(candidate).replace(/^::ffff:/, '').trim();
};
const consumeRateLimit = (key, policy) => {
  const now = Date.now();
  const current = postBuckets.get(key) || [];
  const recent = current.filter((ts) => now - ts < policy.windowMs);
  if (recent.length >= policy.max) {
    const oldest = recent[0];
    const retryAfterSec = Math.max(
      1,
      Math.ceil((policy.windowMs - (now - oldest)) / 1000)
    );
    postBuckets.set(key, recent);
    return { ok: false, retryAfterSec };
  }
  recent.push(now);
  postBuckets.set(key, recent);
  return { ok: true };
};

const buildConsultationsRouter = (config) => {
  const router = express.Router();
  const store = new ConsultationStore(config.dataFilePath);
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
  const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
  const buildFallbackSchoolId = (email) => {
    const base = normalizeEmail(email)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `local-${base || 'school'}`;
  };
  const requireAdminAccess = async (req, res) => {
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
    if (!hasMinRole(role, 'admin')) {
      res
        .status(403)
        .json({ error: 'Only admin/moderator/superadmin can view consultations' });
      return null;
    }
    return { user: data.user, role };
  };

  router.get('/', async (req, res, next) => {
    try {
      const actorPayload = await requireAdminAccess(req, res);
      if (!actorPayload) return;
      const { user, role } = actorPayload;
      const data = await store.list();

      if (role === 'admin') {
        const actorEmail = normalizeEmail(user?.email);
        const fallbackSchoolId = buildFallbackSchoolId(actorEmail);
        const schools = await readStore();
        const allowedSchoolIds = new Set(
          (schools || [])
            .filter((school) => {
              const schoolEmail = normalizeEmail(school?.basic_info?.email);
              const schoolId = String(school?.school_id || '').trim().toLowerCase();
              return schoolEmail === actorEmail || schoolId === fallbackSchoolId;
            })
            .map((school) => String(school?.school_id || '').trim())
            .filter(Boolean)
        );
        const filtered = data.filter((row) =>
          allowedSchoolIds.has(String(row?.schoolId || '').trim())
        );
        return res.json({ data: filtered });
      }

      res.json({ data });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    const validationError = validatePayload(req.body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    try {
      const ip = getClientIp(req);
      const parentPhone = normalizePhone(req.body.parentPhone);
      const schoolId = normalizeText(req.body.schoolId);
      const childName = normalizeText(req.body.childName);

      const ipLimit = consumeRateLimit(`ip:${ip}`, POST_RATE_LIMITS.byIp);
      if (!ipLimit.ok) {
        res.setHeader('Retry-After', String(ipLimit.retryAfterSec));
        return res.status(429).json({ error: 'Too many requests from this IP. Try later.' });
      }

      const phoneLimit = consumeRateLimit(
        `phone:${parentPhone}`,
        POST_RATE_LIMITS.byPhone
      );
      if (!phoneLimit.ok) {
        res.setHeader('Retry-After', String(phoneLimit.retryAfterSec));
        return res
          .status(429)
          .json({ error: 'Too many requests from this phone number. Try later.' });
      }

      const existing = await store.list();
      const now = Date.now();
      const duplicate = existing.find((item) => {
        const createdAt = new Date(item?.createdAt || 0).getTime();
        if (!Number.isFinite(createdAt) || now - createdAt > DEDUPE_WINDOW_MS) {
          return false;
        }
        return (
          normalizePhone(item?.parentPhone) === parentPhone &&
          normalizeText(item?.schoolId) === schoolId &&
          normalizeText(item?.childName) === childName
        );
      });
      if (duplicate) {
        return res.status(409).json({
          error: 'A similar consultation request was sent recently. Please wait.',
        });
      }

      const record = await store.add({
        schoolId: String(req.body.schoolId).trim(),
        schoolName: req.body.schoolName.trim(),
        parentName: req.body.parentName.trim(),
        parentPhone: req.body.parentPhone.trim(),
        parentEmail: req.body.parentEmail?.trim() || '',
        childName: req.body.childName.trim(),
        childGrade: req.body.childGrade.trim(),
        consultationType: req.body.consultationType || 'First meeting',
        comment: req.body.comment?.trim() || '',
        whatsappPhone: req.body.whatsappPhone?.replace(/\s+/g, '') || '',
      });

      try {
        await sendWhatsAppMessage(config, record);
      } catch (whatsAppError) {
        console.warn('Failed to notify WhatsApp:', whatsAppError.message);
      }

      res.status(201).json({ data: record });
    } catch (error) {
      next(error);
    }
  });

  return router;
};

module.exports = {
  buildConsultationsRouter,
};
