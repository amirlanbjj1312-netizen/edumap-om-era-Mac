const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const {
  readStore,
  listSchools,
  getSchoolById,
  upsertSchool,
  deleteSchool,
} = require('../services/schoolsStore');
const { ConsultationStore } = require('../services/consultationStore');
const { readSurveyStore, listSurveyResponses } = require('../services/ratingSurveyStore');
const { calculateCompositeRating } = require('../services/schoolRating');
const {
  recordProgramAnalyticsEvent,
  getProgramAnalyticsSummary,
  resetProgramAnalytics,
} = require('../services/programAnalyticsStore');
const {
  recordEngagementAnalyticsEvent,
  getEngagementAnalyticsSummary,
  getSchoolEngagementAnalyticsSummary,
  listSchoolViewerAccounts,
  resetEngagementAnalytics,
} = require('../services/engagementAnalyticsStore');
const { buildConfig } = require('../utils/config');
const { autofillMissingSchoolLocales } = require('../services/schoolLocaleTranslator');
const { ValidationError, validateSchoolPayload } = require('../validation');

const buildSchoolsRouter = () => {
  const router = express.Router();
  const config = buildConfig();
  const consultationsStore = new ConsultationStore(config.dataFilePath);
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
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const getBearerToken = (req) => {
    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) {
      return header.slice(7).trim();
    }
    return null;
  };
  const normalizeText = (value) => String(value || '').trim();
  const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
  const getActorAssignedSchoolId = (actor) =>
    normalizeText(
      actor?.app_metadata?.school_id || actor?.user_metadata?.school_id || ''
    );
  const buildFallbackSchoolId = (email) => {
    const base = normalizeEmail(email)
      .split('@')[0]
      .replace(/[^a-z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
    return `school-${base || 'school'}`;
  };
  const isAdminOwnSchool = (actor, profile) => {
    const actorEmail = normalizeEmail(actor?.email);
    if (!actorEmail) return false;
    const schoolEmail = normalizeEmail(profile?.basic_info?.email);
    const schoolId = String(profile?.school_id || '').trim().toLowerCase();
    const assignedSchoolId = getActorAssignedSchoolId(actor).toLowerCase();
    const fallbackSchoolId = buildFallbackSchoolId(actorEmail);
    return (
      schoolEmail === actorEmail ||
      (assignedSchoolId && schoolId === assignedSchoolId) ||
      schoolId === fallbackSchoolId
    );
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
    if (role !== 'superadmin') {
      res.status(403).json({ error: 'Only superadmin can reset analytics' });
      return null;
    }
    return data.user;
  };
  const requireAdminOrSuperadmin = async (req, res) => {
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
        .json({ error: 'Only admin/superadmin can manage schools and payments' });
      return null;
    }
    return { user: data.user, role };
  };
  const requireAuthenticatedActor = async (req, res) => {
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
      data.user?.user_metadata?.role || data.user?.app_metadata?.role || 'user';
    return { user: data.user, role };
  };
  const resolveUsersByIds = async (ids) => {
    if (!supabaseAdmin) return [];
    const uniqueIds = Array.from(
      new Set(
        (Array.isArray(ids) ? ids : [])
          .map((item) => normalizeText(item))
          .filter(Boolean)
      )
    ).slice(0, 100);
    if (!uniqueIds.length) return [];
    const users = await Promise.all(
      uniqueIds.map(async (userId) => {
        try {
          const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
          if (error || !data?.user) return null;
          return data.user;
        } catch (_error) {
          return null;
        }
      })
    );
    return users.filter(Boolean);
  };
  const resolveOptionalActor = async (req) => {
    const token = getBearerToken(req);
    if (!token || !supabaseAdmin) {
      return { actorType: 'guest', actorUserId: null, actorRole: 'guest' };
    }
    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !data?.user) {
        return { actorType: 'guest', actorUserId: null, actorRole: 'guest' };
      }
      const role =
        data.user?.user_metadata?.role || data.user?.app_metadata?.role || 'user';
      return {
        actorType: 'auth',
        actorUserId: data.user.id,
        actorRole: role,
      };
    } catch (_error) {
      return { actorType: 'guest', actorUserId: null, actorRole: 'guest' };
    }
  };
  const recalculateSchoolRating = async (school) => {
    if (!school) return school;
    const schoolId = String(school?.school_id || '').trim();
    const [surveyStore, allResponses, consultations] = await Promise.all([
      readSurveyStore(),
      listSurveyResponses(),
      consultationsStore.list(),
    ]);
    const questionById = new Map(
      (surveyStore?.config?.questions || []).map((question) => [String(question?.id || '').trim(), question])
    );
    const schoolResponses = allResponses.filter((item) => String(item?.school_id || '').trim() === schoolId);
    const formula = calculateCompositeRating({
      school,
      surveyResponses: schoolResponses,
      consultations,
      questionById,
      popularityCount: Number(school?.system?.popularity || 0),
      schoolId,
    });
    return {
      ...school,
      system: {
        ...(school.system || {}),
        rating: formula.rating,
        reviews_count: Array.isArray(school?.reviews?.items) ? school.reviews.items.length : 0,
        feedback_count: formula.breakdown?.feedback_count || schoolResponses.length,
        rating_breakdown: formula.breakdown,
        rating_formula: {
          survey_average: formula.survey_average,
          total_points: formula.total_points,
          points: formula.points,
          consultations_count: consultations.filter(
            (item) => String(item?.schoolId || '').trim() === schoolId
          ).length,
          popularity_count: Number(school?.system?.popularity || 0),
          survey_responses_count: schoolResponses.length,
          updated_at: new Date().toISOString(),
        },
      },
    };
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

  const SUBSCRIPTION_LIMITS = {
    starter: { photos: 20, clubs: 10, staff: 30 },
    growth: { photos: 200, clubs: 50, staff: 100 },
    pro: { photos: 500, clubs: 120, staff: 250 },
  };

  const splitCsv = (value) =>
    String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

  const resolvePlanKey = (profile = {}) => {
    const lastTariffId = String(profile?.monetization?.last_tariff_id || '')
      .trim()
      .toLowerCase();
    const planName = String(profile?.monetization?.plan_name || '')
      .trim()
      .toLowerCase();

    const source = `${lastTariffId} ${planName}`.trim();
    if (!source) return 'starter';
    if (source.includes('premium') || source.includes('pro')) return 'pro';
    if (source.includes('growth')) return 'growth';
    if (source.includes('starter')) return 'starter';
    return 'starter';
  };

  const validatePlanContentLimits = (profile = {}) => {
    const planKey = resolvePlanKey(profile);
    const limits = SUBSCRIPTION_LIMITS[planKey] || SUBSCRIPTION_LIMITS.starter;

    const photosCount = splitCsv(profile?.media?.photos).length;
    if (photosCount > limits.photos) {
      throw new ValidationError(
        `Photos limit exceeded for ${planKey} plan: ${photosCount}/${limits.photos}`
      );
    }

    const clubsCount = Array.isArray(profile?.services?.clubs_catalog)
      ? profile.services.clubs_catalog.length
      : 0;
    if (clubsCount > limits.clubs) {
      throw new ValidationError(
        `Clubs/sections limit exceeded for ${planKey} plan: ${clubsCount}/${limits.clubs}`
      );
    }

    const staffCount = Array.isArray(profile?.services?.teaching_staff?.members)
      ? profile.services.teaching_staff.members.length
      : 0;
    if (staffCount > limits.staff) {
      throw new ValidationError(
        `Teaching staff cards limit exceeded for ${planKey} plan: ${staffCount}/${limits.staff}`
      );
    }
  };

  router.get('/billing/tariffs', async (_req, res) => {
    res.json({ data: TEST_BILLING_TARIFFS });
  });

  router.get('/', async (req, res, next) => {
    try {
      const includeInactive = isTrue(req.query.include_inactive || req.query.includeInactive);
      const includeHidden = isTrue(req.query.include_hidden || req.query.includeHidden);
      const limit = Number.parseInt(String(req.query?.limit || '0'), 10);
      const offset = Number.parseInt(String(req.query?.offset || '0'), 10);
      const result = await listSchools({
        includeInactive,
        includeHidden,
        city: req.query?.city,
        district: req.query?.district,
        type: req.query?.type,
        subtype: req.query?.subtype,
        q: req.query?.q,
        limit: Number.isFinite(limit) ? limit : 0,
        offset: Number.isFinite(offset) ? offset : 0,
      });
      res.json({
        data: result.data,
        meta: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
          hasMore: result.limit ? result.offset + result.data.length < result.total : false,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const school = await getSchoolById(req.params.id, {
        includeInactive: isTrue(req.query.include_inactive || req.query.includeInactive),
        includeHidden: isTrue(req.query.include_hidden || req.query.includeHidden),
      });
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
      const locale = String(req.body?.locale || '').trim();
      const source = String(req.body?.source || 'mobile').trim();

      if (!schoolId || !programName || !eventType) {
        return res.status(400).json({
          error: 'schoolId, programName and eventType are required',
        });
      }
      if (schoolId.length > 120 || programName.length > 200 || source.length > 40) {
        return res.status(400).json({ error: 'Invalid analytics payload length' });
      }
      if (locale && !['ru', 'en', 'kk'].includes(locale)) {
        return res.status(400).json({ error: 'Invalid locale' });
      }

      await recordProgramAnalyticsEvent({
        schoolId,
        programName,
        eventType,
        locale,
        expanded: Boolean(req.body?.expanded),
        source,
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
        const schoolName =
          school?.basic_info?.display_name?.ru ||
          school?.basic_info?.name?.ru ||
          school?.basic_info?.display_name?.en ||
          school?.basic_info?.name?.en ||
          school?.basic_info?.email ||
          schoolId ||
          'Школа';
        if (schoolId) {
          acc[schoolId] = schoolName;
        }
        const email = normalizeEmail(school?.basic_info?.email);
        if (email) {
          acc[buildFallbackSchoolId(email)] = schoolName;
        }
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

  router.post('/analytics/program-info/reset', async (req, res, next) => {
    try {
      const actor = await requireSuperadmin(req, res);
      if (!actor) return;
      const result = await resetProgramAnalytics({
        actorEmail: String(actor.email || ''),
      });
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  router.post('/analytics/engagement', async (req, res, next) => {
    try {
      const actor = await resolveOptionalActor(req);
      if (actor.actorType !== 'auth' || !actor.actorUserId) {
        return res.json({ ok: true });
      }
      const schoolId = String(req.body?.schoolId || '').trim();
      const eventType = String(req.body?.eventType || '').trim();
      const locale = String(req.body?.locale || '').trim();
      const source = String(req.body?.source || 'parent_web').trim();

      if (!eventType) {
        return res.status(400).json({ error: 'eventType is required' });
      }
      if (schoolId.length > 120 || source.length > 40) {
        return res.status(400).json({ error: 'Invalid analytics payload length' });
      }
      if (locale && !['ru', 'en', 'kk'].includes(locale)) {
        return res.status(400).json({ error: 'Invalid locale' });
      }

      await recordEngagementAnalyticsEvent({
        schoolId: schoolId || null,
        eventType,
        locale,
        source,
        actorType: actor.actorType,
        actorUserId: actor.actorUserId,
        metadata: req.body?.metadata,
      });

      res.json({ ok: true });
    } catch (error) {
      if (String(error?.message || '').includes('Invalid eventType')) {
        return res.status(400).json({ error: 'Invalid eventType' });
      }
      next(error);
    }
  });

  router.get('/analytics/engagement', async (req, res, next) => {
    try {
      const actorPayload = await requireAdminOrSuperadmin(req, res);
      if (!actorPayload) return;
      const actor = actorPayload.user;
      const actorRole = actorPayload.role;

      const days = Number.parseInt(String(req.query?.days || '30'), 10);
      const limit = Number.parseInt(String(req.query?.limit || '10'), 10);
      const requestedSchoolId = normalizeText(req.query?.schoolId);

      if (actorRole === 'admin') {
        const schools = await readStore();
        const assignedSchoolId = getActorAssignedSchoolId(actor).toLowerCase();
        const actorEmail = normalizeEmail(actor?.email);
        const fallbackSchoolId = buildFallbackSchoolId(actorEmail).toLowerCase();
        const ownSchool =
          schools.find(
            (item) => String(item?.school_id || '').trim().toLowerCase() === assignedSchoolId
          ) ||
          schools.find(
            (item) => normalizeEmail(item?.basic_info?.email) === actorEmail
          ) ||
          schools.find(
            (item) => String(item?.school_id || '').trim().toLowerCase() === fallbackSchoolId
          ) ||
          null;

        const schoolId = String(ownSchool?.school_id || assignedSchoolId || fallbackSchoolId).trim();
        const schoolName =
          ownSchool?.basic_info?.display_name?.ru ||
          ownSchool?.basic_info?.name?.ru ||
          ownSchool?.basic_info?.display_name?.en ||
          ownSchool?.basic_info?.name?.en ||
          schoolId;
        const summary = await getSchoolEngagementAnalyticsSummary({ schoolId, days });
        return res.json({
          data: {
            ...summary,
            school_name: schoolName,
            actor: actor.email || actor.id,
          },
        });
      }

      if (requestedSchoolId) {
        const schools = await readStore();
        const targetSchool =
          schools.find(
            (item) => String(item?.school_id || '').trim().toLowerCase() === requestedSchoolId.toLowerCase()
          ) || null;
        const schoolName =
          targetSchool?.basic_info?.display_name?.ru ||
          targetSchool?.basic_info?.name?.ru ||
          targetSchool?.basic_info?.display_name?.en ||
          targetSchool?.basic_info?.name?.en ||
          requestedSchoolId;
        const [summary, rawViewerAccounts] = await Promise.all([
          getSchoolEngagementAnalyticsSummary({ schoolId: requestedSchoolId, days }),
          listSchoolViewerAccounts({ schoolId: requestedSchoolId, days, limit: 50 }),
        ]);
        const users = await resolveUsersByIds(
          rawViewerAccounts.map((item) => item.actor_user_id)
        );
        const userById = new Map(
          users.map((user) => [
            String(user.id || ''),
            {
              user_id: String(user.id || ''),
              email: normalizeEmail(user.email),
              first_name: normalizeText(user.user_metadata?.first_name || user.user_metadata?.firstName),
              last_name: normalizeText(user.user_metadata?.last_name || user.user_metadata?.lastName),
              role:
                user?.user_metadata?.role || user?.app_metadata?.role || 'user',
            },
          ])
        );

        return res.json({
          data: {
            ...summary,
            school_name: schoolName,
            viewer_accounts: rawViewerAccounts.map((row) => {
              const user = userById.get(String(row.actor_user_id || ''));
              const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();
              return {
                actor_user_id: row.actor_user_id,
                email: user?.email || '',
                name: fullName || user?.email || row.actor_user_id,
                role: user?.role || 'user',
                views_count: row.views_count,
                last_view_at: row.last_view_at,
              };
            }),
            actor: actor.email || actor.id,
          },
        });
      }

      const summary = await getEngagementAnalyticsSummary({ days, limit });
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

      res.json({
        data: {
          ...summary,
          topSchools: (summary.topSchools || []).map((row) => ({
            ...row,
            school_name: nameById[row.school_id] || row.school_id,
          })),
          actor: actor.email || actor.id,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/analytics/engagement/reset', async (req, res, next) => {
    try {
      const actor = await requireSuperadmin(req, res);
      if (!actor) return;
      const result = await resetEngagementAnalytics({
        actorEmail: String(actor.email || ''),
      });
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  router.post('/translate-locales', async (req, res, next) => {
    try {
      const actorPayload = await requireAdminOrSuperadmin(req, res);
      if (!actorPayload) return;
      const actor = actorPayload.user;
      const actorRole = actorPayload.role;
      const profile = validateSchoolPayload(req.body || {});
      const assignedSchoolId = getActorAssignedSchoolId(actor);
      const normalizedProfile =
        actorRole === 'admin' && assignedSchoolId
          ? { ...profile, school_id: assignedSchoolId }
          : profile;
      const schoolId = String(normalizedProfile?.school_id || '').trim();

      if (actorRole === 'admin') {
        const schools = await readStore();
        const existing = schools.find((item) => item?.school_id === schoolId);
        const isOwn = existing
          ? isAdminOwnSchool(actor, existing)
          : isAdminOwnSchool(actor, normalizedProfile);
        if (!isOwn) {
          return res.status(403).json({ error: 'Admin can translate only own school profile' });
        }
      }

      const translated = await autofillMissingSchoolLocales(config, normalizedProfile);
      res.json({ data: translated });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const actorPayload = await requireAdminOrSuperadmin(req, res);
      if (!actorPayload) return;
      const actor = actorPayload.user;
      const actorRole = actorPayload.role;
      const profile = validateSchoolPayload(req.body || {});
      const assignedSchoolId = getActorAssignedSchoolId(actor);
      const normalizedProfile =
        actorRole === 'admin' && assignedSchoolId
          ? { ...profile, school_id: assignedSchoolId }
          : profile;
      const schoolId = String(normalizedProfile?.school_id || '').trim();

      if (actorRole === 'admin') {
        const schools = await readStore();
        const existing = schools.find((item) => item?.school_id === schoolId);
        const isOwn = existing
          ? isAdminOwnSchool(actor, existing)
          : isAdminOwnSchool(actor, normalizedProfile);
        if (!isOwn) {
          return res
            .status(403)
            .json({ error: 'Admin can update only own school profile' });
        }
      }
      validatePlanContentLimits(normalizedProfile);

      const saved = await upsertSchool(normalizedProfile);
      res.json({ data: saved });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const actorPayload = await requireAdminOrSuperadmin(req, res);
      if (!actorPayload) return;
      const actor = actorPayload.user;
      const actorRole = actorPayload.role;
      const schools = await readStore();
      const existing = schools.find((item) => item?.school_id === req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'School not found' });
      }
      if (actorRole === 'admin' && !isAdminOwnSchool(actor, existing)) {
        return res
          .status(403)
          .json({ error: 'Admin can update only own school profile' });
      }
      const profile = {
        ...req.body,
        school_id: req.params.id,
      };
      validateSchoolPayload(profile, { expectedSchoolId: req.params.id });
      validatePlanContentLimits(profile);
      const saved = await upsertSchool(profile);
      res.json({ data: saved });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const actorPayload = await requireAdminOrSuperadmin(req, res);
      if (!actorPayload) return;
      const actor = actorPayload.user;
      const actorRole = actorPayload.role;
      const schools = await readStore();
      const existing = schools.find((item) => item?.school_id === req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'School not found' });
      }
      if (actorRole === 'admin' && !isAdminOwnSchool(actor, existing)) {
        return res
          .status(403)
          .json({ error: 'Admin can delete only own school profile' });
      }
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
            status: 'published',
            source: review?.source || 'legacy',
          });
        }
        const pendingReviews = Array.isArray(school?.reviews?.pending_items)
          ? school.reviews.pending_items
          : [];
        for (const review of pendingReviews) {
          rows.push({
            id: review?.id || `pending-review-${Date.now()}`,
            school_id: school?.school_id || '',
            school_name: schoolName,
            author: review?.author || '',
            text: review?.text || review?.positives || review?.concerns || '',
            rating: Number(review?.rating) || 0,
            created_at: review?.created_at || '',
            status: review?.status || 'pending',
            source: review?.source || 'direct_card',
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
        const pendingReviews = Array.isArray(school?.reviews?.pending_items)
          ? school.reviews.pending_items
          : [];
        const hasPublished = reviews.some((item) => String(item?.id || '') === reviewId);
        const hasPending = pendingReviews.some((item) => String(item?.id || '') === reviewId);
        if (!hasPublished && !hasPending) {
          continue;
        }
        const nextReviews = reviews.filter(
          (item) => String(item?.id || '') !== reviewId
        );
        const nextPendingReviews = pendingReviews.filter(
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
            pending_items: nextPendingReviews,
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
        updatedProfile = await recalculateSchoolRating(updatedProfile);
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

  router.post('/reviews/:reviewId/approve', async (req, res, next) => {
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
        const reviews = Array.isArray(school?.reviews?.items) ? school.reviews.items : [];
        const pendingReviews = Array.isArray(school?.reviews?.pending_items)
          ? school.reviews.pending_items
          : [];
        const pendingReview = pendingReviews.find((item) => String(item?.id || '') === reviewId);
        if (!pendingReview) continue;

        const approvedReview = {
          ...pendingReview,
          status: 'published',
          source: pendingReview?.source || 'direct_card',
          approved_at: new Date().toISOString(),
          approved_by: actor.email || actor.id,
        };
        const nextPendingReviews = pendingReviews.filter(
          (item) => String(item?.id || '') !== reviewId
        );
        const nextReviews = [approvedReview, ...reviews].slice(0, 200);
        const highlightText = nextReviews[0]?.text || '';
        const auditLog = Array.isArray(school?.system?.audit_log)
          ? school.system.audit_log
          : [];

        updatedProfile = {
          ...school,
          reviews: {
            ...(school.reviews || {}),
            items: nextReviews,
            pending_items: nextPendingReviews,
            count: nextReviews.length,
            average_rating: school?.reviews?.average_rating ?? null,
            highlight: highlightText,
          },
          system: {
            ...(school.system || {}),
            reviews_count: nextReviews.length,
            highlight_review: highlightText,
            updated_at: new Date().toISOString(),
            audit_log: [
              {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                at: new Date().toISOString(),
                action: 'approve_review',
                actor: actor.email || actor.id,
                review_id: reviewId,
              },
              ...auditLog,
            ].slice(0, 100),
          },
        };
        updatedProfile = await recalculateSchoolRating(updatedProfile);
        break;
      }

      if (!updatedProfile) {
        return res.status(404).json({ error: 'Pending review not found' });
      }

      await upsertSchool(updatedProfile);
      return res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post('/reviews/:reviewId/reject', async (req, res, next) => {
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
        const pendingReviews = Array.isArray(school?.reviews?.pending_items)
          ? school.reviews.pending_items
          : [];
        const hasPending = pendingReviews.some((item) => String(item?.id || '') === reviewId);
        if (!hasPending) continue;

        const nextPendingReviews = pendingReviews.filter(
          (item) => String(item?.id || '') !== reviewId
        );
        const auditLog = Array.isArray(school?.system?.audit_log)
          ? school.system.audit_log
          : [];
        updatedProfile = {
          ...school,
          reviews: {
            ...(school.reviews || {}),
            pending_items: nextPendingReviews,
          },
          system: {
            ...(school.system || {}),
            updated_at: new Date().toISOString(),
            audit_log: [
              {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                at: new Date().toISOString(),
                action: 'reject_review',
                actor: actor.email || actor.id,
                review_id: reviewId,
              },
              ...auditLog,
            ].slice(0, 100),
          },
        };
        updatedProfile = await recalculateSchoolRating(updatedProfile);
        break;
      }

      if (!updatedProfile) {
        return res.status(404).json({ error: 'Pending review not found' });
      }

      await upsertSchool(updatedProfile);
      return res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post('/reviews/reset-school/:schoolId', async (req, res, next) => {
    try {
      const actor = await requireModerator(req, res);
      if (!actor) return;
      const schoolId = String(req.params?.schoolId || '').trim();
      if (!schoolId) {
        return res.status(400).json({ error: 'schoolId is required' });
      }

      const schools = await readStore();
      const school = schools.find((item) => String(item?.school_id || '') === schoolId);
      if (!school) {
        return res.status(404).json({ error: 'School not found' });
      }

      const auditLog = Array.isArray(school?.system?.audit_log)
        ? school.system.audit_log
        : [];

      const updatedProfile = {
        ...school,
        reviews: {
          ...(school.reviews || {}),
          items: [],
          pending_items: [],
          count: 0,
          average_rating: null,
          highlight: '',
        },
        system: {
          ...(school.system || {}),
          rating: 0,
          reviews_count: 0,
          highlight_review: '',
          updated_at: new Date().toISOString(),
          audit_log: [
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              at: new Date().toISOString(),
              action: 'reset_school_rating',
              actor: actor.email || actor.id,
              school_id: schoolId,
            },
            ...auditLog,
          ].slice(0, 100),
        },
      };

      await upsertSchool(updatedProfile);
      return res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/reviews/submit', async (req, res, next) => {
    try {
      const actorPayload = await requireAuthenticatedActor(req, res);
      if (!actorPayload) return;
      const schoolId = String(req.params?.id || '').trim();
      if (!schoolId) {
        return res.status(400).json({ error: 'schoolId is required' });
      }

      const schools = await readStore();
      const school = schools.find((item) => String(item?.school_id || '').trim() === schoolId);
      if (!school) {
        return res.status(404).json({ error: 'School not found' });
      }

      const experienceType = String(req.body?.experienceType || '').trim().toLowerCase();
      const experienceFreshness = String(req.body?.experienceFreshness || '').trim().toLowerCase();
      const allowedExperienceTypes = new Set([
        'current_parent',
        'former_parent',
        'applicant_parent',
        'consultation_only',
        'other',
      ]);
      const allowedFreshnessValues = new Set([
        'current_year',
        'within_2_years',
        'within_5_years',
        'over_5_years',
      ]);
      if (!allowedExperienceTypes.has(experienceType)) {
        return res.status(400).json({ error: 'experienceType is required' });
      }
      if (!allowedFreshnessValues.has(experienceFreshness)) {
        return res.status(400).json({ error: 'experienceFreshness is required' });
      }

      const criteria = {
        teaching: clamp(Number(req.body?.teachingRating || 0), 1, 5),
        communication: clamp(Number(req.body?.communicationRating || 0), 1, 5),
        safety: clamp(Number(req.body?.safetyRating || 0), 1, 5),
        atmosphere: clamp(Number(req.body?.atmosphereRating || 0), 1, 5),
        value: clamp(Number(req.body?.valueRating || 0), 1, 5),
      };
      const missingCriteria = Object.values(criteria).some((score) => !Number.isFinite(score) || score < 1 || score > 5);
      if (missingCriteria) {
        return res.status(400).json({ error: 'All review criteria are required' });
      }

      const positives = normalizeText(req.body?.positives).slice(0, 1200);
      const concerns = normalizeText(req.body?.concerns).slice(0, 1200);
      const recommendationFor = normalizeText(req.body?.recommendationFor).slice(0, 600);
      const comment = normalizeText(req.body?.comment).slice(0, 1200);
      if (!positives && !concerns && !comment) {
        return res.status(400).json({ error: 'Review text is required' });
      }

      const rating =
        (
          criteria.teaching +
          criteria.communication +
          criteria.safety +
          criteria.atmosphere +
          criteria.value
        ) / 5;

      const authorName =
        normalizeText(
          actorPayload.user?.user_metadata?.name ||
            [actorPayload.user?.user_metadata?.firstName, actorPayload.user?.user_metadata?.lastName]
              .filter(Boolean)
              .join(' ') ||
            actorPayload.user?.email
        ) || 'Parent';

      const nextPendingReviews = [
        {
          id: `pending-review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          author: authorName,
          author_email: normalizeEmail(actorPayload.user?.email || ''),
          text: comment || positives || concerns,
          rating: Number(rating.toFixed(1)),
          created_at: new Date().toISOString(),
          status: 'pending',
          source: 'direct_card',
          experience_type: experienceType,
          experience_freshness: experienceFreshness,
          criteria,
          positives,
          concerns,
          recommendation_for: recommendationFor,
          comment,
        },
        ...(Array.isArray(school?.reviews?.pending_items) ? school.reviews.pending_items : []),
      ].slice(0, 200);

      let updatedProfile = {
        ...school,
        reviews: {
          ...(school.reviews || {}),
          pending_items: nextPendingReviews,
        },
        system: {
          ...(school.system || {}),
          updated_at: new Date().toISOString(),
        },
      };
      updatedProfile = await recalculateSchoolRating(updatedProfile);
      await upsertSchool(updatedProfile);
      res.status(201).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/monetization', async (req, res, next) => {
    try {
      const actorPayload = await requireAdminOrSuperadmin(req, res);
      if (!actorPayload) return;
      const actor = actorPayload.user;
      const actorRole = actorPayload.role;

      const schoolId = String(req.params?.id || '').trim();
      if (!schoolId) {
        return res.status(400).json({ error: 'schoolId is required' });
      }

      const schools = await readStore();
      const school = schools.find((item) => item?.school_id === schoolId);
      if (!school) {
        return res.status(404).json({ error: 'School not found' });
      }

      if (actorRole === 'admin' && !isAdminOwnSchool(actor, school)) {
        return res
          .status(403)
          .json({ error: 'Admin can update only own school monetization' });
      }

      const input = req.body?.monetization || {};
      const status = String(input?.subscription_status || 'inactive')
        .trim()
        .toLowerCase();
      if (!['inactive', 'active', 'paused', 'expired'].includes(status)) {
        return res.status(400).json({ error: 'Invalid subscription_status' });
      }

      const planName = String(input?.plan_name || '').trim();
      const lastTariffId = String(input?.last_tariff_id || '').trim();
      const startsAt = String(input?.starts_at || '').trim();
      const endsAt = String(input?.ends_at || '').trim();
      const priorityWeight = Number.parseInt(String(input?.priority_weight ?? 0), 10);

      const nowIso = new Date().toISOString();
      const currentAuditLog = Array.isArray(school?.system?.audit_log)
        ? school.system.audit_log
        : [];

      const updatedProfile = {
        ...school,
        monetization: {
          ...(school?.monetization || {}),
          is_promoted: input?.is_promoted === true,
          subscription_status: status,
          plan_name: planName,
          priority_weight: Number.isFinite(priorityWeight) ? priorityWeight : 0,
          starts_at: startsAt,
          ends_at: endsAt,
          last_tariff_id: lastTariffId,
        },
        system: {
          ...(school?.system || {}),
          updated_at: nowIso,
          audit_log: [
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              at: nowIso,
              action: 'update_monetization',
              actor: actor.email || actor.id,
              school_id: schoolId,
            },
            ...currentAuditLog,
          ].slice(0, 100),
        },
      };

      const saved = await upsertSchool(updatedProfile);
      return res.json({ data: saved });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/payments/test', async (req, res, next) => {
    try {
      const actorPayload = await requireAdminOrSuperadmin(req, res);
      if (!actorPayload) return;
      const actor = actorPayload.user;
      const actorRole = actorPayload.role;

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

      if (actorRole !== 'superadmin') {
        const actorEmail = String(actor?.email || '')
          .trim()
          .toLowerCase();
        const schoolEmail = String(school?.basic_info?.email || '')
          .trim()
          .toLowerCase();
        if (!actorEmail || !schoolEmail || actorEmail !== schoolEmail) {
          return res
            .status(403)
            .json({ error: 'Admin can process payments only for own school' });
        }
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
