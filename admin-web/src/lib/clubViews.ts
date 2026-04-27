import { buildUnifiedClubsFromServices } from '@/lib/clubsSchedule';

type Locale = 'ru' | 'en' | 'kk';

const toText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const toList = (value: unknown) =>
  toText(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const toLocalizedText = (value: unknown, locale: Locale) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const item = value as Record<string, unknown>;
    return (
      toText(item[locale]) ||
      toText(item.ru) ||
      toText(item.en) ||
      toText(item.kk) ||
      ''
    );
  }
  return toText(value);
};

const toCurrencySymbol = (value: unknown) => {
  const code = toText(value).toUpperCase();
  if (code === 'USD') return '$';
  if (code === 'EUR') return '€';
  return '₸';
};

const toTeacherId = (value: unknown, fallback: string) => {
  const raw = toText(value).toLowerCase();
  if (!raw) return fallback;
  return raw
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

export const buildSchoolTeachers = (school: unknown, locale: Locale) => {
  const root = school && typeof school === 'object' ? (school as Record<string, unknown>) : {};
  const services =
    root.services && typeof root.services === 'object'
      ? (root.services as Record<string, unknown>)
      : {};
  const teachingStaff =
    services.teaching_staff && typeof services.teaching_staff === 'object'
      ? (services.teaching_staff as Record<string, unknown>)
      : {};
  const members = Array.isArray(teachingStaff.members)
    ? teachingStaff.members
    : [];
  return members
    .map((item: Record<string, unknown>, index: number) => ({
      id: toTeacherId(item.id || item.full_name, `teacher-${index + 1}`),
      full_name: toText(item.full_name) || (locale === 'en' ? 'Teacher' : 'Преподаватель'),
      position: toLocalizedText(item.position, locale),
      category: toText(item.category),
      subjects: toText(item.subjects),
      teaching_languages: toText(item.teaching_languages),
      experience_years: toText(item.experience_years),
      bio: toLocalizedText(item.bio, locale),
      photo_url: toText(item.photo_url),
    }))
    .filter((item: { full_name: string; subjects: string; position: string; bio: string; photo_url: string }) =>
      item.full_name || item.subjects || item.position || item.bio || item.photo_url
    );
};

export const buildSchoolClubs = (school: unknown, locale: Locale) => {
  const root = school && typeof school === 'object' ? (school as Record<string, unknown>) : {};
  const clubs = buildUnifiedClubsFromServices(root.services);
  return clubs
    .map((item, index) => {
      const name = toLocalizedText(item.name, locale);
      const description = toLocalizedText(item.description, locale);
      const schedule = toLocalizedText(item.schedule, locale);
      const teacherName = toLocalizedText(item.teacher_name, locale);
      const priceAmount = toText(item.price_amount || item.price_monthly);
      const symbol = toCurrencySymbol(item.price_currency);
      const hasContent =
        name ||
        description ||
        schedule ||
        teacherName ||
        toText(item.class_range) ||
        toText(item.age_group) ||
        toText(item.duration_minutes) ||
        toText(item.location) ||
        priceAmount;
      if (!hasContent) return null;
      return {
        id: toText(item.id) || `club-${index + 1}`,
        name: name || (locale === 'en' ? 'Club' : 'Кружок'),
        description,
        schedule,
        teacher_id: toTeacherId(item.teacher_id || teacherName, ''),
        teacher_name: teacherName,
        trainer_info: toLocalizedText(item.trainer_info, locale),
        trainer_photo: toText(item.trainer_photo),
        section_photos: toList(item.section_photos),
        class_range: toText(item.class_range),
        age_group: toText(item.age_group),
        duration_minutes: toText(item.duration_minutes),
        location: toText(item.location),
        price_amount: priceAmount,
        price_currency: toText(item.price_currency || 'KZT'),
        price_label: priceAmount ? `${Number(priceAmount).toLocaleString('ru-RU')} ${symbol}` : '',
      };
    })
    .filter(Boolean) as Array<{
    id: string;
    name: string;
    description: string;
    schedule: string;
    teacher_id: string;
    teacher_name: string;
    trainer_info: string;
    trainer_photo: string;
    section_photos: string[];
    class_range: string;
    age_group: string;
    duration_minutes: string;
    location: string;
    price_amount: string;
    price_currency: string;
    price_label: string;
  }>;
};
