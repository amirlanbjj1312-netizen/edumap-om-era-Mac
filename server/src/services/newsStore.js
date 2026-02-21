const fs = require('fs/promises');
const path = require('path');
const { buildConfig } = require('../utils/config');
const { getPool, ensureNewsTable } = require('./db');
const { NEWS_SEED } = require('../data/newsSeed');

const config = buildConfig();
const STORAGE_DIR = path.resolve(__dirname, '../data');
const STORAGE_PATH = path.join(STORAGE_DIR, 'news.json');

const ensureStorage = async () => {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
};

const sortNews = (items = []) =>
  [...items].sort(
    (a, b) =>
      new Date(b?.publishedAt || 0).getTime() -
      new Date(a?.publishedAt || 0).getTime()
  );

const normalizeMedia = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
};

const normalizeNewsItem = (value = {}, existing = null) => {
  const now = new Date().toISOString();
  const title = String(value.title || existing?.title || '').trim();
  if (!title) {
    throw new Error('title is required');
  }
  const id = String(value.id || existing?.id || `news-${Date.now()}`).trim();
  return {
    id,
    title,
    titleEn: String(value.titleEn || existing?.titleEn || '').trim(),
    summary: String(value.summary || existing?.summary || '').trim(),
    summaryEn: String(value.summaryEn || existing?.summaryEn || '').trim(),
    category: String(value.category || existing?.category || 'Announcements').trim(),
    author: String(value.author || existing?.author || 'Moderator').trim(),
    tags: Array.isArray(value.tags)
      ? value.tags.map((tag) => String(tag || '').trim()).filter(Boolean)
      : Array.isArray(existing?.tags)
      ? existing.tags
      : [],
    publishedAt: String(value.publishedAt || existing?.publishedAt || now).trim(),
    imageUrls: normalizeMedia(value.imageUrls || existing?.imageUrls),
    videoUrls: normalizeMedia(value.videoUrls || existing?.videoUrls),
    content: String(value.content || existing?.content || '').trim(),
    contentEn: String(value.contentEn || existing?.contentEn || '').trim(),
    updatedAt: now,
  };
};

const readFileStore = async () => {
  try {
    await ensureStorage();
    const raw = await fs.readFile(STORAGE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) {
      return sortNews(parsed);
    }
    return sortNews(NEWS_SEED);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return sortNews(NEWS_SEED);
    }
    throw error;
  }
};

const writeFileStore = async (items) => {
  await ensureStorage();
  await fs.writeFile(STORAGE_PATH, JSON.stringify(items, null, 2));
};

const readNews = async () => {
  if (!config.databaseUrl) {
    return readFileStore();
  }
  const db = getPool();
  await ensureNewsTable();
  const { rows } = await db.query('SELECT item FROM news ORDER BY updated_at DESC');
  if (!rows.length) return sortNews(NEWS_SEED);
  return sortNews(rows.map((row) => row.item));
};

const upsertNewsItem = async (input) => {
  const existingItems = await readNews();
  const existing = existingItems.find((item) => item.id === input?.id) || null;
  const item = normalizeNewsItem(input, existing);

  if (!config.databaseUrl) {
    const current = await readFileStore();
    const index = current.findIndex((entry) => entry.id === item.id);
    const next = [...current];
    if (index === -1) {
      next.push(item);
    } else {
      next[index] = item;
    }
    await writeFileStore(sortNews(next));
    return item;
  }

  const db = getPool();
  await ensureNewsTable();
  await db.query(
    `
      INSERT INTO news (id, item, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (id)
      DO UPDATE SET item = EXCLUDED.item, updated_at = NOW()
    `,
    [item.id, item]
  );
  return item;
};

const deleteNewsItem = async (id) => {
  const targetId = String(id || '').trim();
  if (!targetId) throw new Error('id is required');

  if (!config.databaseUrl) {
    const current = await readFileStore();
    const next = current.filter((item) => item.id !== targetId);
    await writeFileStore(next);
    return sortNews(next);
  }

  const db = getPool();
  await ensureNewsTable();
  await db.query('DELETE FROM news WHERE id = $1', [targetId]);
  return readNews();
};

module.exports = {
  readNews,
  upsertNewsItem,
  deleteNewsItem,
};
