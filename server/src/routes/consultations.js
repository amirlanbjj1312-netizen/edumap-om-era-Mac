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
const FIELD_LIMITS = {
  schoolId: 120,
  schoolName: 180,
  parentName: 120,
  parentPhone: 24,
  parentEmail: 120,
  childName: 120,
  childGrade: 24,
  consultationType: 64,
  consultationTypeLabel: 120,
  comment: 2000,
  whatsappPhone: 24,
};
const ALLOWED_CONSULTATION_TYPES = new Set([
  'schoolDetail.consultation.firstMeeting',
  'schoolDetail.consultation.transfer',
  'schoolDetail.consultation.learningQuestion',
  'schoolDetail.consultation.other',
  // Backward compatibility with old plain labels
  'First meeting',
  'Transfer',
  'Learning question',
  'Other',
]);
const GRADE_PATTERN = /^(pre-k|[1-9]|1[0-2])$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POST_RATE_LIMITS = {
  byIp: { windowMs: 15 * 60 * 1000, max: 10 },
  byPhone: { windowMs: 60 * 60 * 1000, max: 3 },
};
const DEDUPE_WINDOW_MS = 60 * 60 * 1000;
const postBuckets = new Map();
const CRM_STATUSES = new Set([
  'new',
  'in_progress',
  'contacted',
  'consultation_scheduled',
  'waiting',
  'enrolled',
  'closed',
  'rejected',
]);

const exceedsLimit = (value, limit) => String(value || '').trim().length > limit;
const validatePayload = (body = {}) => {
  for (const field of REQUIRED_FIELDS) {
    if (!body[field] || !String(body[field]).trim()) {
      return `Field "${field}" is required.`;
    }
  }

  for (const [field, limit] of Object.entries(FIELD_LIMITS)) {
    if (body[field] != null && exceedsLimit(body[field], limit)) {
      return `Field "${field}" is too long (max ${limit} chars).`;
    }
  }

  const normalizedParentPhone = normalizePhone(body.parentPhone);
  if (normalizedParentPhone.length < 10 || normalizedParentPhone.length > 15) {
    return 'Field "parentPhone" must contain 10-15 digits.';
  }

  const normalizedWhatsApp = normalizePhone(body.whatsappPhone);
  if (String(body.whatsappPhone || '').trim() && (normalizedWhatsApp.length < 10 || normalizedWhatsApp.length > 15)) {
    return 'Field "whatsappPhone" must contain 10-15 digits.';
  }

  const parentEmail = String(body.parentEmail || '').trim();
  if (parentEmail && !EMAIL_PATTERN.test(parentEmail)) {
    return 'Field "parentEmail" is invalid.';
  }

  const grade = String(body.childGrade || '').trim();
  if (!GRADE_PATTERN.test(grade)) {
    return 'Field "childGrade" must be one of: Pre-K, 1..12.';
  }

  const consultationType = String(body.consultationType || '').trim() || 'First meeting';
  if (!ALLOWED_CONSULTATION_TYPES.has(consultationType)) {
    return 'Field "consultationType" has unsupported value.';
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
  const getActorAssignedSchoolId = (actor) =>
    String(actor?.app_metadata?.school_id || actor?.user_metadata?.school_id || '')
      .trim()
      .toLowerCase();
  const buildFallbackSchoolId = (email) => {
    const base = normalizeEmail(email)
      .split('@')[0]
      .replace(/[^a-z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
    return `school-${base || 'school'}`;
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
        const assignedSchoolId = getActorAssignedSchoolId(user);
        const schools = await readStore();
        const allowedSchoolIds = new Set(
          (schools || [])
            .filter((school) => {
              const schoolEmail = normalizeEmail(school?.basic_info?.email);
              const schoolId = String(school?.school_id || '').trim().toLowerCase();
              return schoolEmail === actorEmail || schoolId === fallbackSchoolId || schoolId === assignedSchoolId;
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
        schoolName: String(req.body.schoolName).trim(),
        parentName: String(req.body.parentName).trim(),
        parentPhone: String(req.body.parentPhone).trim(),
        parentEmail: String(req.body.parentEmail || '').trim(),
        childName: String(req.body.childName).trim(),
        childGrade: String(req.body.childGrade).trim(),
        consultationType:
          String(req.body.consultationType || '').trim() || 'First meeting',
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

  router.patch('/:id', async (req, res, next) => {
    try {
      const actorPayload = await requireAdminAccess(req, res);
      if (!actorPayload) return;
      const { user, role } = actorPayload;
      const id = String(req.params?.id || '').trim();
      if (!id) {
        return res.status(400).json({ error: 'Consultation id is required.' });
      }

      const allItems = await store.list();
      const target = allItems.find((item) => String(item?.id || '').trim() === id);
      if (!target) {
        return res.status(404).json({ error: 'Consultation request not found.' });
      }

      if (role === 'admin') {
        const actorEmail = normalizeEmail(user?.email);
        const fallbackSchoolId = buildFallbackSchoolId(actorEmail);
        const assignedSchoolId = getActorAssignedSchoolId(user);
        const targetSchoolId = String(target?.schoolId || '').trim().toLowerCase();
        const schools = await readStore();
        const canAccess = (schools || []).some((school) => {
          const schoolEmail = normalizeEmail(school?.basic_info?.email);
          const schoolId = String(school?.school_id || '').trim().toLowerCase();
          return (
            schoolId === targetSchoolId &&
            (schoolEmail === actorEmail || schoolId === fallbackSchoolId || schoolId === assignedSchoolId)
          );
        });
        if (!canAccess) {
          return res.status(403).json({ error: 'Admin can update only own school requests.' });
        }
      }

      const nextStatus = String(req.body?.status || '').trim();
      const internalNote = String(req.body?.internalNote || '').trim();
      const assignedTo = String(req.body?.assignedTo || '').trim();
      const followUpAt = String(req.body?.followUpAt || '').trim();

      if (nextStatus && !CRM_STATUSES.has(nextStatus)) {
        return res.status(400).json({ error: 'Unsupported consultation status.' });
      }
      if (internalNote.length > 3000) {
        return res.status(400).json({ error: 'internalNote is too long.' });
      }
      if (assignedTo.length > 160) {
        return res.status(400).json({ error: 'assignedTo is too long.' });
      }
      if (followUpAt && !Number.isFinite(new Date(followUpAt).getTime())) {
        return res.status(400).json({ error: 'followUpAt must be a valid datetime.' });
      }

      const updated = await store.updateById(id, {
        status: nextStatus || target.status || 'new',
        internalNote,
        assignedTo,
        followUpAt,
        updatedAt: new Date().toISOString(),
        updatedBy: normalizeEmail(user?.email) || String(user?.id || ''),
      });

      return res.json({ data: updated });
    } catch (error) {
      next(error);
    }
  });

  return router;
};

module.exports = {
  buildConsultationsRouter,
};
