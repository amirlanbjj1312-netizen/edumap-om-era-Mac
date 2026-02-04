const path = require('path');

const sanitize = (value) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const parseList = (value) => {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const buildConfig = () => {
  const dataFilePath =
    process.env.CONSULTATION_STORE_FILE ||
    path.resolve(__dirname, '../../data/consultations.json');

  return {
    port: Number(process.env.PORT) || 4000,
    allowedOrigins: parseList(process.env.ALLOWED_ORIGINS),
    dataFilePath,
    llm: {
      provider: sanitize(process.env.LLM_PROVIDER) || 'openai',
      apiKey:
        sanitize(process.env.LLM_API_KEY) ||
        sanitize(process.env.OPENAI_API_KEY),
      baseUrl:
        sanitize(process.env.LLM_BASE_URL) || 'https://api.openai.com/v1',
      model: sanitize(process.env.LLM_MODEL) || 'gpt-4o-mini',
      timeoutMs: Number(process.env.LLM_TIMEOUT_MS) || 15000,
      maxRetries: Number(process.env.LLM_MAX_RETRIES) || 2,
    },
    whatsapp: {
      apiUrl: sanitize(process.env.WHATSAPP_API_URL),
      token: sanitize(process.env.WHATSAPP_ACCESS_TOKEN),
      templateName: sanitize(process.env.WHATSAPP_TEMPLATE_NAME) || 'consultation_update',
    },
    email: {
      sendGridKey: sanitize(process.env.SENDGRID_API_KEY),
      fromEmail: sanitize(process.env.FROM_EMAIL),
      codeTtlMinutes: Number(process.env.CODE_TTL_MINUTES) || 10,
      maxAttempts: Number(process.env.MAX_CODE_ATTEMPTS) || 5,
      resendWindowSec: Number(process.env.RESEND_WINDOW_SEC) || 60,
    },
    supabase: {
      url: sanitize(process.env.SUPABASE_URL),
      serviceRoleKey: sanitize(process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
    databaseUrl: sanitize(process.env.DATABASE_URL),
  };
};

module.exports = {
  buildConfig,
};
