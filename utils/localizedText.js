import { DEFAULT_LOCALE } from './i18n';

export const normalizeLocalizedText = (value) => {
  if (!value) {
    return { ru: '', en: '', kk: '' };
  }
  if (typeof value === 'string') {
    return { ru: value, en: '', kk: '' };
  }
  const ru = typeof value.ru === 'string' ? value.ru : '';
  const en = typeof value.en === 'string' ? value.en : '';
  const kk = typeof value.kk === 'string' ? value.kk : '';
  return { ru, en, kk };
};

export const getLocalizedText = (value, locale = DEFAULT_LOCALE) => {
  const normalized = normalizeLocalizedText(value);
  return normalized[locale] || normalized.ru || normalized.kk || normalized.en || '';
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
    kk: normalized.kk.trim(),
  };
  return trimmed;
};
