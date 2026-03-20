'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loadSchools } from '@/lib/api';
import { useParentLocale } from '@/lib/parentLocale';

type SchoolRow = {
  school_id?: string;
  basic_info?: {
    display_name?: unknown;
    name?: unknown;
    type?: unknown;
    city?: unknown;
    district?: unknown;
    license_details?: {
      number?: unknown;
    };
    coordinates?: {
      latitude?: unknown;
      longitude?: unknown;
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
  };
  finance?: {
    tuition_monthly?: unknown;
    monthly_fee?: unknown;
    price_monthly?: unknown;
  };
  system?: {
    rating?: number;
    reviews_count?: number;
  };
};

type MapSchool = {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
};

declare global {
  interface Window {
    L?: unknown;
  }
}

type LeafletMap = {
  setView: (center: [number, number], zoom: number) => void;
  fitBounds: (bounds: Array<[number, number]>, options?: { padding?: [number, number] }) => void;
};

type LeafletLayer = {
  addTo: (target: unknown) => LeafletLayer;
  remove: () => void;
};

type LeafletMarker = {
  bindPopup: (html: string) => LeafletMarker;
  addTo: (layer: unknown) => LeafletMarker;
  openPopup: () => LeafletMarker;
};

type LeafletApi = {
  map: (
    node: HTMLDivElement,
    options: { zoomControl: boolean; minZoom: number; maxZoom: number }
  ) => LeafletMap;
  tileLayer: (url: string, options: { attribution: string }) => LeafletLayer;
  layerGroup: () => LeafletLayer;
  marker: (point: [number, number]) => LeafletMarker;
  circleMarker: (
    point: [number, number],
    options: { radius: number; color: string; weight: number; fillColor: string; fillOpacity: number }
  ) => LeafletMarker;
  icon?: (options: {
    iconUrl: string;
    shadowUrl?: string;
    iconSize?: [number, number];
    iconAnchor?: [number, number];
    popupAnchor?: [number, number];
    shadowSize?: [number, number];
  }) => unknown;
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

const normalize = (value: string) => value.toLowerCase().trim();

const toggleValue = (arr: string[], value: string) =>
  arr.includes(value) ? arr.filter((item) => item !== value) : [...arr, value];

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

const toFloat = (value: unknown): number | null => {
  const raw = typeof value === 'string' ? value.replace(',', '.').trim() : value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const hasValidCoordinates = (lat: number | null, lng: number | null): lat is number => {
  if (lat === null || lng === null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  if (Math.abs(lat) < 0.000001 && Math.abs(lng) < 0.000001) return false;
  return true;
};

const toNumber = (value: unknown): number => {
  const raw = toText(value).replace(',', '.').trim();
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toPriceNumber = (value: unknown): number => {
  const raw = toText(value);
  if (!raw) return 0;
  const digits = raw.replace(/\s+/g, '').match(/\d+(?:[.,]\d+)?/);
  if (!digits) return 0;
  const parsed = Number(digits[0].replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

const getMonthlyFee = (row: SchoolRow): number =>
  toPriceNumber(
    row.finance?.tuition_monthly ||
      row.finance?.monthly_fee ||
      row.finance?.price_monthly ||
      row.basic_info?.name
  );

const isPrivateType = (value: string): boolean => {
  const normalized = normalizePrimaryTypeKey(value);
  if (normalized) return normalized === 'Private';
  const v = normalize(value);
  return v.includes('private') || v.includes('част') || v.includes('жеке') || v.includes('international') || v.includes('международ') || v.includes('автоном');
};

const ensureLeafletAssets = () =>
  new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined') return resolve();
    if (window.L) return resolve();

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const existingScript = document.getElementById('leaflet-js') as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Leaflet load error')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = 'leaflet-js';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Leaflet load error'));
    document.body.appendChild(script);
  });

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const OPTION_I18N: Record<string, { ru: string; en: string; kk: string }> = {
  State: { ru: 'Государственная', en: 'State', kk: 'Мемлекеттік' },
  Private: { ru: 'Частная', en: 'Private', kk: 'Жеке' },
  International: { ru: 'Международная', en: 'International', kk: 'Халықаралық' },
  Autonomous: { ru: 'Автономная', en: 'Autonomous', kk: 'Автономды' },
  Almaty: { ru: 'Алматы', en: 'Almaty', kk: 'Алматы' },
  Astana: { ru: 'Астана', en: 'Astana', kk: 'Астана' },
  Karaganda: { ru: 'Караганда', en: 'Karaganda', kk: 'Қарағанды' },
  City: { ru: 'Город', en: 'City', kk: 'Қала' },
  District: { ru: 'Район', en: 'District', kk: 'Аудан' },
  Almaly: { ru: 'Алмалы', en: 'Almaly', kk: 'Алмалы' },
  Auezov: { ru: 'Ауэзов', en: 'Auezov', kk: 'Әуезов' },
  Bostandyk: { ru: 'Бостандык', en: 'Bostandyk', kk: 'Бостандық' },
  Zhetysu: { ru: 'Жетысу', en: 'Zhetysu', kk: 'Жетісу' },
  Medeu: { ru: 'Медеу', en: 'Medeu', kk: 'Медеу' },
  Nauryzbay: { ru: 'Наурызбай', en: 'Nauryzbay', kk: 'Наурызбай' },
  'Almaty District': { ru: 'Алматы', en: 'Almaty District', kk: 'Алматы' },
  Baikonyr: { ru: 'Байконур', en: 'Baikonyr', kk: 'Байқоңыр' },
  Yesil: { ru: 'Есиль', en: 'Yesil', kk: 'Есіл' },
  Saryarka: { ru: 'Сарыарка', en: 'Saryarka', kk: 'Сарыарқа' },
  Nura: { ru: 'Нура', en: 'Nura', kk: 'Нұра' },
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

const localizeOption = (value: string, locale: 'ru' | 'en' | 'kk') => {
  const key = value.replace(/\s+/g, ' ').trim();
  const hit = OPTION_I18N[key];
  return hit ? hit[locale] : value;
};

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

export default function ParentSchoolsMapPage() {
  const { locale } = useParentLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [rows, setRows] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState('');
  const [ready, setReady] = useState(false);

  const [cityFilter, setCityFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [privatePriceLimit, setPrivatePriceLimit] = useState<number | null>(null);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [gradeRangeFilter, setGradeRangeFilter] = useState('');

  const FILTER_TEXT: Record<string, { ru: string; en: string; kk: string }> = {
    closeMap: { ru: 'Закрыть карту', en: 'Close map', kk: 'Картаны жабу' },
    filters: { ru: 'Фильтры', en: 'Filters', kk: 'Сүзгілер' },
    schoolsOnMap: { ru: 'Школ на карте', en: 'Schools on map', kk: 'Картадағы мектептер' },
    city: { ru: 'Город', en: 'City', kk: 'Қала' },
    allCities: { ru: 'Все города', en: 'All cities', kk: 'Барлық қалалар' },
    district: { ru: 'Район', en: 'District', kk: 'Аудан' },
    allDistricts: { ru: 'Все районы', en: 'All districts', kk: 'Барлық аудандар' },
    schoolType: { ru: 'Тип школы', en: 'School type', kk: 'Мектеп түрі' },
    anyType: { ru: 'Любой тип', en: 'Any type', kk: 'Кез келген түр' },
    languageOfInstruction: { ru: 'Язык обучения', en: 'Language of instruction', kk: 'Оқыту тілі' },
    privatePriceTo: { ru: 'Цена до (₸)', en: 'Price up to (₸)', kk: 'Баға дейін (₸)' },
    gradesRange: { ru: 'Количество классов', en: 'Grades', kk: 'Сыныптар' },
    allGrades: { ru: 'Любые классы', en: 'Any grades', kk: 'Кез келген сыныптар' },
    reset: { ru: 'Сбросить', en: 'Reset', kk: 'Тазарту' },
    noCity: { ru: 'Без города', en: 'No city', kk: 'Қаласы жоқ' },
    mapLoadError: { ru: 'Не удалось загрузить карту.', en: 'Failed to load map.', kk: 'Картаны жүктеу сәтсіз болды.' },
  };
  const ft = (key: keyof typeof FILTER_TEXT) => FILTER_TEXT[key][locale];
  const mapLoadErrorText = FILTER_TEXT.mapLoadError[locale];
  const noCityText = FILTER_TEXT.noCity[locale];
  const schoolDefaultText = locale === 'en' ? 'School' : locale === 'kk' ? 'Мектеп' : 'Школа';

  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersLayerRef = useRef<LeafletLayer | null>(null);

  const focusedSchoolId = useMemo(() => searchParams.get('focus') || '', [searchParams]);
  const backHref = useMemo(() => {
    const back = searchParams.get('back') || '';
    return back.startsWith('/parent/') ? back : '/parent/schools';
  }, [searchParams]);

  useEffect(() => {
    let mounted = true;
    loadSchools()
      .then((payload) => {
        if (!mounted) return;
        const list = Array.isArray(payload?.data) ? payload.data : [];
        setRows(list);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const rowsWithCoords = useMemo(
    () =>
      rows.filter((row) => {
        const lat = toFloat(row.basic_info?.coordinates?.latitude);
        const lng = toFloat(row.basic_info?.coordinates?.longitude);
        return hasValidCoordinates(lat, lng);
      }),
    [rows]
  );

  const cityOptions = useMemo(() => {
    const values = rowsWithCoords
      .map((row) => toText(row.basic_info?.city).trim())
      .filter(Boolean);
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [rowsWithCoords]);

  const districtOptions = useMemo(() => {
    const values = rowsWithCoords
      .filter((row) => !cityFilter || toText(row.basic_info?.city) === cityFilter)
      .map((row) => toText(row.basic_info?.district).trim())
      .filter(Boolean);
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [rowsWithCoords, cityFilter]);

  const typeOptions = useMemo(() => {
    const values = rowsWithCoords
      .flatMap((row) => getSchoolTypes(row.basic_info?.type))
      .filter(Boolean);
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [rowsWithCoords]);

  const privatePriceBounds = useMemo(() => {
    const prices = rowsWithCoords
      .filter((row) => isPrivateType(toText(row.basic_info?.type)))
      .map((row) => getMonthlyFee(row))
      .filter((price) => Number.isFinite(price) && price > 0);
    const max = prices.length ? Math.max(...prices) : 500000;
    return { min: 0, max: Math.ceil(max / 10000) * 10000 };
  }, [rowsWithCoords]);

  const maxPrivatePrice = useMemo(() => {
    if (privatePriceLimit == null) return privatePriceBounds.max;
    return Math.min(privatePriceLimit, privatePriceBounds.max);
  }, [privatePriceBounds.max, privatePriceLimit]);

  const filteredRows = useMemo(() => {
    return rowsWithCoords.filter((row) => {
      const city = toText(row.basic_info?.city);
      const district = toText(row.basic_info?.district);
      const schoolTypeValues = getSchoolTypes(row.basic_info?.type);
      const monthlyFee = getMonthlyFee(row);

      const cityOk = !cityFilter || city === cityFilter;
      const districtOk = !districtFilter || district === districtFilter;
      const typeOk = !typeFilter || schoolTypeValues.includes(typeFilter);
      const privatePriceOk = !isPrivateType(typeFilter) || monthlyFee <= maxPrivatePrice || monthlyFee <= 0;
      const gradesOk = matchesGradeRange(row.education?.grades, gradeRangeFilter);

      const schoolLanguages = toList(row.education?.languages).map(normalize);
      const languagesOk =
        !selectedLanguages.length ||
        selectedLanguages.some((lang) => schoolLanguages.some((schoolLang) => schoolLang.includes(normalize(lang))));

      return (
        cityOk &&
        districtOk &&
        typeOk &&
        privatePriceOk &&
        languagesOk &&
        gradesOk
      );
    });
  }, [
    rowsWithCoords,
    cityFilter,
    districtFilter,
    typeFilter,
    maxPrivatePrice,
    selectedLanguages,
    gradeRangeFilter,
  ]);

  const schools = useMemo(() => {
    return filteredRows
      .map((row) => {
        const lat = toFloat(row.basic_info?.coordinates?.latitude);
        const lng = toFloat(row.basic_info?.coordinates?.longitude);
        if (!hasValidCoordinates(lat, lng)) return null;
        return {
          id: row.school_id || `${lat}-${lng}`,
          name: toText(row.basic_info?.display_name) || toText(row.basic_info?.name) || schoolDefaultText,
          city: localizeOption(
            toText(row.basic_info?.city) || toText(row.basic_info?.district) || '',
            locale
          ),
          lat,
          lng,
        };
      })
      .filter(Boolean) as MapSchool[];
  }, [filteredRows, locale, schoolDefaultText]);

  useEffect(() => {
    let cancelled = false;
    ensureLeafletAssets()
      .then(() => {
        if (cancelled) return;
        if (!mapHostRef.current || !window.L) return;
        const L = window.L as LeafletApi | undefined;
        if (!L) return;
        if (!mapRef.current) {
          mapRef.current = L.map(mapHostRef.current, {
            zoomControl: true,
            minZoom: 4,
            maxZoom: 18,
          });
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
          }).addTo(mapRef.current);
        }
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setMapError(mapLoadErrorText);
      });

    return () => {
      cancelled = true;
    };
  }, [mapLoadErrorText]);

  useEffect(() => {
    if (!ready || !window.L || !mapRef.current) return;
    const L = window.L as LeafletApi;
    const orangeIcon = L.icon?.({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });

    if (markersLayerRef.current) {
      markersLayerRef.current.remove();
      markersLayerRef.current = null;
    }

    const layer = L.layerGroup();
    const bounds: Array<[number, number]> = [];

    schools.forEach((school) => {
      const isFocused = focusedSchoolId && school.id === focusedSchoolId;
      const marker = orangeIcon
        ? (L.marker as unknown as (point: [number, number], options?: { icon?: unknown }) => LeafletMarker)(
            [school.lat, school.lng],
            { icon: orangeIcon }
          )
        : L.marker([school.lat, school.lng]);
      marker.bindPopup(
        `<strong>${escapeHtml(school.name)}</strong><br/>${escapeHtml(school.city || noCityText)}`
      );
      marker.addTo(layer);
      if (isFocused) marker.openPopup();
      bounds.push([school.lat, school.lng]);
    });

    layer.addTo(mapRef.current);
    markersLayerRef.current = layer;

    if (bounds.length) {
      mapRef.current.fitBounds(bounds, { padding: [48, 48] });
    } else {
      mapRef.current.setView([48.02, 66.92], 5);
    }
    if (focusedSchoolId) {
      const focused = schools.find((item) => item.id === focusedSchoolId);
      if (focused) mapRef.current.setView([focused.lat, focused.lng], 12);
    }
  }, [ready, schools, focusedSchoolId, noCityText]);

  return (
    <div className="schools-map-fullscreen-page">
      {mobileFiltersOpen ? (
        <button
          type="button"
          className="schools-map-mobile-backdrop"
          aria-label={ft('filters')}
          onClick={() => setMobileFiltersOpen(false)}
        />
      ) : null}
      <button
        type="button"
        aria-label={ft('closeMap')}
        onClick={() => router.push(backHref)}
        style={{
          position: 'fixed',
          right: 14,
          top: 14,
          zIndex: 10000,
          minHeight: 44,
          borderRadius: 999,
          background: 'rgba(16, 27, 59, 0.96)',
          border: '1px solid rgba(255,255,255,0.2)',
          color: '#fff',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 14px',
          boxShadow: '0 8px 20px rgba(9, 18, 44, 0.36)',
          cursor: 'pointer',
          fontWeight: 700,
          fontSize: 14,
        }}
      >
        <span style={{ fontSize: 24, lineHeight: 1 }}>×</span>
        <span>{ft('closeMap')}</span>
      </button>

      <button
        type="button"
        className="schools-map-filter-fab"
        onClick={() => setMobileFiltersOpen(true)}
      >
        {ft('filters')}
      </button>

      <aside className={`schools-map-filters-panel${mobileFiltersOpen ? ' is-open' : ''}`}>
        <div className="schools-filter-card">
          <div className="schools-map-mobile-filter-head">
            <p className="schools-filter-title">{ft('filters')}</p>
            <button
              type="button"
              className="schools-map-mobile-filter-close"
              aria-label={ft('closeMap')}
              onClick={() => setMobileFiltersOpen(false)}
            >
              ×
            </button>
          </div>
          {!loading ? <p className="muted" style={{ marginTop: -4 }}>{ft('schoolsOnMap')}: {schools.length}</p> : null}
          <label className="field">
            <span>{ft('city')}</span>
            <select className="input" value={cityFilter} onChange={(e) => {
              setCityFilter(e.target.value);
              setDistrictFilter('');
            }}>
              <option value="">{ft('allCities')}</option>
              {cityOptions.map((city) => (
                <option key={city} value={city}>{localizeOption(city, locale)}</option>
              ))}
            </select>
          </label>
          {cityFilter ? (
            <label className="field">
              <span>{ft('district')}</span>
              <select className="input" value={districtFilter} onChange={(e) => setDistrictFilter(e.target.value)}>
                <option value="">{ft('allDistricts')}</option>
                {districtOptions.map((district) => (
                  <option key={district} value={district}>{localizeOption(district, locale)}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="field">
            <span>{ft('schoolType')}</span>
            <select className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">{ft('anyType')}</option>
              {typeOptions.map((schoolType) => (
                <option key={schoolType} value={schoolType}>{localizeOption(schoolType, locale)}</option>
              ))}
            </select>
          </label>

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
                  {localizeOption(lang, locale)}
                </button>
              ))}
            </div>
          </div>
          {isPrivateType(typeFilter) ? (
            <label className="field">
              <span>{ft('privatePriceTo')}: {maxPrivatePrice.toLocaleString('ru-RU')}</span>
              <input
                type="range"
                min={privatePriceBounds.min}
                max={privatePriceBounds.max}
                step={10000}
                value={maxPrivatePrice}
                onChange={(e) => setPrivatePriceLimit(Number(e.target.value))}
              />
            </label>
          ) : null}
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

          <button
            type="button"
            className="button secondary schools-filter-reset"
            onClick={() => {
              setCityFilter('');
              setDistrictFilter('');
              setTypeFilter('');
              setPrivatePriceLimit(null);
              setSelectedLanguages([]);
              setGradeRangeFilter('');
            }}
          >
            {ft('reset')}
          </button>
          {loading ? <p className="muted">{locale === 'en' ? 'Loading schools...' : locale === 'kk' ? 'Мектептер жүктелуде...' : 'Загрузка школ...'}</p> : null}
          {mapError ? <p style={{ color: '#b91c1c', margin: '8px 0 0' }}>{mapError}</p> : null}
        </div>
      </aside>

      <div ref={mapHostRef} className="schools-map-fullscreen-canvas" />
    </div>
  );
}
