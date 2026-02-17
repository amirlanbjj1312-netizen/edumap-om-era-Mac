const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const {
  readStore,
  upsertSchool,
  deleteSchool,
} = require('../services/schoolsStore');
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
    if (role !== 'superadmin') {
      res.status(403).json({ error: 'Only superadmin can manage reviews' });
      return null;
    }
    return data.user;
  };

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
      const actor = await requireSuperadmin(req, res);
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
      const actor = await requireSuperadmin(req, res);
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

  return router;
};

module.exports = { buildSchoolsRouter };
