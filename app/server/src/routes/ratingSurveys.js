const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { buildConfig } = require('../utils/config');
const { ConsultationStore } = require('../services/consultationStore');
const { readStore, upsertSchool } = require('../services/schoolsStore');
const {
  readSurveyStore,
  setSurveyConfig,
  createSurveyCampaign,
  listSurveyCampaigns,
  closeSurveyCampaign,
  addSurveyResponse,
  listSurveyResponses,
} = require('../services/ratingSurveyStore');
const {
  calculateSurveyAverage,
  calculateCompositeRating,
} = require('../services/schoolRating');

const ROLE_PRIORITY = {
  user: 0,
  admin: 1,
  moderator: 2,
  superadmin: 3,
};

const hasMinRole = (role, minRole) =>
  (ROLE_PRIORITY[role] || 0) >= (ROLE_PRIORITY[minRole] || 0);

const normalizeText = (value, max = 240) =>
  String(value || '')
    .trim()
    .slice(0, max);
const normalizeEmail = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();
const EXCLUDED_STATS_EMAILS = new Set(['amirlan.sm@mail.ru']);
const isStatsExcludedEmail = (value) => EXCLUDED_STATS_EMAILS.has(normalizeEmail(value));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const EXPERIENCE_TYPE_POINTS = new Set([
  'current_parent',
  'former_parent',
  'applicant_parent',
  'consultation_only',
  'other',
]);

const EXPERIENCE_FRESHNESS_POINTS = new Set([
  'current_year',
  'within_2_years',
  'within_5_years',
  'over_5_years',
]);

const resolveSchoolName = (school = {}) => {
  const displayName = school?.basic_info?.display_name;
  const brandName = school?.basic_info?.brand_name;
  const name = school?.basic_info?.name;
  if (typeof displayName === 'string' && displayName.trim()) return displayName.trim();
  if (displayName && typeof displayName === 'object') {
    const localized = displayName.ru || displayName.kk || displayName.en;
    if (localized) return String(localized).trim();
  }
  if (typeof brandName === 'string' && brandName.trim()) return brandName.trim();
  if (typeof name === 'string' && name.trim()) return name.trim();
  if (name && typeof name === 'object') {
    const localized = name.ru || name.kk || name.en;
    if (localized) return String(localized).trim();
  }
  return String(school?.school_id || '').trim();
};

const buildRatingSurveysRouter = () => {
  const router = express.Router();
  const config = buildConfig();
  const consultationsStore = new ConsultationStore(config.dataFilePath);

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

  const getActor = async (req, res) => {
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
    const role = data.user?.user_metadata?.role || data.user?.app_metadata?.role || 'user';
    return { user: data.user, role };
  };

  const requireModerator = async (req, res) => {
    const actor = await getActor(req, res);
    if (!actor) return null;
    if (!hasMinRole(actor.role, 'moderator')) {
      res.status(403).json({ error: 'Only moderator/superadmin can manage surveys' });
      return null;
    }
    return actor;
  };

  router.get('/config', async (req, res, next) => {
    try {
      const actor = await requireModerator(req, res);
      if (!actor) return;
      const store = await readSurveyStore();
      res.json({ data: store.config });
    } catch (error) {
      next(error);
    }
  });

  router.put('/config', async (req, res, next) => {
    try {
      const actor = await requireModerator(req, res);
      if (!actor) return;
      const questions = Array.isArray(req.body?.questions) ? req.body.questions : [];
      const cycleDays = Number.parseInt(String(req.body?.cycleDays || req.body?.cycle_days || 60), 10);
      if (!questions.length) {
        return res.status(400).json({ error: 'questions are required' });
      }
      const configData = await setSurveyConfig({
        questions,
        cycleDays,
        actor: actor.user.email || actor.user.id,
      });
      res.json({ data: configData });
    } catch (error) {
      next(error);
    }
  });

  router.get('/campaigns', async (req, res, next) => {
    try {
      const actor = await requireModerator(req, res);
      if (!actor) return;
      const campaigns = await listSurveyCampaigns();
      const responses = (await listSurveyResponses()).filter(
        (item) => !isStatsExcludedEmail(item?.user_email)
      );
      const schools = await readStore();
      const schoolNameById = new Map(
        schools.map((item) => [String(item?.school_id || '').trim(), resolveSchoolName(item)])
      );

      const data = campaigns.map((campaign) => {
        const campaignResponses = responses.filter((item) => item.campaign_id === campaign.id);
        const answeredByUsers = new Set(campaignResponses.map((item) => item.user_id)).size;
        const targetType = String(campaign.target_type || 'school');
        const visibleParentEmails = Array.isArray(campaign.parent_emails)
          ? campaign.parent_emails.filter((item) => !isStatsExcludedEmail(item))
          : [];
        const targetLabel =
          targetType === 'all_parents'
            ? 'Все родители'
            : targetType === 'specific_parents'
              ? `Конкретные родители (${visibleParentEmails.length})`
              : 'По школам';
        return {
          ...campaign,
          parent_emails: visibleParentEmails,
          school_names: campaign.school_ids.map((id) => schoolNameById.get(id) || id),
          target_label: targetLabel,
          responses_count: campaignResponses.length,
          unique_users_count: answeredByUsers,
        };
      });
      res.json({ data });
    } catch (error) {
      next(error);
    }
  });

  router.post('/campaigns', async (req, res, next) => {
    try {
      const actor = await requireModerator(req, res);
      if (!actor) return;
      const title = normalizeText(req.body?.title, 160);
      const description = normalizeText(req.body?.description, 400);
      const sendAt = normalizeText(req.body?.sendAt || req.body?.send_at, 40);
      const targetType = normalizeText(req.body?.targetType || req.body?.target_type, 40).toLowerCase();
      const schoolIds = Array.isArray(req.body?.schoolIds)
        ? req.body.schoolIds.map((item) => normalizeText(item, 140)).filter(Boolean)
        : [];
      const parentEmails = Array.isArray(req.body?.parentEmails)
        ? [...new Set(req.body.parentEmails.map((item) => normalizeEmail(item)).filter(Boolean))]
        : [];
      const normalizedTargetType = ['school', 'all_parents', 'specific_parents'].includes(targetType)
        ? targetType
        : 'school';
      if (!title) {
        return res.status(400).json({ error: 'title is required' });
      }
      if (normalizedTargetType === 'school' && !schoolIds.length) {
        return res.status(400).json({ error: 'schoolIds are required' });
      }
      if (normalizedTargetType === 'specific_parents' && !parentEmails.length) {
        return res.status(400).json({ error: 'parentEmails are required for specific_parents' });
      }
      const campaign = await createSurveyCampaign({
        title,
        description,
        schoolIds,
        targetType: normalizedTargetType,
        parentEmails,
        sendAt,
        actor: actor.user.email || actor.user.id,
      });
      res.json({ data: campaign });
    } catch (error) {
      next(error);
    }
  });

  router.post('/campaigns/:id/close', async (req, res, next) => {
    try {
      const actor = await requireModerator(req, res);
      if (!actor) return;
      const updated = await closeSurveyCampaign(req.params.id);
      if (!updated) return res.status(404).json({ error: 'Campaign not found' });
      res.json({ data: updated });
    } catch (error) {
      next(error);
    }
  });

  router.get('/analytics', async (req, res, next) => {
    try {
      const actor = await requireModerator(req, res);
      if (!actor) return;
      const [campaigns, rawResponses, schools, consultations] = await Promise.all([
        listSurveyCampaigns(),
        listSurveyResponses(),
        readStore(),
        consultationsStore.list(),
      ]);
      const responses = rawResponses.filter((item) => !isStatsExcludedEmail(item?.user_email));
      const surveyStore = await readSurveyStore();
      const questionById = new Map(
        (surveyStore?.config?.questions || []).map((question) => [String(question?.id || '').trim(), question])
      );

      const schoolRows = schools.map((school) => {
        const schoolId = String(school?.school_id || '').trim();
        const schoolResponses = responses.filter((item) => item.school_id === schoolId);
        const surveyAvg = calculateSurveyAverage(schoolResponses, questionById);
        const consultationsCount = consultations.filter(
          (item) => String(item?.schoolId || '').trim() === schoolId
        ).length;
        const popularityCount = Number(school?.system?.popularity || 0);
        const formula = calculateCompositeRating({
          surveyAvg,
          responses: schoolResponses,
          consultations,
          schoolId,
          popularityCount,
        });
        return {
          school_id: schoolId,
          school_name: resolveSchoolName(school),
          responses_count: schoolResponses.length,
          survey_average: surveyAvg,
          consultations_count: consultationsCount,
          popularity_count: popularityCount,
          current_rating: Number(school?.system?.rating || 0),
          calculated_rating: formula.rating,
          formula,
        };
      });

      res.json({
        data: {
          config: (await readSurveyStore()).config,
          campaigns_count: campaigns.length,
          responses_count: responses.length,
          schools: schoolRows.sort((a, b) => b.responses_count - a.responses_count),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/active', async (req, res, next) => {
    try {
      const actor = await getActor(req, res);
      if (!actor) return;
      const [campaigns, store, schools] = await Promise.all([
        listSurveyCampaigns(),
        readSurveyStore(),
        readStore(),
      ]);
      const schoolNameById = new Map(
        schools.map((item) => [String(item?.school_id || '').trim(), resolveSchoolName(item)])
      );
      const responses = await listSurveyResponses();
      const answeredSet = new Set(
        responses
          .filter((item) => item.user_id === actor.user.id)
          .map((item) => `${item.campaign_id}:${item.school_id}`)
      );
      const actorEmail = normalizeEmail(actor.user.email || '');
      const allSchoolOptions = schools.map((item) => ({
        id: String(item?.school_id || '').trim(),
        name: resolveSchoolName(item),
      }));
      const data = campaigns
        .filter((campaign) => {
          if (campaign.status !== 'active') return false;
          const targetType = String(campaign.target_type || 'school');
          if (targetType === 'specific_parents') {
            const allowed = Array.isArray(campaign.parent_emails)
              ? campaign.parent_emails.map((item) => normalizeEmail(item))
              : [];
            return !!actorEmail && allowed.includes(actorEmail);
          }
          return true;
        })
        .map((campaign) => ({
          id: campaign.id,
          title: campaign.title,
          description: campaign.description,
          school_ids: campaign.school_ids,
          target_type: campaign.target_type || 'school',
          school_options: (
            Array.isArray(campaign.school_ids) && campaign.school_ids.length
              ? campaign.school_ids.map((schoolId) => ({
                  id: schoolId,
                  name: schoolNameById.get(schoolId) || schoolId,
                }))
              : allSchoolOptions
          )
            .filter((item) => item.id)
            .map((item) => ({
              ...item,
              answered: answeredSet.has(`${campaign.id}:${item.id}`),
            })),
          send_at: campaign.send_at,
          questions: store.config.questions
            .filter((item) => item.enabled !== false)
            .sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0)),
        }));
      res.json({ data });
    } catch (error) {
      next(error);
    }
  });

  router.post('/responses', async (req, res, next) => {
    try {
      const actor = await getActor(req, res);
      if (!actor) return;
      const campaignId = normalizeText(req.body?.campaignId, 120);
      const schoolId = normalizeText(req.body?.schoolId, 140);
      const comment = normalizeText(req.body?.comment, 1200);
      const experienceType = normalizeText(req.body?.experienceType, 40).toLowerCase();
      const experienceFreshness = normalizeText(req.body?.experienceFreshness, 40).toLowerCase();
      const answers = Array.isArray(req.body?.answers)
        ? req.body.answers.map((item) => ({
            question_id: normalizeText(item?.questionId || item?.question_id, 120),
            question_type: normalizeText(item?.questionType || item?.question_type, 40),
            score: clamp(Number.parseInt(String(item?.score || 0), 10), 1, 5),
            option_id: normalizeText(item?.optionId || item?.option_id, 60),
            option_label: normalizeText(item?.optionLabel || item?.option_label, 160),
            text: normalizeText(item?.text, 1200),
          }))
        : [];
      if (!campaignId || !schoolId) {
        return res.status(400).json({ error: 'campaignId and schoolId are required' });
      }
      if (!EXPERIENCE_TYPE_POINTS.has(experienceType)) {
        return res.status(400).json({ error: 'experienceType is required' });
      }
      if (!EXPERIENCE_FRESHNESS_POINTS.has(experienceFreshness)) {
        return res.status(400).json({ error: 'experienceFreshness is required' });
      }
      if (!answers.length) {
        return res.status(400).json({ error: 'answers are required' });
      }

      const campaigns = await listSurveyCampaigns();
      const campaign = campaigns.find((item) => item.id === campaignId);
      if (!campaign || campaign.status !== 'active') {
        return res.status(400).json({ error: 'Campaign is not active' });
      }
      if (Array.isArray(campaign.school_ids) && campaign.school_ids.length && !campaign.school_ids.includes(schoolId)) {
        return res.status(400).json({ error: 'School is not included in campaign' });
      }
      const surveyStore = await readSurveyStore();
      const activeQuestions = Array.isArray(surveyStore?.config?.questions)
        ? surveyStore.config.questions.filter((item) => item.enabled !== false)
        : [];
      const questionById = new Map(
        activeQuestions.map((question) => [String(question?.id || '').trim(), question])
      );
      const normalizedAnswers = [];
      for (const answer of answers) {
        const question = questionById.get(answer.question_id);
        if (!question) continue;
        const questionType = String(question.type || 'rating');
        if (questionType === 'rating') {
          const score = Number(answer.score || 0);
          if (score < 1 || score > 5) continue;
          normalizedAnswers.push({
            question_id: answer.question_id,
            question_type: 'rating',
            score,
            option_id: '',
            option_label: '',
            text: '',
          });
          continue;
        }
        if (questionType === 'single_choice') {
          const optionId = String(answer.option_id || '').trim().toLowerCase();
          const optionLabel = String(answer.option_label || '').trim();
          if (!optionId && !optionLabel) continue;
          const option = Array.isArray(question.options)
            ? question.options.find(
                (item) =>
                  String(item?.id || '').trim().toLowerCase() === optionId ||
                  String(item?.label || '').trim().toLowerCase() === optionLabel.toLowerCase()
              )
            : null;
          normalizedAnswers.push({
            question_id: answer.question_id,
            question_type: 'single_choice',
            score: Number(option?.score || 0),
            option_id: String(option?.id || optionId),
            option_label: String(option?.label || optionLabel),
            text: '',
          });
          continue;
        }
        const freeText = String(answer.text || '').trim();
        if (!freeText) continue;
        normalizedAnswers.push({
          question_id: answer.question_id,
          question_type: 'text',
          score: 0,
          option_id: '',
          option_label: '',
          text: freeText,
        });
      }
      const missingRequired = activeQuestions.some((question) => {
        if (question.required === false) return false;
        return !normalizedAnswers.some((answer) => answer.question_id === question.id);
      });
      if (missingRequired) {
        return res.status(400).json({ error: 'Required questions are missing' });
      }
      if (!normalizedAnswers.length) {
        return res.status(400).json({ error: 'answers are required' });
      }

      const schools = await readStore();
      const selectedSchool = schools.find(
        (item) => String(item?.school_id || '').trim() === schoolId
      );
      const selectedSchoolName =
        String(
          selectedSchool?.name ||
            selectedSchool?.display_name ||
            selectedSchool?.short_name ||
            ''
        ).trim() || schoolId;

      const answersWithSchool = [
        {
          question_id: '__school__',
          question_type: 'school',
          score: 0,
          option_id: schoolId,
          option_label: selectedSchoolName,
          text: selectedSchoolName,
        },
        ...normalizedAnswers,
      ];

      const response = await addSurveyResponse({
        campaign_id: campaignId,
        school_id: schoolId,
        user_id: actor.user.id,
        user_email: actor.user.email || '',
        experience_type: experienceType,
        experience_freshness: experienceFreshness,
        answers: answersWithSchool,
        comment,
      });

      const [responses, consultations] = await Promise.all([
        listSurveyResponses(),
        consultationsStore.list(),
      ]);
      const school = selectedSchool;
      if (school) {
        const schoolResponses = responses.filter((item) => item.school_id === schoolId);
        const surveyAvg = calculateSurveyAverage(schoolResponses, questionById);
        const consultationsCount = consultations.filter(
          (item) => String(item?.schoolId || '').trim() === schoolId
        ).length;
        const popularityCount = Number(school?.system?.popularity || 0);
        const formula = calculateCompositeRating({
          school,
          responses: schoolResponses,
          consultations,
          questionById,
          schoolId,
          popularityCount,
        });
        const reviewItemsCount = Array.isArray(school?.reviews?.items)
          ? school.reviews.items.length
          : 0;

        const nextProfile = {
          ...school,
          system: {
            ...(school.system || {}),
            rating: formula.rating,
            reviews_count: reviewItemsCount,
            feedback_count: schoolResponses.length,
            rating_breakdown: formula.breakdown,
            rating_formula: {
              survey_average: formula.survey_average,
              total_points: formula.total_points,
              points: formula.points,
              consultations_count: consultationsCount,
              popularity_count: popularityCount,
              survey_responses_count: schoolResponses.length,
              updated_at: new Date().toISOString(),
            },
          },
          surveys: {
            ...(school.surveys || {}),
            average_score: surveyAvg,
            responses_count: schoolResponses.length,
            last_campaign_id: campaignId,
            last_response_at: response.created_at,
          },
        };
        await upsertSchool(nextProfile);
      }

      res.json({ data: response });
    } catch (error) {
      if (String(error?.message || '') === 'already_answered') {
        return res.status(409).json({ error: 'Survey for this school is already submitted' });
      }
      next(error);
    }
  });

  return router;
};

module.exports = {
  buildRatingSurveysRouter,
};
