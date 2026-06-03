type LocalizedText = { ru?: string; en?: string; kk?: string };

const toText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const toLocalized = (value: unknown): LocalizedText => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const item = value as Record<string, unknown>;
    return {
      ru: toText(item.ru),
      en: toText(item.en),
      kk: toText(item.kk),
    };
  }
  const text = toText(value);
  return { ru: text, en: text, kk: text };
};

const toArray = (value: unknown) => (Array.isArray(value) ? value : []);

const toPriceCurrency = (value: unknown) => {
  const raw = toText(value).toUpperCase();
  return raw === 'USD' || raw === 'EUR' ? raw : 'KZT';
};

export const normalizeUnifiedClubItem = (value: unknown, index = 0) => {
  const item =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const legacyPrice = toText(item.price_monthly || item.price_amount);
  const classRange = toText(item.class_range || item.grades);
  return {
    id: toText(item.id) || `club-${index + 1}`,
    name: toLocalized(item.name || item.title),
    description: toLocalized(item.description),
    schedule: toLocalized(item.schedule),
    age_group: toText(item.age_group),
    class_range: classRange,
    duration_minutes: toText(item.duration_minutes),
    location: toText(item.location),
    teacher_id: toText(item.teacher_id),
    teacher_name: toText(item.teacher_name),
    trainer_info: toText(item.trainer_info),
    trainer_photo: toText(item.trainer_photo),
    section_photos: toText(item.section_photos),
    price_amount: legacyPrice,
    price_currency: toPriceCurrency(item.price_currency),
    price_monthly: legacyPrice,
    grades: classRange,
  };
};

export const buildUnifiedClubsFromServices = (services: unknown) => {
  const section =
    services && typeof services === 'object' && !Array.isArray(services)
      ? (services as Record<string, unknown>)
      : {};
  const explicitUnified = toArray(section.clubs_unified);
  if (explicitUnified.length) {
    return explicitUnified.map((item, index) => normalizeUnifiedClubItem(item, index));
  }
  const legacyCatalog = toArray(section.clubs_catalog);
  return legacyCatalog.map((item, index) => normalizeUnifiedClubItem(item, index));
};

export const buildLegacyClubsCatalogFromUnified = (unified: unknown) =>
  toArray(unified).map((item, index) => {
    const normalized = normalizeUnifiedClubItem(item, index);
    return {
      id: normalized.id,
      name: normalized.name,
      description: normalized.description,
      schedule: normalized.schedule,
      teacher_name: normalized.teacher_name,
      trainer_info: normalized.trainer_info,
      trainer_photo: normalized.trainer_photo,
      section_photos: normalized.section_photos,
      grades: normalized.class_range,
      price_monthly: normalized.price_amount,
      price_currency: normalized.price_currency,
    };
  });

export const countClubsInServices = (services: unknown) =>
  buildUnifiedClubsFromServices(services).length;
