'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadSchools } from '@/lib/api';
import { getCompareIds, subscribeCompareIds } from '@/lib/parentCompare';
import { useParentLocale } from '@/lib/parentLocale';
import { buildFeeRulesFromFinance, formatSchoolFee } from '@/lib/schoolFinance';

type SchoolRow = {
  school_id?: string;
  basic_info?: {
    display_name?: unknown;
    brand_name?: unknown;
    short_name?: unknown;
    name?: unknown;
    city?: unknown;
    type?: unknown;
    school_subtype?: unknown;
    district?: unknown;
    address?: unknown;
    phone?: unknown;
    email?: unknown;
    website?: unknown;
    description?: unknown;
  };
  education?: {
    languages?: unknown;
    curricula?: {
      national?: unknown;
      international?: unknown;
      additional?: unknown;
      other?: unknown;
    };
    entrance_exam?: { required?: unknown };
    advanced_subjects?: unknown;
    average_class_size?: unknown;
  };
  services?: {
    after_school?: unknown;
    transport?: unknown;
    inclusive_education?: unknown;
    meals_status?: unknown;
    safety?: {
      security?: unknown;
      cameras?: unknown;
      access_control?: unknown;
    };
    medical_office?: unknown;
    clubs_count?: unknown;
  };
  media?: {
    photos?: unknown;
    videos?: unknown;
    accreditation?: unknown;
    certificates?: unknown;
  };
  contacts?: { social?: unknown };
  admissions?: { scholarships?: unknown; grants?: unknown };
  system?: { rating?: number; reviews_count?: number };
  finance?: {
    fee_rules?: unknown;
    tuition_monthly?: unknown;
    monthly_fee?: unknown;
    price_monthly?: unknown;
    monthly_fee_by_grade?: unknown;
    discounts?: unknown;
  };
};

const toText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    const localized = value as Record<string, unknown>;
    const picked = localized.ru ?? localized.kk ?? localized.en;
    if (typeof picked === 'string') return picked;
    if (typeof picked === 'number') return String(picked);
  }
  return '';
};

const toLocaleText = (value: unknown, locale: 'ru' | 'en' | 'kk'): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    const localized = value as Record<string, unknown>;
    const picked = localized[locale] ?? localized.ru ?? localized.kk ?? localized.en;
    if (typeof picked === 'string') return picked;
    if (typeof picked === 'number') return String(picked);
  }
  return '';
};

const toList = (value: unknown): string[] =>
  toText(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const OPTION_I18N: Record<string, { ru: string; en: string; kk: string }> = {
  Almaty: { ru: 'Алматы', en: 'Almaty', kk: 'Алматы' },
  Astana: { ru: 'Астана', en: 'Astana', kk: 'Астана' },
  Baikonyr: { ru: 'Байконур', en: 'Baikonyr', kk: 'Байқоңыр' },
  Yesil: { ru: 'Есиль', en: 'Yesil', kk: 'Есіл' },
  Saryarka: { ru: 'Сарыарка', en: 'Saryarka', kk: 'Сарыарқа' },
  Nura: { ru: 'Нура', en: 'Nura', kk: 'Нұра' },
  Russian: { ru: 'Русский', en: 'Russian', kk: 'Орыс тілі' },
  English: { ru: 'Английский', en: 'English', kk: 'Ағылшын тілі' },
  Kazakh: { ru: 'Казахский', en: 'Kazakh', kk: 'Қазақ тілі' },
  Chinese: { ru: 'Китайский', en: 'Chinese', kk: 'Қытай тілі' },
  French: { ru: 'Французский', en: 'French', kk: 'Француз тілі' },
  German: { ru: 'Немецкий', en: 'German', kk: 'Неміс тілі' },
  Mathematics: { ru: 'Математика', en: 'Mathematics', kk: 'Математика' },
  Physics: { ru: 'Физика', en: 'Physics', kk: 'Физика' },
  Engineering: { ru: 'Инженерия', en: 'Engineering', kk: 'Инженерия' },
  'English language': { ru: 'Английский язык', en: 'English language', kk: 'Ағылшын тілі' },
  Paid: { ru: 'Платное', en: 'Paid', kk: 'Ақылы' },
  Free: { ru: 'Бесплатно', en: 'Free', kk: 'Тегін' },
  Included: { ru: 'Включено', en: 'Included', kk: 'Қосылған' },
};

const OPTION_ALIASES: Record<string, string> = {
  русский: 'Russian',
  'орыс тілі': 'Russian',
  английский: 'English',
  англииский: 'English',
  english: 'English',
  'ағылшын тілі': 'English',
  'английский язык': 'English language',
  'english language': 'English language',
  казахский: 'Kazakh',
  казахскийй: 'Kazakh',
  қазақша: 'Kazakh',
  'қазақ тілі': 'Kazakh',
  математика: 'Mathematics',
  mathematics: 'Mathematics',
  физика: 'Physics',
  physics: 'Physics',
  инженерия: 'Engineering',
  engineering: 'Engineering',
  paid: 'Paid',
  free: 'Free',
  included: 'Included',
  almaty: 'Almaty',
  алматы: 'Almaty',
  astana: 'Astana',
  астана: 'Astana',
  yesil: 'Yesil',
  есиль: 'Yesil',
  есіл: 'Yesil',
  saryarka: 'Saryarka',
  сарыарка: 'Saryarka',
  сарыарқа: 'Saryarka',
  nura: 'Nura',
  нура: 'Nura',
  нұра: 'Nura',
  baikonyr: 'Baikonyr',
  байконур: 'Baikonyr',
  байқоңыр: 'Baikonyr',
};

const normalizeOptionKey = (value: string) => value.replace(/\s+/g, ' ').trim();

const localizeOption = (value: string, locale: 'ru' | 'en' | 'kk') => {
  const key = normalizeOptionKey(value);
  if (!key) return '';
  const aliasKey = OPTION_ALIASES[key.toLowerCase()] || key;
  const normalizedAliasKey = normalizeOptionKey(aliasKey);
  const direct = OPTION_I18N[normalizedAliasKey];
  if (direct) return direct[locale];
  const ciKey = Object.keys(OPTION_I18N).find(
    (entry) => entry.toLowerCase() === normalizedAliasKey.toLowerCase()
  );
  if (ciKey) return OPTION_I18N[ciKey][locale];
  return key;
};

const localizeUniqueList = (value: unknown, locale: 'ru' | 'en' | 'kk') =>
  Array.from(
    new Map(
      toList(value)
        .map((item) => localizeOption(item, locale).trim())
        .filter(Boolean)
        .map((item) => [item.toLowerCase(), item] as const)
    ).values()
  );

const TYPE_KEY_ALIASES: Record<string, 'State' | 'Private'> = {
  state: 'State',
  private: 'Private',
  international: 'Private',
  autonomous: 'Private',
  государственная: 'State',
  частная: 'Private',
  международная: 'Private',
  автономная: 'Private',
  мемлекеттік: 'State',
  жеке: 'Private',
  халықаралық: 'Private',
  автономды: 'Private',
};

const normalizePrimaryTypeKey = (value: string): 'State' | 'Private' | '' => {
  const key = value.trim().toLowerCase();
  if (!key) return '';
  return TYPE_KEY_ALIASES[key] || '';
};

const getSchoolType = (value: unknown): 'State' | 'Private' | '' => {
  const list = toList(value);
  for (const item of list) {
    const normalized = normalizePrimaryTypeKey(item);
    if (normalized) return normalized;
  }
  return normalizePrimaryTypeKey(toText(value));
};

const SCHOOL_TYPE_I18N: Record<string, { ru: string; en: string; kk: string }> = {
  State: { ru: 'Государственная', en: 'State', kk: 'Мемлекеттік' },
  Private: { ru: 'Частная', en: 'Private', kk: 'Жеке' },
  International: { ru: 'Международная', en: 'International', kk: 'Халықаралық' },
  Autonomous: { ru: 'Автономная', en: 'Autonomous', kk: 'Автономды' },
  Государственная: { ru: 'Государственная', en: 'State', kk: 'Мемлекеттік' },
  Частная: { ru: 'Частная', en: 'Private', kk: 'Жеке' },
  Международная: { ru: 'Международная', en: 'International', kk: 'Халықаралық' },
  Автономная: { ru: 'Автономная', en: 'Autonomous', kk: 'Автономды' },
  Мемлекеттік: { ru: 'Государственная', en: 'State', kk: 'Мемлекеттік' },
  Жеке: { ru: 'Частная', en: 'Private', kk: 'Жеке' },
  Халықаралық: { ru: 'Международная', en: 'International', kk: 'Халықаралық' },
  Автономды: { ru: 'Автономная', en: 'Autonomous', kk: 'Автономды' },
};

const SCHOOL_SUBTYPE_I18N: Record<string, { ru: string; en: string; kk: string }> = {
  'General School': { ru: 'Обычная средняя школа', en: 'General school', kk: 'Жалпы орта мектеп' },
  'Autonomous School': { ru: 'Автономная школа', en: 'Autonomous school', kk: 'Автономды мектеп' },
  Gymnasium: { ru: 'Гимназия', en: 'Gymnasium', kk: 'Гимназия' },
  Lyceum: { ru: 'Лицей', en: 'Lyceum', kk: 'Лицей' },
  'Specialized School': { ru: 'Специализированная школа', en: 'Specialized school', kk: 'Мамандандырылған мектеп' },
  'International School': { ru: 'Международная школа', en: 'International school', kk: 'Халықаралық мектеп' },
  'Private General School': { ru: 'Частная общеобразовательная школа', en: 'Private general school', kk: 'Жеке жалпы білім беретін мектеп' },
  'Innovative School': { ru: 'Инновационная школа', en: 'Innovative school', kk: 'Инновациялық мектеп' },
  'Advanced Subjects School': { ru: 'Школа с углублённым изучением предметов', en: 'Advanced subjects school', kk: 'Пәндерді тереңдетіп оқытатын мектеп' },
  'Author School': { ru: 'Авторская школа', en: 'Author school', kk: 'Авторлық мектеп' },
  'Online School': { ru: 'Онлайн-школа / дистанционная школа', en: 'Online / distance school', kk: 'Онлайн / қашықтан оқыту мектебі' },
  'Boarding School': { ru: 'Школа-интернат', en: 'Boarding school', kk: 'Мектеп-интернат' },
};

const localizeSchoolType = (value: string, locale: 'ru' | 'en' | 'kk'): string => {
  const normalized = value.trim();
  if (!normalized) return '';
  const hit =
    SCHOOL_TYPE_I18N[normalized] ||
    SCHOOL_TYPE_I18N[Object.keys(SCHOOL_TYPE_I18N).find((k) => k.toLowerCase() === normalized.toLowerCase()) || ''];
  return hit ? hit[locale] : normalized;
};

const localizeSchoolSubtype = (value: string, locale: 'ru' | 'en' | 'kk'): string => {
  const normalized = value.trim();
  if (!normalized) return '';
  const hit =
    SCHOOL_SUBTYPE_I18N[normalized] ||
    SCHOOL_SUBTYPE_I18N[Object.keys(SCHOOL_SUBTYPE_I18N).find((k) => k.toLowerCase() === normalized.toLowerCase()) || ''];
  return hit ? hit[locale] : normalized;
};

const formatComposedSchoolType = (typeValue: unknown, subtypeValue: unknown, locale: 'ru' | 'en' | 'kk'): string => {
  const typeKey = getSchoolType(typeValue);
  const typeLabel = localizeSchoolType(typeKey || toLocaleText(typeValue, locale), locale);
  const subtypeLabel = localizeSchoolSubtype(toText(subtypeValue), locale);
  if (!subtypeLabel) return typeLabel;
  if (locale === 'ru') {
    const prefix = subtypeLabel.toLowerCase().startsWith('лицей')
      ? typeKey === 'Private' ? 'Частный' : 'Государственный'
      : typeKey === 'Private' ? 'Частная' : 'Государственная';
    const lowered = subtypeLabel.charAt(0).toLowerCase() + subtypeLabel.slice(1);
    return `${prefix} ${lowered}`;
  }
  return `${typeLabel} ${subtypeLabel}`.trim();
};

const formatSchoolTypes = (value: unknown, locale: 'ru' | 'en' | 'kk'): string => {
  const items = toList(value);
  if (!items.length) return localizeSchoolType(toLocaleText(value, locale), locale);
  return items.map((item) => localizeSchoolType(item, locale)).filter(Boolean).join(', ');
};

const getIn = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);

const asBoolText = (value: unknown, locale: 'ru' | 'en' | 'kk'): string => {
  if (typeof value === 'boolean') {
    if (locale === 'en') return value ? 'Yes' : 'No';
    if (locale === 'kk') return value ? 'Иә' : 'Жоқ';
    return value ? 'Да' : 'Нет';
  }
  const raw = toText(value).trim().toLowerCase();
  if (!raw) return '—';
  const yes = ['true', 'yes', 'да', 'иә', 'есть', 'доступно', 'supported', 'active'];
  const no = ['false', 'no', 'нет', 'жоқ', 'not supported', 'inactive', 'недоступно'];
  if (yes.some((token) => raw.includes(token))) {
    return locale === 'en' ? 'Yes' : locale === 'kk' ? 'Иә' : 'Да';
  }
  if (no.some((token) => raw.includes(token))) {
    return locale === 'en' ? 'No' : locale === 'kk' ? 'Жоқ' : 'Нет';
  }
  return toText(value).trim() || '—';
};

const formatGradeFees = (
  finance: SchoolRow['finance'],
  locale: 'ru' | 'en' | 'kk'
): string => {
  const rules = buildFeeRulesFromFinance(finance || {});
  if (!rules.length) return '—';
  const classLabel = locale === 'en' ? 'Grades' : locale === 'kk' ? 'Сыныптар' : 'Классы';
  const byCurrency = new Map<string, string[]>();
  rules.forEach((rule) => {
    const range = rule.from_grade === rule.to_grade ? `${rule.from_grade}` : `${rule.from_grade}-${rule.to_grade}`;
    const symbol = rule.currency === 'KZT' ? '₸' : rule.currency === 'USD' ? '$' : '€';
    const periodLabel =
      locale === 'en'
        ? rule.period === 'yearly'
          ? '/ year'
          : '/ month'
        : locale === 'kk'
          ? rule.period === 'yearly'
            ? '/ жыл'
            : '/ ай'
          : rule.period === 'yearly'
            ? '/ год'
            : '/ мес';
    const line = `${classLabel} ${range}: ${rule.amount.toLocaleString('ru-RU')} ${symbol} ${periodLabel}`;
    const prev = byCurrency.get(rule.currency) || [];
    prev.push(line);
    byCurrency.set(rule.currency, prev);
  });
  return Array.from(byCurrency.values())
    .flat()
    .join('\n');
};

export default function ParentComparePage() {
  const router = useRouter();
  const { locale } = useParentLocale();
  const [rows, setRows] = useState<SchoolRow[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>(() => getCompareIds());

  const text = useMemo(
    () =>
      locale === 'en'
        ? {
            title: 'School comparison',
            subtitle: 'Compare selected schools by key criteria.',
            empty: 'No schools selected for comparison.',
            collapse: 'Collapse',
            criteria: 'Criteria',
            schoolA: 'School 1',
            schoolB: 'School 2',
            notSelected: 'Not selected',
          }
        : locale === 'kk'
          ? {
              title: 'Мектептерді салыстыру',
              subtitle: 'Таңдалған мектептерді негізгі критерийлер бойынша салыстырыңыз.',
              empty: 'Салыстыру үшін мектеп таңдалмаған.',
              collapse: 'Жию',
              criteria: 'Критерий',
              schoolA: 'Мектеп 1',
              schoolB: 'Мектеп 2',
              notSelected: 'Таңдалмаған',
            }
          : {
              title: 'Сравнение школ',
              subtitle: 'Сравните выбранные школы по ключевым критериям.',
              empty: 'Для сравнения пока не выбрано ни одной школы.',
              collapse: 'Свернуть',
              criteria: 'Критерий',
              schoolA: 'Школа 1',
              schoolB: 'Школа 2',
              notSelected: 'Не выбрана',
            },
    [locale]
  );

  useEffect(() => {
    let mounted = true;
    loadSchools().then((payload) => {
      if (!mounted) return;
      setRows(Array.isArray(payload?.data) ? payload.data : []);
    });
    const unsub = subscribeCompareIds((ids) => setCompareIds(ids));
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const selectedRows = useMemo(() => {
    const map = new Map(rows.map((row) => [String(row.school_id || ''), row]));
    return compareIds.map((id) => map.get(id)).filter(Boolean).slice(0, 2) as SchoolRow[];
  }, [rows, compareIds]);

  const leftSchool = selectedRows[0];
  const rightSchool = selectedRows[1];

  const leftName =
    (leftSchool &&
      (toLocaleText(leftSchool.basic_info?.display_name, locale) ||
        toLocaleText(leftSchool.basic_info?.brand_name, locale) ||
        toLocaleText(leftSchool.basic_info?.short_name, locale) ||
        toText(leftSchool.basic_info?.name))) ||
    text.notSelected;
  const rightName =
    (rightSchool &&
      (toLocaleText(rightSchool.basic_info?.display_name, locale) ||
        toLocaleText(rightSchool.basic_info?.brand_name, locale) ||
        toLocaleText(rightSchool.basic_info?.short_name, locale) ||
        toText(rightSchool.basic_info?.name))) ||
    text.notSelected;

  const criteriaRows = useMemo(() => {
    const criteriaLabel = (ru: string, en: string, kk: string) => (locale === 'en' ? en : locale === 'kk' ? kk : ru);
    const valueFor = (school: SchoolRow | undefined, key: string): string => {
      if (!school) return '—';
      switch (key) {
        case 'name':
          return (
            toLocaleText(school.basic_info?.display_name, locale) ||
            toLocaleText(school.basic_info?.brand_name, locale) ||
            toLocaleText(school.basic_info?.short_name, locale) ||
            toText(school.basic_info?.name) ||
            '—'
          );
        case 'city':
          return localizeOption(toText(school.basic_info?.city).trim(), locale) || '—';
        case 'district':
          return localizeOption(toText(school.basic_info?.district).trim(), locale) || '—';
        case 'type': {
          const type = getSchoolType(school.basic_info?.type) || toText(school.basic_info?.type);
          return (
            formatComposedSchoolType(school.basic_info?.type, school.basic_info?.school_subtype, locale) ||
            formatSchoolTypes(type, locale) ||
            '—'
          );
        }
        case 'subtype':
          return localizeSchoolSubtype(toText(school.basic_info?.school_subtype), locale) || '—';
        case 'address':
          return toText(school.basic_info?.address).trim() || '—';
        case 'phone':
          return toText(school.basic_info?.phone).trim() || '—';
        case 'email':
          return toText(school.basic_info?.email).trim() || '—';
        case 'website':
          return toText(school.basic_info?.website).trim() || '—';
        case 'languages':
          return localizeUniqueList(school.education?.languages, locale).join(', ') || '—';
        case 'curricula': {
          const items = [
            getIn(school, 'education.curricula.national'),
            getIn(school, 'education.curricula.international'),
            getIn(school, 'education.curricula.additional'),
            getIn(school, 'education.curricula.other'),
          ]
            .map((v) => toText(v).trim())
            .filter(Boolean);
          return items.length ? items.join(' · ') : '—';
        }
        case 'advancedSubjects':
          return localizeUniqueList(getIn(school, 'education.advanced_subjects'), locale).join(', ') || '—';
        case 'entranceExam':
          return asBoolText(getIn(school, 'education.entrance_exam.required'), locale);
        case 'avgClassSize':
          return toText(getIn(school, 'education.average_class_size')).trim() || '—';
        case 'clubsCount':
          return toText(getIn(school, 'services.clubs_count')).trim() || '—';
        case 'afterSchool':
          return asBoolText(getIn(school, 'services.after_school'), locale);
        case 'meals':
          return localizeOption(toText(getIn(school, 'services.meals_status')).trim(), locale) || '—';
        case 'transport':
          return asBoolText(getIn(school, 'services.transport'), locale);
        case 'inclusive':
          return asBoolText(getIn(school, 'services.inclusive_education'), locale);
        case 'security':
          return asBoolText(getIn(school, 'services.safety.security'), locale);
        case 'cameras':
          return asBoolText(getIn(school, 'services.safety.cameras'), locale);
        case 'accessControl':
          return asBoolText(getIn(school, 'services.safety.access_control'), locale);
        case 'medicalOffice':
          return asBoolText(getIn(school, 'services.medical_office'), locale);
        case 'monthly':
          return formatSchoolFee(
            {
              finance: school.finance,
              basic_info: { price: getIn(school, 'basic_info.price') },
            },
            locale,
            '—'
          );
        case 'monthlyByGrade':
          return formatGradeFees(school.finance, locale);
        case 'discounts':
          return toText(getIn(school, 'finance.discounts')).trim() || '—';
        case 'grants':
          return toText(getIn(school, 'admissions.grants')).trim() || toText(getIn(school, 'admissions.scholarships')).trim() || '—';
        case 'rating':
          return String(getIn(school, 'system.rating') ?? '0.0');
        case 'reviews':
          return String(getIn(school, 'system.reviews_count') ?? 0);
        case 'accreditation':
          return toText(getIn(school, 'media.accreditation')).trim() || toText(getIn(school, 'media.certificates')).trim() || '—';
        case 'photos':
          return toText(getIn(school, 'media.photos')).trim() || '—';
        case 'videos':
          return toText(getIn(school, 'media.videos')).trim() || '—';
        case 'description':
          return toText(getIn(school, 'basic_info.description')).trim() || '—';
        default:
          return '—';
      }
    };
    const defs = [
      ['name', criteriaLabel('Название', 'Name', 'Атауы')],
      ['city', criteriaLabel('Город', 'City', 'Қала')],
      ['district', criteriaLabel('Район', 'District', 'Аудан')],
      ['type', criteriaLabel('Тип школы', 'School type', 'Мектеп түрі')],
      ['subtype', criteriaLabel('Подтип', 'Subtype', 'Ішкі түрі')],
      ['address', criteriaLabel('Адрес', 'Address', 'Мекенжай')],
      ['phone', criteriaLabel('Телефон', 'Phone', 'Телефон')],
      ['email', criteriaLabel('Email', 'Email', 'Email')],
      ['website', criteriaLabel('Сайт', 'Website', 'Сайт')],
      ['languages', criteriaLabel('Языки обучения', 'Languages', 'Оқыту тілдері')],
      ['curricula', criteriaLabel('Программы', 'Curricula', 'Бағдарламалар')],
      ['advancedSubjects', criteriaLabel('Углублённые предметы', 'Advanced subjects', 'Тереңдетілген пәндер')],
      ['entranceExam', criteriaLabel('Вступительный экзамен', 'Entrance exam', 'Қабылдау емтиханы')],
      ['avgClassSize', criteriaLabel('Средний размер класса', 'Average class size', 'Орташа сынып көлемі')],
      ['clubsCount', criteriaLabel('Количество кружков', 'Clubs count', 'Үйірмелер саны')],
      ['afterSchool', criteriaLabel('Продлёнка', 'After school', 'Ұзартылған күн')],
      ['meals', criteriaLabel('Питание', 'Meals', 'Тамақтану')],
      ['transport', criteriaLabel('Транспорт', 'Transport', 'Тасымал')],
      ['inclusive', criteriaLabel('Инклюзия', 'Inclusive education', 'Инклюзия')],
      ['security', criteriaLabel('Охрана', 'Security', 'Күзет')],
      ['cameras', criteriaLabel('Камеры', 'Cameras', 'Камералар')],
      ['accessControl', criteriaLabel('Контроль доступа', 'Access control', 'Кіру бақылауы')],
      ['medicalOffice', criteriaLabel('Медпункт', 'Medical office', 'Медпункт')],
      ['monthly', criteriaLabel('Стоимость обучения', 'Tuition fee', 'Оқу құны')],
      ['monthlyByGrade', criteriaLabel('Стоимость по классам', 'Fee by grade', 'Сыныптар бойынша төлем')],
      ['discounts', criteriaLabel('Скидки', 'Discounts', 'Жеңілдіктер')],
      ['grants', criteriaLabel('Гранты/Стипендии', 'Grants/Scholarships', 'Гранттар/Стипендиялар')],
      ['rating', criteriaLabel('Рейтинг', 'Rating', 'Рейтинг')],
      ['reviews', criteriaLabel('Отзывы', 'Reviews', 'Пікірлер')],
      ['accreditation', criteriaLabel('Аккредитация', 'Accreditation', 'Аккредитация')],
      ['photos', criteriaLabel('Фото', 'Photos', 'Фотолар')],
      ['videos', criteriaLabel('Видео', 'Videos', 'Бейнелер')],
      ['description', criteriaLabel('Описание', 'Description', 'Сипаттама')],
    ] as Array<[string, string]>;
    return defs.map(([key, label]) => ({
      key,
      label,
      left: valueFor(leftSchool, key),
      right: valueFor(rightSchool, key),
    }));
  }, [locale, leftSchool, rightSchool]);

  return (
    <div className="card compare-page-card">
      <div className="compare-head">
        <h2 className="section-title" style={{ marginBottom: 0 }}>{text.title}</h2>
        <button
          type="button"
          className="button secondary compare-collapse-btn"
          onClick={() => router.push('/parent/schools')}
        >
          {text.collapse}
        </button>
      </div>
      <p className="muted">{text.subtitle}</p>

      {!selectedRows.length ? (
        <p className="muted" style={{ marginTop: 14 }}>{text.empty}</p>
      ) : (
        <div className="compare-table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th className="compare-col-criteria">{text.criteria}</th>
                <th className="compare-col-school">{leftName}</th>
                <th className="compare-col-school">{rightName}</th>
              </tr>
            </thead>
            <tbody>
              {criteriaRows.map((row) => (
                <tr key={row.key}>
                  <td className="compare-criteria-cell"><strong>{row.label}</strong></td>
                  <td className="compare-value-cell">{row.left || '—'}</td>
                  <td className="compare-value-cell">{row.right || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
