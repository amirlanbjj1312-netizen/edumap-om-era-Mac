import { DEFAULT_LOCALE } from './i18n';

export const normalizeLocalizedText = (value) => {
  if (!value) {
    return { ru: '', en: '' };
  }
  if (typeof value === 'string') {
    return { ru: value, en: '' };
  }
  const ru = typeof value.ru === 'string' ? value.ru : '';
  const en = typeof value.en === 'string' ? value.en : '';
  return { ru, en };
};

export const getLocalizedText = (value, locale = DEFAULT_LOCALE) => {
  const normalized = normalizeLocalizedText(value);
  return normalized[locale] || normalized.ru || normalized.en || '';
};

export const setLocalizedText = (value, locale, nextValue) => {
  const normalized = normalizeLocalizedText(value);
  return {
    ...normalized,
    [locale]: nextValue,
  };
};

export const finalizeLocalizedText = (value, primaryLocale) => {
  const normalized = normalizeLocalizedText(value);
  const trimmed = {
    ru: normalized.ru.trim(),
    en: normalized.en.trim(),
  };
  const otherLocale = primaryLocale === 'en' ? 'ru' : 'en';
  if (!trimmed[otherLocale] && trimmed[primaryLocale]) {
    trimmed[otherLocale] = trimmed[primaryLocale];
  }
  return trimmed;
};
