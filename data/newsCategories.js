const CATEGORY_LABELS_BY_LOCALE = {
  en: {
    announcements: 'Announcements',
    tips: 'Useful tips',
    events: 'Events',
    competitions: 'Competitions',
  },
  ru: {
    announcements: 'Объявления',
    tips: 'Полезные советы',
    events: 'События',
    competitions: 'Конкурсы',
  },
};

const CATEGORY_KEYS = Object.keys(CATEGORY_LABELS_BY_LOCALE.en);

const CATEGORY_MATCHERS = {
  announcements: ['объявления', 'announcement', 'announcements', 'updates', 'admissions', 'general'],
  tips: ['полезные советы', 'tips', 'advice', 'useful tips'],
  events: ['события', 'events'],
  competitions: ['конкурсы', 'competitions', 'contests'],
};

const normalizeCategory = (value) =>
  (value || '').toString().trim().toLowerCase();

export const NEWS_CATEGORY_CHOICES = CATEGORY_KEYS.map((id) => ({
  id,
  label: CATEGORY_LABELS_BY_LOCALE.en[id],
}));

export const NEWS_CATEGORY_FILTERS = [
  { id: 'all', label: 'All' },
  ...NEWS_CATEGORY_CHOICES,
];

export const resolveCategoryKey = (value) => {
  const normalized = normalizeCategory(value);
  if (!normalized) return 'announcements';
  for (const [key, variants] of Object.entries(CATEGORY_MATCHERS)) {
    if (variants.includes(normalized)) return key;
  }
  for (const labels of Object.values(CATEGORY_LABELS_BY_LOCALE)) {
    for (const [key, label] of Object.entries(labels)) {
      if (normalizeCategory(label) === normalized) return key;
    }
  }
  return 'announcements';
};

export const getCategoryLabel = (locale, key) =>
  CATEGORY_LABELS_BY_LOCALE[locale]?.[key] ||
  CATEGORY_LABELS_BY_LOCALE.en[key] ||
  key;

export const getCategoryChoices = (locale) =>
  CATEGORY_KEYS.map((id) => ({
    id,
    label: getCategoryLabel(locale, id),
  }));

export const getCategoryFilters = (locale, allLabel = 'All') => [
  { id: 'all', label: allLabel },
  ...getCategoryChoices(locale),
];

export const formatCategoryLabel = (value, locale = 'ru') =>
  getCategoryLabel(locale, resolveCategoryKey(value));
