const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const {
  readStore,
  upsertSchool,
  deleteSchool,
} = require('../services/schoolsStore');
const {
  recordProgramAnalyticsEvent,
  getProgramAnalyticsSummary,
} = require('../services/programAnalyticsStore');
const { buildConfig } = require('../utils/config');

const buildSchoolsRouter = () => {
  const router = express.Router();
  const config = buildConfig();
  const supabaseAdmin =
    config.supabase?.url && config.supabase?.serviceRoleKey
      ? createClient(config.supabase.url, config.supabase.serviceRoleKey, {
          auth: { persistSession: false },
        })
      : null;

  const isTrue = (value) =>
    value === true ||
    value === 'true' ||
    value === '1' ||
    value === 1;

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

  const requireModerator = async (req, res) => {
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
    if (!hasMinRole(role, 'moderator')) {
      res
        .status(403)
        .json({ error: 'Only moderator or superadmin can manage reviews' });
      return null;
    }
    return data.user;
  };
  const requireSuperadmin = async (req, res) => {
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
    if (!hasMinRole(role, 'superadmin')) {
      res.status(403).json({ error: 'Only superadmin can process test payments' });
      return null;
    }
    return data.user;
  };

  const TEST_BILLING_TARIFFS = [
    {
      id: 'starter_30',
      name: 'Top Starter',
      description: '1 активный топ-слот в выбранной локации',
      price_kzt: 30000,
      duration_days: 30,
      priority_weight: 10,
    },
    {
      id: 'growth_30',
      name: 'Top Growth',
      description: 'Повышенный приоритет в топ-блоке',
      price_kzt: 60000,
      duration_days: 30,
      priority_weight: 25,
    },
    {
      id: 'premium_30',
      name: 'Top Premium',
      description: 'Максимальный приоритет в топ-блоке',
      price_kzt: 120000,
      duration_days: 30,
      priority_weight: 50,
    },
    {
      id: 'premium_90',
      name: 'Top Premium 90',
      description: 'Максимальный приоритет на 90 дней',
      price_kzt: 300000,
      duration_days: 90,
      priority_weight: 55,
    },
  ];

  router.get('/billing/tariffs', async (_req, res) => {
    res.json({ data: TEST_BILLING_TARIFFS });
  });

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

  router.post('/analytics/program-info', async (req, res, next) => {
    try {
      const schoolId = String(req.body?.schoolId || '').trim();
      const programName = String(req.body?.programName || '').trim();
      const eventType = String(req.body?.eventType || '').trim();

      if (!schoolId || !programName || !eventType) {
        return res.status(400).json({
          error: 'schoolId, programName and eventType are required',
        });
      }

      await recordProgramAnalyticsEvent({
        schoolId,
        programName,
        eventType,
        locale: req.body?.locale,
        expanded: Boolean(req.body?.expanded),
        source: req.body?.source || 'mobile',
      });

      res.json({ ok: true });
    } catch (error) {
      if (String(error?.message || '').includes('Invalid eventType')) {
        return res.status(400).json({ error: 'Invalid eventType' });
      }
      next(error);
    }
  });

  router.get('/analytics/program-info', async (req, res, next) => {
    try {
      const actor = await requireModerator(req, res);
      if (!actor) return;

      const days = Number.parseInt(String(req.query?.days || '30'), 10);
      const limit = Number.parseInt(String(req.query?.limit || '10'), 10);
      const summary = await getProgramAnalyticsSummary({ days, limit });
      const schools = await readStore();
      const nameById = schools.reduce((acc, school) => {
        const schoolId = school?.school_id;
        if (!schoolId) return acc;
        const schoolName =
          school?.basic_info?.display_name?.ru ||
          school?.basic_info?.name?.ru ||
          school?.basic_info?.display_name?.en ||
          school?.basic_info?.name?.en ||
          schoolId;
        acc[schoolId] = schoolName;
        return acc;
      }, {});

      const topSchools = (summary.topSchools || []).map((row) => ({
        ...row,
        school_name: nameById[row.school_id] || row.school_id,
      }));

      res.json({
        data: {
          ...summary,
          topSchools,
          actor: actor.email || actor.id,
        },
      });
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

  router.get('/reviews/all', async (req, res, next) => {
    try {
      const actor = await requireModerator(req, res);
      if (!actor) return;
      const schools = await readStore();
      const rows = [];
      for (const school of schools) {
        const reviews = Array.isArray(school?.reviews?.items)
          ? school.reviews.items
          : [];
        const schoolName =
          school?.basic_info?.display_name?.ru ||
          school?.basic_info?.name?.ru ||
          school?.school_id ||
          '';
        for (const review of reviews) {
          rows.push({
            id: review?.id || `review-${Date.now()}`,
            school_id: school?.school_id || '',
            school_name: schoolName,
            author: review?.author || '',
            text: review?.text || '',
            rating: Number(review?.rating) || 0,
            created_at: review?.created_at || '',
          });
        }
      }
      rows.sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
      res.json({ data: rows });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/reviews/:reviewId', async (req, res, next) => {
    try {
      const actor = await requireModerator(req, res);
      if (!actor) return;
      const reviewId = String(req.params?.reviewId || '').trim();
      if (!reviewId) {
        return res.status(400).json({ error: 'reviewId is required' });
      }

      const schools = await readStore();
      let updatedProfile = null;

      for (const school of schools) {
        const reviews = Array.isArray(school?.reviews?.items)
          ? school.reviews.items
          : [];
        if (!reviews.some((item) => String(item?.id || '') === reviewId)) {
          continue;
        }
        const nextReviews = reviews.filter(
          (item) => String(item?.id || '') !== reviewId
        );
        const ratingSum = nextReviews.reduce(
          (sum, item) => sum + (Number(item?.rating) || 0),
          0
        );
        const averageRating =
          nextReviews.length > 0 ? ratingSum / nextReviews.length : null;
        const highlightText = nextReviews[0]?.text || '';

        const auditLog = Array.isArray(school?.system?.audit_log)
          ? school.system.audit_log
          : [];

        updatedProfile = {
          ...school,
          reviews: {
            ...(school.reviews || {}),
            items: nextReviews,
            count: nextReviews.length,
            average_rating: averageRating,
            highlight: highlightText,
          },
          system: {
            ...(school.system || {}),
            rating: averageRating,
            reviews_count: nextReviews.length,
            highlight_review: highlightText,
            updated_at: new Date().toISOString(),
            audit_log: [
              {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                at: new Date().toISOString(),
                action: 'delete_review',
                actor: actor.email || actor.id,
                review_id: reviewId,
              },
              ...auditLog,
            ].slice(0, 100),
          },
        };
        break;
      }

      if (!updatedProfile) {
        return res.status(404).json({ error: 'Review not found' });
      }

      await upsertSchool(updatedProfile);
      return res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/payments/test', async (req, res, next) => {
    try {
      const actor = await requireSuperadmin(req, res);
      if (!actor) return;

      const schoolId = String(req.params?.id || '').trim();
      const tariffId = String(req.body?.tariffId || '').trim();
      if (!schoolId || !tariffId) {
        return res.status(400).json({ error: 'schoolId and tariffId are required' });
      }

      const tariff = TEST_BILLING_TARIFFS.find((item) => item.id === tariffId);
      if (!tariff) {
        return res.status(400).json({ error: 'Invalid tariffId' });
      }

      const schools = await readStore();
      const school = schools.find((item) => item?.school_id === schoolId);
      if (!school) {
        return res.status(404).json({ error: 'School not found' });
      }

      const now = new Date();
      const startsAtIso = now.toISOString();
      const endsAt = new Date(now.getTime());
      endsAt.setDate(endsAt.getDate() + Number(tariff.duration_days || 30));
      const endsAtIso = endsAt.toISOString();
      const paymentId = `testpay-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

      const currentAuditLog = Array.isArray(school?.system?.audit_log)
        ? school.system.audit_log
        : [];
      const currentPayments = Array.isArray(school?.monetization?.payments)
        ? school.monetization.payments
        : [];

      const paymentRecord = {
        id: paymentId,
        type: 'test',
        status: 'paid',
        tariff_id: tariff.id,
        tariff_name: tariff.name,
        amount_kzt: tariff.price_kzt,
        currency: 'KZT',
        paid_at: startsAtIso,
        actor: actor.email || actor.id,
      };

      const updatedProfile = {
        ...school,
        monetization: {
          ...(school?.monetization || {}),
          is_promoted: true,
          subscription_status: 'active',
          plan_name: tariff.name,
          priority_weight: Number(tariff.priority_weight) || 0,
          starts_at: startsAtIso,
          ends_at: endsAtIso,
          last_tariff_id: tariff.id,
          last_payment_id: paymentId,
          payments: [paymentRecord, ...currentPayments].slice(0, 50),
        },
        system: {
          ...(school?.system || {}),
          updated_at: startsAtIso,
          audit_log: [
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              at: startsAtIso,
              action: 'payment_test_success',
              actor: actor.email || actor.id,
              school_id: schoolId,
              payment_id: paymentId,
              tariff_id: tariff.id,
              amount_kzt: tariff.price_kzt,
            },
            ...currentAuditLog,
          ].slice(0, 100),
        },
      };

      const saved = await upsertSchool(updatedProfile);

      res.json({
        data: {
          school_id: schoolId,
          payment: {
            id: paymentId,
            status: 'paid',
            tariff_id: tariff.id,
            amount_kzt: tariff.price_kzt,
            paid_at: startsAtIso,
          },
          monetization: saved?.monetization || updatedProfile.monetization,
          profile: saved,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
};

module.exports = { buildSchoolsRouter };
