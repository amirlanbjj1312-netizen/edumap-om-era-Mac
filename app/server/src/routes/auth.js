const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const sgMail = require('@sendgrid/mail');
const { createClient } = require('@supabase/supabase-js');
const { OtpStore } = require('../services/otpStore');
const {
  ValidationError,
  validateSendCodePayload,
  validateVerifyCodePayload,
  validateSetRolePayload,
  validateUserStatusPayload,
  validateCreateSchoolAccountPayload,
  validateRegisterWithCodePayload,
  validateResetPasswordWithCodePayload,
} = require('../validation');
const {
  readSchoolAccessLog,
  appendSchoolAccessLog,
  clearSchoolAccessLog,
  updateSchoolAccessLogStatus,
  upsertSchoolAccessLogEntry,
  deleteSchoolAccessLogEntry,
  ALLOWED_STATUSES,
} = require('../services/schoolAccessLogStore');
const { deleteSchool } = require('../services/schoolsStore');
const { listSurveyResponses } = require('../services/ratingSurveyStore');
const {
  getUserAdminSettings,
  upsertUserAdminSettings,
} = require('../services/userAdminStore');

const buildAuthRouter = (config) => {
  const router = express.Router();
  const consultationsPath = path.resolve(__dirname, '../data/consultations.json');
  const isOtpBypassEnabled =
    String(process.env.DEV_OTP_BYPASS || '').trim().toLowerCase() === 'true' ||
    String(process.env.DEV_OTP_BYPASS || '').trim() === '1';
  const otpBypassCode =
    String(process.env.DEV_OTP_CODE || '111111')
      .replace(/\D/g, '')
      .slice(0, 6) || '111111';
  const store = new OtpStore({
    ttlMinutes: config.email.codeTtlMinutes,
    maxAttempts: config.email.maxAttempts,
    resendWindowSec: config.email.resendWindowSec,
  });
  const supabaseAdmin =
    config.supabase?.url && config.supabase?.serviceRoleKey
      ? createClient(config.supabase.url, config.supabase.serviceRoleKey, {
          auth: { persistSession: false },
        })
      : null;

  if (config.email.sendGridKey) {
    sgMail.setApiKey(config.email.sendGridKey);
  }

  const ensureSendGrid = () => {
    if (!config.email.sendGridKey || !config.email.fromEmail) {
      const error = new Error('Email sending is not configured');
      error.status = 500;
      throw error;
    }
  };

  const getBearerToken = (req) => {
    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) {
      return header.slice(7).trim();
    }
    return null;
  };

  const getUserRole = (user) =>
    user?.user_metadata?.role || user?.app_metadata?.role || '';

  const ROLE_PRIORITY = {
    user: 0,
    admin: 1,
    moderator: 2,
    superadmin: 3,
  };

  const hasMinRole = (role, minRole) =>
    (ROLE_PRIORITY[role] || 0) >= (ROLE_PRIORITY[minRole] || 0);

  const resolveUserByEmail = async (email) => {
    const target = String(email || '').trim().toLowerCase();
    if (!target) return null;
    let page = 1;
    while (page <= 10) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error) throw error;
      const users = data?.users || [];
      const found = users.find(
        (item) => String(item.email || '').trim().toLowerCase() === target
      );
      if (found) return found;
      if (users.length < 200) break;
      page += 1;
    }
    return null;
  };

  const getActor = async (req) => {
    const token = getBearerToken(req);
    if (!token) {
      const error = new Error('Authorization token is required');
      error.status = 401;
      throw error;
    }
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      const error = new Error('Invalid token');
      error.status = 401;
      throw error;
    }
    return userData.user;
  };

  router.post('/send-code', async (req, res, next) => {
    try {
      const { email } = validateSendCodePayload(req.body || {});
      if (isOtpBypassEnabled) {
        if (!store.canResend(email)) {
          return res.status(429).json({ error: 'Wait before resending code' });
        }
        store.generate(email, otpBypassCode);
        return res.json({
          ok: true,
          mode: 'dev_bypass',
          message: 'DEV_OTP_BYPASS is enabled. Use configured fixed OTP code.',
        });
      }

      ensureSendGrid();

      if (!store.canResend(email)) {
        return res.status(429).json({ error: 'Wait before resending code' });
      }

      const code = Math.floor(100000 + Math.random() * 900000)
        .toString()
        .slice(0, 6);
      store.generate(email, code);

      await sgMail.send({
        to: email,
        from: config.email.fromEmail,
        subject: 'Your verification code',
        text: `Your verification code: ${code}`,
      });

      res.json({ ok: true });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      if (String(error?.message || '').includes('Email sending is not configured')) {
        return res.status(500).json({
          error:
            'Email sending is not configured (SENDGRID_API_KEY/FROM_EMAIL).',
        });
      }
      next(error);
    }
  });

  router.post('/verify-code', (req, res) => {
    let validated;
    try {
      validated = validateVerifyCodePayload(req.body || {});
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(400).json({ error: 'Invalid request payload' });
    }
    const { email, code } = validated;
    if (isOtpBypassEnabled) {
      if (code !== otpBypassCode) {
        return res.status(400).json({ error: 'Invalid code' });
      }
      return res.json({ ok: true, mode: 'dev_bypass' });
    }

    const entry = store.get(email);
    if (!entry) {
      return res.status(400).json({ error: 'Code not found or expired' });
    }
    if (entry.attempts >= config.email.maxAttempts) {
      return res.status(429).json({ error: 'Too many attempts' });
    }
    if (entry.code !== code) {
      store.incrementAttempt(email);
      return res.status(400).json({ error: 'Invalid code' });
    }
    store.delete(email);
    return res.json({ ok: true });
  });

  router.post('/register-with-code', async (req, res, next) => {
    try {
      if (!supabaseAdmin) {
        return res.status(500).json({ error: 'Supabase admin is not configured' });
      }
      const { email, code, password, role, metadata } =
        validateRegisterWithCodePayload(req.body || {});
      if (isOtpBypassEnabled) {
        if (code !== otpBypassCode) {
          return res.status(400).json({ error: 'Invalid code' });
        }
      } else {
        const entry = store.get(email);
        if (!entry) {
          return res.status(400).json({ error: 'Code not found or expired' });
        }
        if (entry.attempts >= config.email.maxAttempts) {
          return res.status(429).json({ error: 'Too many attempts' });
        }
        if (entry.code !== code) {
          store.incrementAttempt(email);
          return res.status(400).json({ error: 'Invalid code' });
        }
      }

      let existingUser = null;
      try {
        existingUser = await resolveUserByEmail(email);
      } catch (lookupError) {
        // Fallback: continue and rely on createUser duplicate check.
        console.warn('[auth/register-with-code] user lookup failed:', lookupError?.message);
      }
      if (existingUser) {
        store.delete(email);
        return res.status(409).json({ error: 'User with this email already exists' });
      }

      const userMetadata = { ...metadata, role };
      const appMetadata = { role };
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: userMetadata,
        app_metadata: appMetadata,
      });
      if (error || !data?.user) {
        return res.status(400).json({ error: error?.message || 'Failed to register user' });
      }

      store.delete(email);
      return res.json({
        data: {
          id: data.user.id,
          email: data.user.email || email,
          role,
        },
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      const message = String(error?.message || '');
      if (message) {
        return res.status(500).json({ error: `register-with-code failed: ${message}` });
      }
      next(error);
    }
  });

  router.post('/reset-password-with-code', async (req, res, next) => {
    try {
      if (!supabaseAdmin) {
        return res.status(500).json({ error: 'Supabase admin is not configured' });
      }
      const { email, code, password } = validateResetPasswordWithCodePayload(
        req.body || {}
      );
      if (isOtpBypassEnabled) {
        if (code !== otpBypassCode) {
          return res.status(400).json({ error: 'Invalid code' });
        }
      } else {
        const entry = store.get(email);
        if (!entry) {
          return res.status(400).json({ error: 'Code not found or expired' });
        }
        if (entry.attempts >= config.email.maxAttempts) {
          return res.status(429).json({ error: 'Too many attempts' });
        }
        if (entry.code !== code) {
          store.incrementAttempt(email);
          return res.status(400).json({ error: 'Invalid code' });
        }
      }

      const user = await resolveUserByEmail(email);
      if (!user?.id) {
        return res.status(404).json({ error: 'User not found' });
      }

      const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password,
      });
      if (error) {
        return res
          .status(400)
          .json({ error: error.message || 'Failed to reset password' });
      }

      store.delete(email);
      return res.json({ ok: true });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  });

  router.post('/delete-account', async (req, res, next) => {
    try {
      if (!supabaseAdmin) {
        return res.status(500).json({ error: 'Supabase admin is not configured' });
      }

      const token = getBearerToken(req);
      if (!token) {
        return res.status(401).json({ error: 'Authorization token is required' });
      }

      const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
      if (userError || !userData?.user) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
        userData.user.id
      );
      if (deleteError) {
        return res.status(500).json({ error: deleteError.message });
      }

      return res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.get('/users', async (req, res, next) => {
    try {
      if (!supabaseAdmin) {
        return res.status(500).json({ error: 'Supabase admin is not configured' });
      }

      const actor = await getActor(req);
      const actorRole = getUserRole(actor);
      if (!hasMinRole(actorRole, 'moderator')) {
        return res
          .status(403)
          .json({ error: 'Only moderator or superadmin can manage users' });
      }

      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 500,
      });
      if (error) {
        return res.status(500).json({ error: error.message });
      }

      const users = (data?.users || []).map((user) => ({
        id: user.id,
        email: user.email || '',
        createdAt: user.created_at || '',
        role: getUserRole(user) || 'user',
        firstName: String(user?.user_metadata?.firstName || '').trim(),
        lastName: String(user?.user_metadata?.lastName || '').trim(),
        bannedUntil: user.banned_until || null,
        isActive: !user.banned_until,
      }));
      return res.json({ data: users });
    } catch (error) {
      next(error);
    }
  });

  router.post('/set-role', async (req, res, next) => {
    try {
      if (!supabaseAdmin) {
        return res.status(500).json({ error: 'Supabase admin is not configured' });
      }

      const actor = await getActor(req);
      const actorRole = getUserRole(actor);
      if (!hasMinRole(actorRole, 'moderator')) {
        return res
          .status(403)
          .json({ error: 'Only moderator or superadmin can manage roles' });
      }

      const { email, role } = validateSetRolePayload(req.body || {});
      const allowedRoles =
        actorRole === 'superadmin'
          ? ['moderator', 'superadmin', 'admin', 'user']
          : ['moderator', 'admin', 'user'];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role value' });
      }

      const user = await resolveUserByEmail(email);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      const targetRole = getUserRole(user) || 'user';
      if (actorRole !== 'superadmin' && hasMinRole(targetRole, 'superadmin')) {
        return res
          .status(403)
          .json({ error: 'Moderator cannot edit superadmin accounts' });
      }

      const nextUserMetadata = { ...(user.user_metadata || {}), role };
      const nextAppMetadata = { ...(user.app_metadata || {}), role };

      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: nextUserMetadata,
        app_metadata: nextAppMetadata,
      });
      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.json({
        data: {
          id: data?.user?.id || user.id,
          email,
          role,
        },
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  });

  router.post('/users/:id/status', async (req, res, next) => {
    try {
      if (!supabaseAdmin) {
        return res.status(500).json({ error: 'Supabase admin is not configured' });
      }

      const actor = await getActor(req);
      const actorRole = getUserRole(actor);
      if (!hasMinRole(actorRole, 'moderator')) {
        return res
          .status(403)
          .json({ error: 'Only moderator or superadmin can manage users' });
      }

      const { userId, active } = validateUserStatusPayload(req.body || {}, {
        userId: req.params?.id,
      });

      if (actorRole !== 'superadmin') {
        const { data: targetUser, error: targetError } =
          await supabaseAdmin.auth.admin.getUserById(userId);
        if (targetError || !targetUser?.user) {
          return res.status(404).json({ error: 'User not found' });
        }
        const targetRole = getUserRole(targetUser.user) || 'user';
        if (hasMinRole(targetRole, 'superadmin')) {
          return res
            .status(403)
            .json({ error: 'Moderator cannot edit superadmin accounts' });
        }
      }

      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: active ? 'none' : '876000h',
      });
      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.json({
        data: {
          id: data?.user?.id || userId,
          isActive: active,
        },
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  });

  router.get('/users/:id/details', async (req, res, next) => {
    try {
      if (!supabaseAdmin) {
        return res.status(500).json({ error: 'Supabase admin is not configured' });
      }

      const actor = await getActor(req);
      const actorRole = getUserRole(actor);
      if (!hasMinRole(actorRole, 'moderator')) {
        return res
          .status(403)
          .json({ error: 'Only moderator or superadmin can manage users' });
      }

      const userId = String(req.params?.id || '').trim();
      if (!userId) {
        return res.status(400).json({ error: 'user id is required' });
      }

      const { data: targetUserData, error: targetError } =
        await supabaseAdmin.auth.admin.getUserById(userId);
      if (targetError || !targetUserData?.user) {
        return res.status(404).json({ error: 'User not found' });
      }
      const targetUser = targetUserData.user;
      const targetRole = getUserRole(targetUser) || 'user';
      if (actorRole !== 'superadmin' && hasMinRole(targetRole, 'superadmin')) {
        return res
          .status(403)
          .json({ error: 'Moderator cannot edit superadmin accounts' });
      }

      const settings = await getUserAdminSettings(
        targetUser.id,
        targetUser.email || ''
      );

      const surveyResponses = await listSurveyResponses();
      const surveyResponsesByUser = surveyResponses.filter(
        (item) => item?.user_id === targetUser.id
      );

      let consultationRows = [];
      try {
        const rawConsultations = await fs.readFile(consultationsPath, 'utf8');
        const parsed = JSON.parse(rawConsultations);
        if (Array.isArray(parsed)) consultationRows = parsed;
      } catch {
        consultationRows = [];
      }
      const targetEmail = String(targetUser.email || '')
        .trim()
        .toLowerCase();
      const consultationsByUser = consultationRows.filter((item) => {
        const candidates = [
          item?.email,
          item?.user_email,
          item?.userEmail,
          item?.parent_email,
          item?.parentEmail,
          item?.contact_email,
          item?.contactEmail,
        ];
        return candidates.some(
          (value) =>
            String(value || '')
              .trim()
              .toLowerCase() === targetEmail
        );
      });

      const lastSurveyAt =
        surveyResponsesByUser
          .map((item) => Date.parse(String(item?.created_at || '')))
          .filter((ts) => Number.isFinite(ts))
          .sort((a, b) => b - a)[0] || 0;
      const lastConsultAt =
        consultationsByUser
          .map((item) =>
            Date.parse(String(item?.createdAt || item?.created_at || ''))
          )
          .filter((ts) => Number.isFinite(ts))
          .sort((a, b) => b - a)[0] || 0;
      const lastSignInTs = Date.parse(String(targetUser.last_sign_in_at || '')) || 0;
      const lastActivityTs = Math.max(lastSignInTs, lastSurveyAt, lastConsultAt);

      return res.json({
        data: {
          user: {
            id: targetUser.id,
            email: targetUser.email || '',
            role: targetRole,
            firstName: String(targetUser?.user_metadata?.firstName || '').trim(),
            lastName: String(targetUser?.user_metadata?.lastName || '').trim(),
            createdAt: targetUser.created_at || '',
            lastSignInAt: targetUser.last_sign_in_at || '',
            bannedUntil: targetUser.banned_until || null,
            isActive: !targetUser.banned_until,
          },
          settings,
          analytics: {
            surveyResponsesCount: surveyResponsesByUser.length,
            consultationRequestsCount: consultationsByUser.length,
            aiChatRequestsCount: 0,
            aiMatchRequestsCount: 0,
            mostVisitedSections: ['schools', 'news', 'profile'],
            lastActivityAt: lastActivityTs
              ? new Date(lastActivityTs).toISOString()
              : '',
          },
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/users/:id/settings', async (req, res, next) => {
    try {
      if (!supabaseAdmin) {
        return res.status(500).json({ error: 'Supabase admin is not configured' });
      }

      const actor = await getActor(req);
      const actorRole = getUserRole(actor);
      if (!hasMinRole(actorRole, 'moderator')) {
        return res
          .status(403)
          .json({ error: 'Only moderator or superadmin can manage users' });
      }

      const userId = String(req.params?.id || '').trim();
      if (!userId) {
        return res.status(400).json({ error: 'user id is required' });
      }

      const { data: targetUserData, error: targetError } =
        await supabaseAdmin.auth.admin.getUserById(userId);
      if (targetError || !targetUserData?.user) {
        return res.status(404).json({ error: 'User not found' });
      }
      const targetUser = targetUserData.user;
      const targetRole = getUserRole(targetUser) || 'user';
      if (actorRole !== 'superadmin' && hasMinRole(targetRole, 'superadmin')) {
        return res
          .status(403)
          .json({ error: 'Moderator cannot edit superadmin accounts' });
      }

      const body = req.body || {};
      const nextSettings = await upsertUserAdminSettings({
        user_id: userId,
        email: targetUser.email || '',
        first_name: body?.first_name || body?.firstName || '',
        last_name: body?.last_name || body?.lastName || '',
        subscription: {
          plan: body?.subscription?.plan,
          status: body?.subscription?.status,
          starts_at: body?.subscription?.starts_at,
          ends_at: body?.subscription?.ends_at,
          auto_renew: body?.subscription?.auto_renew,
        },
        ai_limits: {
          chat_bonus: body?.ai_limits?.chat_bonus,
          selector_bonus: body?.ai_limits?.selector_bonus,
          bonus_expires_at: body?.ai_limits?.bonus_expires_at,
        },
        notes: body?.notes,
        updated_by: actor.email || actor.id || 'moderator',
      });

      return res.json({ data: nextSettings });
    } catch (error) {
      next(error);
    }
  });

  router.post('/create-school-account', async (req, res, next) => {
    try {
      if (!supabaseAdmin) {
        return res.status(500).json({ error: 'Supabase admin is not configured' });
      }

      const actor = await getActor(req);
      const actorRole = getUserRole(actor);
      if (actorRole !== 'superadmin') {
        return res
          .status(403)
          .json({ error: 'Only superadmin can create school accounts' });
      }

      const { email, password, schoolId, schoolName } =
        validateCreateSchoolAccountPayload(req.body || {});
      const existing = await resolveUserByEmail(email);
      if (existing) {
        return res.status(409).json({ error: 'User with this email already exists' });
      }
      const inferredSchoolId =
        schoolId ||
        `school-${String(email.split('@')[0] || '')
          .toLowerCase()
          .replace(/[^a-z0-9._-]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 60) || Date.now()}`;

      const userMetadata = {
        role: 'admin',
        school_id: inferredSchoolId,
        school_name: schoolName || '',
        created_by: actor.email || actor.id || 'superadmin',
      };
      const appMetadata = {
        role: 'admin',
        school_id: inferredSchoolId,
      };

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: userMetadata,
        app_metadata: appMetadata,
      });
      if (error || !data?.user) {
        return res
          .status(400)
          .json({ error: error?.message || 'Failed to create school account' });
      }
      await appendSchoolAccessLog({
        email,
        password,
        schoolId: inferredSchoolId,
        actor: actor.email || actor.id || 'superadmin',
      });

      return res.json({
        data: {
          id: data.user.id,
          email: data.user.email || email,
          role: 'admin',
          schoolId: inferredSchoolId,
        },
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  });

  router.get('/school-access-log', async (req, res, next) => {
    try {
      if (!supabaseAdmin) {
        return res.status(500).json({ error: 'Supabase admin is not configured' });
      }
      const actor = await getActor(req);
      const actorRole = getUserRole(actor);
      if (actorRole !== 'superadmin') {
        return res.status(403).json({ error: 'Only superadmin can view school access log' });
      }
      const data = await readSchoolAccessLog();
      return res.json({ data });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/school-access-log', async (req, res, next) => {
    try {
      if (!supabaseAdmin) {
        return res.status(500).json({ error: 'Supabase admin is not configured' });
      }
      const actor = await getActor(req);
      const actorRole = getUserRole(actor);
      if (actorRole !== 'superadmin') {
        return res.status(403).json({ error: 'Only superadmin can clear school access log' });
      }
      const data = await clearSchoolAccessLog();
      return res.json({ data });
    } catch (error) {
      next(error);
    }
  });

  router.post('/school-access-log', async (req, res, next) => {
    try {
      if (!supabaseAdmin) {
        return res.status(500).json({ error: 'Supabase admin is not configured' });
      }
      const actor = await getActor(req);
      const actorRole = getUserRole(actor);
      if (actorRole !== 'superadmin') {
        return res.status(403).json({ error: 'Only superadmin can update school access log' });
      }
      const id = String(req.body?.id || '').trim();
      const email = String(req.body?.email || '')
        .trim()
        .toLowerCase();
      const password = String(req.body?.password || '');
      const schoolId = String(req.body?.schoolId || '').trim();
      const createdAt = String(req.body?.createdAt || '').trim();
      const status = String(req.body?.status || '')
        .trim()
        .toLowerCase();
      if (!id || !email) {
        return res.status(400).json({ error: 'id and email are required' });
      }
      if (status && !ALLOWED_STATUSES.has(status)) {
        return res.status(400).json({ error: 'Invalid status. Use: создан, выдан, заполнен' });
      }
      const passwordForAuth = password.trim();
      if (passwordForAuth && passwordForAuth !== '-' && passwordForAuth.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }

      let authSync = 'skipped';
      if (passwordForAuth && passwordForAuth !== '-') {
        try {
          const authUser = await resolveUserByEmail(email);
          if (authUser?.id) {
            const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
              authUser.id,
              { password: passwordForAuth }
            );
            if (updateError) {
              authSync = 'failed';
            } else {
              authSync = 'ok';
            }
          } else {
            authSync = 'user_not_found';
          }
        } catch {
          authSync = 'failed';
        }
      }

      const row = await upsertSchoolAccessLogEntry({
        id,
        email,
        password,
        schoolId,
        createdAt,
        status: status || 'создан',
        actor: actor.email || actor.id || 'superadmin',
      });
      return res.json({ data: row, authSync });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/school-access-log/:id', async (req, res, next) => {
    try {
      if (!supabaseAdmin) {
        return res.status(500).json({ error: 'Supabase admin is not configured' });
      }
      const actor = await getActor(req);
      const actorRole = getUserRole(actor);
      if (actorRole !== 'superadmin') {
        return res.status(403).json({ error: 'Only superadmin can update school access log' });
      }
      const id = String(req.params.id || '').trim();
      const status = String(req.body?.status || '')
        .trim()
        .toLowerCase();
      if (!id) {
        return res.status(400).json({ error: 'id is required' });
      }
      if (!ALLOWED_STATUSES.has(status)) {
        return res.status(400).json({ error: 'Invalid status. Use: создан, выдан, заполнен' });
      }
      const row = await updateSchoolAccessLogStatus(id, status);
      if (!row) {
        return res.status(404).json({ error: 'School access log entry not found' });
      }
      return res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/school-access-log/:id', async (req, res, next) => {
    try {
      if (!supabaseAdmin) {
        return res.status(500).json({ error: 'Supabase admin is not configured' });
      }
      const actor = await getActor(req);
      const actorRole = getUserRole(actor);
      if (actorRole !== 'superadmin') {
        return res.status(403).json({ error: 'Only superadmin can update school access log' });
      }
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ error: 'id is required' });
      }
      const ok = await deleteSchoolAccessLogEntry(id);
      if (!ok) {
        return res.status(404).json({ error: 'School access log entry not found' });
      }
      return res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/school-access-log/:id/full', async (req, res, next) => {
    try {
      if (!supabaseAdmin) {
        return res.status(500).json({ error: 'Supabase admin is not configured' });
      }
      const actor = await getActor(req);
      const actorRole = getUserRole(actor);
      if (actorRole !== 'superadmin') {
        return res.status(403).json({ error: 'Only superadmin can delete school account data' });
      }

      const id = String(req.params.id || '').trim();
      const email = String(req.query?.email || '')
        .trim()
        .toLowerCase();
      const schoolId = String(req.query?.schoolId || '').trim();
      if (!id) {
        return res.status(400).json({ error: 'id is required' });
      }

      let userDeleted = false;
      if (email) {
        const authUser = await resolveUserByEmail(email);
        if (authUser?.id) {
          const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);
          if (deleteUserError) {
            return res.status(500).json({ error: deleteUserError.message || 'Failed to delete school admin user' });
          }
          userDeleted = true;
        }
      }

      let schoolDeleted = false;
      if (schoolId) {
        await deleteSchool(schoolId);
        schoolDeleted = true;
      }

      const logDeleted = await deleteSchoolAccessLogEntry(id);

      return res.json({
        ok: true,
        data: {
          logDeleted,
          userDeleted,
          schoolDeleted,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
};

module.exports = { buildAuthRouter };
