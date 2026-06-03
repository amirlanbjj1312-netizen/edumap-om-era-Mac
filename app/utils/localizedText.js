import { DEFAULT_LOCALE } from './i18n';

export const normalizeLocalizedText = (value) => {
  if (!value) {
    return { ru: '', en: '', kk: '' };
  }
  if (typeof value === 'string') {
    return { ru: value, en: '', kk: '' };
  }
  const extractLeaf = (input, seen = new WeakSet()) => {
    if (!input) return '';
    if (typeof input === 'string') return input.trim();
    if (typeof input !== 'object' || Array.isArray(input)) return '';
    if (seen.has(input)) return '';
    seen.add(input);
    return (
      extractLeaf(input?.ru, seen) ||
      extractLeaf(input?.kk, seen) ||
      extractLeaf(input?.en, seen) ||
      ''
    );
  };
  const ru = extractLeaf(value?.ru) || extractLeaf(value);
  const en = extractLeaf(value?.en);
  const kk = extractLeaf(value?.kk);
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
