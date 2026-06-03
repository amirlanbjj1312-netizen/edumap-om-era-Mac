const fs = require('fs/promises');
const path = require('path');

const STORAGE_DIR = path.resolve(__dirname, '../data');
const STORAGE_PATH = path.join(STORAGE_DIR, 'rating-surveys.json');

const DEFAULT_QUESTIONS = [
  {
    id: 'quality_teachers',
    text: 'Качество преподавания',
    description: 'Насколько вы довольны уровнем учителей',
    type: 'rating',
    required: true,
    order: 1,
    enabled: true,
  },
  {
    id: 'school_safety',
    text: 'Безопасность и комфорт',
    description: 'Насколько ребёнку безопасно и комфортно в школе',
    type: 'rating',
    required: true,
    order: 2,
    enabled: true,
  },
  {
    id: 'communication',
    text: 'Коммуникация со школой',
    description: 'Насколько быстро и понятно школа отвечает родителям',
    type: 'rating',
    required: true,
    order: 3,
    enabled: true,
  },
  {
    id: 'clubs_quality',
    text: 'Кружки и дополнительные занятия',
    description: 'Насколько полезны и интересны секции/кружки',
    type: 'rating',
    required: true,
    order: 4,
    enabled: true,
  },
  {
    id: 'value_for_money',
    text: 'Соотношение цена/качество',
    description: 'Насколько стоимость соответствует качеству',
    type: 'rating',
    required: true,
    order: 5,
    enabled: true,
  },
];

const normalizeString = (value, max = 300) =>
  String(value || '')
    .trim()
    .slice(0, max);

const toPositiveInt = (value, fallback = 1) => {
  const num = Number.parseInt(String(value), 10);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return num;
};

const toBool = (value, fallback = true) => {
  if (value === true || value === false) return value;
  if (typeof value === 'string') {
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
  }
  return fallback;
};

const normalizeQuestion = (input = {}, index = 0) => {
  const text = normalizeString(input.text, 200);
  const fallbackId = `question_${index + 1}`;
  const rawType = normalizeString(input.type, 40).toLowerCase();
  const type = ['rating', 'single_choice', 'text'].includes(rawType) ? rawType : 'rating';
  const options = Array.isArray(input.options)
    ? input.options
        .map((item, optionIndex) => {
          if (typeof item === 'string') {
            return {
              id: `opt_${optionIndex + 1}`,
              label: normalizeString(item, 160),
              score: 0,
            };
          }
          return {
            id:
              normalizeString(item?.id, 60)
                .toLowerCase()
                .replace(/[^a-z0-9_]+/g, '_') || `opt_${optionIndex + 1}`,
            label: normalizeString(item?.label, 160),
            score: Number.isFinite(Number(item?.score))
              ? Math.max(0, Math.min(5, Number(item?.score)))
              : 0,
          };
        })
        .filter((item) => item.label)
    : [];
  return {
    id:
      normalizeString(input.id, 120)
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, '_') || fallbackId,
    text: text || `Вопрос ${index + 1}`,
    description: normalizeString(input.description, 240),
    type,
    options,
    required: toBool(input.required, true),
    order: toPositiveInt(input.order, index + 1),
    enabled: toBool(input.enabled, true),
  };
};

const normalizeCampaign = (input = {}) => {
  const sendAt = normalizeString(input.send_at || input.sendAt, 40);
  const status = normalizeString(input.status, 32).toLowerCase();
  const targetType = normalizeString(input.target_type || input.targetType, 40).toLowerCase();
  const normalizedTargetType = ['school', 'all_parents', 'specific_parents'].includes(targetType)
    ? targetType
    : 'school';
  const parentEmails = Array.isArray(input.parent_emails || input.parentEmails)
    ? [...new Set((input.parent_emails || input.parentEmails)
        .map((item) => normalizeString(item, 160).toLowerCase())
        .filter(Boolean))]
    : [];
  return {
    id: normalizeString(input.id, 120) || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: normalizeString(input.title, 160) || 'Анкета удовлетворенности',
    description: normalizeString(input.description, 400),
    school_ids: Array.isArray(input.school_ids || input.schoolIds)
      ? (input.school_ids || input.schoolIds)
          .map((item) => normalizeString(item, 140))
          .filter(Boolean)
      : [],
    target_type: normalizedTargetType,
    parent_emails: parentEmails,
    send_at: sendAt || new Date().toISOString(),
    created_at: normalizeString(input.created_at || input.createdAt, 40) || new Date().toISOString(),
    created_by: normalizeString(input.created_by || input.createdBy, 160),
    status: ['draft', 'scheduled', 'active', 'closed'].includes(status) ? status : 'scheduled',
  };
};

const normalizeAnswer = (input = {}) => {
  const scoreRaw = Number.parseInt(String(input.score), 10);
  const score = Number.isFinite(scoreRaw) ? Math.min(5, Math.max(1, scoreRaw)) : 0;
  return {
    question_id: normalizeString(input.question_id || input.questionId, 120),
    question_type: normalizeString(input.question_type || input.questionType, 40).toLowerCase(),
    score,
    option_id: normalizeString(input.option_id || input.optionId, 60).toLowerCase(),
    option_label: normalizeString(input.option_label || input.optionLabel, 160),
    text: normalizeString(input.text, 1200),
  };
};

const normalizeResponse = (input = {}) => ({
  id: normalizeString(input.id, 120) || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  campaign_id: normalizeString(input.campaign_id || input.campaignId, 120),
  school_id: normalizeString(input.school_id || input.schoolId, 140),
  user_id: normalizeString(input.user_id || input.userId, 120),
  user_email: normalizeString(input.user_email || input.userEmail, 160).toLowerCase(),
  experience_type: normalizeString(input.experience_type || input.experienceType, 40).toLowerCase(),
  experience_freshness: normalizeString(
    input.experience_freshness || input.experienceFreshness,
    40
  ).toLowerCase(),
  verified_interaction: toBool(input.verified_interaction ?? input.verifiedInteraction, false),
  answers: Array.isArray(input.answers)
    ? input.answers
        .map(normalizeAnswer)
        .filter(
          (item) =>
            item.question_id &&
            (item.score > 0 || item.option_id || item.option_label || item.text)
        )
    : [],
  comment: normalizeString(input.comment, 1200),
  created_at: normalizeString(input.created_at || input.createdAt, 40) || new Date().toISOString(),
});

const ensureStorage = async () => {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
};

const defaultStorePayload = () => ({
  config: {
    cycle_days: 60,
    questions: DEFAULT_QUESTIONS.map((item, index) => normalizeQuestion(item, index)),
    updated_at: new Date().toISOString(),
    updated_by: 'system',
  },
  campaigns: [],
  responses: [],
});

const readSurveyStore = async () => {
  try {
    await ensureStorage();
    const raw = await fs.readFile(STORAGE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const base = defaultStorePayload();
    return {
      config: {
        ...base.config,
        ...(parsed?.config || {}),
        cycle_days: toPositiveInt(parsed?.config?.cycle_days, 60),
        questions: Array.isArray(parsed?.config?.questions)
          ? parsed.config.questions.map((item, index) => normalizeQuestion(item, index))
          : base.config.questions,
      },
      campaigns: Array.isArray(parsed?.campaigns)
        ? parsed.campaigns.map((item) => normalizeCampaign(item))
        : [],
      responses: Array.isArray(parsed?.responses)
        ? parsed.responses.map((item) => normalizeResponse(item))
        : [],
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      const base = defaultStorePayload();
      await writeSurveyStore(base);
      return base;
    }
    throw error;
  }
};

const writeSurveyStore = async (payload) => {
  await ensureStorage();
  await fs.writeFile(STORAGE_PATH, JSON.stringify(payload, null, 2), 'utf8');
};

const setSurveyConfig = async ({ questions = [], cycleDays = 60, actor = '' } = {}) => {
  const store = await readSurveyStore();
  const normalizedQuestions = Array.isArray(questions)
    ? questions.map((item, index) => normalizeQuestion(item, index)).filter((item) => item.text)
    : [];
  const withOrder = normalizedQuestions.map((item, index) => ({
    ...item,
    order: index + 1,
  }));
  const next = {
    ...store,
    config: {
      cycle_days: toPositiveInt(cycleDays, 60),
      questions: withOrder.length ? withOrder : store.config.questions,
      updated_at: new Date().toISOString(),
      updated_by: normalizeString(actor, 160) || 'unknown',
    },
  };
  await writeSurveyStore(next);
  return next.config;
};

const createSurveyCampaign = async ({
  title = '',
  description = '',
  schoolIds = [],
  targetType = 'school',
  parentEmails = [],
  sendAt = '',
  actor = '',
} = {}) => {
  const store = await readSurveyStore();
  const normalized = normalizeCampaign({
    title,
    description,
    school_ids: schoolIds,
    target_type: targetType,
    parent_emails: parentEmails,
    send_at: sendAt,
    created_by: actor,
    status: sendAt ? 'scheduled' : 'active',
  });
  const next = {
    ...store,
    campaigns: [normalized, ...store.campaigns],
  };
  await writeSurveyStore(next);
  return normalized;
};

const listSurveyCampaigns = async () => {
  const store = await readSurveyStore();
  return store.campaigns
    .map((item) => {
      const now = Date.now();
      const sendAtTs = new Date(item.send_at || 0).getTime();
      const autoStatus =
        item.status === 'closed'
          ? 'closed'
          : Number.isFinite(sendAtTs) && sendAtTs > now
            ? 'scheduled'
            : 'active';
      return { ...item, status: autoStatus };
    })
    .sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
};

const closeSurveyCampaign = async (campaignId) => {
  const id = normalizeString(campaignId, 120);
  if (!id) return null;
  const store = await readSurveyStore();
  const nextCampaigns = store.campaigns.map((item) =>
    item.id === id ? { ...item, status: 'closed' } : item
  );
  const updated = nextCampaigns.find((item) => item.id === id) || null;
  if (!updated) return null;
  await writeSurveyStore({
    ...store,
    campaigns: nextCampaigns,
  });
  return updated;
};

const addSurveyResponse = async (payload = {}) => {
  const normalized = normalizeResponse(payload);
  if (!normalized.campaign_id || !normalized.school_id || !normalized.user_id) {
    throw new Error('campaign_id, school_id and user_id are required');
  }
  if (!normalized.answers.length) {
    throw new Error('answers are required');
  }

  const store = await readSurveyStore();
  const duplicate = store.responses.find(
    (item) =>
      item.campaign_id === normalized.campaign_id &&
      item.school_id === normalized.school_id &&
      item.user_id === normalized.user_id
  );
  if (duplicate) {
    throw new Error('already_answered');
  }

  const next = {
    ...store,
    responses: [normalized, ...store.responses],
  };
  await writeSurveyStore(next);
  return normalized;
};

const listSurveyResponses = async () => {
  const store = await readSurveyStore();
  return store.responses.sort(
    (a, b) =>
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );
};

module.exports = {
  readSurveyStore,
  setSurveyConfig,
  createSurveyCampaign,
  listSurveyCampaigns,
  closeSurveyCampaign,
  addSurveyResponse,
  listSurveyResponses,
};
