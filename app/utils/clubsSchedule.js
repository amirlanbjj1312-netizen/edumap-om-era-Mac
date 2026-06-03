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

const WEEKDAY_ORDER = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const WEEKDAY_PATTERNS = {
  Monday: /понедельник|monday|дүйсенбі/i,
  Tuesday: /вторник|tuesday|сейсенбі/i,
  Wednesday: /среда|wednesday|сәрсенбі/i,
  Thursday: /четверг|thursday|бейсенбі/i,
  Friday: /пятница|friday|жұма/i,
  Saturday: /суббота|saturday|сенбі/i,
  Sunday: /воскресенье|sunday|жексенбі/i,
};

const WEEKDAY_LABELS = {
  ru: {
    Monday: { short: 'ПН', long: 'Понедельник' },
    Tuesday: { short: 'ВТ', long: 'Вторник' },
    Wednesday: { short: 'СР', long: 'Среда' },
    Thursday: { short: 'ЧТ', long: 'Четверг' },
    Friday: { short: 'ПТ', long: 'Пятница' },
    Saturday: { short: 'СБ', long: 'Суббота' },
    Sunday: { short: 'ВС', long: 'Воскресенье' },
  },
  en: {
    Monday: { short: 'MO', long: 'Monday' },
    Tuesday: { short: 'TU', long: 'Tuesday' },
    Wednesday: { short: 'WE', long: 'Wednesday' },
    Thursday: { short: 'TH', long: 'Thursday' },
    Friday: { short: 'FR', long: 'Friday' },
    Saturday: { short: 'SA', long: 'Saturday' },
    Sunday: { short: 'SU', long: 'Sunday' },
  },
  kk: {
    Monday: { short: 'ДС', long: 'Дүйсенбі' },
    Tuesday: { short: 'СС', long: 'Сейсенбі' },
    Wednesday: { short: 'СР', long: 'Сәрсенбі' },
    Thursday: { short: 'БС', long: 'Бейсенбі' },
    Friday: { short: 'ЖМ', long: 'Жұма' },
    Saturday: { short: 'СН', long: 'Сенбі' },
    Sunday: { short: 'ЖК', long: 'Жексенбі' },
  },
};

const formatScheduleTime = (value) => String(value || '').replace('.', ':').trim();

const parseSchedulePreset = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return { days: [], start: '', end: '' };
  const days = WEEKDAY_ORDER.filter((item) => WEEKDAY_PATTERNS[item].test(raw));
  const times = Array.from(raw.matchAll(/([01]?\d|2[0-3])[:.][0-5]\d/g)).map((item) =>
    formatScheduleTime(item[0])
  );
  const [start = '', end = ''] = times;
  return { days, start, end };
};

const parseScheduleSlots = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return [];
  return raw
    .split(/\s*;\s*/)
    .map((item) => parseSchedulePreset(item))
    .filter((slot) => slot.days.length || slot.start || slot.end);
};

const getWeekdayLabel = (dayKey, locale = 'ru', mode = 'short') =>
  WEEKDAY_LABELS[locale]?.[dayKey]?.[mode] ||
  WEEKDAY_LABELS.ru[dayKey]?.[mode] ||
  dayKey;

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
        durationMinutes: text(club.duration_minutes),
        location: text(club.location),
        scheduleSlots: parseScheduleSlots(schedule),
      };
    })
    .filter(Boolean);

module.exports = {
  WEEKDAY_ORDER,
  buildUnifiedClubs,
  getWeekdayLabel,
  mapUnifiedToDisplay,
  parseScheduleSlots,
};
