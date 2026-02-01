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

  return router;
};

module.exports = { buildAuthRouter };
