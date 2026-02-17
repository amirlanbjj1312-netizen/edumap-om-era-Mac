const express = require('express');
const sgMail = require('@sendgrid/mail');
const { createClient } = require('@supabase/supabase-js');
const { OtpStore } = require('../services/otpStore');

const buildAuthRouter = (config) => {
  const router = express.Router();
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
      const { email } = req.body || {};
      if (!email || !String(email).trim()) {
        return res.status(400).json({ error: 'Email is required' });
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
      next(error);
    }
  });

  router.post('/verify-code', (req, res) => {
    const { email, code } = req.body || {};
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
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
      if (getUserRole(actor) !== 'superadmin') {
        return res.status(403).json({ error: 'Only superadmin can manage roles' });
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
      if (getUserRole(actor) !== 'superadmin') {
        return res.status(403).json({ error: 'Only superadmin can manage roles' });
      }

      const email = String(req.body?.email || '').trim().toLowerCase();
      const role = String(req.body?.role || '').trim();
      const allowedRoles = ['moderator', 'superadmin', 'admin', 'user'];
      if (!email) {
        return res.status(400).json({ error: 'Field "email" is required' });
      }
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role value' });
      }

      const user = await resolveUserByEmail(email);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
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
      next(error);
    }
  });

  router.post('/users/:id/status', async (req, res, next) => {
    try {
      if (!supabaseAdmin) {
        return res.status(500).json({ error: 'Supabase admin is not configured' });
      }

      const actor = await getActor(req);
      if (getUserRole(actor) !== 'superadmin') {
        return res.status(403).json({ error: 'Only superadmin can manage users' });
      }

      const userId = String(req.params?.id || '').trim();
      if (!userId) {
        return res.status(400).json({ error: 'User id is required' });
      }
      const active = req.body?.active !== false;

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
      next(error);
    }
  });

  return router;
};

module.exports = { buildAuthRouter };
