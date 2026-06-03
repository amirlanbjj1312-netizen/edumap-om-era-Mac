const fs = require('fs/promises');
const path = require('path');

const STORAGE_DIR = path.resolve(__dirname, '../data');
const STORAGE_PATH = path.join(STORAGE_DIR, 'user-admin-settings.json');

const normalizeString = (value, max = 300) =>
  String(value || '')
    .trim()
    .slice(0, max);

const toInteger = (value, fallback = 0) => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const ensureStorageDir = async () => {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
};

const defaultPayload = () => ({
  users: [],
});

const normalizeSettings = (input = {}) => ({
  user_id: normalizeString(input.user_id, 120),
  email: normalizeString(input.email, 160).toLowerCase(),
  first_name: normalizeString(input.first_name, 120),
  last_name: normalizeString(input.last_name, 120),
  subscription: {
    plan: normalizeString(input?.subscription?.plan, 120) || 'free',
    status: normalizeString(input?.subscription?.status, 40) || 'inactive',
    starts_at: normalizeString(input?.subscription?.starts_at, 40),
    ends_at: normalizeString(input?.subscription?.ends_at, 40),
    auto_renew: Boolean(input?.subscription?.auto_renew),
  },
  ai_limits: {
    chat_bonus: Math.max(0, toInteger(input?.ai_limits?.chat_bonus, 0)),
    selector_bonus: Math.max(0, toInteger(input?.ai_limits?.selector_bonus, 0)),
    bonus_expires_at: normalizeString(input?.ai_limits?.bonus_expires_at, 40),
  },
  notes: normalizeString(input.notes, 2000),
  updated_at: normalizeString(input.updated_at, 40) || new Date().toISOString(),
  updated_by: normalizeString(input.updated_by, 160),
});

const readStore = async () => {
  try {
    await ensureStorageDir();
    const raw = await fs.readFile(STORAGE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed?.users)
        ? parsed.users.map((item) => normalizeSettings(item)).filter((item) => item.user_id)
        : [],
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      const base = defaultPayload();
      await writeStore(base);
      return base;
    }
    throw error;
  }
};

const writeStore = async (payload) => {
  await ensureStorageDir();
  await fs.writeFile(STORAGE_PATH, JSON.stringify(payload, null, 2), 'utf8');
};

const getUserAdminSettings = async (userId, email = '') => {
  const id = normalizeString(userId, 120);
  if (!id) return null;
  const normalizedEmail = normalizeString(email, 160).toLowerCase();
  const store = await readStore();
  const existing = store.users.find((item) => item.user_id === id);
  if (existing) return existing;
  return normalizeSettings({
    user_id: id,
    email: normalizedEmail,
  });
};

const upsertUserAdminSettings = async (payload = {}) => {
  const normalized = normalizeSettings(payload);
  if (!normalized.user_id) {
    throw new Error('user_id is required');
  }
  const store = await readStore();
  const index = store.users.findIndex((item) => item.user_id === normalized.user_id);
  if (index >= 0) {
    store.users[index] = {
      ...store.users[index],
      ...normalized,
      subscription: {
        ...(store.users[index]?.subscription || {}),
        ...(normalized.subscription || {}),
      },
      ai_limits: {
        ...(store.users[index]?.ai_limits || {}),
        ...(normalized.ai_limits || {}),
      },
      updated_at: new Date().toISOString(),
    };
  } else {
    store.users.unshift({
      ...normalized,
      updated_at: new Date().toISOString(),
    });
  }
  await writeStore(store);
  return store.users.find((item) => item.user_id === normalized.user_id) || null;
};

module.exports = {
  getUserAdminSettings,
  upsertUserAdminSettings,
};

