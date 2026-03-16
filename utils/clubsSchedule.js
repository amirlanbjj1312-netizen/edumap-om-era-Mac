const text = (value) => (typeof value === 'string' ? value.trim() : '');

const localizedText = (value, locale = 'ru') => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const item = value || {};
    return (
      text(item[locale]) ||
      text(item.ru) ||
      text(item.en) ||
      text(item.kk) ||
      ''
    );
  }
  return text(value);
};

const toArray = (value) => (Array.isArray(value) ? value : []);

const normalizeUnifiedItem = (value, index = 0) => {
  const item = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const classRange = text(item.class_range || item.grades);
  const priceAmount = text(item.price_amount || item.price_monthly);
  return {
    id: text(item.id) || `club-${index + 1}`,
    name: item.name || item.title || {},
    description: item.description || {},
    schedule: item.schedule || {},
    age_group: text(item.age_group),
    class_range: classRange,
    duration_minutes: text(item.duration_minutes),
    location: text(item.location),
    teacher_id: text(item.teacher_id),
    teacher_name: text(item.teacher_name),
    price_amount: priceAmount,
    price_currency: text(item.price_currency || 'KZT').toUpperCase() || 'KZT',
    grades: classRange,
    price_monthly: priceAmount,
  };
};

const buildUnifiedClubs = (services) => {
  const source = services && typeof services === 'object' ? services : {};
  const unified = toArray(source.clubs_unified);
  if (unified.length) return unified.map((item, index) => normalizeUnifiedItem(item, index));
  const legacy = toArray(source.clubs_catalog);
  return legacy.map((item, index) => normalizeUnifiedItem(item, index));
};

const mapUnifiedToDisplay = (services, locale = 'ru') =>
  buildUnifiedClubs(services)
    .map((club, index) => {
      const name = localizedText(club.name, locale);
      const description = localizedText(club.description, locale);
      const schedule = localizedText(club.schedule, locale);
      const teacherName = text(club.teacher_name);
      const grades = text(club.class_range || club.grades);
      const priceMonthly = text(club.price_amount || club.price_monthly);
      const hasContent =
        name || description || schedule || teacherName || grades || priceMonthly;
      if (!hasContent) return null;
      return {
        id: club.id || `club-${index + 1}`,
        name,
        description,
        schedule,
        teacherName,
        grades,
        priceMonthly,
      };
    })
    .filter(Boolean);

module.exports = {
  buildUnifiedClubs,
  mapUnifiedToDisplay,
};
