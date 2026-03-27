'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { loadSchools, recordEngagementEvent } from '@/lib/api';
import { isGuestMode } from '@/lib/guestMode';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useParentLocale } from '@/lib/parentLocale';
import { clearCompareIds, getCompareIds, subscribeCompareIds, toggleCompareId } from '@/lib/parentCompare';
import { getFavoriteIds, subscribeFavoriteIds, toggleFavoriteId } from '@/lib/parentFavorites';
import { formatSchoolFee, getComparableFeeInKzt, type SchoolFeePeriod } from '@/lib/schoolFinance';
import { formatKzPhone } from '@/lib/phone';
import { countClubsInServices } from '@/lib/clubsSchedule';
import { matchesSearch } from '@/lib/textSearch';

type SchoolRow = {
  updated_at?: unknown;
  school_id?: string;
  basic_info?: {
    display_name?: unknown;
    brand_name?: unknown;
    short_name?: unknown;
    name?: unknown;
    price?: unknown;
    type?: unknown;
    school_subtype?: unknown;
    city?: unknown;
    district?: unknown;
    address?: unknown;
    phone?: unknown;
    additional_locations?: unknown;
    license_details?: {
      number?: unknown;
    };
  };
  education?: {
    languages?: unknown;
    grades?: unknown;
    curricula?: {
      national?: unknown;
      international?: unknown;
      additional?: unknown;
      other?: unknown;
    };
    entrance_exam?: {
      required?: unknown;
    };
    advanced_subjects?: unknown;
    advanced_subjects_other?: unknown;
    average_class_size?: unknown;
  };
  services?: {
    after_school?: unknown;
    transport?: unknown;
    inclusive_education?: unknown;
    safety?: {
      security?: unknown;
      cameras?: unknown;
      access_control?: unknown;
    };
    medical_office?: unknown;
    meals_status?: unknown;
    specialists?: unknown;
    specialists_other?: unknown;
    clubs?: {
      catalog?: unknown;
    };
    clubs_count?: unknown;
  };
  media?: {
    accreditation?: unknown;
    certificates?: unknown;
    logo?: unknown;
    photos?: unknown;
  };
  finance?: {
    fee_rules?: unknown;
    tuition_monthly?: unknown;
    monthly_fee?: unknown;
    price_monthly?: unknown;
    monthly_fee_by_grade?: unknown;
  };
  monetization?: {
    is_promoted?: unknown;
    subscription_status?: unknown;
    priority_weight?: unknown;
    starts_at?: unknown;
    ends_at?: unknown;
    plan_name?: unknown;
  };
  system?: {
    rating?: number;
    reviews_count?: number;
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

const toList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => toText(item).trim()).filter(Boolean);
  }
  const text = toText(value);
  if (!text) return [];
  return text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

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

const getSchoolTypes = (value: unknown): string[] => {
  const normalized = toList(value)
    .map((item) => normalizePrimaryTypeKey(item))
    .filter(Boolean) as Array<'State' | 'Private'>;
  if (normalized.length) return Array.from(new Set(normalized));
  const fallback = normalizePrimaryTypeKey(toText(value));
  return fallback ? [fallback] : [];
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

const toRuTypePrefix = (typeKey: string, subtypeRu: string): string => {
  const isPrivate = typeKey === 'Private';
  if (subtypeRu.toLowerCase().startsWith('лицей')) return isPrivate ? 'Частный' : 'Государственный';
  return isPrivate ? 'Частная' : 'Государственная';
};

const formatComposedSchoolType = (typeValue: unknown, subtypeValue: unknown, locale: 'ru' | 'en' | 'kk'): string => {
  const primaryType = getSchoolTypes(typeValue)[0] || '';
  const localizedType = localizeSchoolType(primaryType || toLocaleText(typeValue, locale).trim(), locale);
  const localizedSubtype = localizeSchoolSubtype(toText(subtypeValue), locale);
  if (!localizedSubtype) return localizedType;

  if (locale === 'ru') {
    const prefix = toRuTypePrefix(primaryType, localizedSubtype);
    const subtypeLowered = localizedSubtype.charAt(0).toLowerCase() + localizedSubtype.slice(1);
    return `${prefix} ${subtypeLowered}`.trim();
  }
  return `${localizedType} ${localizedSubtype}`.trim();
};

const formatSchoolTypes = (value: unknown, locale: 'ru' | 'en' | 'kk'): string => {
  const items = getSchoolTypes(value);
  if (!items.length) return localizeSchoolType(toLocaleText(value, locale).trim(), locale);
  return items.map((item) => localizeSchoolType(item, locale)).filter(Boolean).join(', ');
};

const normalize = (value: string) => value.toLowerCase().trim();

const parseGrades = (value: unknown): number[] => {
  const text = toText(value);
  if (!text) return [];
  const matches = text.match(/\d{1,2}/g) || [];
  const numbers = matches
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 0 && item <= 12);
  return Array.from(new Set(numbers)).sort((a, b) => a - b);
};

const matchesGradeRange = (gradesValue: unknown, filter: string): boolean => {
  if (!filter) return true;
  const grades = parseGrades(gradesValue);
  if (!grades.length) return false;
  if (filter === '0') return grades.includes(0);
  if (filter === '1-4') return [1, 2, 3, 4].some((grade) => grades.includes(grade));
  if (filter === '5-9') return [5, 6, 7, 8, 9].some((grade) => grades.includes(grade));
  if (filter === '10-12') return [10, 11, 12].some((grade) => grades.includes(grade));
  if (filter === '1-12') return grades.includes(1) && grades.includes(12);
  return false;
};

const toggleValue = (arr: string[], value: string) =>
  arr.includes(value) ? arr.filter((item) => item !== value) : [...arr, value];

const normalizeOptionLabel = (value: unknown) =>
  toText(value)
    .replace(/\s+/g, ' ')
    .trim();

const CITY_DISTRICT_CATALOG: Record<string, string[]> = {
  Astana: ['Almaty', 'Baikonyr', 'Yesil', 'Nura', 'Saryarka'],
  Almaty: ['Almaly', 'Auezov', 'Bostandyk', 'Zhetysu', 'Medeu', 'Nauryzbay', 'Turksib'],
  Karaganda: ['City', 'Maikuduk', 'Yugo-Vostok', 'Prishakhtinsk', 'Sortirovka'],
};

const DISTRICT_CANONICAL_MAP: Record<string, string> = {
  almaty: 'Almaty',
  'almaty district': 'Almaty',
  алматы: 'Almaty',
  baikonyr: 'Baikonyr',
  байконур: 'Baikonyr',
  байконыр: 'Baikonyr',
  yesil: 'Yesil',
  esil: 'Yesil',
  есиль: 'Yesil',
  есіл: 'Yesil',
  nura: 'Nura',
  нура: 'Nura',
  нұра: 'Nura',
  saryarka: 'Saryarka',
  сарыарка: 'Saryarka',
  сарыарқа: 'Saryarka',
  almaly: 'Almaly',
  алмалы: 'Almaly',
  auezov: 'Auezov',
  ауэзов: 'Auezov',
  әуезов: 'Auezov',
  bostandyk: 'Bostandyk',
  бостандык: 'Bostandyk',
  бостандық: 'Bostandyk',
  zhetysu: 'Zhetysu',
  жетысу: 'Zhetysu',
  жетісу: 'Zhetysu',
  medeu: 'Medeu',
  медеу: 'Medeu',
  nauryzbay: 'Nauryzbay',
  наурызбай: 'Nauryzbay',
  turksib: 'Turksib',
  турксиб: 'Turksib',
  city: 'City',
  город: 'City',
  maikuduk: 'Maikuduk',
  майкудук: 'Maikuduk',
  майқұдық: 'Maikuduk',
  'yugo-vostok': 'Yugo-Vostok',
  'юго-восток': 'Yugo-Vostok',
  prishakhtinsk: 'Prishakhtinsk',
  пришахтинск: 'Prishakhtinsk',
  sortirovka: 'Sortirovka',
  сортировка: 'Sortirovka',
};

const normalizeDistrictName = (value: unknown) => {
  const raw = normalizeOptionLabel(value).toLowerCase();
  return DISTRICT_CANONICAL_MAP[raw] || normalizeOptionLabel(value);
};

const uniqueOptionValues = (values: string[]) => {
  const map = new Map<string, string>();
  values.forEach((value) => {
    const normalized = normalizeOptionLabel(value);
    if (!normalized) return;
    const key = normalized.toLocaleLowerCase('ru-RU');
    if (!map.has(key)) {
      map.set(key, normalized);
    }
  });
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'ru'));
};

const toNumber = (value: unknown): number => {
  const raw = toText(value).replace(',', '.').trim();
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toTimestamp = (value: unknown): number | null => {
  if (!value) return null;
  const ts = new Date(String(value)).getTime();
  return Number.isFinite(ts) ? ts : null;
};

const isPrivateType = (value: string): boolean => {
  const normalized = normalizePrimaryTypeKey(value);
  if (normalized) return normalized === 'Private';
  const v = normalize(value);
  return v.includes('private') || v.includes('част') || v.includes('жеке') || v.includes('international') || v.includes('международ') || v.includes('автоном');
};

const normalizeMediaToken = (value: unknown): string => {
  const raw = String(value ?? '')
    .trim()
    .replace(/^["'\[]+/, '')
    .replace(/["'\]]+$/, '');
  return raw.trim();
};

const looksLikeImagePath = (value: string): boolean => {
  const v = value.trim().toLowerCase();
  if (!v) return false;
  if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('//')) return true;
  if (v.startsWith('/')) return true;
  if (v.startsWith('file://')) return false;
  if (v.startsWith('blob:') || v.startsWith('data:')) return true;
  if (v.includes('storage/v1/object/public/')) return true;
  if (v.includes('/uploads/') || v.includes('uploads/')) return true;
  return /(\.png|\.jpg|\.jpeg|\.webp|\.gif|\.svg)(\?|#|$)/i.test(v);
};

const extractMediaUrls = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => extractMediaUrls(item))
      .filter(Boolean);
  }

  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const picked = obj.url ?? obj.src ?? obj.path ?? obj.href;
    if (picked) return extractMediaUrls(picked);
    return [];
  }

  const text = toText(value).trim();
  if (!text) return [];

  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      const parsed = JSON.parse(text);
      return extractMediaUrls(parsed);
    } catch {
      // ignore and fallback to comma split
    }
  }

  return text
    .split(',')
    .map((item) => normalizeMediaToken(item))
    .filter((item) => looksLikeImagePath(item));
};

const pickSchoolImage = (row: SchoolRow): string => {
  const logoCandidates = extractMediaUrls(row.media?.logo);
  if (logoCandidates.length) return logoCandidates[0];
  const photoCandidates = extractMediaUrls(row.media?.photos);
  return photoCandidates[0] || '';
};

const toMediaUrl = (value: string): string => {
  const src = value.trim();
  if (!src) return '';
  if (/^(https?:)?\/\//i.test(src) || src.startsWith('data:') || src.startsWith('blob:')) return src;
  if (src.startsWith('file://')) return '';

  const cleanSrc = src.replace(/^\/+/, '');
  const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/api\/?$/i, '');
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
  const mediaBucket = (process.env.NEXT_PUBLIC_MEDIA_BUCKET || 'school-media').trim();

  if (cleanSrc.startsWith('schools/') && supabaseUrl) {
    return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(mediaBucket)}/${cleanSrc}`;
  }

  if (src.startsWith('/')) {
    return apiBase ? `${apiBase}${src}` : src;
  }

  return apiBase ? `${apiBase}/${cleanSrc}` : src;
};

const getBrandTitle = (row: SchoolRow, locale: 'ru' | 'en' | 'kk'): string =>
  toLocaleText(row.basic_info?.display_name, locale).trim() ||
  toLocaleText(row.basic_info?.brand_name, locale).trim() ||
  toLocaleText(row.basic_info?.short_name, locale).trim();

const hasLogo = (row: SchoolRow): boolean => Boolean(pickSchoolImage(row));

const hasRequiredParentFields = (row: SchoolRow, locale: 'ru' | 'en' | 'kk'): boolean => {
  const name = getBrandTitle(row, locale);
  const type = toText(row.basic_info?.type).trim();
  const city = toText(row.basic_info?.city).trim();
  const district = toText(row.basic_info?.district).trim();
  const languages = toList(row.education?.languages);
  return Boolean(name && type && city && district && languages.length && hasLogo(row));
};

const getSchoolProgramsCount = (row: SchoolRow): number =>
  [
    ...toList(row.education?.curricula?.national),
    ...toList(row.education?.curricula?.international),
    ...toList(row.education?.curricula?.additional),
    ...toList(row.education?.curricula?.other),
  ].length;

const getSchoolPhotoCount = (row: SchoolRow): number => extractMediaUrls(row.media?.photos).length;

const getSchoolUpdatedAt = (row: SchoolRow): number => Date.parse(toText(row.updated_at) || '') || 0;

const normalizeSchoolIdentity = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const buildSchoolDedupeKey = (row: SchoolRow, locale: 'ru' | 'en' | 'kk'): string => {
  const brand = normalizeSchoolIdentity(getBrandTitle(row, locale));
  const city = normalizeSchoolIdentity(toText(row.basic_info?.city));
  const district = normalizeSchoolIdentity(toText(row.basic_info?.district));
  const phone = normalizeSchoolIdentity(toText(row.basic_info?.phone));
  return `meta:${brand}|${city}|${district}|${phone}`;
};

const dedupeSchoolRows = (rows: SchoolRow[], locale: 'ru' | 'en' | 'kk'): SchoolRow[] => {
  const byKey = new Map<string, SchoolRow>();

  rows.forEach((row) => {
    const key = buildSchoolDedupeKey(row, locale);
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, row);
      return;
    }

    if (getSchoolUpdatedAt(row) > getSchoolUpdatedAt(current)) {
      byKey.set(key, row);
    }
  });

  return Array.from(byKey.values());
};

const getSchoolQualityScore = (row: SchoolRow): number => {
  const monthlyFee = getComparableFeeInKzt(row, 'monthly');
  const programsCount = getSchoolProgramsCount(row);
  const photosCount = getSchoolPhotoCount(row);
  const clubsCount = Math.max(countClubsInServices(row.services), toNumber(row.services?.clubs_count));
  const hasPhone = Boolean(toText(row.basic_info?.phone).trim());
  const hasAccreditation = Boolean(
    toList(row.media?.accreditation).length ||
      toList(row.media?.certificates).length ||
      toText(row.basic_info?.license_details?.number).trim()
  );
  const rating = Math.max(0, Number(row.system?.rating ?? 0));
  const reviewsCount = Math.max(0, Number(row.system?.reviews_count ?? 0));

  let score = 0;
  if (monthlyFee > 0) score += 3;
  if (photosCount > 0) score += 2;
  if (programsCount > 0) score += 2;
  if (clubsCount > 0) score += 2;
  if (hasPhone) score += 1;
  if (hasAccreditation) score += 1;

  score += Math.min(rating, 5);
  score += Math.min(reviewsCount, 20) * 0.2;

  return score;
};

export default function ParentSchoolsPage() {
  const router = useRouter();
  const { t, locale } = useParentLocale();
  const [guest] = useState(() => isGuestMode());
  const [rows, setRows] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [compareIds, setCompareIds] = useState<string[]>(() => getCompareIds());
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => getFavoriteIds());
  const [compareError, setCompareError] = useState('');
  const [query, setQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [privatePriceLimit, setPrivatePriceLimit] = useState<number | null>(null);
  const [pricePeriodFilter, setPricePeriodFilter] = useState<SchoolFeePeriod>('monthly');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedAccreditation, setSelectedAccreditation] = useState<string[]>([]);
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedMeals, setSelectedMeals] = useState<string[]>([]);
  const [selectedSpecialists, setSelectedSpecialists] = useState<string[]>([]);
  const [entranceExam, setEntranceExam] = useState<'all' | 'yes' | 'no'>('all');
  const [selectedAdvanced, setSelectedAdvanced] = useState<string[]>([]);
  const [gradeRangeFilter, setGradeRangeFilter] = useState('');
  const [minClubs, setMinClubs] = useState(0);
  const [sortMode, setSortMode] = useState<
    'recommended' | 'rating' | 'reviews' | 'priceAsc' | 'priceDesc' | 'name' | 'updated'
  >('recommended');
  const [sortModalOpen, setSortModalOpen] = useState(false);
  const [hideAiFab, setHideAiFab] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [guestGateMessage, setGuestGateMessage] = useState('');
  const compareTargetCount = 2;
  const compareCount = compareIds.length;
  const compareUi = useMemo(
    () =>
      locale === 'en'
          ? {
              aiChat: 'AI chat',
              aiMatch: 'AI match',
              compare: 'Compare',
              showCompare: 'Show comparison',
              addCompare: 'Compare',
              cancelCompare: 'Cancel',
              pickTwo: 'Select 2 schools to compare.',
            }
        : locale === 'kk'
          ? {
              aiChat: 'AI чат',
              aiMatch: 'AI іріктеу',
              compare: 'Салыстыру',
              showCompare: 'Салыстыруды көрсету',
              addCompare: 'Салыстыру',
              cancelCompare: 'Болдырмау',
              pickTwo: 'Салыстыру үшін 2 мектеп таңдаңыз.',
            }
          : {
              aiChat: 'AI чат',
              aiMatch: 'AI подбор',
              compare: 'Сравнить',
              showCompare: 'Показать сравнение',
              addCompare: 'Сравнить',
              cancelCompare: 'Отменить',
              pickTwo: 'Выберите 2 школы для сравнения.',
            },
    [locale]
  );
  const favoriteUi = useMemo(
    () =>
      locale === 'en'
        ? {
            add: 'Add to favorites',
            remove: 'Remove from favorites',
          }
        : locale === 'kk'
          ? {
              add: 'Таңдаулыларға қосу',
              remove: 'Таңдаулылардан алып тастау',
            }
          : {
              add: 'Добавить в избранное',
              remove: 'Убрать из избранного',
            },
    [locale]
  );
  const guestGateUi = useMemo(
    () =>
      locale === 'en'
        ? {
            message: 'This feature is available only after registration.',
            filters: 'Filters are available only for registered users.',
          }
        : locale === 'kk'
          ? {
              message: 'Бұл мүмкіндік тек тіркелген пайдаланушыларға қолжетімді.',
              filters: 'Сүзгілер тек тіркелген пайдаланушыларға қолжетімді.',
            }
          : {
              message: 'Эта функция доступна только зарегистрированным пользователям.',
              filters: 'Фильтры доступны только зарегистрированным пользователям.',
            },
    [locale]
  );
  const sortUi = useMemo(
    () =>
      locale === 'en'
        ? {
            button: 'Sort',
            sortBy: 'Sort by',
            title: 'Sort by',
            close: 'Close',
            recommended: 'Relevance (default)',
            priceAsc: 'Price: ascending',
            priceDesc: 'Price: descending',
          }
        : locale === 'kk'
          ? {
              button: 'Сұрыптау',
              sortBy: 'Сұрыптау',
              title: 'Сұрыптау',
              close: 'Жабу',
              recommended: 'Релеванттылық (әдепкі)',
              priceAsc: 'Баға: өсу ретімен',
              priceDesc: 'Баға: кему ретімен',
            }
          : {
              button: 'Сортировка',
              sortBy: 'Сортировать',
              title: 'Сортировать по',
              close: 'Закрыть',
              recommended: 'Наши рекомендации',
              priceAsc: 'Цена (сначала самая низкая)',
              priceDesc: 'Цена (сначала самая высокая)',
            },
    [locale]
  );
  const currentSortLabel = useMemo(() => {
    switch (sortMode) {
      case 'priceAsc':
        return sortUi.priceAsc;
      case 'priceDesc':
        return sortUi.priceDesc;
      default:
        return sortUi.recommended;
    }
  }, [sortMode, sortUi]);

  const FILTER_TEXT: Record<string, { ru: string; en: string; kk: string }> = {
    filters: { ru: 'Фильтры', en: 'Filters', kk: 'Сүзгілер' },
    city: { ru: 'Город', en: 'City', kk: 'Қала' },
    allCities: { ru: 'Все города', en: 'All cities', kk: 'Барлық қалалар' },
    district: { ru: 'Район', en: 'District', kk: 'Аудан' },
    allDistricts: { ru: 'Все районы', en: 'All districts', kk: 'Барлық аудандар' },
    schoolType: { ru: 'Тип школы', en: 'School type', kk: 'Мектеп түрі' },
    anyType: { ru: 'Любой тип', en: 'Any type', kk: 'Кез келген түр' },
    ratingFrom: { ru: 'Рейтинг от', en: 'Rating from', kk: 'Рейтинг кемінде' },
    privatePriceTo: { ru: 'Цена до (₸)', en: 'Price up to (₸)', kk: 'Баға дейін (₸)' },
    pricePeriod: { ru: 'Период цены', en: 'Price period', kk: 'Баға кезеңі' },
    perMonth: { ru: 'В месяц', en: 'Per month', kk: 'Айына' },
    perYear: { ru: 'В год', en: 'Per year', kk: 'Жылына' },
    languageOfInstruction: { ru: 'Язык обучения', en: 'Language of instruction', kk: 'Оқыту тілі' },
    accreditation: { ru: 'Аккредитация', en: 'Accreditation', kk: 'Аккредитация' },
    programs: { ru: 'Программы', en: 'Programs', kk: 'Бағдарламалар' },
    services: { ru: 'Услуги', en: 'Services', kk: 'Қызметтер' },
    meals: { ru: 'Питание', en: 'Meals', kk: 'Тамақтану' },
    specialists: { ru: 'Специалисты', en: 'Specialists', kk: 'Мамандар' },
    entranceExam: { ru: 'Вступительный экзамен', en: 'Entrance exam', kk: 'Қабылдау емтиханы' },
    yes: { ru: 'Да', en: 'Yes', kk: 'Иә' },
    no: { ru: 'Нет', en: 'No', kk: 'Жоқ' },
    any: { ru: 'Любой', en: 'Any', kk: 'Кез келгені' },
    advancedSubjects: { ru: 'Углубленные предметы', en: 'Advanced subjects', kk: 'Тереңдетілген пәндер' },
    gradesRange: { ru: 'Количество классов', en: 'Grades', kk: 'Сыныптар' },
    allGrades: { ru: 'Любые классы', en: 'Any grades', kk: 'Кез келген сыныптар' },
    minClubs: { ru: 'Количество кружков (мин.)', en: 'Number of clubs (min.)', kk: 'Үйірмелер саны (мин.)' },
    reset: { ru: 'Сбросить', en: 'Reset', kk: 'Тазарту' },
  };
  const ft = (key: keyof typeof FILTER_TEXT) => FILTER_TEXT[key][locale];

  const OPTION_I18N: Record<string, { ru: string; en: string; kk: string }> = {
    State: { ru: 'Государственная', en: 'State', kk: 'Мемлекеттік' },
    Private: { ru: 'Частная', en: 'Private', kk: 'Жеке' },
    International: { ru: 'Международная', en: 'International', kk: 'Халықаралық' },
    Autonomous: { ru: 'Автономная', en: 'Autonomous', kk: 'Автономды' },
    Almaty: { ru: 'Алматы', en: 'Almaty', kk: 'Алматы' },
    Astana: { ru: 'Астана', en: 'Astana', kk: 'Астана' },
    Karaganda: { ru: 'Караганда', en: 'Karaganda', kk: 'Қарағанды' },
    Almaly: { ru: 'Алмалы', en: 'Almaly', kk: 'Алмалы' },
    Auezov: { ru: 'Ауэзов', en: 'Auezov', kk: 'Әуезов' },
    Bostandyk: { ru: 'Бостандык', en: 'Bostandyk', kk: 'Бостандық' },
    Zhetysu: { ru: 'Жетысу', en: 'Zhetysu', kk: 'Жетісу' },
    Medeu: { ru: 'Медеу', en: 'Medeu', kk: 'Медеу' },
    Nauryzbay: { ru: 'Наурызбай', en: 'Nauryzbay', kk: 'Наурызбай' },
    Baikonyr: { ru: 'Байконур', en: 'Baikonyr', kk: 'Байқоңыр' },
    Yesil: { ru: 'Есиль', en: 'Yesil', kk: 'Есіл' },
    'Almaty District': { ru: 'Алматы', en: 'Almaty District', kk: 'Алматы' },
    Saryarka: { ru: 'Сарыарка', en: 'Saryarka', kk: 'Сарыарқа' },
    Nura: { ru: 'Нура', en: 'Nura', kk: 'Нұра' },
    Turksib: { ru: 'Турксибский', en: 'Turksib', kk: 'Түрксіб' },
    City: { ru: 'Город', en: 'City', kk: 'Қала' },
    District: { ru: 'Район', en: 'District', kk: 'Аудан' },
    Maikuduk: { ru: 'Майкудук', en: 'Maikuduk', kk: 'Майқұдық' },
    'Yugo-Vostok': { ru: 'Юго-Восток', en: 'Yugo-Vostok', kk: 'Оңтүстік-Шығыс' },
    Prishakhtinsk: { ru: 'Пришахтинск', en: 'Prishakhtinsk', kk: 'Пришахтинск' },
    Sortirovka: { ru: 'Сортировка', en: 'Sortirovka', kk: 'Сортировка' },
    Английский: { ru: 'Английский', en: 'English', kk: 'Ағылшын тілі' },
    Русский: { ru: 'Русский', en: 'Russian', kk: 'Орыс тілі' },
    Казахский: { ru: 'Казахский', en: 'Kazakh', kk: 'Қазақ тілі' },
    Лицензия: { ru: 'Лицензия', en: 'License', kk: 'Лицензия' },
    Сертификаты: { ru: 'Сертификаты', en: 'Certificates', kk: 'Сертификаттар' },
    'Госпрограмма (Казахстан)': {
      ru: 'Госпрограмма (Казахстан)',
      en: 'State program (Kazakhstan)',
      kk: 'Мембағдарлама (Қазақстан)',
    },
    'Обновленное содержание': { ru: 'Обновленное содержание', en: 'Updated content', kk: 'Жаңартылған мазмұн' },
    'Интегрированная программа НИШ': { ru: 'Интегрированная программа НИШ', en: 'NIS integrated program', kk: 'NIS кіріктірілген бағдарламасы' },
    Монтессори: { ru: 'Монтессори', en: 'Montessori', kk: 'Монтессори' },
    Вальдорф: { ru: 'Вальдорф', en: 'Waldorf', kk: 'Вальдорф' },
    'Американская программа': { ru: 'Американская программа', en: 'American program', kk: 'Америкалық бағдарлама' },
    'Британская программа': { ru: 'Британская программа', en: 'British program', kk: 'Британдық бағдарлама' },
    'Билингвальная программа': { ru: 'Билингвальная программа', en: 'Bilingual program', kk: 'Билингвалды бағдарлама' },
    'Авторская программа': { ru: 'Авторская программа', en: 'Author program', kk: 'Авторлық бағдарлама' },
    Продленка: { ru: 'Продленка', en: 'After-school care', kk: 'Ұзартылған күн' },
    Транспорт: { ru: 'Транспорт', en: 'Transport', kk: 'Көлік' },
    'Инклюзивное образование': { ru: 'Инклюзивное образование', en: 'Inclusive education', kk: 'Инклюзивті білім беру' },
    Охрана: { ru: 'Охрана', en: 'Security', kk: 'Күзет' },
    Видеонаблюдение: { ru: 'Видеонаблюдение', en: 'Video surveillance', kk: 'Бейнебақылау' },
    'Контроль доступа': { ru: 'Контроль доступа', en: 'Access control', kk: 'Кіруді бақылау' },
    Медпункт: { ru: 'Медпункт', en: 'Medical room', kk: 'Медпункт' },
    Бесплатное: { ru: 'Бесплатное', en: 'Free', kk: 'Тегін' },
    Платное: { ru: 'Платное', en: 'Paid', kk: 'Ақылы' },
    'Без питания': { ru: 'Без питания', en: 'No meals', kk: 'Тамақсыз' },
    Психолог: { ru: 'Психолог', en: 'Psychologist', kk: 'Психолог' },
    Логопед: { ru: 'Логопед', en: 'Speech therapist', kk: 'Логопед' },
    'Социальный работник': { ru: 'Социальный работник', en: 'Social worker', kk: 'Әлеуметтік қызметкер' },
    Тьютор: { ru: 'Тьютор', en: 'Tutor', kk: 'Тьютор' },
    Спецпедагог: { ru: 'Спецпедагог', en: 'Special educator', kk: 'Арнайы педагог' },
    Медсестра: { ru: 'Медсестра', en: 'Nurse', kk: 'Медбике' },
    Дефектолог: { ru: 'Дефектолог', en: 'Defectologist', kk: 'Дефектолог' },
    Математика: { ru: 'Математика', en: 'Mathematics', kk: 'Математика' },
    Физика: { ru: 'Физика', en: 'Physics', kk: 'Физика' },
    Химия: { ru: 'Химия', en: 'Chemistry', kk: 'Химия' },
    Биология: { ru: 'Биология', en: 'Biology', kk: 'Биология' },
    Информатика: { ru: 'Информатика', en: 'Computer science', kk: 'Информатика' },
    Робототехника: { ru: 'Робототехника', en: 'Robotics', kk: 'Робототехника' },
    Инженерия: { ru: 'Инженерия', en: 'Engineering', kk: 'Инженерия' },
    'Искусственный интеллект': { ru: 'Искусственный интеллект', en: 'Artificial intelligence', kk: 'Жасанды интеллект' },
    'Анализ данных': { ru: 'Анализ данных', en: 'Data analysis', kk: 'Деректер талдауы' },
    Экономика: { ru: 'Экономика', en: 'Economics', kk: 'Экономика' },
    Бизнес: { ru: 'Бизнес', en: 'Business', kk: 'Бизнес' },
    Предпринимательство: { ru: 'Предпринимательство', en: 'Entrepreneurship', kk: 'Кәсіпкерлік' },
    'Английский язык': { ru: 'Английский язык', en: 'English language', kk: 'Ағылшын тілі' },
    'Всемирная история': { ru: 'Всемирная история', en: 'World history', kk: 'Дүниежүзі тарихы' },
    География: { ru: 'География', en: 'Geography', kk: 'География' },
    'Дизайн и технологии': { ru: 'Дизайн и технологии', en: 'Design and technology', kk: 'Дизайн және технология' },
    'Искусство и дизайн': { ru: 'Искусство и дизайн', en: 'Art and design', kk: 'Өнер және дизайн' },
    Музыка: { ru: 'Музыка', en: 'Music', kk: 'Музыка' },
    Медиазнания: { ru: 'Медиазнания', en: 'Media studies', kk: 'Медиасауат' },
    Психология: { ru: 'Психология', en: 'Psychology', kk: 'Психология' },
  };
  const localizeOption = (value: string) => OPTION_I18N[value]?.[locale] || value;

  const languageOptions = ['Английский', 'Русский', 'Казахский'];
  const accreditationOptions = [
    { key: 'license', label: 'Лицензия' },
    { key: 'certificates', label: 'Сертификаты' },
  ];
  const programOptions = Array.from(new Set([
    'Госпрограмма (Казахстан)',
    'Обновленное содержание',
    'Интегрированная программа НИШ',
    'Cambridge Primary',
    'Cambridge Lower Secondary',
    'Cambridge IGCSE',
    'Cambridge A-Level',
    'IB PYP',
    'STEAM',
    'STEM',
    'Монтессори',
    'Вальдорф',
    'Американская программа',
    'Британская программа',
    'Билингвальная программа',
    'Авторская программа',
  ]));
  const serviceOptions = [
    { key: 'after_school', label: 'Продленка' },
    { key: 'transport', label: 'Транспорт' },
    { key: 'inclusive_education', label: 'Инклюзивное образование' },
    { key: 'security', label: 'Охрана' },
    { key: 'cameras', label: 'Видеонаблюдение' },
    { key: 'access_control', label: 'Контроль доступа' },
    { key: 'medical_office', label: 'Медпункт' },
  ];
  const mealsOptions = ['Бесплатное', 'Платное', 'Без питания'];
  const specialistOptions = [
    'Психолог',
    'Логопед',
    'Социальный работник',
    'Тьютор',
    'Спецпедагог',
    'Медсестра',
    'Дефектолог',
  ];
  const advancedOptions = [
    'Математика',
    'Физика',
    'Химия',
    'Биология',
    'Информатика',
    'Робототехника',
    'Инженерия',
    'Искусственный интеллект',
    'Анализ данных',
    'Экономика',
    'Бизнес',
    'Предпринимательство',
    'Английский язык',
    'Всемирная история',
    'География',
    'Дизайн и технологии',
    'Искусство и дизайн',
    'Музыка',
    'Медиазнания',
    'Психология',
  ];

  useEffect(() => {
    let mounted = true;
    loadSchools()
      .then((payload) => {
        if (!mounted) return;
        setRows(dedupeSchoolRows(Array.isArray(payload?.data) ? payload.data : [], locale));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [locale]);

  useEffect(() => {
    const unsub = subscribeCompareIds((ids) => setCompareIds(ids));
    return () => {
      unsub();
    };
  }, []);
  useEffect(() => {
    const unsub = subscribeFavoriteIds((ids) => setFavoriteIds(ids));
    return () => {
      unsub();
    };
  }, []);

  const cityOptions = useMemo(() => {
    const values = rows
      .filter((row) => hasRequiredParentFields(row, locale))
      .map((row) => normalizeOptionLabel(row.basic_info?.city))
      .filter(Boolean);
    return uniqueOptionValues(values);
  }, [rows, locale]);

  const districtOptions = useMemo(() => {
    const normalizedCity = normalizeOptionLabel(cityFilter);
    if (normalizedCity && CITY_DISTRICT_CATALOG[normalizedCity]) {
      return CITY_DISTRICT_CATALOG[normalizedCity];
    }
    const values = rows
      .filter((row) => hasRequiredParentFields(row, locale))
      .filter(
        (row) =>
          !cityFilter || normalizeOptionLabel(row.basic_info?.city) === normalizeOptionLabel(cityFilter)
      )
      .map((row) => normalizeDistrictName(row.basic_info?.district))
      .filter(Boolean);
    return uniqueOptionValues(values);
  }, [rows, cityFilter, locale]);

  const typeOptions = useMemo(() => {
    const values = rows
      .filter((row) => hasRequiredParentFields(row, locale))
      .flatMap((row) => getSchoolTypes(row.basic_info?.type))
      .filter(Boolean);
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [rows, locale]);

  const privatePriceBounds = useMemo(() => {
    const prices = rows
      .filter((row) => hasRequiredParentFields(row, locale))
      .filter((row) => isPrivateType(toText(row.basic_info?.type)))
      .map((row) => getComparableFeeInKzt(row, pricePeriodFilter))
      .filter((price) => Number.isFinite(price) && price > 0);
    const max = prices.length ? Math.max(...prices) : 500000;
    return {
      min: 0,
      max: Math.ceil(max / 10000) * 10000,
    };
  }, [rows, locale, pricePeriodFilter]);

  const maxPrivatePrice = useMemo(() => {
    if (privatePriceLimit == null) return privatePriceBounds.max;
    return Math.min(privatePriceLimit, privatePriceBounds.max);
  }, [privatePriceBounds.max, privatePriceLimit]);

  const filtered = useMemo(() => {
    const q = query.trim();
    return rows.filter((row) => {
      if (!hasRequiredParentFields(row, locale)) return false;
      const displayName = getBrandTitle(row, locale);
      const name = toText(row.basic_info?.name);
      const schoolTypeValues = getSchoolTypes(row.basic_info?.type);
      const rating = Number(row.system?.rating ?? 0);
      const comparableFee = getComparableFeeInKzt(row, pricePeriodFilter);
      const textOk = matchesSearch(
        [
          displayName,
          name,
          toText(row.basic_info?.city),
          toText(row.basic_info?.district),
          formatComposedSchoolType(row.basic_info?.type, row.basic_info?.school_subtype, locale),
          toText(row.school_id),
          toList(row.education?.languages).join(' '),
        ],
        q
      );
      const cityOk = !cityFilter || toText(row.basic_info?.city) === cityFilter;
      const districtOk =
        !districtFilter || normalizeDistrictName(row.basic_info?.district) === districtFilter;
      const typeOk = !typeFilter || schoolTypeValues.includes(typeFilter);
      const ratingOk = rating >= minRating;
      const privatePriceOk =
        !isPrivateType(typeFilter) || comparableFee <= maxPrivatePrice || comparableFee <= 0;
      const schoolLanguages = toList(row.education?.languages).map(normalize);
      const languagesOk =
        !selectedLanguages.length ||
        selectedLanguages.some((lang) => schoolLanguages.some((schoolLang) => schoolLang.includes(normalize(lang))));
      const gradesOk = matchesGradeRange(row.education?.grades, gradeRangeFilter);

      const licenseNumber = toText(row.basic_info?.license_details?.number);
      const hasLicense = Boolean(licenseNumber);
      const certificates = toList(row.media?.accreditation).length || toList(row.media?.certificates).length;
      const hasCertificates = certificates > 0;
      const accreditationOk =
        !selectedAccreditation.length ||
        selectedAccreditation.every((key) => {
          if (key === 'license') return hasLicense;
          if (key === 'certificates') return hasCertificates;
          return true;
        });

      const schoolPrograms = [
        ...toList(row.education?.curricula?.national),
        ...toList(row.education?.curricula?.international),
        ...toList(row.education?.curricula?.additional),
        ...toList(row.education?.curricula?.other),
      ].map(normalize);
      const programsOk =
        !selectedPrograms.length ||
        selectedPrograms.some((program) =>
          schoolPrograms.some((schoolProgram) => schoolProgram.includes(normalize(program)))
        );

      const services = row.services || {};
      const serviceChecks: Record<string, boolean> = {
        after_school: Boolean(services?.after_school),
        transport: Boolean(services?.transport),
        inclusive_education: Boolean(services?.inclusive_education),
        security: Boolean(services?.safety?.security),
        cameras: Boolean(services?.safety?.cameras),
        access_control: Boolean(services?.safety?.access_control),
        medical_office: Boolean(services?.medical_office),
      };
      const servicesOk =
        !selectedServices.length || selectedServices.every((serviceKey) => serviceChecks[serviceKey]);

      const mealsStatus = normalize(toText(services?.meals_status));
      const mealsOk =
        !selectedMeals.length ||
        selectedMeals.some((meal) => {
          if (meal === 'Бесплатное') return mealsStatus.includes('free') || mealsStatus.includes('бесплат');
          if (meal === 'Платное') return mealsStatus.includes('paid') || mealsStatus.includes('плат');
          if (meal === 'Без питания') return mealsStatus.includes('no meals') || mealsStatus.includes('без');
          return true;
        });

      const specialistsSource = `${toText(services?.specialists)} ${toText(services?.specialists_other)}`.toLowerCase();
      const specialistsOk =
        !selectedSpecialists.length ||
        selectedSpecialists.some((specialist) => specialistsSource.includes(normalize(specialist)));

      const hasEntranceExam = Boolean(row.education?.entrance_exam?.required);
      const entranceExamOk =
        entranceExam === 'all' ||
        (entranceExam === 'yes' && hasEntranceExam) ||
        (entranceExam === 'no' && !hasEntranceExam);

      const advancedSubjects = `${toText(row.education?.advanced_subjects)} ${toText(row.education?.advanced_subjects_other)}`.toLowerCase();
      const advancedOk =
        !selectedAdvanced.length ||
        selectedAdvanced.some((subject) => advancedSubjects.includes(normalize(subject)));

      const clubsCount = Math.max(
        countClubsInServices(row.services),
        toNumber(row.services?.clubs_count)
      );
      const clubsOk = clubsCount >= minClubs;

      return (
        textOk &&
        cityOk &&
        districtOk &&
        typeOk &&
        ratingOk &&
        privatePriceOk &&
        languagesOk &&
        gradesOk &&
        accreditationOk &&
        programsOk &&
        servicesOk &&
        mealsOk &&
        specialistsOk &&
        entranceExamOk &&
        advancedOk &&
        clubsOk
      );
    });
  }, [
    query,
    rows,
    locale,
    cityFilter,
    districtFilter,
    typeFilter,
    minRating,
    maxPrivatePrice,
    pricePeriodFilter,
    selectedLanguages,
    selectedAccreditation,
    selectedPrograms,
    selectedServices,
    selectedMeals,
    selectedSpecialists,
    entranceExam,
    selectedAdvanced,
    gradeRangeFilter,
    minClubs,
  ]);

  const sortedRows = useMemo(() => {
    const next = [...filtered];
    if (sortMode === 'rating') {
      next.sort((a, b) => Number(b.system?.rating ?? 0) - Number(a.system?.rating ?? 0));
      return next;
    }
    if (sortMode === 'reviews') {
      next.sort((a, b) => Number(b.system?.reviews_count ?? 0) - Number(a.system?.reviews_count ?? 0));
      return next;
    }
    if (sortMode === 'name') {
      next.sort((a, b) =>
        getBrandTitle(a, locale).localeCompare(getBrandTitle(b, locale), undefined, { sensitivity: 'base' })
      );
      return next;
    }
    if (sortMode === 'priceAsc') {
      next.sort((a, b) => {
        const aType = toText(a.basic_info?.type);
        const bType = toText(b.basic_info?.type);
        const aPrice = isPrivateType(aType)
          ? getComparableFeeInKzt(a, pricePeriodFilter) || Number.MAX_SAFE_INTEGER
          : Number.MAX_SAFE_INTEGER;
        const bPrice = isPrivateType(bType)
          ? getComparableFeeInKzt(b, pricePeriodFilter) || Number.MAX_SAFE_INTEGER
          : Number.MAX_SAFE_INTEGER;
        return aPrice - bPrice;
      });
      return next;
    }
    if (sortMode === 'priceDesc') {
      next.sort((a, b) => {
        const aType = toText(a.basic_info?.type);
        const bType = toText(b.basic_info?.type);
        const aRaw = isPrivateType(aType) ? getComparableFeeInKzt(a, pricePeriodFilter) : 0;
        const bRaw = isPrivateType(bType) ? getComparableFeeInKzt(b, pricePeriodFilter) : 0;
        const aPrice = aRaw > 0 ? aRaw : -1;
        const bPrice = bRaw > 0 ? bRaw : -1;
        return bPrice - aPrice;
      });
      return next;
    }
    if (sortMode === 'updated') {
      next.sort((a, b) => {
        const aTs = getSchoolUpdatedAt(a);
        const bTs = getSchoolUpdatedAt(b);
        return bTs - aTs;
      });
      return next;
    }
    next.sort((a, b) => {
      const qualityDiff = getSchoolQualityScore(b) - getSchoolQualityScore(a);
      if (qualityDiff !== 0) return qualityDiff;

      const ratingDiff = Number(b.system?.rating ?? 0) - Number(a.system?.rating ?? 0);
      if (ratingDiff !== 0) return ratingDiff;

      const reviewsDiff =
        Number(b.system?.reviews_count ?? 0) - Number(a.system?.reviews_count ?? 0);
      if (reviewsDiff !== 0) return reviewsDiff;

      const updatedDiff = getSchoolUpdatedAt(b) - getSchoolUpdatedAt(a);
      if (updatedDiff !== 0) return updatedDiff;

      return getBrandTitle(a, locale).localeCompare(getBrandTitle(b, locale), undefined, {
        sensitivity: 'base',
      });
    });
    return next;
  }, [filtered, sortMode, locale, pricePeriodFilter]);

  useEffect(() => {
    if (!sortModalOpen) return undefined;
    const onDocumentClick = (event: MouseEvent) => {
      if (!sortMenuRef.current) return;
      const target = event.target as Node;
      if (!sortMenuRef.current.contains(target)) {
        setSortModalOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSortModalOpen(false);
    };
    document.addEventListener('mousedown', onDocumentClick);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onDocumentClick);
      document.removeEventListener('keydown', onEscape);
    };
  }, [sortModalOpen]);

  useEffect(() => {
    if (!mobileFiltersOpen) return undefined;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileFiltersOpen(false);
    };
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('keydown', onEscape);
    };
  }, [mobileFiltersOpen]);

  const onCompareAction = () => {
    if (guest) {
      void recordEngagementEvent({
        eventType: 'guest_gate_click',
        locale,
        source: 'schools_compare',
        metadata: { feature: 'compare' },
      }).catch(() => undefined);
      setGuestGateMessage(guestGateUi.message);
      setCompareError('');
      return;
    }
    if (!compareMode) {
      clearCompareIds();
      setCompareIds([]);
      setCompareError('');
      setCompareMode(true);
      return;
    }
    if (compareIds.length !== compareTargetCount) {
      setCompareError(compareUi.pickTwo);
      return;
    }
    setCompareError('');
    router.push('/parent/compare');
  };

  const cancelCompareMode = () => {
    clearCompareIds();
    setCompareIds([]);
    setCompareError('');
    setCompareMode(false);
  };

  const showGuestGateMessage = (message = guestGateUi.message) => {
    void recordEngagementEvent({
      eventType: 'guest_gate_click',
      locale,
      source: 'schools_guest_gate',
      metadata: { feature: 'locked_action' },
    }).catch(() => undefined);
    setGuestGateMessage(message);
    setCompareError('');
  };

  const resetFilters = () => {
    setCityFilter('');
    setDistrictFilter('');
    setTypeFilter('');
    setMinRating(0);
    setPrivatePriceLimit(null);
    setPricePeriodFilter('monthly');
    setSelectedLanguages([]);
    setSelectedAccreditation([]);
    setSelectedPrograms([]);
    setSelectedServices([]);
    setSelectedMeals([]);
    setSelectedSpecialists([]);
    setEntranceExam('all');
    setSelectedAdvanced([]);
    setGradeRangeFilter('');
    setMinClubs(0);
  };

  const activeFiltersCount = [
    cityFilter,
    districtFilter,
    typeFilter,
    privatePriceLimit != null ? 'price' : '',
    pricePeriodFilter !== 'monthly' ? 'price_period' : '',
    selectedLanguages.length ? 'languages' : '',
    gradeRangeFilter ? 'grades' : '',
  ].filter(Boolean).length;

  const filtersContent = (
    <>
      <label className="field">
        <span>{ft('city')}</span>
        <select className="input" value={cityFilter} onChange={(e) => {
          setCityFilter(e.target.value);
          setDistrictFilter('');
        }}>
          <option value="">{ft('allCities')}</option>
          {cityOptions.map((city) => (
            <option key={city} value={city}>
              {localizeOption(city)}
            </option>
          ))}
        </select>
      </label>
      {cityFilter ? (
        <label className="field">
          <span>{ft('district')}</span>
          <select className="input" value={districtFilter} onChange={(e) => setDistrictFilter(e.target.value)}>
            <option value="">{ft('allDistricts')}</option>
            {districtOptions.map((district) => (
              <option key={district} value={district}>
                {localizeOption(district)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="field">
        <span>{ft('schoolType')}</span>
        <select className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">{ft('anyType')}</option>
          {typeOptions.map((schoolType) => (
            <option key={schoolType} value={schoolType}>
              {localizeOption(schoolType)}
            </option>
          ))}
        </select>
      </label>
      {isPrivateType(typeFilter) ? (
        <>
          <label className="field">
            <span>{ft('pricePeriod')}</span>
            <select
              className="input"
              value={pricePeriodFilter}
              onChange={(e) => setPricePeriodFilter(e.target.value as SchoolFeePeriod)}
            >
              <option value="monthly">{ft('perMonth')}</option>
              <option value="yearly">{ft('perYear')}</option>
            </select>
          </label>
          <label className="field">
            <span>
              {ft('privatePriceTo')} {pricePeriodFilter === 'yearly' ? `(${ft('perYear').toLowerCase()})` : `(${ft('perMonth').toLowerCase()})`}: {maxPrivatePrice.toLocaleString('ru-RU')}
            </span>
            <input
              type="range"
              min={privatePriceBounds.min}
              max={privatePriceBounds.max}
              step={10000}
              value={maxPrivatePrice}
              onChange={(e) => setPrivatePriceLimit(Number(e.target.value))}
            />
          </label>
        </>
      ) : null}
      <div className="schools-filter-section">
        <p className="schools-filter-label">{ft('languageOfInstruction')}</p>
        <div className="schools-filter-chip-list">
          {languageOptions.map((lang) => (
            <button
              key={lang}
              type="button"
              className={`schools-filter-chip${selectedLanguages.includes(lang) ? ' active' : ''}`}
              onClick={() => setSelectedLanguages((prev) => toggleValue(prev, lang))}
            >
              {localizeOption(lang)}
            </button>
          ))}
        </div>
      </div>
      <label className="field">
        <span>{ft('gradesRange')}</span>
        <select className="input" value={gradeRangeFilter} onChange={(e) => setGradeRangeFilter(e.target.value)}>
          <option value="">{ft('allGrades')}</option>
          <option value="0">0</option>
          <option value="1-4">1-4</option>
          <option value="5-9">5-9</option>
          <option value="10-12">10-12</option>
          <option value="1-12">1-12</option>
        </select>
      </label>
      {!mobileFiltersOpen ? (
        <button type="button" className="button secondary schools-filter-reset" onClick={resetFilters}>
          {ft('reset')}
        </button>
      ) : null}
    </>
  );

  return (
    <div className="card">
      <section className="market-hero">
        <h2 className="market-title">{t('schools_title')}</h2>
        <div className="market-search-row">
          <input
            className="input market-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('schools_search_placeholder')}
          />
          <button type="button" className="button market-search-button">
            {t('find')}
          </button>
        </div>
        <div className="market-chips">
          <Link href="/parent/schools/map" className="market-chip market-chip-map">
            {t('map')}
          </Link>
          <Link
            href="/parent/ai-match"
            className={`market-chip accent action-chip market-chip-ai${guest ? ' guest-locked-button' : ''}`}
            onClick={(event) => {
              if (!guest) return;
              event.preventDefault();
              showGuestGateMessage();
            }}
          >
            {compareUi.aiMatch}
          </Link>
          <button
            type="button"
            className={`market-chip accent action-chip market-chip-compare${guest ? ' guest-locked-button' : ''} ${(compareMode && compareIds.length === compareTargetCount) ? 'active compare-ready' : ''}`}
            onClick={onCompareAction}
          >
            {(compareMode && compareIds.length === compareTargetCount) ? compareUi.showCompare : compareUi.compare}
            {' '}
            ({compareCount}/{compareTargetCount})
          </button>
          {compareMode ? (
            <button
              type="button"
              className="market-chip cancel-chip"
              onClick={cancelCompareMode}
              title={compareUi.cancelCompare}
              aria-label={compareUi.cancelCompare}
            >
              × {compareUi.cancelCompare}
            </button>
          ) : null}
          <span className="schools-total market-schools-total">{sortedRows.length} {t('schools_word')}</span>
        </div>
      </section>
      {compareError || guestGateMessage ? <p style={{ marginTop: 8, color: '#b91c1c' }}>{compareError || guestGateMessage}</p> : null}

      <div className="schools-mobile-actions">
        <button
          type="button"
          className="schools-mobile-action schools-mobile-action-sort"
          onClick={() => setSortModalOpen((prev) => !prev)}
          aria-expanded={sortModalOpen}
          aria-haspopup="menu"
        >
          <span aria-hidden="true">⇅</span>
          <span>{sortUi.button}</span>
        </button>
        <button
          type="button"
          className={`schools-mobile-action schools-mobile-action-filter-inline${mobileFiltersOpen ? ' active' : ''}${guest ? ' guest-locked-button' : ''}`}
          onClick={() => {
            if (guest) {
              showGuestGateMessage(guestGateUi.filters);
              return;
            }
            setMobileFiltersOpen((prev) => !prev);
          }}
          aria-expanded={mobileFiltersOpen}
          aria-controls="schools-mobile-filters"
        >
          <span>
            {ft('filters')}
            {activeFiltersCount ? ` (${activeFiltersCount})` : ''}
          </span>
        </button>
        <Link href="/parent/schools/map" className="schools-mobile-action schools-mobile-action-map">
          <span aria-hidden="true">⌘</span>
          <span>{t('map')}</span>
        </Link>
        <button
          type="button"
          className={`schools-mobile-action schools-mobile-action-compare${guest ? ' guest-locked-button' : ''}${compareMode ? ' compare-mode' : ' compare-idle'} ${(compareMode && compareIds.length === compareTargetCount) ? 'active compare-ready' : ''}`}
          onClick={onCompareAction}
        >
          <span>
            {compareMode
              ? (compareIds.length === compareTargetCount ? compareUi.showCompare : compareUi.pickTwo)
              : compareUi.compare}
            {' '}
            ({compareCount}/{compareTargetCount})
          </span>
        </button>
        <Link
          href="/parent/ai-match"
          className={`schools-mobile-action schools-mobile-action-ai${guest ? ' guest-locked-button' : ''}`}
          onClick={(event) => {
            if (!guest) return;
            event.preventDefault();
            showGuestGateMessage();
          }}
        >
          <span aria-hidden="true">✦</span>
          <span>{compareUi.aiMatch}</span>
        </Link>
      </div>
      <div className="schools-mobile-meta">
        <span className="schools-mobile-total">{sortedRows.length} {t('schools_word')}</span>
        {compareMode ? (
          <button
            type="button"
            className="schools-mobile-compare-cancel"
            onClick={cancelCompareMode}
          >
            {compareUi.cancelCompare}
          </button>
        ) : null}
      </div>

      <div className="schools-mobile-filter-bar">
        <button
          type="button"
          className={`button secondary schools-mobile-filter-trigger${mobileFiltersOpen ? ' active' : ''}${guest ? ' guest-locked-button' : ''}`}
          onClick={() => {
            if (guest) {
              showGuestGateMessage(guestGateUi.filters);
              return;
            }
            setMobileFiltersOpen((prev) => !prev);
          }}
          aria-expanded={mobileFiltersOpen}
          aria-controls="schools-mobile-filters"
        >
          {ft('filters')}
          {activeFiltersCount ? ` (${activeFiltersCount})` : ''}
        </button>
      </div>

      {mobileFiltersOpen ? (
        <div className="schools-mobile-filter-overlay" onClick={() => setMobileFiltersOpen(false)}>
          <div
            id="schools-mobile-filters"
            className="schools-mobile-filter-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="schools-mobile-filter-head">
              <button
                type="button"
                className="schools-mobile-filter-close"
                onClick={() => setMobileFiltersOpen(false)}
                aria-label="Close filters"
              >
                ×
              </button>
              <p className="schools-mobile-filter-heading">{ft('filters')}</p>
              <button
                type="button"
                className="schools-mobile-filter-clear"
                onClick={resetFilters}
              >
                {ft('reset')}
              </button>
            </div>
            <div className="schools-mobile-filter-scroll">
              <div className="schools-filter-card schools-filter-card-mobile">
                {filtersContent}
              </div>
            </div>
            <div className="schools-mobile-filter-actions">
              <button
                type="button"
                className="button schools-mobile-filter-apply"
                onClick={() => setMobileFiltersOpen(false)}
              >
                {locale === 'en'
                  ? `Show ${sortedRows.length} results`
                  : locale === 'kk'
                    ? `${sortedRows.length} нәтижені көрсету`
                    : `Показать ${sortedRows.length} результатов`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="schools-booking-layout">
        <aside className="schools-filter-sidebar">
          <div className={`schools-filter-card${guest ? ' guest-gated-panel' : ''}`}>
            <div className={guest ? 'guest-gated-content' : ''}>
              <p className="schools-filter-title">{ft('filters')}</p>
              {filtersContent}
            </div>
            {guest ? (
              <div className="guest-gated-overlay">
                <p className="guest-gated-title">{ft('filters')}</p>
                <p className="guest-gated-text">{guestGateUi.filters}</p>
                <Link className="button" href="/login">
                  {t('sign_in_account')}
                </Link>
              </div>
            ) : null}
          </div>
          {guest ? <p className="muted">{t('guest_schools_note')}</p> : null}
        </aside>

        <section>
          {loading ? <p className="muted">{t('loading')}</p> : null}
          {!loading && !sortedRows.length ? <p className="muted">{t('schools_not_found')}</p> : null}
          <div className="market-headline">
            <div className="booking-sort-wrap" ref={sortMenuRef}>
              <button
                type="button"
                className="booking-sort-button"
                onClick={() => setSortModalOpen((prev) => !prev)}
                aria-expanded={sortModalOpen}
                aria-haspopup="menu"
              >
                <span aria-hidden="true">⇅</span>
                <span>{sortUi.sortBy}: {currentSortLabel}</span>
              </button>
              {sortModalOpen ? (
                <div className="booking-sort-menu" role="menu">
                  {[
                    { key: 'recommended', label: sortUi.recommended, disabled: false },
                    { key: 'priceAsc', label: sortUi.priceAsc, disabled: false },
                    { key: 'priceDesc', label: sortUi.priceDesc, disabled: false },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      role="menuitemradio"
                      aria-checked={sortMode === item.key}
                      className={`booking-sort-item${sortMode === item.key ? ' active' : ''}${item.disabled ? ' disabled' : ''}`}
                      disabled={item.disabled}
                      onClick={() => {
                        if (item.disabled) return;
                        setSortMode(item.key as typeof sortMode);
                        setSortModalOpen(false);
                      }}
                    >
                      <span>{item.label}</span>
                      {sortMode === item.key ? <span aria-hidden="true">✓</span> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="schools-grid market-grid booking-cards-grid">
            {sortedRows.slice(0, 80).map((row, index) => {
              const schoolTitle =
                getBrandTitle(row, locale) ||
                t('school_default');
              const imageSrc = toMediaUrl(pickSchoolImage(row));
              const schoolType = getSchoolTypes(row.basic_info?.type)[0] || toText(row.basic_info?.type);
              const isPrivateSchool = isPrivateType(schoolType);
              const schoolTypeLabel = formatComposedSchoolType(
                row.basic_info?.type,
                row.basic_info?.school_subtype,
                locale
              ) || formatSchoolTypes(row.basic_info?.type, locale);
              const priceLabel =
                locale === 'en'
                  ? 'Tuition fee'
                  : locale === 'kk'
                    ? 'Оқу құны'
                    : 'Стоимость обучения';
              const onRequest =
                locale === 'en'
                  ? 'on request'
                  : locale === 'kk'
                    ? 'сұраныс бойынша'
                    : 'по запросу';
              const formattedFee = formatSchoolFee(row, locale, onRequest);
              const schoolId = String(row.school_id || '');
              const isFavorite = schoolId ? favoriteIds.includes(schoolId) : false;
              const mainAddress = toText(row.basic_info?.address).trim();
              const branchAddresses = Array.isArray((row.basic_info as any)?.additional_locations)
                ? ((row.basic_info as any).additional_locations as Array<Record<string, unknown>>)
                    .map((item) => {
                      const city = localizeOption(toText(item?.city).trim());
                      const district = localizeOption(toText(item?.district).trim());
                      const address = toText(item?.address).trim();
                      return [city, district, address].filter(Boolean).join(', ');
                    })
                    .filter(Boolean)
                : [];
              const visibleBranchAddresses = branchAddresses.slice(0, 1);
              const totalAddressCount = (mainAddress ? 1 : 0) + visibleBranchAddresses.length;
              return (
                <Link
                  key={row.school_id || String(index)}
                  href={row.school_id ? `/parent/schools/${encodeURIComponent(row.school_id)}` : '#'}
                  className={`parent-school-link ${row.school_id ? '' : 'is-disabled'}`}
                >
                  <article className="parent-school-card">
                    <div className="market-school-row">
                      <div className={`school-image-placeholder${imageSrc ? ' has-image' : ''}`}>
                        <span className="school-image-fallback">{schoolTitle.slice(0, 1).toUpperCase() || 'Ш'}</span>
                        {imageSrc ? (
                          <img
                            src={imageSrc}
                            alt={schoolTitle}
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.parentElement?.classList.remove('has-image');
                            }}
                          />
                        ) : null}
                      </div>
                      <div className="market-school-main">
                        <p className="parent-school-name">{schoolTitle}</p>
                        <div className="parent-school-badges">
                          <span className="school-chip parent-school-badge">
                            {localizeOption(
                              toText(row.basic_info?.city) ||
                                toText(row.basic_info?.district) ||
                                t('city_default')
                            ).toUpperCase()}
                          </span>
                          <span className="school-chip parent-school-badge">
                            {schoolTypeLabel || t('not_specified')}
                          </span>
                        </div>
                        <p className="muted market-school-phone">{formatKzPhone(toText(row.basic_info?.phone)) || t('phone_unknown')}</p>
                        {isPrivateSchool ? (
                          <p className="market-school-price">
                            {priceLabel}:{' '}
                            <span className={guest ? 'guest-price-blur' : ''}>{formattedFee}</span>
                          </p>
                        ) : null}
                        {mainAddress ? (
                          <div className="market-school-address-list">
                            <p className="market-school-address-row">
                              <strong>
                                {totalAddressCount <= 1
                                  ? locale === 'en'
                                    ? 'Address'
                                    : locale === 'kk'
                                      ? 'Мекенжай'
                                      : 'Адрес'
                                  : locale === 'en'
                                    ? 'Branch 1'
                                    : locale === 'kk'
                                      ? '1-филиал'
                                      : 'Филиал 1'}
                                :
                              </strong>{' '}
                              {mainAddress}
                            </p>
                            {visibleBranchAddresses.map((address, addressIndex) => (
                              <p key={`${schoolId}-branch-${addressIndex}`} className="market-school-address-row">
                                <strong>
                                  {locale === 'en'
                                    ? `Branch ${addressIndex + 2}`
                                    : locale === 'kk'
                                      ? `${addressIndex + 2}-филиал`
                                      : `Филиал ${addressIndex + 2}`}
                                  :
                                </strong>{' '}
                                {address}
                              </p>
                            ))}
                          </div>
                        ) : visibleBranchAddresses.length ? (
                          <div className="market-school-address-list">
                            {visibleBranchAddresses.map((address, addressIndex) => (
                              <p key={`${schoolId}-branch-${addressIndex}`} className="market-school-address-row">
                                <strong>
                                  {locale === 'en'
                                    ? `Branch ${addressIndex + 2}`
                                    : locale === 'kk'
                                      ? `${addressIndex + 2}-филиал`
                                      : `Филиал ${addressIndex + 2}`}
                                  :
                                </strong>{' '}
                                {address}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="market-school-side-actions">
                        <div className="market-card-action-row">
                          {compareMode && row.school_id ? (
                            <button
                              type="button"
                              className={`button compare-card-button ${compareIds.includes(String(row.school_id)) ? 'secondary' : ''}`}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                const result = toggleCompareId(String(row.school_id), compareTargetCount);
                                if (result.limitReached) {
                                  setCompareError(compareUi.pickTwo);
                                  return;
                                }
                                if (!compareIds.includes(String(row.school_id))) {
                                  void recordEngagementEvent({
                                    eventType: 'compare_add',
                                    schoolId: String(row.school_id),
                                    locale,
                                    source: 'schools_list',
                                  }).catch(() => undefined);
                                }
                                setCompareError('');
                                setCompareIds(result.ids);
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={compareIds.includes(String(row.school_id))}
                                onChange={() => undefined}
                                style={{ marginRight: 8 }}
                              />
                              {compareUi.addCompare}
                            </button>
                          ) : null}
                          {!guest && schoolId ? (
                            <button
                              type="button"
                              className={`school-favorite-btn inline${isFavorite ? ' active' : ''}`}
                              aria-label={isFavorite ? favoriteUi.remove : favoriteUi.add}
                              title={isFavorite ? favoriteUi.remove : favoriteUi.add}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                if (!isFavorite) {
                                  void recordEngagementEvent({
                                    eventType: 'favorite_add',
                                    schoolId,
                                    locale,
                                    source: 'schools_list',
                                  }).catch(() => undefined);
                                }
                                const result = toggleFavoriteId(schoolId);
                                setFavoriteIds(result.ids);
                              }}
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path
                                  d="M12 20.4l-1.2-1.1C6 15 3 12.2 3 8.8 3 6.1 5.1 4 7.8 4c1.6 0 3.1.8 4.2 2 1.1-1.2 2.6-2 4.2-2C18.9 4 21 6.1 21 8.8c0 3.4-3 6.2-7.8 10.5L12 20.4z"
                                  fill={isFavorite ? 'currentColor' : 'none'}
                                  stroke="currentColor"
                                  strokeWidth="1.9"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="parent-school-meta">
                      <span className="market-stars">☆☆☆☆☆</span>
                      <span className="school-chip">
                        {row.system?.rating ?? '0.0'}
                      </span>
                      <span className="school-chip">
                        {row.system?.reviews_count ?? 0} {t('reviews_word')}
                      </span>
                    </div>
                    <p className="parent-school-expand-hint">{t('open_school_card')}</p>
                  </article>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
      {!hideAiFab ? (
        <div className="ai-fab-wrap">
          <button
            type="button"
            className="ai-fab-close"
            aria-label="Закрыть AI чат кнопку"
            onClick={() => setHideAiFab(true)}
          >
            ×
          </button>
          <Link
            href="/parent/chat"
            className={`ai-fab-main${guest ? ' guest-locked-button' : ''}`}
            aria-label="Открыть AI чат"
            onClick={(event) => {
              if (!guest) return;
              event.preventDefault();
              showGuestGateMessage();
            }}
          >
            <span className="ai-fab-icon" aria-hidden="true">💬</span>
            <span className="ai-fab-label">{compareUi.aiChat}</span>
          </Link>
        </div>
      ) : (
        <button
          type="button"
          className="ai-fab-restore"
          onClick={() => setHideAiFab(false)}
        >
          {compareUi.aiChat}
        </button>
      )}
    </div>
  );
}
