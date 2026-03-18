const fs = require('fs/promises');
const path = require('path');

const STORAGE_DIR = path.resolve(__dirname, '../data');
const STORAGE_PATH = path.join(STORAGE_DIR, 'site-footer-settings.json');

const ensureStorageDir = async () => {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
};

const normalizeString = (value, max = 400) =>
  String(value || '')
    .trim()
    .slice(0, max);

const normalizeUrl = (value) => normalizeString(value, 1200);

const defaultSettings = () => ({
  parent_footer: {
    socials: {
      instagram_url: '',
      telegram_url: '',
      whatsapp_url: '',
    },
    contacts: {
      phone_primary: '',
      phone_secondary: '',
      email: '',
    },
    legal: {
      privacy_url: '',
      privacy_name: '',
      terms_url: '',
      terms_name: '',
      faq_url: '',
    },
    updated_at: '',
    updated_by: '',
  },
});

const normalizeFooterSettings = (input = {}) => ({
  socials: {
    instagram_url: normalizeUrl(input?.socials?.instagram_url),
    telegram_url: normalizeUrl(input?.socials?.telegram_url),
    whatsapp_url: normalizeUrl(input?.socials?.whatsapp_url),
  },
  contacts: {
    phone_primary: normalizeString(input?.contacts?.phone_primary, 40),
    phone_secondary: normalizeString(input?.contacts?.phone_secondary, 40),
    email: normalizeString(input?.contacts?.email, 160),
  },
  legal: {
    privacy_url: normalizeUrl(input?.legal?.privacy_url),
    privacy_name: normalizeString(input?.legal?.privacy_name, 240),
    terms_url: normalizeUrl(input?.legal?.terms_url),
    terms_name: normalizeString(input?.legal?.terms_name, 240),
    faq_url: normalizeUrl(input?.legal?.faq_url),
  },
  updated_at: normalizeString(input?.updated_at, 40) || new Date().toISOString(),
  updated_by: normalizeString(input?.updated_by, 160),
});

const readStore = async () => {
  try {
    await ensureStorageDir();
    const raw = await fs.readFile(STORAGE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      parent_footer: normalizeFooterSettings(parsed?.parent_footer || {}),
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      const base = defaultSettings();
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

const getParentFooterSettings = async () => {
  const store = await readStore();
  return normalizeFooterSettings(store.parent_footer || {});
};

const updateParentFooterSettings = async (payload = {}) => {
  const store = await readStore();
  store.parent_footer = {
    ...(store.parent_footer || {}),
    ...normalizeFooterSettings(payload),
    socials: {
      ...(store.parent_footer?.socials || {}),
      ...normalizeFooterSettings(payload).socials,
    },
    contacts: {
      ...(store.parent_footer?.contacts || {}),
      ...normalizeFooterSettings(payload).contacts,
    },
    legal: {
      ...(store.parent_footer?.legal || {}),
      ...normalizeFooterSettings(payload).legal,
    },
    updated_at: new Date().toISOString(),
  };
  await writeStore(store);
  return store.parent_footer;
};

module.exports = {
  getParentFooterSettings,
  updateParentFooterSettings,
};
