class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

const MAX_SCHOOL_PAYLOAD_BYTES = 500000;
const MAX_DEPTH = 8;
const MAX_NODES = 6000;
const MAX_ARRAY_LENGTH = 500;
const MAX_KEY_LENGTH = 80;
const MAX_STRING_LENGTH = 10000;

const NEWS_CATEGORY_MAP = {
  announcements: 'announcements',
  announcement: 'announcements',
  'объявления': 'announcements',
  'объявление': 'announcements',
  хабарландырулар: 'announcements',
  tips: 'tips',
  'useful tips': 'tips',
  'полезные советы': 'tips',
  'пайдалы кеңестер': 'tips',
  events: 'events',
  события: 'events',
  оқиғалар: 'events',
  competitions: 'competitions',
  contests: 'competitions',
  конкурсы: 'competitions',
  байқаулар: 'competitions',
};

const COURSE_SUBJECTS = new Set(['math', 'reading', 'science', 'art']);
const SCHOOL_TYPES = new Set([
  'State',
  'Private',
  'International',
  'Autonomous',
  'Государственная',
  'Частная',
  'Международная',
  'Автономная',
  'Мемлекеттік',
  'Жеке',
  'Халықаралық',
  'Автономды',
]);
const PAYMENT_SYSTEMS = new Set([
  '',
  'Per month',
  'Per semester',
  'Per year',
  'Free',
  'Paid',
  'Included',
  'В месяц',
  'В семестр',
  'В год',
  'Бесплатно',
  'Платно',
  'Включено',
  'Айына',
  'Семестрге',
  'Жылына',
  'Тегін',
  'Ақылы',
  'Қамтылған',
]);
const SUBSCRIPTION_STATUSES = new Set([
  '',
  'inactive',
  'active',
  'expired',
  'canceled',
  'cancelled',
  'trial',
  'past_due',
]);
const TRANSPORT_STOP_TYPES = new Set(['', 'Metro', 'Bus', 'Метро', 'Автобус']);
const AUTH_ROLES = new Set(['user', 'admin', 'moderator', 'superadmin']);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HANDLE_RE = /^@?[a-zA-Z0-9._-]{2,64}$/;
const SCHOOL_ID_RE = /^[a-zA-Z0-9._-]{3,120}$/;
const ISO_DATE_RE =
  /^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isString = (value) => typeof value === 'string';
const trim = (value) => String(value || '').trim();
const normalizePhone = (value) => String(value || '').replace(/\D/g, '');

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => trim(item)).filter(Boolean);
  }
  if (isString(value)) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const isUrl = (value, { allowFile = false } = {}) => {
  const raw = trim(value);
  if (!raw) return false;
  if (allowFile && /^file:\/\//i.test(raw)) return true;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_error) {
    return false;
  }
};

const ensure = (condition, message) => {
  if (!condition) throw new ValidationError(message);
};

const ensureMaxLen = (value, max, fieldName) => {
  if (value == null) return;
  ensure(trim(value).length <= max, `${fieldName} is too long (max ${max})`);
};

const ensureEmail = (value, fieldName) => {
  const raw = trim(value);
  if (!raw) return;
  ensure(EMAIL_RE.test(raw), `${fieldName} is invalid`);
};

const ensurePhone = (value, fieldName, { required = false } = {}) => {
  const raw = trim(value);
  if (!raw) {
    ensure(!required, `${fieldName} is required`);
    return;
  }
  const digits = normalizePhone(raw);
  ensure(
    digits.length >= 10 && digits.length <= 15,
    `${fieldName} must contain 10-15 digits`
  );
};

const ensureEnum = (value, allowed, fieldName) => {
  const raw = trim(value);
  if (!raw) return;
  ensure(allowed.has(raw), `${fieldName} has unsupported value`);
};

const ensureDateString = (value, fieldName) => {
  const raw = trim(value);
  if (!raw) return;
  ensure(ISO_DATE_RE.test(raw), `${fieldName} must be a valid date/time`);
  const parsed = new Date(raw);
  ensure(Number.isFinite(parsed.getTime()), `${fieldName} must be a valid date/time`);
};

const ensureNumericStringInRange = (value, min, max, fieldName) => {
  const raw = trim(value);
  if (!raw) return;
  const normalized = raw.replace(',', '.');
  ensure(/^-?\d+(?:\.\d+)?$/.test(normalized), `${fieldName} must be numeric`);
  const num = Number(normalized);
  ensure(Number.isFinite(num), `${fieldName} must be numeric`);
  ensure(num >= min && num <= max, `${fieldName} must be between ${min} and ${max}`);
};

const ensureLocalizedText = (value, fieldName, maxLen) => {
  if (!value) return;
  if (isString(value)) {
    ensureMaxLen(value, maxLen, fieldName);
    return;
  }
  if (!isObject(value)) {
    throw new ValidationError(`${fieldName} must be string or localized object`);
  }
  ['ru', 'en', 'kk'].forEach((lang) =>
    ensureMaxLen(value?.[lang], maxLen, `${fieldName}.${lang}`)
  );
};

const ensureMediaUrls = (value, fieldName) => {
  const urls = toArray(value);
  ensure(urls.length <= 30, `${fieldName} has too many items`);
  urls.forEach((url) => ensure(isUrl(url), `${fieldName} contains invalid URL`));
};

const ensureDeepPayloadConstraints = (payload, rootName) => {
  const text = JSON.stringify(payload);
  ensure(
    Buffer.byteLength(text || '', 'utf8') <= MAX_SCHOOL_PAYLOAD_BYTES,
    `${rootName} payload is too large`
  );
  let visited = 0;
  const walk = (value, depth) => {
    visited += 1;
    ensure(visited <= MAX_NODES, `${rootName} payload is too complex`);
    ensure(depth <= MAX_DEPTH, `${rootName} payload nesting is too deep`);

    if (value == null) return;
    if (typeof value === 'boolean') return;
    if (typeof value === 'number') {
      ensure(Number.isFinite(value), `${rootName} contains invalid number`);
      return;
    }
    if (typeof value === 'string') {
      ensure(value.length <= MAX_STRING_LENGTH, `${rootName} contains too long text`);
      return;
    }
    if (Array.isArray(value)) {
      ensure(value.length <= MAX_ARRAY_LENGTH, `${rootName} contains too many array items`);
      value.forEach((item) => walk(item, depth + 1));
      return;
    }
    if (!isObject(value)) {
      throw new ValidationError(`${rootName} contains unsupported value type`);
    }
    Object.entries(value).forEach(([key, inner]) => {
      ensure(key.length <= MAX_KEY_LENGTH, `${rootName} contains too long key name`);
      walk(inner, depth + 1);
    });
  };
  walk(payload, 0);
};

const normalizeNewsCategory = (value) => {
  const key = trim(value).toLowerCase();
  return NEWS_CATEGORY_MAP[key] || '';
};

const normalizeHashtags = (value) => {
  const tags = Array.isArray(value) ? value : toArray(value);
  const cleaned = tags
    .map((entry) =>
      trim(entry)
        .replace(/^#+/, '')
        .replace(/\s+/g, '-')
        .replace(/[^\p{L}\p{N}_-]/gu, '')
        .toLowerCase()
    )
    .filter(Boolean);
  return [...new Set(cleaned)].slice(0, 30);
};

const validateNewsPayload = (payload) => {
  ensure(isObject(payload), 'news payload must be object');
  const title = trim(payload.title);
  const titleEn = trim(payload.titleEn);
  const titleKk = trim(payload.titleKk);
  ensure(title || titleEn || titleKk, 'At least one title is required');

  ensureMaxLen(payload.id, 80, 'id');
  ensureMaxLen(title, 180, 'title');
  ensureMaxLen(titleEn, 180, 'titleEn');
  ensureMaxLen(titleKk, 180, 'titleKk');
  ensureMaxLen(payload.summary, 500, 'summary');
  ensureMaxLen(payload.summaryEn, 500, 'summaryEn');
  ensureMaxLen(payload.summaryKk, 500, 'summaryKk');
  ensureMaxLen(payload.author, 120, 'author');
  ensureMaxLen(payload.content, 50000, 'content');
  ensureMaxLen(payload.contentEn, 50000, 'contentEn');
  ensureMaxLen(payload.contentKk, 50000, 'contentKk');

  const normalizedCategory = normalizeNewsCategory(payload.category || 'announcements');
  ensure(normalizedCategory, 'category has unsupported value');

  const imageUrls = toArray(payload.imageUrls);
  const videoUrls = toArray(payload.videoUrls);
  ensure(imageUrls.length <= 20, 'imageUrls has too many items');
  ensure(videoUrls.length <= 20, 'videoUrls has too many items');
  imageUrls.forEach((url) => ensure(isUrl(url), 'imageUrls contains invalid URL'));
  videoUrls.forEach((url) => ensure(isUrl(url), 'videoUrls contains invalid URL'));

  ensureDateString(payload.publishedAt, 'publishedAt');
  const tags = normalizeHashtags(payload.tags);

  return {
    ...payload,
    category: normalizedCategory,
    tags,
    imageUrls,
    videoUrls,
  };
};

const validateCourseTestPayload = (payload) => {
  ensure(isObject(payload), 'payload must be object');
  const subjectId = trim(payload.subjectId);
  ensure(subjectId, 'subjectId is required');
  ensureEnum(subjectId, COURSE_SUBJECTS, 'subjectId');
  const test = payload.test;
  ensure(isObject(test), 'test is required');

  const testId = trim(test.id || `${subjectId}-${Date.now()}`);
  ensureMaxLen(testId, 120, 'test.id');

  const title = trim(test.title);
  ensure(title, 'test.title is required');
  ensureMaxLen(title, 180, 'test.title');
  ensureMaxLen(test.grade, 40, 'test.grade');

  const questions = Array.isArray(test.questions) ? test.questions : [];
  ensure(questions.length <= 100, 'test.questions has too many items');

  return {
    subjectId,
    test: {
      ...test,
      id: testId,
      title,
      grade: trim(test.grade),
      questions,
    },
  };
};

const validateCourseQuestionPayload = (payload) => {
  ensure(isObject(payload), 'payload must be object');
  const subjectId = trim(payload.subjectId);
  const testId = trim(payload.testId);
  ensure(subjectId, 'subjectId is required');
  ensure(testId, 'testId is required');
  ensureEnum(subjectId, COURSE_SUBJECTS, 'subjectId');

  const question = payload.question;
  ensure(isObject(question), 'question is required');

  const questionId = trim(question.id || `${testId}-q-${Date.now()}`);
  const text = trim(question.text);
  ensure(text, 'question.text is required');
  ensureMaxLen(questionId, 120, 'question.id');
  ensureMaxLen(text, 2000, 'question.text');

  const options = Array.isArray(question.options)
    ? question.options.map((item) => trim(item)).filter(Boolean)
    : [];
  ensure(options.length >= 2 && options.length <= 8, 'question.options must contain 2-8 items');
  options.forEach((item) => ensureMaxLen(item, 300, 'question.options[]'));

  const correctIndex = Number(question.correctIndex);
  ensure(Number.isInteger(correctIndex), 'question.correctIndex must be integer');
  ensure(
    correctIndex >= 0 && correctIndex < options.length,
    'question.correctIndex is out of range'
  );

  ensureMaxLen(question.video, 1000, 'question.video');
  ensureMaxLen(question.image, 1000, 'question.image');
  if (trim(question.video)) ensure(isUrl(question.video), 'question.video must be valid URL');
  if (trim(question.image)) ensure(isUrl(question.image), 'question.image must be valid URL');

  return {
    subjectId,
    testId,
    question: {
      ...question,
      id: questionId,
      text,
      options,
      correctIndex,
      video: trim(question.video),
      image: trim(question.image),
    },
  };
};

const validateSchoolPayload = (payload, { expectedSchoolId = '' } = {}) => {
  ensure(isObject(payload), 'school payload must be object');
  ensureDeepPayloadConstraints(payload, 'school');

  const schoolId = trim(payload.school_id);
  ensure(schoolId, 'school_id is required');
  ensure(SCHOOL_ID_RE.test(schoolId), 'school_id contains unsupported characters');
  if (expectedSchoolId) {
    ensure(schoolId === trim(expectedSchoolId), 'school_id mismatch with URL parameter');
  }

  const basicInfo = isObject(payload.basic_info) ? payload.basic_info : {};
  const displayName = basicInfo.display_name;
  const fullName = basicInfo.name;
  ensureLocalizedText(fullName, 'basic_info.name', 220);
  ensureLocalizedText(displayName, 'basic_info.display_name', 220);
  ensureLocalizedText(basicInfo.address, 'basic_info.address', 280);
  ensureLocalizedText(basicInfo.description, 'basic_info.description', 5000);

  ensureEnum(basicInfo.type, SCHOOL_TYPES, 'basic_info.type');
  ensureMaxLen(basicInfo.city, 80, 'basic_info.city');
  ensureMaxLen(basicInfo.district, 120, 'basic_info.district');
  ensurePhone(basicInfo.phone, 'basic_info.phone');
  ensurePhone(basicInfo.whatsapp_phone, 'basic_info.whatsapp_phone');
  ensureEmail(basicInfo.email, 'basic_info.email');
  ensureMaxLen(basicInfo.website, 500, 'basic_info.website');
  if (trim(basicInfo.website)) {
    ensure(isUrl(basicInfo.website), 'basic_info.website must be valid URL');
  }

  const coordinates = isObject(basicInfo.coordinates) ? basicInfo.coordinates : {};
  ensureNumericStringInRange(
    coordinates.latitude,
    -90,
    90,
    'basic_info.coordinates.latitude'
  );
  ensureNumericStringInRange(
    coordinates.longitude,
    -180,
    180,
    'basic_info.coordinates.longitude'
  );

  const finance = isObject(payload.finance) ? payload.finance : {};
  ensureNumericStringInRange(finance.monthly_fee, 0, 100000000, 'finance.monthly_fee');
  ensureEnum(finance.payment_system, PAYMENT_SYSTEMS, 'finance.payment_system');
  ensureMaxLen(finance.grants_discounts, 800, 'finance.grants_discounts');

  const media = isObject(payload.media) ? payload.media : {};
  ensureMediaUrls(media.photos, 'media.photos');
  ensureMediaUrls(media.videos, 'media.videos');
  ensureMediaUrls(media.certificates, 'media.certificates');
  ensureMaxLen(media.logo, 1000, 'media.logo');
  if (trim(media.logo)) ensure(isUrl(media.logo), 'media.logo must be valid URL');

  const socialLinks = isObject(media.social_links) ? media.social_links : {};
  ['instagram', 'tiktok', 'youtube', 'facebook', 'vk', 'telegram', 'whatsapp'].forEach(
    (network) => {
      const value = trim(socialLinks[network]);
      if (!value) return;
      if (network === 'whatsapp') {
        if (isUrl(value)) return;
        ensurePhone(value, `media.social_links.${network}`);
        return;
      }
      const looksLikeUrl = /^https?:\/\//i.test(value);
      const isValid = looksLikeUrl ? isUrl(value) : HANDLE_RE.test(value);
      ensure(isValid, `media.social_links.${network} must be URL or handle`);
      ensureMaxLen(value, 300, `media.social_links.${network}`);
    }
  );

  const location = isObject(payload.location) ? payload.location : {};
  ensureEnum(location.transport_stop_type, TRANSPORT_STOP_TYPES, 'location.transport_stop_type');
  ensureLocalizedText(location.nearest_metro_stop, 'location.nearest_metro_stop', 120);
  ensureLocalizedText(location.nearest_bus_stop, 'location.nearest_bus_stop', 120);
  ensureNumericStringInRange(
    location.distance_to_metro_km,
    0,
    200,
    'location.distance_to_metro_km'
  );
  ensureNumericStringInRange(
    location.distance_to_bus_stop_km,
    0,
    200,
    'location.distance_to_bus_stop_km'
  );
  ensureLocalizedText(location.service_area, 'location.service_area', 500);

  const monetization = isObject(payload.monetization) ? payload.monetization : {};
  ensureEnum(
    monetization.subscription_status,
    SUBSCRIPTION_STATUSES,
    'monetization.subscription_status'
  );
  ensureMaxLen(monetization.plan_name, 120, 'monetization.plan_name');
  ensureNumericStringInRange(
    monetization.priority_weight,
    0,
    1000000,
    'monetization.priority_weight'
  );
  ensureDateString(monetization.starts_at, 'monetization.starts_at');
  ensureDateString(monetization.ends_at, 'monetization.ends_at');

  return payload;
};

const validateSendCodePayload = (payload) => {
  ensure(isObject(payload), 'payload must be object');
  const email = trim(payload.email).toLowerCase();
  ensure(email, 'Email is required');
  ensure(email.length <= 120, 'Email is too long');
  ensure(EMAIL_RE.test(email), 'Email is invalid');
  return { email };
};

const validateVerifyCodePayload = (payload) => {
  ensure(isObject(payload), 'payload must be object');
  const email = trim(payload.email).toLowerCase();
  const code = trim(payload.code);
  ensure(email, 'Email is required');
  ensure(code, 'Code is required');
  ensure(email.length <= 120, 'Email is too long');
  ensure(EMAIL_RE.test(email), 'Email is invalid');
  ensure(/^\d{6}$/.test(code), 'Code must be 6 digits');
  return { email, code };
};

const normalizePublicRole = (value) => {
  const role = trim(value).toLowerCase();
  if (role === 'student') return 'user';
  return role;
};

const sanitizeRegistrationMetadata = (value) => {
  if (!isObject(value)) return {};
  const allowedKeys = [
    'role',
    'firstName',
    'name',
    'lastName',
    'organization',
    'bin',
    'iin',
    'licenseNumber',
    'licenseIssuedAt',
    'licenseExpiresAt',
    'contactPhone',
    'website',
    'schoolVerified',
    'verificationStatus',
    'verificationSource',
  ];
  const result = {};
  for (const key of allowedKeys) {
    const raw = value[key];
    if (raw == null || raw === '') continue;
    if (typeof raw === 'boolean') {
      result[key] = raw;
      continue;
    }
    const text = trim(raw);
    if (!text) continue;
    ensureMaxLen(text, 220, `metadata.${key}`);
    result[key] = text;
  }
  ensureEmail(value?.email, 'metadata.email');
  ensurePhone(value?.contactPhone, 'metadata.contactPhone');
  if (result.website) {
    ensure(isUrl(result.website), 'metadata.website must be valid URL');
  }
  return result;
};

const validateRegisterWithCodePayload = (payload) => {
  ensure(isObject(payload), 'payload must be object');
  const { email, code } = validateVerifyCodePayload(payload);
  const password = String(payload.password || '');
  ensure(password.length >= 8, 'Password must be at least 8 characters');
  ensure(password.length <= 128, 'Password is too long');
  ensure(/[A-Za-z]/.test(password), 'Password must include at least one letter');
  ensure(/\d/.test(password), 'Password must include at least one digit');
  const role = normalizePublicRole(payload.role || payload.metadata?.role || 'user');
  ensure(['user', 'admin'].includes(role), 'Invalid role value');
  const metadata = sanitizeRegistrationMetadata(payload.metadata || {});
  return { email, code, password, role, metadata };
};

const validateSetRolePayload = (payload) => {
  ensure(isObject(payload), 'payload must be object');
  const email = trim(payload.email).toLowerCase();
  const role = trim(payload.role);
  ensure(email, 'Field "email" is required');
  ensure(EMAIL_RE.test(email), 'Field "email" is invalid');
  ensure(AUTH_ROLES.has(role), 'Invalid role value');
  return { email, role };
};

const validateUserStatusPayload = (payload, { userId }) => {
  ensure(isObject(payload), 'payload must be object');
  const id = trim(userId);
  ensure(id, 'User id is required');
  ensure(id.length <= 120, 'User id is too long');
  const active = payload?.active !== false;
  ensure(typeof active === 'boolean', 'Field "active" must be boolean');
  return { userId: id, active };
};

const sanitizeSchoolIds = (schoolIds, maxItems = 20) => {
  ensure(Array.isArray(schoolIds), 'schoolIds must be array');
  const unique = [];
  const seen = new Set();
  for (const raw of schoolIds) {
    const id = trim(raw);
    if (!id) continue;
    ensure(id.length <= 120, 'schoolIds contains too long id');
    ensure(/^[\w.-]+$/.test(id), 'schoolIds contains unsupported id');
    if (!seen.has(id)) {
      unique.push(id);
      seen.add(id);
    }
    if (unique.length >= maxItems) break;
  }
  return unique;
};

const validateAiSchoolQueryPayload = (payload) => {
  ensure(isObject(payload), 'payload must be object');
  const query = trim(payload.query);
  ensure(query, 'Query is required.');
  ensure(query.length <= 1500, 'Query is too long.');
  return { query };
};

const validateAiSchoolChatPayload = (payload) => {
  ensure(isObject(payload), 'payload must be object');
  const message = trim(payload.message);
  ensure(message, 'Message is required.');
  ensure(message.length <= 2000, 'Message is too long.');

  const rawSchoolIds = Array.isArray(payload.schoolIds) ? payload.schoolIds : [];
  const schoolIds = sanitizeSchoolIds(rawSchoolIds, 20);
  const schools = Array.isArray(payload.schools) ? payload.schools : [];
  if (!schoolIds.length && !schools.length) {
    throw new ValidationError('schoolIds (preferred) or schools data is required.');
  }

  if (schools.length) {
    ensure(schools.length <= 12, 'Too many schools in payload.');
    schools.forEach((school, index) => {
      ensure(isObject(school), `schools[${index}] must be object`);
      ensureMaxLen(school.school_id, 120, `schools[${index}].school_id`);
      ensureMaxLen(school.name, 240, `schools[${index}].name`);
      ensureMaxLen(school.type, 120, `schools[${index}].type`);
      ensureMaxLen(school.city, 120, `schools[${index}].city`);
      ensureMaxLen(school.district, 120, `schools[${index}].district`);
      ensureMaxLen(school.address, 280, `schools[${index}].address`);
      ensureMaxLen(school.languages, 400, `schools[${index}].languages`);
      ensureMaxLen(school.programs, 800, `schools[${index}].programs`);
      ensureMaxLen(school.curricula, 1000, `schools[${index}].curricula`);
      ensureMaxLen(
        school.advanced_subjects,
        1000,
        `schools[${index}].advanced_subjects`
      );
      ensureMaxLen(school.clubs, 1000, `schools[${index}].clubs`);
      ensureMaxLen(school.specialists, 1000, `schools[${index}].specialists`);
    });
  }

  return { message, schoolIds, schools };
};

module.exports = {
  ValidationError,
  validateNewsPayload,
  validateCourseTestPayload,
  validateCourseQuestionPayload,
  validateSchoolPayload,
  validateSendCodePayload,
  validateVerifyCodePayload,
  validateSetRolePayload,
  validateUserStatusPayload,
  validateAiSchoolQueryPayload,
  validateAiSchoolChatPayload,
  validateRegisterWithCodePayload,
};
