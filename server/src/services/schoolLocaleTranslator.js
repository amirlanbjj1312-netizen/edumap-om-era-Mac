const axios = require('axios');

const LOCALE_KEYS = ['ru', 'en', 'kk'];

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

const toText = (value) => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return '';
};

const isPlainObject = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isLocalizedObject = (value) => {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  if (!keys.length) return false;
  return keys.every((key) => LOCALE_KEYS.includes(key)) && keys.includes('ru');
};

const pathStartsWith = (path, scopePath) => {
  if (!scopePath.length) return true;
  if (scopePath.length > path.length) return false;
  return scopePath.every((part, index) => path[index] === part);
};

const shouldInspectPath = (path, scopePaths) => {
  if (!scopePaths?.length) return true;
  return scopePaths.some((scopePath) => {
    if (pathStartsWith(path, scopePath)) return true;
    return pathStartsWith(scopePath, path);
  });
};

const collectMissingTranslations = (value, path = [], acc = [], scopePaths = null) => {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectMissingTranslations(item, [...path, index], acc, scopePaths)
    );
    return acc;
  }

  if (!isPlainObject(value)) return acc;
  if (!shouldInspectPath(path, scopePaths)) return acc;

  if (isLocalizedObject(value)) {
    const ru = toText(value.ru);
    if (!ru) return acc;
    const en = toText(value.en);
    const kk = toText(value.kk);
    if (!en || !kk) {
      acc.push({ path, ru, needsEn: !en, needsKk: !kk });
    }
    return acc;
  }

  Object.entries(value).forEach(([key, nested]) => {
    collectMissingTranslations(nested, [...path, key], acc, scopePaths);
  });
  return acc;
};

const getByPath = (source, path) =>
  path.reduce((acc, key) => (acc == null ? acc : acc[key]), source);

const setByPath = (source, path, nextValue) => {
  if (!path.length) return nextValue;
  const [head, ...tail] = path;
  if (Array.isArray(source)) {
    const next = [...source];
    next[head] = setByPath(next[head], tail, nextValue);
    return next;
  }
  return {
    ...(source || {}),
    [head]: setByPath(source?.[head], tail, nextValue),
  };
};

const extractJson = (text) => {
  if (typeof text !== 'string') return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
};

const buildMessages = (texts) => [
  {
    role: 'system',
    content: [
      'You translate school profile content from Russian into English and Kazakh.',
      'Return only valid JSON.',
      'Preserve numbers, URLs, phone numbers, email addresses, abbreviations, brand names, and proper nouns when appropriate.',
      'Keep formatting concise and natural for school profiles.',
    ].join(' '),
  },
  {
    role: 'user',
    content: [
      'Translate these Russian strings into English and Kazakh.',
      'Return JSON with shape: {"items":[{"ru":"...","en":"...","kk":"..."}]}.',
      'Keep item order unchanged.',
      JSON.stringify({ items: texts.map((ru) => ({ ru })) }, null, 2),
    ].join('\n'),
  },
];

const translateBatch = async (config, texts) => {
  if (!config?.llm?.apiKey) {
    const error = new Error('LLM is not configured');
    error.code = 'LLM_NOT_CONFIGURED';
    throw error;
  }

  const baseUrl = config.llm.baseUrl.replace(/\/$/, '');
  const url = `${baseUrl}/chat/completions`;
  const payload = {
    model: config.llm.model,
    messages: buildMessages(texts),
    temperature: 0.2,
  };
  if (config.llm.provider === 'openai') {
    payload.response_format = { type: 'json_object' };
  }

  const maxAttempts = Math.max(1, config.llm.maxRetries + 1);
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${config.llm.apiKey}`,
        },
        timeout: config.llm.timeoutMs,
      });
      const content = response?.data?.choices?.[0]?.message?.content || '';
      const parsed = extractJson(content);
      const items = Array.isArray(parsed?.items) ? parsed.items : null;
      if (!items || items.length !== texts.length) {
        throw new Error('LLM returned invalid translation payload');
      }
      return items.map((item, index) => ({
        ru: texts[index],
        en: toText(item?.en),
        kk: toText(item?.kk),
      }));
    } catch (error) {
      lastError = error;
      if (!shouldRetry(error) || attempt === maxAttempts) {
        const err = new Error('LLM translation request failed');
        err.status = error?.response?.status;
        err.code = error?.code;
        err.cause = error;
        throw err;
      }
      await sleep(getRetryDelayMs(error, attempt));
    }
  }

  throw lastError || new Error('LLM translation request failed');
};

const normalizeScopePaths = (scope) => {
  if (!Array.isArray(scope)) return null;
  const normalized = scope
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .map((item) =>
      item
        .split('.')
        .map((part) => part.trim())
        .filter(Boolean)
    )
    .filter((parts) => parts.length);
  return normalized.length ? normalized : null;
};

const autofillMissingSchoolLocales = async (config, profile, options = {}) => {
  const scopePaths = normalizeScopePaths(options.scope);
  const targets = collectMissingTranslations(profile, [], [], scopePaths);
  if (!targets.length) return profile;

  const uniqueTexts = Array.from(new Set(targets.map((item) => item.ru)));
  const translated = await translateBatch(config, uniqueTexts);
  const byRu = new Map(translated.map((item) => [item.ru, item]));

  let nextProfile = profile;
  targets.forEach((target) => {
    const current = getByPath(nextProfile, target.path);
    if (!isLocalizedObject(current)) return;
    const translation = byRu.get(target.ru);
    if (!translation) return;
    nextProfile = setByPath(nextProfile, target.path, {
      ...current,
      en: target.needsEn ? translation.en || current.en || '' : current.en || '',
      kk: target.needsKk ? translation.kk || current.kk || '' : current.kk || '',
    });
  });

  return nextProfile;
};

module.exports = {
  autofillMissingSchoolLocales,
  translateTexts: translateBatch,
};
