const axios = require('axios');

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
  const base = 500 * 2 ** (attempt - 1);
  const jitter = Math.floor(Math.random() * 250);
  return base + jitter;
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

const normalizeChatResponse = (raw, schools) => {
  const reply =
    typeof raw?.reply === 'string' && raw.reply.trim()
      ? raw.reply.trim()
      : "I couldn't find suitable schools in the list. Please clarify the city, budget, or learning format.";
  const allowedIds = new Set();
  const nameToId = new Map();
  schools.forEach((school) => {
    const id = String(school?.school_id || school?.id || '');
    if (id) allowedIds.add(id);
    const name =
      school?.basic_info?.name ||
      school?.name ||
      school?.basic_info?.organization ||
      '';
    if (name && id) nameToId.set(name.toLowerCase(), id);
  });
  const rawIds = Array.isArray(raw?.recommendedSchoolIds)
    ? raw.recommendedSchoolIds
    : [];
  const recommended = rawIds
    .map((value) => String(value).trim())
    .map((value) => {
      if (allowedIds.has(value)) return value;
      const mapped = nameToId.get(value.toLowerCase());
      return mapped || '';
    })
    .filter((value) => value && allowedIds.has(value));

  return {
    reply,
    recommendedSchoolIds: Array.from(new Set(recommended)),
  };
};

const buildMessages = (message, schools) => [
    {
      role: 'system',
      content:
        'You are a school assistant. Use ONLY the provided school data. Do not invent schools. Respond in English.',
    },
  {
    role: 'user',
    content: [
      `User message: "${message}"`,
      'School data (JSON):',
      JSON.stringify(schools),
      'Respond with JSON only in this format:',
      '{"reply":"...","recommendedSchoolIds":["..."]}',
      'Use school_id values from the data for recommendedSchoolIds.',
    ].join('\n'),
  },
];

const chatWithSchools = async (config, message, schools) => {
  if (!config?.llm?.apiKey) {
    const error = new Error('LLM is not configured');
    error.code = 'LLM_NOT_CONFIGURED';
    throw error;
  }
  const baseUrl = config.llm.baseUrl.replace(/\/$/, '');
  const url = `${baseUrl}/chat/completions`;
  const payload = {
    model: config.llm.model,
    messages: buildMessages(message, schools),
    temperature: 0.2,
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
      return normalizeChatResponse(raw, schools);
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
  chatWithSchools,
};
