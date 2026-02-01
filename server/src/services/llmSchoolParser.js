const axios = require('axios');

const PRICE_MIN = 0;
const PRICE_MAX = 400000;
const CITY_OPTIONS = [
  {
    name: 'Almaty',
    areas: ['Almaly', 'Auezov', 'Bostandyk', 'Zhetysu', 'Medeu', 'Nauryzbay'],
  },
  {
    name: 'Astana',
    areas: ['Almaty district', 'Baikonur', 'Yesil', 'Saryarka', 'Nura'],
  },
  {
    name: 'Karaganda',
    areas: ['City', 'Maikudyk', 'South-East', 'Prishakhtinsk', 'Sortirovka'],
  },
];
const CITY_NAMES = CITY_OPTIONS.map((city) => city.name);
const CITY_AREAS = CITY_OPTIONS.reduce((acc, city) => {
  acc[city.name] = city.areas;
  return acc;
}, {});
const TYPE_OPTIONS = ['State', 'Private', 'International'];
const LANGUAGE_OPTIONS = ['English', 'Russian', 'Kazakh'];
const CURRICULA_OPTIONS = [
  'State program (Kazakhstan)',
  'Updated content',
  'NIS Integrated Program',
  'Cambridge Primary',
  'Cambridge Lower Secondary',
  'Cambridge IGCSE',
  'Cambridge A-Level',
  'IB PYP',
  'STEAM',
  'STEM',
  'Montessori',
  'Waldorf',
  'American Curriculum',
  'British National Curriculum',
  'Bilingual Program',
  'Author program',
];
const SUBJECT_OPTIONS = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'Computer Science',
  'Robotics',
  'Engineering',
  'Artificial Intelligence',
  'Data Science',
  'Economics',
  'Business',
  'Entrepreneurship',
  'English Language',
  'World History',
  'Geography',
  'Design & Technology',
  'Art & Design',
  'Music',
  'Media Studies',
  'Psychology',
];
const SPECIALISTS_OPTIONS = [
  'Psychologist',
  'Speech therapist',
  'Social worker',
  'Tutor',
  'Special education teacher',
  'Nurse',
  'Defectologist',
];
const SERVICE_OPTIONS = [
  'after_school',
  'transport',
  'inclusive_education',
  'security',
  'cameras',
  'access_control',
  'medical_office',
];
const MEAL_OPTIONS = ['Free', 'Paid', 'No meals'];
const ACCREDITATION_OPTIONS = ['License', 'Certificates'];
const SORT_OPTIONS = [
  'relevance',
  'rating_desc',
  'price_asc',
  'price_desc',
  'name_asc',
  'reviews_desc',
  'distance_asc',
  'updated_desc',
];

const toArray = (value) => (Array.isArray(value) ? value : []);
const toString = (value) => (typeof value === 'string' ? value.trim() : '');
const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};
const toPositiveInt = (value) => {
  const num = Math.round(Number(value));
  return Number.isFinite(num) ? Math.max(0, num) : 0;
};
const uniq = (value) => [...new Set(value)];

const filterAllowed = (value, allowed) =>
  uniq(
    toArray(value)
      .map((item) => toString(item))
      .filter((item) => allowed.has(item))
  );

const normalizeCityAreas = (value) => {
  if (!value || typeof value !== 'object') return {};
  const result = {};
  Object.entries(value).forEach(([city, areas]) => {
    if (!CITY_NAMES.includes(city)) return;
    const allowed = new Set(CITY_AREAS[city] || []);
    const next = filterAllowed(areas, allowed);
    if (next.length) {
      result[city] = next;
    }
  });
  return result;
};

const normalizePriceRange = (value) => {
  if (!Array.isArray(value) || value.length < 2) {
    return [PRICE_MIN, PRICE_MAX];
  }
  let min = toNumber(value[0]);
  let max = toNumber(value[1]);
  if (min === null && max === null) return [PRICE_MIN, PRICE_MAX];
  if (min === null) min = PRICE_MIN;
  if (max === null) max = PRICE_MAX;
  min = Math.min(PRICE_MAX, Math.max(PRICE_MIN, min));
  max = Math.min(PRICE_MAX, Math.max(PRICE_MIN, max));
  if (min > max) {
    return [max, min];
  }
  return [min, max];
};

const normalizeExam = (value) => {
  if (value === 'Yes' || value === 'No') return value;
  return null;
};

const normalizeSort = (value) =>
  SORT_OPTIONS.includes(value) ? value : null;

const normalizeParsed = (raw) => {
  const cities = filterAllowed(raw?.cities, new Set(CITY_NAMES));
  const cityAreas = normalizeCityAreas(raw?.cityAreas);
  Object.keys(cityAreas).forEach((city) => {
    if (!cities.includes(city)) cities.push(city);
  });
  const types = filterAllowed(raw?.types, new Set(TYPE_OPTIONS));
  const languages = filterAllowed(raw?.languages, new Set(LANGUAGE_OPTIONS));
  const curricula = filterAllowed(raw?.curricula, new Set(CURRICULA_OPTIONS));
  const subjects = filterAllowed(raw?.subjects, new Set(SUBJECT_OPTIONS));
  const specialists = filterAllowed(
    raw?.specialists,
    new Set(SPECIALISTS_OPTIONS)
  );
  const services = filterAllowed(raw?.services, new Set(SERVICE_OPTIONS));
  const meals = filterAllowed(raw?.meals, new Set(MEAL_OPTIONS));
  const accreditations = filterAllowed(
    raw?.accreditations,
    new Set(ACCREDITATION_OPTIONS)
  );
  const ratingRaw = toNumber(raw?.rating);
  const rating = ratingRaw === null ? null : Math.max(0, Math.min(5, ratingRaw));
  return {
    query: toString(raw?.query),
    cities,
    cityAreas,
    types,
    languages,
    curricula,
    subjects,
    specialists,
    services,
    meals,
    accreditations,
    exam: normalizeExam(raw?.exam),
    rating,
    minClubs: toPositiveInt(raw?.minClubs),
    minClassSize: toPositiveInt(raw?.minClassSize),
    priceRange: normalizePriceRange(raw?.priceRange),
    useNearby: Boolean(raw?.useNearby),
    sortOption: normalizeSort(raw?.sortOption),
  };
};

const extractJson = (text) => {
  if (typeof text !== 'string') return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (error) {
    return null;
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetry = (error) => {
  const status = error?.response?.status;
  if (status === 429) return true;
  if (status >= 500 && status < 600) return true;
  const code = error?.code;
  return (
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNABORTED' ||
    code === 'EAI_AGAIN'
  );
};

const getRetryDelayMs = (error, attempt) => {
  const retryAfter = error?.response?.headers?.['retry-after'];
  const retrySeconds = Number(retryAfter);
  if (Number.isFinite(retrySeconds) && retrySeconds > 0) {
    return retrySeconds * 1000;
  }
  const base = 400 * 2 ** (attempt - 1);
  const jitter = Math.floor(Math.random() * 200);
  return base + jitter;
};

const buildMessages = (query) => {
  const schema = {
    query: 'string',
    cities: CITY_NAMES,
    cityAreas: CITY_AREAS,
    types: TYPE_OPTIONS,
    languages: LANGUAGE_OPTIONS,
    curricula: CURRICULA_OPTIONS,
    subjects: SUBJECT_OPTIONS,
    specialists: SPECIALISTS_OPTIONS,
    services: SERVICE_OPTIONS,
    meals: MEAL_OPTIONS,
    accreditations: ACCREDITATION_OPTIONS,
    exam: ['Yes', 'No', null],
    rating: 'number|null',
    minClubs: 'number',
    minClassSize: 'number',
    priceRange: `[${PRICE_MIN}, ${PRICE_MAX}]`,
    useNearby: 'boolean',
    sortOption: SORT_OPTIONS,
  };
  return [
    {
      role: 'system',
      content:
        'You are a strict JSON generator that converts a school search query into filter fields. Output only a JSON object.',
    },
    {
      role: 'user',
      content: [
        `User query: "${query}"`,
        'Return a JSON object with these fields and allowed values:',
        JSON.stringify(schema, null, 2),
        'Rules:',
        '- Use only the allowed values for list fields.',
        '- If a field is not mentioned, use empty arrays, null, 0, or default priceRange.',
        '- query should include remaining keywords not mapped to filters.',
        '- exam must be "Yes", "No", or null.',
        '- sortOption must be one of the allowed values or null.',
        'Output only JSON.',
      ].join('\n'),
    },
  ];
};

const parseSchoolQueryWithLlm = async (config, query) => {
  if (!config?.llm?.apiKey) {
    const error = new Error('LLM is not configured');
    error.code = 'LLM_NOT_CONFIGURED';
    throw error;
  }
  const baseUrl = config.llm.baseUrl.replace(/\/$/, '');
  const url = `${baseUrl}/chat/completions`;
  const messages = buildMessages(query);
  const payload = {
    model: config.llm.model,
    messages,
    temperature: 0,
  };
  if (config.llm.provider === 'openai') {
    payload.response_format = { type: 'json_object' };
  }
  const maxAttempts = Math.max(1, config.llm.maxRetries + 1);
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await axios.post(
        url,
        payload,
        {
          headers: {
            Authorization: `Bearer ${config.llm.apiKey}`,
          },
          timeout: config.llm.timeoutMs,
        }
      );
      const content = response?.data?.choices?.[0]?.message?.content || '';
      const raw = extractJson(content);
      if (!raw) {
        const error = new Error('LLM returned invalid JSON');
        error.code = 'LLM_INVALID_JSON';
        throw error;
      }
      return normalizeParsed(raw);
    } catch (error) {
      lastError = error;
      if (!shouldRetry(error) || attempt === maxAttempts) {
        const status = error?.response?.status;
        const err = new Error('LLM request failed');
        err.status = status;
        err.code = error?.code;
        err.cause = error;
        throw err;
      }
      const delay = getRetryDelayMs(error, attempt);
      await sleep(delay);
    }
  }

  throw lastError || new Error('LLM request failed');
};

module.exports = {
  parseSchoolQueryWithLlm,
};
