'use client';

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { loadSchoolById, recordEngagementEvent, requestJson, submitDirectSchoolReview } from '@/lib/api';
import { isGuestMode } from '@/lib/guestMode';
import { useParentLocale } from '@/lib/parentLocale';
import { buildFeeRulesFromFinance, formatSchoolFee } from '@/lib/schoolFinance';
import { formatKzPhone } from '@/lib/phone';
import {
  formatAdmissionGradeLabel,
  normalizeAdmissionRules,
} from '@/lib/admission';

type SchoolRow = {
  school_id?: string;
  [key: string]: unknown;
};

type TeacherCard = {
  full_name: string;
  position: string;
  category: string;
  subjects: string;
  teaching_languages: string;
  exam_prep: string;
  experience_years: string;
  bio: string;
  photo_url: string;
};

type ServiceCard = {
  label: string;
  value: string;
  tone?: 'positive' | 'neutral';
};

type StudentSuccessStory = {
  student_name: string;
  admitted_to: string;
  ent_score: string;
  ielts_score: string;
  sat_score: string;
  school_average_score: string;
  achievements: string;
  admission_subjects: string;
  application_deadline: string;
  student_photo: string;
};

type ContactItem = {
  label: string;
  value: string;
  href?: string;
};

type ProgramDetails = {
  title: string;
  summary: string;
  highlights: string[];
};

type MediaViewerKind = 'photo' | 'video' | 'doc';

type MediaViewerState = {
  kind: MediaViewerKind;
  index: number;
};

type ConsultationDraft = {
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  childName: string;
  childGrade: string;
  consultationType: string;
  comment: string;
};

type ReviewDraft = {
  experienceType: 'current_parent' | 'former_parent' | 'applicant_parent' | 'consultation_only' | 'other';
  experienceFreshness: 'current_year' | 'within_2_years' | 'within_5_years' | 'over_5_years';
  teachingRating: string;
  communicationRating: string;
  safetyRating: string;
  atmosphereRating: string;
  valueRating: string;
  positives: string;
  concerns: string;
  recommendationFor: string;
  comment: string;
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

const FIELD_LABELS: Record<string, string> = {
  name: 'Название',
  display_name: 'Отображаемое название',
  type: 'Тип школы',
  city: 'Город',
  district: 'Район',
  address: 'Адрес',
  description: 'Описание',
  phone: 'Телефон',
  whatsapp_phone: 'WhatsApp',
  email: 'Email',
  website: 'Сайт',
  number: 'Номер лицензии',
  issued_at: 'Лицензия выдана',
  valid_until: 'Лицензия до',
  languages: 'Языки',
  grades: 'Классы',
  programs: 'Программы',
  advanced_subjects: 'Профильные предметы',
  average_class_size: 'Средний размер класса',
  meals_status: 'Питание',
  transport: 'Трансфер',
  inclusive_education: 'Инклюзивное обучение',
  after_school: 'Продленка',
  latitude: 'Широта',
  longitude: 'Долгота',
  nearest_metro_stop: 'Ближайшее метро',
  nearest_bus_stop: 'Ближайшая остановка',
  distance_to_metro_km: 'До метро, км',
  distance_to_bus_stop_km: 'До остановки, км',
  service_area: 'Зона обслуживания',
  logo: 'Логотип',
  photos: 'Фото',
  videos: 'Видео',
  certificates: 'Сертификаты',
};

const SECTION_LABELS: Array<{ key: string; icon: IconKind }> = [
  { key: 'education', icon: 'education' },
  { key: 'services', icon: 'shield' },
  { key: 'basic_info', icon: 'info' },
  { key: 'media', icon: 'globe' },
  { key: 'reviews', icon: 'chat' },
  { key: 'staff', icon: 'user' },
];
const SECTION_TITLES: Record<string, { ru: string; en: string; kk: string }> = {
  education: { ru: 'Процесс обучения', en: 'Learning process', kk: 'Оқу процесі' },
  basic_info: { ru: 'Контактная информация', en: 'Contact information', kk: 'Байланыс ақпараты' },
  media: { ru: 'Социальные сети', en: 'Social media', kk: 'Әлеуметтік желілер' },
  services: { ru: 'Сервис и безопасность', en: 'Services and safety', kk: 'Қызмет пен қауіпсіздік' },
  reviews: { ru: 'Отзывы', en: 'Reviews', kk: 'Пікірлер' },
  staff: { ru: 'Команда школы', en: 'School team', kk: 'Мектеп командасы' },
};

type IconKind = 'type' | 'price' | 'address' | 'city' | 'district' | 'rating' | 'phone' | 'education' | 'info' | 'globe' | 'shield' | 'chat' | 'user';
type SocialKey = 'instagram' | 'whatsapp' | 'telegram' | 'tiktok' | 'youtube' | 'facebook' | 'vk' | 'linkedin';
const SOCIAL_ICON_IMAGES: Partial<Record<SocialKey, string>> = {
  whatsapp: '/whatsapp',
  telegram: '/telegram.png',
  tiktok: '/tiktok.avif',
  youtube: '/ютуб.png',
  facebook: '/facebook.webp',
  vk: '/vk.png',
  linkedin: '/linkedin.webp',
};

function SchoolIcon({ kind }: { kind: IconKind }) {
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: '#2d62d8', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  if (kind === 'type') return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M8 4v16" /></svg>;
  if (kind === 'price') return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M14.5 8.5c-.5-.7-1.4-1-2.5-1-1.7 0-3 1-3 2.4 0 3.1 5.5 1.8 5.5 4.6 0 1.3-1.2 2.2-2.9 2.2-1.2 0-2.2-.4-2.9-1.2M12 6v12" /></svg>;
  if (kind === 'address') return <svg {...common}><path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>;
  if (kind === 'city') return <svg {...common}><rect x="3" y="8" width="18" height="13" rx="2" /><path d="M7 8V4h10v4M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" /></svg>;
  if (kind === 'district') return <svg {...common}><path d="M3 6l9-3 9 3-9 3-9-3Z" /><path d="M3 12l9 3 9-3M3 18l9 3 9-3" /></svg>;
  if (kind === 'rating') return <svg {...common}><path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.7l5.4-.8L12 4Z" /></svg>;
  if (kind === 'phone') return <svg {...common}><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 11.2 19a19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-2.9-8.7A2 2 0 0 1 4.2 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .8 2.9a2 2 0 0 1-.4 2.1L8.3 10a16 16 0 0 0 5.7 5.7l1.3-1.3a2 2 0 0 1 2.1-.4c.9.4 1.9.7 2.9.8a2 2 0 0 1 1.7 2Z" /></svg>;
  if (kind === 'education') return <svg {...common}><path d="m3 8 9-5 9 5-9 5-9-5Z" /><path d="M7 10.5V16c0 1.7 2.2 3 5 3s5-1.3 5-3v-5.5" /></svg>;
  if (kind === 'info') return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 10v6M12 7h.01" /></svg>;
  if (kind === 'globe') return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>;
  if (kind === 'shield') return <svg {...common}><path d="M12 3 5 6v6c0 5 3.4 8.7 7 10 3.6-1.3 7-5 7-10V6l-7-3Z" /></svg>;
  if (kind === 'chat') return <svg {...common}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" /></svg>;
  return <svg {...common}><circle cx="12" cy="8" r="3.2" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>;
}

function SocialIcon({ kind }: { kind: SocialKey }) {
  const common = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  if (kind === 'instagram') return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="5" /><circle cx="12" cy="12" r="3.8" /><circle cx="17.2" cy="6.8" r="0.8" fill="currentColor" stroke="none" /></svg>;
  if (kind === 'whatsapp') return <svg {...common}><path d="M20 11.5A8.5 8.5 0 0 1 7.3 19l-3.3.9.9-3.2A8.5 8.5 0 1 1 20 11.5Z" /><path d="M9.2 8.8c.4-.4.9-.4 1.1.1l.7 1.7c.2.4.1.7-.2 1l-.6.5a8.2 8.2 0 0 0 2.7 2.7l.5-.6c.3-.3.6-.4 1-.2l1.7.7c.5.2.5.7.1 1.1l-.7.7c-.6.6-1.5.8-2.3.4a10.7 10.7 0 0 1-5.2-5.2c-.4-.8-.2-1.7.4-2.3l.8-.6Z" /></svg>;
  if (kind === 'telegram') return <svg {...common}><path d="m21 4-3 15-5-4-2.7 2.5.4-3.6L17 8 8 13l-5-2 18-7Z" /></svg>;
  if (kind === 'tiktok') return <svg {...common}><path d="M14 5v8.2a3.8 3.8 0 1 1-2.5-3.6" /><path d="M14 5c.7 1.7 2.2 2.8 4 2.9" /></svg>;
  if (kind === 'youtube') return <svg {...common}><rect x="3" y="6.2" width="18" height="11.6" rx="3.2" /><path d="m10 9.6 5 2.4-5 2.4V9.6Z" fill="currentColor" stroke="none" /></svg>;
  if (kind === 'facebook') return <svg {...common}><path d="M14.4 8.2h2V5.2h-2.3c-2.4 0-3.9 1.5-3.9 3.8v1.8H8v2.9h2.2v5.1h3.1v-5.1h2.6l.4-2.9h-3V9.2c0-.7.4-1 1.1-1Z" /></svg>;
  if (kind === 'linkedin') return <svg {...common}><path d="M7.5 9.2V18M7.5 6.8h.01M11.4 18v-5c0-1.6 1-2.6 2.4-2.6s2.2.9 2.2 2.6v5" /><rect x="4" y="4" width="16" height="16" rx="3" /></svg>;
  return <svg {...common}><path d="M4 7.3c0-1 .8-1.8 1.8-1.8h12.4c1 0 1.8.8 1.8 1.8v9.4c0 1-.8 1.8-1.8 1.8H5.8c-1 0-1.8-.8-1.8-1.8V7.3Z" /><path d="m8.5 9.5 2.8 4 2.3-4M10.4 12.2h1.8" /></svg>;
}

function FactRow({
  icon,
  label,
  value,
  onClick,
  asButton = false,
}: {
  icon: IconKind;
  label: string;
  value: ReactNode;
  onClick?: () => void;
  asButton?: boolean;
}) {
  if (asButton) {
    return (
      <div
        className="school-mobile-fact-row"
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick?.();
          }
        }}
      >
        <span className="school-mobile-fact-label"><span className="school-mobile-fact-icon"><SchoolIcon kind={icon} /></span>{label}</span>
        <strong>{value}</strong>
      </div>
    );
  }
  return (
    <div className="school-mobile-fact-row">
      <span className="school-mobile-fact-label"><span className="school-mobile-fact-icon"><SchoolIcon kind={icon} /></span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ExpandableFactRow({
  icon,
  label,
  value,
  open,
  onToggle,
  children,
}: {
  icon: IconKind;
  label: string;
  value: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className={`school-mobile-fact-expand${open ? ' is-open' : ''}`}>
      <button type="button" className="school-mobile-fact-row school-mobile-fact-row-button" onClick={onToggle}>
        <span className="school-mobile-fact-label">
          <span className="school-mobile-fact-icon"><SchoolIcon kind={icon} /></span>
          {label}
        </span>
        <strong>
          {value}
          <span className={`school-mobile-fact-caret${open ? ' is-open' : ''}`}>▾</span>
        </strong>
      </button>
      {open ? <div className="school-mobile-fact-details">{children}</div> : null}
    </div>
  );
}

const isLocalizedObject = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value as Record<string, unknown>);
  return keys.every((k) => ['ru', 'kk', 'en'].includes(k));
};

const valueToText = (value: unknown): string => {
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    const values = value.map((item) => valueToText(item)).filter(Boolean);
    return values.join(', ');
  }
  if (isLocalizedObject(value)) return toText(value);
  return '';
};

const prettifyField = (path: string) => {
  const key = path.split('.').pop() || path;
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return key.replaceAll('_', ' ');
};

const flattenDetails = (value: unknown, prefix = ''): Array<{ label: string; value: string }> => {
  const direct = valueToText(value);
  if (direct) {
    return prefix ? [{ label: prettifyField(prefix), value: direct }] : [];
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const rows: Array<{ label: string; value: string }> = [];
  const entries = Object.entries(value as Record<string, unknown>);
  for (const [key, nested] of entries) {
    const next = prefix ? `${prefix}.${key}` : key;
    rows.push(...flattenDetails(nested, next));
  }
  return rows;
};

const getIn = (source: unknown, path: string): unknown => {
  if (!source || typeof source !== 'object') return undefined;
  const parts = path.split('.');
  let cursor: unknown = source;
  for (const part of parts) {
    if (!cursor || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
};

const pickFirstText = (source: unknown, paths: string[], fallback = '') => {
  for (const path of paths) {
    const value = toText(getIn(source, path));
    if (value) return value;
  }
  return fallback;
};

const pickLocalizedText = (
  source: unknown,
  pathBase: string,
  locale: 'ru' | 'en' | 'kk',
  fallback = ''
) =>
  pickFirstText(
    source,
    [
      `${pathBase}.${locale}`,
      `${pathBase}.ru`,
      `${pathBase}.kk`,
      `${pathBase}.en`,
      pathBase,
    ],
    fallback
  );

const mergeUniqueRows = (
  primary: Array<{ label: string; value: string }>,
  extra: Array<{ label: string; value: string }>
) => {
  const out = [...primary];
  const seen = new Set(
    primary.map((item) => `${item.label.toLowerCase().trim()}::${item.value.toLowerCase().trim()}`)
  );
  for (const row of extra) {
    const key = `${row.label.toLowerCase().trim()}::${row.value.toLowerCase().trim()}`;
    if (!row.value?.trim() || seen.has(key)) continue;
    out.push(row);
    seen.add(key);
  }
  return out;
};

const localizeCuratorFormat = (value: string, locale: 'ru' | 'en' | 'kk') => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'per_class') {
    return locale === 'en' ? 'One per class' : locale === 'kk' ? 'Әр сыныпқа бір куратор' : 'По одному на класс';
  }
  if (normalized === 'by_parallel') {
    return locale === 'en' ? 'By grade level' : locale === 'kk' ? 'Параллельдер бойынша' : 'По параллелям';
  }
  if (normalized === 'curator_service') {
    return locale === 'en' ? 'Curator service' : locale === 'kk' ? 'Кураторлық қызмет' : 'Кураторская служба';
  }
  return value;
};

const pickImage = (source: unknown) => {
  const logo = toText(getIn(source, 'media.logo'));
  if (logo) return logo;
  const photos = toText(getIn(source, 'media.photos'));
  if (!photos) return '';
  const first = photos
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)[0];
  return first || '';
};

const toNumber = (value: unknown): number | null => {
  const raw = typeof value === 'string' ? value.replace(',', '.').trim() : value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const toList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => toText(item)).map((item) => item.trim()).filter(Boolean);
  }
  const text = toText(value);
  if (!text) return [];
  return text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const toExternalUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const isImageUrl = (value: string) =>
  /\.(png|jpe?g|webp|gif|bmp|svg|avif)(\?.*)?$/i.test(value.trim());

const isVideoUrl = (value: string) =>
  /\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i.test(value.trim());

const toYouTubeEmbedUrl = (value: string) => {
  const trimmed = value.trim();
  const match = trimmed.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{6,})/
  );
  if (!match?.[1]) return '';
  return `https://www.youtube.com/embed/${match[1]}`;
};

const isPrivateType = (value: string): boolean => {
  const v = value.toLowerCase().trim();
  return (
    v.includes('private') ||
    v.includes('част') ||
    v.includes('жеке') ||
    v.includes('international') ||
    v.includes('международ') ||
    v.includes('автоном')
  );
};

const OPTION_I18N: Record<string, { ru: string; en: string; kk: string }> = {
  State: { ru: 'Государственная', en: 'State', kk: 'Мемлекеттік' },
  Private: { ru: 'Частная', en: 'Private', kk: 'Жеке' },
  International: { ru: 'Международная', en: 'International', kk: 'Халықаралық' },
  Autonomous: { ru: 'Автономная', en: 'Autonomous', kk: 'Автономды' },
  Almaty: { ru: 'Алматы', en: 'Almaty', kk: 'Алматы' },
  Almaly: { ru: 'Алмалы', en: 'Almaly', kk: 'Алмалы' },
  Auezov: { ru: 'Ауэзов', en: 'Auezov', kk: 'Әуезов' },
  Bostandyk: { ru: 'Бостандык', en: 'Bostandyk', kk: 'Бостандық' },
  Zhetysu: { ru: 'Жетысу', en: 'Zhetysu', kk: 'Жетісу' },
  Medeu: { ru: 'Медеу', en: 'Medeu', kk: 'Медеу' },
  Nauryzbay: { ru: 'Наурызбай', en: 'Nauryzbay', kk: 'Наурызбай' },
  Astana: { ru: 'Астана', en: 'Astana', kk: 'Астана' },
  'Almaty District': { ru: 'Алматы', en: 'Almaty District', kk: 'Алматы' },
  Baikonyr: { ru: 'Байконур', en: 'Baikonyr', kk: 'Байқоңыр' },
  Yesil: { ru: 'Есиль', en: 'Yesil', kk: 'Есіл' },
  Saryarka: { ru: 'Сарыарка', en: 'Saryarka', kk: 'Сарыарқа' },
  Nura: { ru: 'Нура', en: 'Nura', kk: 'Нұра' },
  Karaganda: { ru: 'Караганда', en: 'Karaganda', kk: 'Қарағанды' },
  City: { ru: 'Город', en: 'City', kk: 'Қала' },
  Maikuduk: { ru: 'Майкудук', en: 'Maikuduk', kk: 'Майқұдық' },
  'Yugo-Vostok': { ru: 'Юго-Восток', en: 'Yugo-Vostok', kk: 'Оңтүстік-Шығыс' },
  Prishakhtinsk: { ru: 'Пришахтинск', en: 'Prishakhtinsk', kk: 'Пришахтинск' },
  Sortirovka: { ru: 'Сортировка', en: 'Sortirovka', kk: 'Сортировка' },
  Kazakh: { ru: 'Казахский', en: 'Kazakh', kk: 'Қазақ тілі' },
  Russian: { ru: 'Русский', en: 'Russian', kk: 'Орыс тілі' },
  English: { ru: 'Английский', en: 'English', kk: 'Ағылшын тілі' },
  Chinese: { ru: 'Китайский', en: 'Chinese', kk: 'Қытай тілі' },
  French: { ru: 'Французский', en: 'French', kk: 'Француз тілі' },
  German: { ru: 'Немецкий', en: 'German', kk: 'Неміс тілі' },
  Mathematics: { ru: 'Математика', en: 'Mathematics', kk: 'Математика' },
  'English Language': { ru: 'Английский язык', en: 'English Language', kk: 'Ағылшын тілі' },
  Engineering: { ru: 'Инженерия', en: 'Engineering', kk: 'Инженерия' },
  'Artificial intelligence': { ru: 'Искусственный интеллект', en: 'Artificial intelligence', kk: 'Жасанды интеллект' },
  'Data analysis': { ru: 'Анализ данных', en: 'Data analysis', kk: 'Деректер талдауы' },
  Physics: { ru: 'Физика', en: 'Physics', kk: 'Физика' },
  Chemistry: { ru: 'Химия', en: 'Chemistry', kk: 'Химия' },
  Biology: { ru: 'Биология', en: 'Biology', kk: 'Биология' },
  Informatics: { ru: 'Информатика', en: 'Informatics', kk: 'Информатика' },
  'State program (Kazakhstan)': {
    ru: 'Госпрограмма (Казахстан)',
    en: 'State program (Kazakhstan)',
    kk: 'Мембағдарлама (Қазақстан)',
  },
  'Updated content': { ru: 'Обновленное содержание', en: 'Updated content', kk: 'Жаңартылған мазмұн' },
  'Integrated NIS program': { ru: 'Интегрированная программа НИШ', en: 'Integrated NIS program', kk: 'НЗМ кіріктірілген бағдарламасы' },
  Test: { ru: 'Тест', en: 'Test', kk: 'Тест' },
  Exam: { ru: 'Экзамен', en: 'Exam', kk: 'Емтихан' },
  Interview: { ru: 'Собеседование', en: 'Interview', kk: 'Сұхбат' },
  'Single shift': { ru: 'Одна смена', en: 'Single shift', kk: 'Бір ауысым' },
  'Two shifts': { ru: 'Две смены', en: 'Two shifts', kk: 'Екі ауысым' },
  Included: { ru: 'Включено', en: 'Included', kk: 'Қамтылған' },
  Available: { ru: 'Доступно', en: 'Available', kk: 'Қолжетімді' },
  Unavailable: { ru: 'Недоступно', en: 'Unavailable', kk: 'Қолжетімсіз' },
  Supported: { ru: 'Поддерживается', en: 'Supported', kk: 'Қолдау бар' },
  'Not supported': { ru: 'Не поддерживается', en: 'Not supported', kk: 'Қолдау жоқ' },
  Paid: { ru: 'Платное', en: 'Paid', kk: 'Ақылы' },
  Free: { ru: 'Бесплатное', en: 'Free', kk: 'Тегін' },
  'No meals': { ru: 'Без питания', en: 'No meals', kk: 'Тамақсыз' },
  paid: { ru: 'Платное', en: 'Paid', kk: 'Ақылы' },
  free: { ru: 'Бесплатное', en: 'Free', kk: 'Тегін' },
  'no meals': { ru: 'Без питания', en: 'No meals', kk: 'Тамақсыз' },
  Psychologist: { ru: 'Психолог', en: 'Psychologist', kk: 'Психолог' },
  'Speech therapist': { ru: 'Логопед', en: 'Speech therapist', kk: 'Логопед' },
  'Social worker': { ru: 'Социальный работник', en: 'Social worker', kk: 'Әлеуметтік қызметкер' },
  Nurse: { ru: 'Медсестра', en: 'Nurse', kk: 'Медбике' },
  'General School': { ru: 'Общеобразовательная', en: 'General', kk: 'Жалпы білім беретін' },
  'Autonomous School': { ru: 'Автономная школа', en: 'Autonomous school', kk: 'Автономды мектеп' },
  Gymnasium: { ru: 'Гимназия', en: 'Gymnasium', kk: 'Гимназия' },
  Lyceum: { ru: 'Лицей', en: 'Lyceum', kk: 'Лицей' },
  'Specialized School': { ru: 'Специализированная школа', en: 'Specialized school', kk: 'Мамандандырылған мектеп' },
  'International School': { ru: 'Международная школа', en: 'International school', kk: 'Халықаралық мектеп' },
  'Private General School': { ru: 'Общеобразовательная', en: 'General', kk: 'Жалпы білім беретін' },
  'Innovative School': { ru: 'Инновационная школа', en: 'Innovative school', kk: 'Инновациялық мектеп' },
  'Advanced Subjects School': { ru: 'Школа с углублённым изучением предметов', en: 'Advanced subjects school', kk: 'Пәндерді тереңдетіп оқытатын мектеп' },
  'Author School': { ru: 'Авторская школа', en: 'Author school', kk: 'Авторлық мектеп' },
  'Online School': { ru: 'Онлайн-школа / дистанционная школа', en: 'Online / distance school', kk: 'Онлайн / қашықтан оқыту мектебі' },
  'Boarding School': { ru: 'Школа-интернат', en: 'Boarding school', kk: 'Мектеп-интернат' },
};

const OPTION_ALIASES: Record<string, string> = {
  русский: 'Russian',
  'орыс тілі': 'Russian',
  англииский: 'English',
  английский: 'English',
  'ағылшын тілі': 'English',
  казахский: 'Kazakh',
  қазақша: 'Kazakh',
  'қазақ тілі': 'Kazakh',
  'госпрограмма (казахстан)': 'State program (Kazakhstan)',
  'мембағдарлама (қазақстан)': 'State program (Kazakhstan)',
  'обновленное содержание': 'Updated content',
  'жаңартылған мазмұн': 'Updated content',
  'интегрированная программа ниш': 'Integrated NIS program',
  'нзм кіріктірілген бағдарламасы': 'Integrated NIS program',
  test: 'Test',
  exam: 'Exam',
  interview: 'Interview',
  'single shift': 'Single shift',
  'two shifts': 'Two shifts',
};

const normalizeOptionKey = (value: string) => value.replace(/\s+/g, ' ').trim();

const localizeOption = (value: string, locale: 'ru' | 'en' | 'kk') => {
  const key = normalizeOptionKey(value);
  const aliasKey = OPTION_ALIASES[key.toLowerCase()] || key;
  const normalizedAliasKey = normalizeOptionKey(aliasKey);
  const match = OPTION_I18N[normalizedAliasKey];
  if (match) return match[locale];

  const lower = normalizedAliasKey.toLowerCase();
  const ciKey = Object.keys(OPTION_I18N).find((entry) => entry.toLowerCase() === lower);
  if (ciKey) return OPTION_I18N[ciKey][locale];

  if (lower === 'paid' || lower.includes('плат') || lower.includes('ақыл')) {
    return locale === 'en' ? 'Paid' : locale === 'kk' ? 'Ақылы' : 'Платное';
  }
  if (lower === 'free' || lower.includes('бесплат') || lower.includes('тегін')) {
    return locale === 'en' ? 'Free' : locale === 'kk' ? 'Тегін' : 'Бесплатное';
  }
  if (lower.includes('no meals') || lower.includes('без пит') || lower.includes('тамақсыз')) {
    return locale === 'en' ? 'No meals' : locale === 'kk' ? 'Тамақсыз' : 'Без питания';
  }
  if (
    lower.includes('not included in tuition') ||
    lower.includes('не включено в стоимость') ||
    lower.includes('құнына кірмейді')
  ) {
    return locale === 'en'
      ? 'Not included in tuition'
      : locale === 'kk'
        ? 'Құнына кірмейді'
        : 'Не включено в стоимость';
  }

  return value;
};

const localizeCsv = (value: string, locale: 'ru' | 'en' | 'kk') =>
  Array.from(
    new Map(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => localizeOption(item, locale).trim())
        .filter(Boolean)
        .map((item) => [item.toLowerCase(), item] as const)
    ).values()
  ).join(', ');

const localizeUniqueList = (value: unknown, locale: 'ru' | 'en' | 'kk') =>
  Array.from(
    new Map(
      toList(value)
        .map((item) => localizeOption(item, locale).trim())
        .filter(Boolean)
      .map((item) => [item.toLowerCase(), item] as const)
    ).values()
  );

const formatGradesSummary = (value: unknown) => {
  const raw = toList(value)
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim())
    .filter(Boolean);

  const numeric = new Set<number>();
  const special: string[] = [];

  for (const item of raw) {
    const normalized = item.replace(/\s+/g, '');
    const rangeMatch = normalized.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (Number.isFinite(start) && Number.isFinite(end) && start <= end) {
        for (let grade = start; grade <= end; grade += 1) numeric.add(grade);
        continue;
      }
    }

    const num = Number(normalized);
    if (Number.isFinite(num)) {
      numeric.add(num);
      continue;
    }

    if (!special.includes(item)) special.push(item);
  }

  const sorted = Array.from(numeric).sort((a, b) => a - b);
  let numericLabel = '';
  if (sorted.length) {
    const isContinuous = sorted.every((grade, index) => index === 0 || grade === sorted[index - 1] + 1);
    numericLabel = isContinuous && sorted.length > 2
      ? `${sorted[0]}-${sorted[sorted.length - 1]}`
      : sorted.join(', ');
  }

  return [...special, numericLabel].filter(Boolean).join(', ');
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

const normalizeTypeKey = (value: string): 'State' | 'Private' | '' => {
  const key = value.trim().toLowerCase();
  return TYPE_KEY_ALIASES[key] || '';
};

const formatCombinedType = (typeRaw: string, subtypeRaw: string, locale: 'ru' | 'en' | 'kk') => {
  const typeKey =
    toList(typeRaw)
      .map((item) => normalizeTypeKey(item))
      .find(Boolean) || normalizeTypeKey(typeRaw);
  if (!typeKey && !subtypeRaw.trim()) return '';
  const typeLabel = localizeOption(typeKey || typeRaw, locale);
  const subtypeLabel = localizeOption(subtypeRaw, locale);
  return subtypeLabel || typeLabel;
};

const formatMealsValue = (
  school: unknown,
  locale: 'ru' | 'en' | 'kk',
  fallback: string
) => {
  const statusRaw =
    toText(getIn(school, 'services.meals_status')) || toText(getIn(school, 'services.meals'));
  const status = statusRaw ? localizeOption(statusRaw, locale) : '';

  const timesRaw = toText(getIn(school, 'services.meals_times_per_day'));
  const timesCount = Number(timesRaw);
  const times =
    Number.isFinite(timesCount) && timesCount > 0
      ? locale === 'en'
        ? `${timesCount} times/day`
        : locale === 'kk'
          ? `күніне ${timesCount} рет`
          : `${timesCount} раза в день`
      : '';

  const freeUntilRaw = toText(getIn(school, 'services.meals_free_until_grade'));
  const freeUntil = freeUntilRaw
    ? locale === 'en'
      ? `free until grade ${freeUntilRaw}`
      : locale === 'kk'
        ? `${freeUntilRaw}-сыныпқа дейін тегін`
        : `бесплатно до ${freeUntilRaw} класса`
    : '';

  const notes =
    toText(getIn(school, `services.meals_notes.${locale}`)) ||
    toText(getIn(school, 'services.meals_notes.ru')) ||
    toText(getIn(school, 'services.meals_notes'));

  const mealsPrice = toText(getIn(school, 'services.meals_price')).trim();
  const mealsCurrency = toText(getIn(school, 'services.meals_currency')).trim() || 'KZT';
  const statusRawLower = statusRaw.toLowerCase();
  const isMealsPriceSeparate =
    statusRawLower.includes('not included in tuition') ||
    statusRawLower.includes('не включено в стоимость') ||
    statusRawLower.includes('құнына кірмейді');
  const mealsPriceText =
    mealsPrice && isMealsPriceSeparate
      ? locale === 'en'
        ? `${mealsPrice} ${mealsCurrency}`
        : locale === 'kk'
          ? `${mealsPrice} ${mealsCurrency}`
          : `${mealsPrice} ${mealsCurrency}`
      : '';

  const parts = [status, mealsPriceText, times, freeUntil, notes].filter(Boolean);
  return parts.length ? parts.join(' • ') : fallback;
};

const formatAfterSchoolValue = (
  school: unknown,
  locale: 'ru' | 'en' | 'kk',
  availableLabel: string,
  unavailableLabel: string
) => {
  const enabled = Boolean(getIn(school, 'services.after_school'));
  if (!enabled) return unavailableLabel;
  const until = toText(getIn(school, 'services.after_school_until')).trim();
  if (!until) return availableLabel;
  return locale === 'en'
    ? `${availableLabel} until ${until}`
    : locale === 'kk'
      ? `${availableLabel} ${until}-ге дейін`
      : `${availableLabel} до ${until}`;
};

export default function ParentSchoolDetailsPage() {
  const { locale } = useParentLocale();
  const [guest] = useState(() => isGuestMode());
  const lastTrackedSchoolIdRef = useRef('');
  const ui = {
    back: locale === 'en' ? 'Back' : locale === 'kk' ? 'Артқа' : 'Назад',
    loading: locale === 'en' ? 'Loading...' : locale === 'kk' ? 'Жүктелуде...' : 'Загрузка...',
    notFound: locale === 'en' ? 'School not found.' : locale === 'kk' ? 'Мектеп табылмады.' : 'Школа не найдена.',
    type: locale === 'en' ? 'Type' : locale === 'kk' ? 'Түрі' : 'Тип',
    price: locale === 'en' ? 'Price' : locale === 'kk' ? 'Бағасы' : 'Цена',
    address: locale === 'en' ? 'Address' : locale === 'kk' ? 'Мекенжай' : 'Адрес',
    city: locale === 'en' ? 'City' : locale === 'kk' ? 'Қала' : 'Город',
    district: locale === 'en' ? 'District' : locale === 'kk' ? 'Аудан' : 'Район',
    clubs: locale === 'en' ? 'Clubs and sections' : locale === 'kk' ? 'Үйірмелер мен секциялар' : 'Кружки и секции',
    consultationCta:
      locale === 'en'
        ? 'Book a consultation'
        : locale === 'kk'
          ? 'Кеңеске жазылу'
          : 'Записаться на консультацию',
    consultationOpen:
      locale === 'en'
        ? 'Request a consultation with the school'
        : locale === 'kk'
          ? 'Мектеппен кеңес алуға өтінім қалдыру'
          : 'Оставить заявку на консультацию со школой',
    consultationHint:
      locale === 'en'
        ? 'The school will receive your contact details in its CRM.'
        : locale === 'kk'
          ? 'Мектеп сіздің байланыс деректеріңізді өз CRM жүйесінде көреді.'
          : 'Школа получит ваши контакты в своём разделе заявок.',
    consultationParentName: locale === 'en' ? 'Parent name' : locale === 'kk' ? 'Ата-ана аты' : 'Имя родителя',
    consultationParentPhone: locale === 'en' ? 'Phone number' : locale === 'kk' ? 'Телефон нөмірі' : 'Номер телефона',
    consultationParentEmail: locale === 'en' ? 'Email' : locale === 'kk' ? 'Email' : 'Email',
    consultationChildName: locale === 'en' ? 'Child name' : locale === 'kk' ? 'Бала аты' : 'Имя ребенка',
    consultationChildGrade: locale === 'en' ? 'Child grade' : locale === 'kk' ? 'Бала сыныбы' : 'Класс ребенка',
    consultationComment:
      locale === 'en' ? 'Comment' : locale === 'kk' ? 'Түсініктеме' : 'Комментарий',
    consultationTypeLabel:
      locale === 'en' ? 'Request type' : locale === 'kk' ? 'Өтінім түрі' : 'Тип запроса',
    consultationSubmit:
      locale === 'en' ? 'Send request' : locale === 'kk' ? 'Өтінім жіберу' : 'Отправить заявку',
    consultationSending:
      locale === 'en' ? 'Sending...' : locale === 'kk' ? 'Жіберілуде...' : 'Отправляем...',
    consultationSuccess:
      locale === 'en'
        ? 'Request sent. The school will contact you.'
        : locale === 'kk'
          ? 'Өтінім жіберілді. Мектеп сізбен байланысады.'
          : 'Заявка отправлена. Школа свяжется с вами.',
    consultationClose: locale === 'en' ? 'Close' : locale === 'kk' ? 'Жабу' : 'Скрыть',
    consultationFirstMeeting:
      locale === 'en' ? 'First meeting' : locale === 'kk' ? 'Алғашқы кездесу' : 'Первая консультация',
    consultationTransfer:
      locale === 'en' ? 'Transfer' : locale === 'kk' ? 'Ауысу' : 'Перевод в школу',
    consultationLearningQuestion:
      locale === 'en'
        ? 'Learning question'
        : locale === 'kk'
          ? 'Оқу туралы сұрақ'
          : 'Вопрос по обучению',
    consultationOther: locale === 'en' ? 'Other' : locale === 'kk' ? 'Басқа' : 'Другое',
    schoolPrograms: locale === 'en' ? 'Study programs' : locale === 'kk' ? 'Оқу бағдарламалары' : 'Учебные программы',
    programInfo: locale === 'en' ? 'Program information' : locale === 'kk' ? 'Бағдарлама туралы' : 'Информация о программе',
    socialEmpty: locale === 'en' ? 'No social links provided.' : locale === 'kk' ? 'Әлеуметтік желілер көрсетілмеген.' : 'Социальные сети не указаны.',
    noReviews: locale === 'en' ? 'No reviews' : locale === 'kk' ? 'Пікір жоқ' : 'Нет отзывов',
    reviewsWord: locale === 'en' ? 'reviews' : locale === 'kk' ? 'пікір' : 'отзывов',
    ratingsWord: locale === 'en' ? 'ratings' : locale === 'kk' ? 'бағалау' : 'оценок',
    leaveReview: locale === 'en' ? 'Leave review' : locale === 'kk' ? 'Пікір қалдыру' : 'Оставить отзыв',
    reviewClose: locale === 'en' ? 'Close form' : locale === 'kk' ? 'Форманы жабу' : 'Скрыть форму',
    reviewExperienceType:
      locale === 'en' ? 'Experience type' : locale === 'kk' ? 'Тәжірибе түрі' : 'Тип опыта',
    reviewExperienceFreshness:
      locale === 'en'
        ? 'How recent is this experience?'
        : locale === 'kk'
          ? 'Бұл тәжірибе қаншалықты жаңа?'
          : 'Насколько свежий этот опыт?',
    reviewCurrentParent:
      locale === 'en'
        ? 'Child studies there now'
        : locale === 'kk'
          ? 'Бала қазір осы мектепте оқиды'
          : 'Ребенок учится там сейчас',
    reviewFormerParent:
      locale === 'en'
        ? 'Child studied there before'
        : locale === 'kk'
          ? 'Бала бұрын осы мектепте оқыған'
          : 'Ребенок учился там раньше',
    reviewApplicantParent:
      locale === 'en'
        ? 'Applied but did not continue'
        : locale === 'kk'
          ? 'Түсуге тырыстық, бірақ жалғастырмадық'
          : 'Поступали, но не продолжили',
    reviewConsultationOnly:
      locale === 'en'
        ? 'Only had consultation/contact'
        : locale === 'kk'
          ? 'Тек кеңес/байланыс болды'
          : 'Была только консультация/контакт',
    reviewOtherExperience:
      locale === 'en' ? 'Other experience' : locale === 'kk' ? 'Басқа тәжірибе' : 'Другой опыт',
    reviewFreshnessCurrent:
      locale === 'en'
        ? 'Current or within the last year'
        : locale === 'kk'
          ? 'Қазір немесе соңғы 1 жыл ішінде'
          : 'Сейчас или в течение последнего года',
    reviewFreshnessTwo:
      locale === 'en' ? '1-2 years ago' : locale === 'kk' ? '1-2 жыл бұрын' : '1-2 года назад',
    reviewFreshnessFive:
      locale === 'en' ? '2-5 years ago' : locale === 'kk' ? '2-5 жыл бұрын' : '2-5 лет назад',
    reviewFreshnessOlder:
      locale === 'en' ? 'More than 5 years ago' : locale === 'kk' ? '5 жылдан бұрын' : 'Более 5 лет назад',
    reviewTeaching:
      locale === 'en' ? 'Teaching quality' : locale === 'kk' ? 'Оқыту сапасы' : 'Качество обучения',
    reviewCommunication:
      locale === 'en'
        ? 'Communication with parents'
        : locale === 'kk'
          ? 'Ата-анамен коммуникация'
          : 'Коммуникация со школой',
    reviewSafety:
      locale === 'en' ? 'Safety' : locale === 'kk' ? 'Қауіпсіздік' : 'Безопасность',
    reviewAtmosphere:
      locale === 'en' ? 'Atmosphere' : locale === 'kk' ? 'Атмосфера' : 'Атмосфера',
    reviewValue:
      locale === 'en' ? 'Value for money' : locale === 'kk' ? 'Баға/сапа' : 'Цена/качество',
    reviewPositives:
      locale === 'en'
        ? 'What was really good?'
        : locale === 'kk'
          ? 'Не ұнады?'
          : 'Что действительно понравилось?',
    reviewConcerns:
      locale === 'en'
        ? 'What should parents know in advance?'
        : locale === 'kk'
          ? 'Ата-аналар нені алдын ала білуі керек?'
          : 'Что родителям стоит знать заранее?',
    reviewRecommendationFor:
      locale === 'en'
        ? 'Who would you recommend this school to?'
        : locale === 'kk'
          ? 'Бұл мектеп кімге көбірек сай келеді?'
          : 'Кому бы вы рекомендовали эту школу?',
    reviewComment:
      locale === 'en'
        ? 'Additional comment'
        : locale === 'kk'
          ? 'Қосымша пікір'
          : 'Дополнительный комментарий',
    reviewSubmit:
      locale === 'en'
        ? 'Send for moderation'
        : locale === 'kk'
          ? 'Модерацияға жіберу'
          : 'Отправить на модерацию',
    reviewSending:
      locale === 'en' ? 'Sending...' : locale === 'kk' ? 'Жіберілуде...' : 'Отправляем...',
    reviewSuccess:
      locale === 'en'
        ? 'Review sent. It will appear after moderation.'
        : locale === 'kk'
          ? 'Пікір жіберілді. Модерациядан кейін жарияланады.'
          : 'Отзыв отправлен. После модерации он появится в карточке.',
    reviewRequired:
      locale === 'en'
        ? 'Fill in all required fields and ratings.'
        : locale === 'kk'
          ? 'Міндетті өрістер мен бағаларды толтырыңыз.'
          : 'Заполните обязательные поля и оценки.',
    reviewSignIn:
      locale === 'en'
        ? 'Sign in to leave a review.'
        : locale === 'kk'
          ? 'Пікір қалдыру үшін кіріңіз.'
          : 'Войдите, чтобы оставить отзыв.',
    reviewBreakdownTitle:
      locale === 'en' ? 'Detailed rating' : locale === 'kk' ? 'Толық рейтинг' : 'Подробный рейтинг',
    reviewRatedBy:
      locale === 'en' ? 'Rated by' : locale === 'kk' ? 'Бағалағандар' : 'Оценили',
    noReviewsHint:
      locale === 'en'
        ? 'No reviews yet. Be the first to share your experience.'
        : locale === 'kk'
          ? 'Әзірге пікір жоқ. Алғашқы пікірді сіз қалдырыңыз.'
          : 'Пока нет отзывов. Будьте первым, кто поделится опытом.',
    allSubjects: locale === 'en' ? 'All subjects' : locale === 'kk' ? 'Барлық пәндер' : 'Все предметы',
    anyExperience: locale === 'en' ? 'Any experience' : locale === 'kk' ? 'Кез келген өтіл' : 'Любой стаж',
    allLanguages: locale === 'en' ? 'All languages' : locale === 'kk' ? 'Барлық тілдер' : 'Все языки',
    teachersEmpty: locale === 'en' ? 'Teachers are not added yet.' : locale === 'kk' ? 'Мұғалімдер әлі қосылмаған.' : 'Преподаватели пока не добавлены.',
    mediaAssets: locale === 'en' ? 'Media files' : locale === 'kk' ? 'Медиа файлдар' : 'Медиафайлы',
    photos: locale === 'en' ? 'Photos' : locale === 'kk' ? 'Фотосуреттер' : 'Фотографии',
    videos: locale === 'en' ? 'Videos' : locale === 'kk' ? 'Бейнелер' : 'Видео',
    accreditations: locale === 'en' ? 'Accreditations' : locale === 'kk' ? 'Аккредитациялар' : 'Аккредитация',
    document: locale === 'en' ? 'Document' : locale === 'kk' ? 'Құжат' : 'Документ',
    description: locale === 'en' ? 'Description' : locale === 'kk' ? 'Сипаттама' : 'Описание',
    available: locale === 'en' ? 'Available' : locale === 'kk' ? 'Қолжетімді' : 'Доступно',
    unavailable: locale === 'en' ? 'Unavailable' : locale === 'kk' ? 'Қолжетімсіз' : 'Недоступно',
    supported: locale === 'en' ? 'Supported' : locale === 'kk' ? 'Қолдау бар' : 'Поддерживается',
    notSupported: locale === 'en' ? 'Not supported' : locale === 'kk' ? 'Қолдау жоқ' : 'Не поддерживается',
    yes: locale === 'en' ? 'Yes' : locale === 'kk' ? 'Иә' : 'Да',
    no: locale === 'en' ? 'No' : locale === 'kk' ? 'Жоқ' : 'Нет',
    notSpecified: locale === 'en' ? 'Not specified' : locale === 'kk' ? 'Көрсетілмеген' : 'Не указано',
    priceComment: locale === 'en' ? 'Comment' : locale === 'kk' ? 'Түсініктеме' : 'Комментарий',
    priceFromTo: locale === 'en' ? 'Grades' : locale === 'kk' ? 'Сыныптар' : 'Классы',
    discounts: locale === 'en' ? 'Discounts' : locale === 'kk' ? 'Жеңілдіктер' : 'Скидки',
    grants: locale === 'en' ? 'Grants' : locale === 'kk' ? 'Гранттар' : 'Гранты',
    registrationFee:
      locale === 'en'
        ? 'Registration fee'
        : locale === 'kk'
          ? 'Тіркеу жарнасы'
          : 'Регистрационный взнос',
    paymentOptions:
      locale === 'en'
        ? 'Payment options'
        : locale === 'kk'
          ? 'Төлем тәсілдері'
          : 'Варианты оплаты',
    includedInTuition:
      locale === 'en'
        ? 'Included in tuition'
        : locale === 'kk'
          ? 'Құнына кіреді'
          : 'Что включено в стоимость',
    extraFees:
      locale === 'en'
        ? 'Paid separately'
        : locale === 'kk'
          ? 'Бөлек төленеді'
          : 'Что оплачивается отдельно',
    freePlaces:
      locale === 'en'
        ? 'Free places'
        : locale === 'kk'
          ? 'Тегін орындар'
          : 'Бесплатные места',
    funding:
      locale === 'en'
        ? 'Funding'
        : locale === 'kk'
          ? 'Қаржыландыру'
          : 'Финансирование',
    stateFunding:
      locale === 'en'
        ? 'State funding'
        : locale === 'kk'
          ? 'Мемлекеттік қаржыландыру'
          : 'Госфинансирование',
    selfFunding:
      locale === 'en'
        ? 'Self-funded'
        : locale === 'kk'
          ? 'Өзін-өзі қаржыландыру'
          : 'Самоокупаемость',
    prev: locale === 'en' ? 'Previous' : locale === 'kk' ? 'Алдыңғы' : 'Назад',
    next: locale === 'en' ? 'Next' : locale === 'kk' ? 'Келесі' : 'Вперед',
    entranceExam: locale === 'en' ? 'Entrance exam' : locale === 'kk' ? 'Түсу емтиханы' : 'Вступительный экзамен',
    admissionSubjects:
      locale === 'en' ? 'Admission subjects' : locale === 'kk' ? 'Түсу пәндері' : 'Предметы для поступления',
    admissionDeadline:
      locale === 'en' ? 'Application deadline' : locale === 'kk' ? 'Құжат тапсыру мерзімі' : 'Срок подачи документов',
    admissionStages:
      locale === 'en' ? 'Admission stages' : locale === 'kk' ? 'Қабылдау кезеңдері' : 'Этапы набора',
    successStories:
      locale === 'en' ? 'Graduate success stories' : locale === 'kk' ? 'Түлектердің жетістік тарихы' : 'Истории выпускников',
    admissionPage:
      locale === 'en' ? 'Admission' : locale === 'kk' ? 'Қабылдау' : 'Поступление',
    admissionHint:
      locale === 'en' ? 'Exam, dates, stages' : locale === 'kk' ? 'Емтихан, мерзім, кезеңдер' : 'Экзамен, сроки, этапы',
    admissionBlocks:
      locale === 'en' ? 'Scenarios' : locale === 'kk' ? 'Сценарийлер' : 'Сценарии',
    pridePage:
      locale === 'en' ? 'Our pride' : locale === 'kk' ? 'Біздің мақтанышымыз' : 'Наша гордость',
    prideHint:
      locale === 'en' ? 'Graduates and achievements' : locale === 'kk' ? 'Түлектер мен жетістіктер' : 'Выпускники и достижения',
    admittedTo: locale === 'en' ? 'Admitted to' : locale === 'kk' ? 'Түскен орны' : 'Поступил(а) в',
    schoolGpa:
      locale === 'en' ? 'School GPA' : locale === 'kk' ? 'Мектептегі орташа балл' : 'Средний балл в школе',
    achievements:
      locale === 'en' ? 'Achievements' : locale === 'kk' ? 'Жетістіктер' : 'Достижения',
    classSizeCards:
      locale === 'en' ? 'Class sizes' : locale === 'kk' ? 'Сынып көлемі' : 'Размер классов',
    averageShort: locale === 'en' ? 'Average' : locale === 'kk' ? 'Орташа' : 'Средний',
    primaryShort: locale === 'en' ? 'Primary' : locale === 'kk' ? 'Бастауыш' : 'Начальная',
    middleShort: locale === 'en' ? 'Middle' : locale === 'kk' ? 'Орта буын' : 'Средняя',
    highShort: locale === 'en' ? 'High' : locale === 'kk' ? 'Жоғары' : 'Старшая',
    guestGateTitle:
      locale === 'en'
        ? 'Full school card is available after sign in'
        : locale === 'kk'
          ? 'Толық мектеп картасы кіруден кейін ашылады'
          : 'Полная карточка школы доступна после входа',
    guestGateText:
      locale === 'en'
        ? 'Detailed information, map, clubs and extended sections are available only for registered users.'
        : locale === 'kk'
          ? 'Толық ақпарат, карта, үйірмелер және кеңейтілген бөлімдер тек тіркелген пайдаланушыларға қолжетімді.'
          : 'Подробная информация, карта, кружки и расширенные разделы доступны только зарегистрированным пользователям.',
    signIn: locale === 'en' ? 'Sign in' : locale === 'kk' ? 'Кіру' : 'Войти',
  };
  const params = useParams<{ schoolId: string }>();
  const schoolId = decodeURIComponent(String(params?.schoolId || ''));
  const [school, setSchool] = useState<SchoolRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [priceExpanded, setPriceExpanded] = useState(false);
  const [opened, setOpened] = useState<Record<string, boolean>>({
    education: true,
    basic_info: false,
    media: false,
    services: false,
    reviews: false,
    staff: false,
  });
  const [activeTeacher, setActiveTeacher] = useState<TeacherCard | null>(null);
  const [activeMedia, setActiveMedia] = useState<MediaViewerState | null>(null);
  const [activeProgram, setActiveProgram] = useState('');
  const [typeInfoOpen, setTypeInfoOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [consultationOpen, setConsultationOpen] = useState(false);
  const [consultationSaving, setConsultationSaving] = useState(false);
  const [consultationMessage, setConsultationMessage] = useState('');
  const [consultationError, setConsultationError] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [consultationDraft, setConsultationDraft] = useState<ConsultationDraft>({
    parentName: '',
    parentPhone: '',
    parentEmail: '',
    childName: '',
    childGrade: '',
    consultationType: 'schoolDetail.consultation.firstMeeting',
    comment: '',
  });
  const [reviewDraft, setReviewDraft] = useState<ReviewDraft>({
    experienceType: 'current_parent',
    experienceFreshness: 'current_year',
    teachingRating: '0',
    communicationRating: '0',
    safetyRating: '0',
    atmosphereRating: '0',
    valueRating: '0',
    positives: '',
    concerns: '',
    recommendationFor: '',
    comment: '',
  });

  useEffect(() => {
    let mounted = true;
    loadSchoolById(schoolId)
      .then((payload) => {
        if (!mounted) return;
        setSchool((payload?.data as SchoolRow) || null);
      })
      .catch(() => {
        if (!mounted) return;
        setSchool(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const media = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobileViewport(media.matches);
    update();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  useEffect(() => {
    const trackedSchoolId = String(school?.school_id || '').trim();
    if (!trackedSchoolId || lastTrackedSchoolIdRef.current === trackedSchoolId) return;
    lastTrackedSchoolIdRef.current = trackedSchoolId;
    void recordEngagementEvent({
      eventType: 'school_card_view',
      schoolId: trackedSchoolId,
      locale,
      source: 'school_card',
    }).catch(() => undefined);
  }, [locale, school?.school_id]);

  const trackedSchoolId = String(school?.school_id || '').trim();
  const canRequestConsultation = !guest;

  const name = pickFirstText(
    school,
    ['basic_info.display_name', 'basic_info.brand_name', 'basic_info.short_name', 'basic_info.name'],
    'Школа'
  );
  const city =
    localizeOption(
      toText(getIn(school, 'basic_info.city')) || toText(getIn(school, 'basic_info.district')) || 'Город',
      locale
    );
  const phone = formatKzPhone(toText(getIn(school, 'basic_info.phone'))) || 'Телефон не указан';
  const rating = String(getIn(school, 'system.rating') ?? '0.0');
  const reviews = String(getIn(school, 'system.reviews_count') ?? 0);
  const feedbackCount = Number(getIn(school, 'system.feedback_count') ?? 0);
  const ratingBreakdown = {
    teaching: Number(getIn(school, 'system.rating_breakdown.criteria.teaching') ?? 0),
    communication: Number(getIn(school, 'system.rating_breakdown.criteria.communication') ?? 0),
    safety: Number(getIn(school, 'system.rating_breakdown.criteria.safety') ?? 0),
    atmosphere: Number(getIn(school, 'system.rating_breakdown.criteria.atmosphere') ?? 0),
    value: Number(getIn(school, 'system.rating_breakdown.criteria.value') ?? 0),
  };
  const ratingBreakdownRows = [
    { label: ui.reviewTeaching, value: ratingBreakdown.teaching },
    { label: ui.reviewCommunication, value: ratingBreakdown.communication },
    { label: ui.reviewSafety, value: ratingBreakdown.safety },
    { label: ui.reviewAtmosphere, value: ratingBreakdown.atmosphere },
    { label: ui.reviewValue, value: ratingBreakdown.value },
  ].filter((row) => row.value > 0);
  const typeRaw = pickFirstText(school, ['basic_info.type'], ui.notSpecified);
  const subtypeRaw = pickFirstText(school, ['basic_info.school_subtype'], '');
  const type = formatCombinedType(typeRaw, subtypeRaw, locale) || localizeCsv(typeRaw, locale) || localizeOption(typeRaw, locale);
  const isPrivateSchool = isPrivateType(typeRaw);
  const consultationTypeOptions = [
    { value: 'schoolDetail.consultation.firstMeeting', label: ui.consultationFirstMeeting },
    { value: 'schoolDetail.consultation.transfer', label: ui.consultationTransfer },
    { value: 'schoolDetail.consultation.learningQuestion', label: ui.consultationLearningQuestion },
    { value: 'schoolDetail.consultation.other', label: ui.consultationOther },
  ];
  const gradeOptions = ['pre-k', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  const reviewExperienceOptions = [
    { value: 'current_parent', label: ui.reviewCurrentParent },
    { value: 'former_parent', label: ui.reviewFormerParent },
    { value: 'applicant_parent', label: ui.reviewApplicantParent },
    { value: 'consultation_only', label: ui.reviewConsultationOnly },
    { value: 'other', label: ui.reviewOtherExperience },
  ];
  const reviewFreshnessOptions = [
    { value: 'current_year', label: ui.reviewFreshnessCurrent },
    { value: 'within_2_years', label: ui.reviewFreshnessTwo },
    { value: 'within_5_years', label: ui.reviewFreshnessFive },
    { value: 'over_5_years', label: ui.reviewFreshnessOlder },
  ];
  const reviewRatingOptions = ['0', '1', '2', '3', '4', '5'];

  const translateConsultationError = (message: string) => {
    const normalized = String(message || '').trim();
    const fieldLabels =
      locale === 'en'
        ? {
            parentName: 'Parent name',
            parentPhone: 'Phone number',
            childName: 'Child name',
            childGrade: 'Child grade',
          }
        : locale === 'kk'
          ? {
              parentName: 'Ата-ана аты',
              parentPhone: 'Телефон нөмірі',
              childName: 'Бала аты',
              childGrade: 'Бала сыныбы',
            }
          : {
              parentName: 'Имя родителя',
              parentPhone: 'Номер телефона',
              childName: 'Имя ребенка',
              childGrade: 'Класс ребенка',
            };
    const requiredMatch = normalized.match(/^Field "([^"]+)" is required\.$/);
    if (requiredMatch) {
      const field = requiredMatch[1] as keyof typeof fieldLabels;
      const label = fieldLabels[field] || requiredMatch[1];
      return locale === 'en'
        ? `${label} is required.`
        : locale === 'kk'
          ? `«${label}» өрісін толтырыңыз.`
          : `Заполните поле «${label}».`;
    }
    if (normalized === 'A similar consultation request was sent recently. Please wait.') {
      return locale === 'en'
        ? 'A similar request was already sent recently. Please wait a bit.'
        : locale === 'kk'
          ? 'Ұқсас өтінім жақында жіберілген. Сәл күте тұрыңыз.'
          : 'Похожая заявка уже была отправлена недавно. Пожалуйста, подождите немного.';
    }
    if (normalized === 'Too many requests from this IP. Try later.') {
      return locale === 'en'
        ? 'Too many requests. Please try again later.'
        : locale === 'kk'
          ? 'Өтінім тым көп. Кейінірек қайталап көріңіз.'
          : 'Слишком много попыток. Попробуйте позже.';
    }
    if (normalized === 'Too many requests from this phone number. Try later.') {
      return locale === 'en'
        ? 'Too many requests from this number. Please try later.'
        : locale === 'kk'
          ? 'Бұл нөмірден өтінім тым көп. Кейінірек қайталап көріңіз.'
          : 'С этого номера уже слишком много заявок. Попробуйте позже.';
    }
    return normalized;
  };

  const submitReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (guest) {
      setReviewError(ui.reviewSignIn);
      return;
    }
    const ratingFields = [
      reviewDraft.teachingRating,
      reviewDraft.communicationRating,
      reviewDraft.safetyRating,
      reviewDraft.atmosphereRating,
      reviewDraft.valueRating,
    ];
    if (
      ratingFields.some((value) => {
        const num = Number(value || 0);
        return !(num >= 1 && num <= 5);
      }) ||
      (!reviewDraft.positives.trim() && !reviewDraft.concerns.trim() && !reviewDraft.comment.trim())
    ) {
      setReviewError(ui.reviewRequired);
      return;
    }
    try {
      setReviewSaving(true);
      setReviewError('');
      setReviewMessage('');
      await submitDirectSchoolReview(trackedSchoolId, {
        experienceType: reviewDraft.experienceType,
        experienceFreshness: reviewDraft.experienceFreshness,
        teachingRating: Number(reviewDraft.teachingRating),
        communicationRating: Number(reviewDraft.communicationRating),
        safetyRating: Number(reviewDraft.safetyRating),
        atmosphereRating: Number(reviewDraft.atmosphereRating),
        valueRating: Number(reviewDraft.valueRating),
        positives: reviewDraft.positives.trim(),
        concerns: reviewDraft.concerns.trim(),
        recommendationFor: reviewDraft.recommendationFor.trim(),
        comment: reviewDraft.comment.trim(),
      });
      const refreshed = await loadSchoolById(trackedSchoolId);
      setSchool((refreshed?.data as SchoolRow) || null);
      setReviewMessage(ui.reviewSuccess);
      setReviewOpen(false);
      setReviewDraft({
        experienceType: 'current_parent',
        experienceFreshness: 'current_year',
        teachingRating: '0',
        communicationRating: '0',
        safetyRating: '0',
        atmosphereRating: '0',
        valueRating: '0',
        positives: '',
        concerns: '',
        recommendationFor: '',
        comment: '',
      });
    } catch (error) {
      setReviewError((error as Error)?.message || ui.reviewRequired);
    } finally {
      setReviewSaving(false);
    }
  };

  const submitConsultation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trackedSchoolId) return;
    setConsultationSaving(true);
    setConsultationMessage('');
    setConsultationError('');
    try {
      await requestJson<{ data?: { id?: string } }>('/consultations', {
        method: 'POST',
        body: JSON.stringify({
          schoolId: trackedSchoolId,
          schoolName: name,
          parentName: consultationDraft.parentName.trim(),
          parentPhone: consultationDraft.parentPhone.trim(),
          parentEmail: consultationDraft.parentEmail.trim(),
          childName: consultationDraft.childName.trim(),
          childGrade: consultationDraft.childGrade.trim(),
          consultationType: consultationDraft.consultationType,
          comment: consultationDraft.comment.trim(),
        }),
      });
      setConsultationMessage(ui.consultationSuccess);
      setConsultationDraft({
        parentName: '',
        parentPhone: '',
        parentEmail: '',
        childName: '',
        childGrade: '',
        consultationType: 'schoolDetail.consultation.firstMeeting',
        comment: '',
      });
      setConsultationOpen(false);
    } catch (error) {
      setConsultationError(translateConsultationError((error as Error)?.message || 'Request failed'));
    } finally {
      setConsultationSaving(false);
    }
  };
  const subtypeInfoMap: Record<string, { ru: string; en: string; kk: string }> = {
    'General School': {
      ru: 'Базовая общеобразовательная школа по стандартной программе.',
      en: 'A general education school with a standard curriculum.',
      kk: 'Стандартты бағдарлама бойынша жалпы білім беретін мектеп.',
    },
    'Autonomous School': {
      ru: 'Школа с расширенной самостоятельностью в программе и управлении.',
      en: 'A school with increased autonomy in curriculum and management.',
      kk: 'Бағдарлама мен басқаруда дербестігі жоғары мектеп.',
    },
    Gymnasium: {
      ru: 'Усиленная академическая подготовка, обычно гуманитарный уклон.',
      en: 'Enhanced academic training, usually with a humanities focus.',
      kk: 'Көбіне гуманитарлық бағыттағы күшейтілген академиялық дайындық.',
    },
    Lyceum: {
      ru: 'Углубленное профильное обучение (чаще точные/естественные науки).',
      en: 'Advanced профиль learning, often in STEM directions.',
      kk: 'Көбіне нақты/жаратылыстану бағытындағы тереңдетілген бейіндік оқыту.',
    },
    'Specialized School': {
      ru: 'Школа с фокусом на конкретном направлении (языки, STEM, искусство и т.д.).',
      en: 'A school focused on a specific domain (languages, STEM, arts, etc.).',
      kk: 'Белгілі бір бағытқа (тіл, STEM, өнер және т.б.) маманданған мектеп.',
    },
    'International School': {
      ru: 'Обучение по международным стандартам и программам.',
      en: 'Education based on international standards and curricula.',
      kk: 'Халықаралық стандарттар мен бағдарламалар бойынша оқыту.',
    },
    'Private General School': {
      ru: 'Частная школа с общеобразовательной базовой программой.',
      en: 'A private school with a general education curriculum.',
      kk: 'Жалпы білім беретін бағдарламадағы жеке мектеп.',
    },
    'Innovative School': {
      ru: 'Школа с современными методиками, технологиями и проектным подходом.',
      en: 'A school using modern methods, technologies, and project-based learning.',
      kk: 'Заманауи әдістер, технологиялар және жобалық оқыту қолданатын мектеп.',
    },
    'Advanced Subjects School': {
      ru: 'Школа с углубленным изучением выбранных предметов.',
      en: 'A school with advanced study of selected subjects.',
      kk: 'Таңдалған пәндерді тереңдетіп оқытатын мектеп.',
    },
    'Author School': {
      ru: 'Школа, работающая по авторской образовательной концепции.',
      en: 'A school based on an author’s educational concept.',
      kk: 'Авторлық білім беру тұжырымдамасымен жұмыс істейтін мектеп.',
    },
    'Online School': {
      ru: 'Основной формат обучения — онлайн/дистанционный.',
      en: 'The primary learning format is online/distance.',
      kk: 'Оқытудың негізгі форматы — онлайн/қашықтан.',
    },
    'Boarding School': {
      ru: 'Школа с проживанием учащихся (интернатный формат).',
      en: 'A school with boarding/accommodation format.',
      kk: 'Оқушылар тұратын (интернат) форматтағы мектеп.',
    },
  };
  const typeInfoText = subtypeRaw ? (subtypeInfoMap[subtypeRaw]?.[locale] || '') : '';
  const cityLabel = localizeOption(pickFirstText(school, ['basic_info.city'], city), locale);
  const districtLabel = localizeOption(
    pickFirstText(school, ['basic_info.district'], ''),
    locale
  );
  const addressLabel = pickFirstText(
    school,
    ['basic_info.address', `basic_info.address.${locale}`, 'basic_info.address.ru'],
    ''
  );
  const additionalLocationsRaw = Array.isArray(getIn(school, 'basic_info.additional_locations'))
    ? (getIn(school, 'basic_info.additional_locations') as Array<Record<string, unknown>>)
    : [];
  const additionalAddresses = additionalLocationsRaw
    .map((item) => {
      const city = localizeOption(String(item?.city || '').trim(), locale);
      const district = localizeOption(String(item?.district || '').trim(), locale);
      const address =
        pickFirstText(
          item,
          ['address', `address.${locale}`, 'address.ru'],
          ''
        ) || '';
      return [city, district, address].filter(Boolean).join(', ');
    })
    .filter(Boolean);
  const hasBranchPoints = additionalLocationsRaw.some((item) => {
    const coordinates =
      item?.coordinates && typeof item.coordinates === 'object' ? item.coordinates : {};
    const branchLat = toNumber((coordinates as { latitude?: unknown }).latitude);
    const branchLng = toNumber((coordinates as { longitude?: unknown }).longitude);
    return branchLat !== null && branchLng !== null;
  });
  const price = formatSchoolFee(
    {
      finance: {
        fee_rules: getIn(school, 'finance.fee_rules'),
        tuition_monthly: getIn(school, 'finance.tuition_monthly'),
        monthly_fee: getIn(school, 'finance.monthly_fee'),
        monthly_fee_by_grade: getIn(school, 'finance.monthly_fee_by_grade'),
        price_monthly: getIn(school, 'finance.price_monthly'),
      },
      basic_info: {
        price: getIn(school, 'basic_info.price'),
      },
    },
    locale,
    locale === 'en' ? 'On request' : locale === 'kk' ? 'Сұраныс бойынша' : 'По запросу'
  );
  const feeRules = buildFeeRulesFromFinance({
    fee_rules: getIn(school, 'finance.fee_rules'),
    monthly_fee_by_grade: getIn(school, 'finance.monthly_fee_by_grade'),
    monthly_fee: getIn(school, 'finance.monthly_fee'),
    tuition_monthly: getIn(school, 'finance.tuition_monthly'),
    price_monthly: getIn(school, 'finance.price_monthly'),
  });
  const financeComment = pickLocalizedText(school, 'finance.comment', locale, '');
  const financeDiscounts = pickLocalizedText(school, 'finance.discounts_info', locale, '');
  const financeGrants = pickLocalizedText(school, 'finance.grants_info', locale, '');
  const legacyDiscountsGrants = pickFirstText(school, ['finance.grants_discounts'], '');
  const registrationFeeRaw = toText(getIn(school, 'finance.registration_fee')).trim();
  const registrationFeeCurrency =
    toText(getIn(school, 'finance.registration_fee_currency')).trim() || 'KZT';
  const registrationFee =
    registrationFeeRaw && Number(registrationFeeRaw.replace(/\s+/g, '').replace(',', '.'))
      ? `${Number(registrationFeeRaw.replace(/\s+/g, '').replace(',', '.')).toLocaleString('ru-RU')} ${registrationFeeCurrency === 'KZT' ? '₸' : registrationFeeCurrency === 'USD' ? '$' : registrationFeeCurrency === 'EUR' ? '€' : registrationFeeCurrency}`
      : registrationFeeRaw
        ? `${registrationFeeRaw} ${registrationFeeCurrency === 'KZT' ? '₸' : registrationFeeCurrency === 'USD' ? '$' : registrationFeeCurrency === 'EUR' ? '€' : registrationFeeCurrency}`
        : '';
  const paymentOptionLabels: Record<string, string> = {
    'Per month': locale === 'en' ? 'Per month' : locale === 'kk' ? 'Айына' : 'В месяц',
    'Per semester': locale === 'en' ? 'Per semester' : locale === 'kk' ? 'Семестрге' : 'В семестр',
    'Per year': locale === 'en' ? 'Per year' : locale === 'kk' ? 'Жылына' : 'В год',
    'In installments':
      locale === 'en' ? 'In installments' : locale === 'kk' ? 'Бірнеше траншпен' : 'Несколькими траншами',
  };
  const paymentOptions = Array.from(
    new Set(
      toList(getIn(school, 'finance.payment_options')).map((item) => paymentOptionLabels[item] || item)
    )
  ).filter(Boolean);
  const includedInTuition = pickLocalizedText(school, 'finance.included_in_tuition', locale, '');
  const extraFees = pickLocalizedText(school, 'finance.extra_fees', locale, '');
  const fundingItems = [
    getIn(school, 'finance.funding_state') ? ui.stateFunding : '',
    getIn(school, 'finance.funding_self') ? ui.selfFunding : '',
  ].filter(Boolean);
  const hasFreePlaces = getIn(school, 'finance.free_places') === true;
  const financeMetaCards = [
    registrationFee ? { label: ui.registrationFee, value: registrationFee } : null,
    paymentOptions.length ? { label: ui.paymentOptions, value: paymentOptions.join(' • ') } : null,
    includedInTuition ? { label: ui.includedInTuition, value: includedInTuition } : null,
    extraFees ? { label: ui.extraFees, value: extraFees } : null,
    fundingItems.length ? { label: ui.funding, value: fundingItems.join(' • ') } : null,
    hasFreePlaces ? { label: ui.freePlaces, value: ui.yes } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;
  const image = pickImage(school);
  const lat = toNumber(getIn(school, 'basic_info.coordinates.latitude'));
  const lng = toNumber(getIn(school, 'basic_info.coordinates.longitude'));
  const hasMap = (lat !== null && lng !== null) || hasBranchPoints;
  const mapSrc = school?.school_id
    ? `/parent/schools/map?focus=${encodeURIComponent(String(school.school_id))}&back=${encodeURIComponent(`/parent/schools/${encodeURIComponent(String(school.school_id))}`)}&embed=1`
    : '';
  const fullMapHref = school?.school_id
    ? `/parent/schools/map?focus=${encodeURIComponent(String(school.school_id))}&back=${encodeURIComponent(`/parent/schools/${encodeURIComponent(String(school.school_id))}`)}`
    : '/parent/schools/map';
  const description = pickFirstText(school, ['basic_info.description', 'basic_info.description.ru'], '');
  const reviewItems = [
    { label: locale === 'en' ? 'Rating' : locale === 'kk' ? 'Рейтинг' : 'Рейтинг', value: rating },
    { label: locale === 'en' ? 'Reviews count' : locale === 'kk' ? 'Пікір саны' : 'Количество отзывов', value: reviews },
  ];
  const phoneDigits = phone.replaceAll(/[^\d]/g, '');
  const whatsappValue = formatKzPhone(pickFirstText(school, ['basic_info.whatsapp_phone']));
  const whatsappDigits = whatsappValue.replaceAll(/[^\d]/g, '');
  const extraPhonesSource = getIn(school, 'basic_info.phones');
  const extraPhoneItems = (Array.isArray(extraPhonesSource) ? (extraPhonesSource as any[]) : [])
    .map((item: any) => {
      const value = formatKzPhone(toText(item?.number));
      const digits = value.replaceAll(/[^\d]/g, '');
      return {
        label: toText(item?.label) || (locale === 'en' ? 'Phone' : locale === 'kk' ? 'Телефон' : 'Телефон'),
        value,
        href: isMobileViewport && digits ? `tel:${digits}` : undefined,
      };
    })
    .filter((item: { value: string }) => item.value);
  const contactItems: ContactItem[] = [
    {
      label: locale === 'en' ? 'Phone' : locale === 'kk' ? 'Телефон' : 'Телефон',
      value: phone,
      href: isMobileViewport && phoneDigits ? `tel:${phoneDigits}` : undefined,
    },
    {
      label: 'WhatsApp',
      value: whatsappValue,
      href: whatsappDigits ? `https://wa.me/${whatsappDigits}` : undefined,
    },
    { label: 'Email', value: pickFirstText(school, ['basic_info.email']) },
    {
      label: locale === 'en' ? 'Website' : locale === 'kk' ? 'Сайт' : 'Сайт',
      value: pickFirstText(school, ['basic_info.website']),
      href: toExternalUrl(pickFirstText(school, ['basic_info.website'])),
    },
    ...extraPhoneItems,
  ].filter((item) => item.value);
  const visibleAdditionalAddresses = additionalAddresses.slice(0, 1);
  const totalAddressCount = (addressLabel ? 1 : 0) + visibleAdditionalAddresses.length;
  const factAddressRows = [
    ...(addressLabel
      ? [
          {
            label:
              totalAddressCount <= 1
                ? ui.address
                : locale === 'en'
                  ? 'Branch 1'
                  : locale === 'kk'
                    ? '1-филиал'
                    : 'Филиал 1',
            value: addressLabel,
          },
        ]
      : []),
    ...visibleAdditionalAddresses.map((value, index) => ({
      label:
        locale === 'en'
          ? `Branch ${index + 2}`
          : locale === 'kk'
            ? `${index + 2}-филиал`
            : `Филиал ${index + 2}`,
      value,
    })),
  ];
  const contactRows = [
    ...(addressLabel
      ? [
          {
            label:
              totalAddressCount <= 1
                ? ui.address
                : locale === 'en'
                  ? 'Branch 1'
                  : locale === 'kk'
                    ? '1-филиал'
                    : 'Филиал 1',
            value: addressLabel,
          },
        ]
      : []),
    ...visibleAdditionalAddresses.map((value, index) => ({
      label:
        locale === 'en'
          ? `Branch ${index + 2}`
          : locale === 'kk'
            ? `${index + 2}-филиал`
            : `Филиал ${index + 2}`,
      value,
    })),
    ...contactItems.map((item) => ({ label: item.label, value: item.value })),
  ];
  const addressRows = contactRows.filter((row) => {
    const normalized = String(row.label || '').toLowerCase();
    return normalized.includes('адрес') || normalized.includes('branch') || normalized.includes('филиал');
  });
  const otherContactRows = contactRows.filter((row) => !addressRows.includes(row));
  const educationLanguages = localizeUniqueList(getIn(school, 'education.languages'), locale);
  const educationPrograms = Array.from(
    new Set(
      [
        ...toList(getIn(school, 'education.curricula.national')),
        ...toList(getIn(school, 'education.curricula.international')),
        ...toList(getIn(school, 'education.curricula.additional')),
      ]
        .map((item) => localizeOption(item, locale).trim())
        .filter(Boolean)
    )
  );
  const entranceRequired = Boolean(getIn(school, 'education.entrance_exam.required'));
  const admissionRules = useMemo(
    () => normalizeAdmissionRules(school),
    [school]
  );
  const entranceFormat = localizeOption(
    pickFirstText(
      school,
      ['education.entrance_exam.format_other', 'education.entrance_exam.format'],
      ''
    ),
    locale
  );
  const admissionSubjects = localizeCsv(
    pickFirstText(
      school,
      ['education.entrance_exam.subjects', 'education.entrance_exam.subjects_other'],
      ''
    ),
    locale
  );
  const educationGrades = localizeCsv(
    formatGradesSummary(pickFirstText(school, ['education.grades'], '')),
    locale
  );
  const admissionHintValue = useMemo(() => {
    if (!admissionRules.length) return ui.admissionHint;
    const labels = admissionRules
      .slice(0, 2)
      .map((rule) => formatAdmissionGradeLabel(rule, locale))
      .filter(Boolean);
    const extraCount = Math.max(0, admissionRules.length - labels.length);
    const suffix = extraCount > 0 ? ` +${extraCount}` : '';
    return `${ui.admissionBlocks}: ${labels.join(', ')}${suffix}`;
  }, [admissionRules, locale, ui.admissionBlocks, ui.admissionHint]);
  const shiftMode = localizeOption(
    pickFirstText(school, ['education.learning_conditions.shift_mode'], ''),
    locale
  );
  const homeworkFormat = pickFirstText(
    school,
    ['education.learning_conditions.homework_format'],
    ''
  );
  const assessmentFormat = pickFirstText(
    school,
    ['education.learning_conditions.assessment_format'],
    ''
  );
  const digitalPlatforms = localizeCsv(
    pickFirstText(school, ['education.learning_conditions.digital_platforms'], ''),
    locale
  );
  const classSizePrimary = pickFirstText(
    school,
    ['education.learning_conditions.class_size_primary'],
    ''
  );
  const classSizeMiddle = pickFirstText(
    school,
    ['education.learning_conditions.class_size_middle'],
    ''
  );
  const classSizeHigh = pickFirstText(
    school,
    ['education.learning_conditions.class_size_high'],
    ''
  );
  const educationItems = [
    { label: locale === 'en' ? 'Languages' : locale === 'kk' ? 'Тілдер' : 'Языки', value: educationLanguages.join(', ') || pickFirstText(school, ['education.languages'], ui.notSpecified) },
    {
      label: locale === 'en' ? 'Grades' : locale === 'kk' ? 'Сыныптар' : 'Классы',
      value: educationGrades,
    },
    {
      label: locale === 'en' ? 'Advanced subjects' : locale === 'kk' ? 'Тереңдетілген пәндер' : 'Углубленные предметы',
      value: localizeCsv(
        pickFirstText(school, ['education.advanced_subjects', 'education.advanced_subjects_other.ru'], ui.notSpecified),
        locale
      ),
    },
    { label: locale === 'en' ? 'Average class size' : locale === 'kk' ? 'Сыныптың орташа көлемі' : 'Средний размер класса', value: pickFirstText(school, ['education.average_class_size'], '—') },
    {
      label: locale === 'en' ? 'Shift mode' : locale === 'kk' ? 'Оқу ауысымы' : 'Сменность обучения',
      value: shiftMode,
    },
    {
      label: locale === 'en' ? 'Homework format' : locale === 'kk' ? 'Үй жұмысының форматы' : 'Формат домашней работы',
      value: homeworkFormat,
    },
    {
      label: locale === 'en' ? 'Assessment format' : locale === 'kk' ? 'Бағалау форматы' : 'Формат оценивания',
      value: assessmentFormat,
    },
    {
      label: locale === 'en' ? 'Digital platforms' : locale === 'kk' ? 'Цифрлық платформалар' : 'Цифровые платформы',
      value: digitalPlatforms,
    },
  ];
  const classSizeRows = [
    {
      label: ui.averageShort,
      value: pickFirstText(school, ['education.average_class_size'], ''),
    },
  ].filter((item) => item.value && item.value.trim());
  const educationRows = educationItems.filter(
    (item) =>
      item.value &&
      item.value.trim() &&
      item.value !== ui.notSpecified &&
      item.value !== '—' &&
      ![
        locale === 'en' ? 'Average class size' : locale === 'kk' ? 'Сыныптың орташа көлемі' : 'Средний размер класса',
        ui.entranceExam,
      ].includes(item.label)
  );
  const studentSuccessStories: StudentSuccessStory[] = Array.isArray(
    getIn(school, 'education.results.student_success_stories')
  )
    ? (getIn(school, 'education.results.student_success_stories') as Array<Record<string, unknown>>)
        .map((item) => ({
          student_name: toText(item.student_name),
          admitted_to: toText(item.admitted_to),
          ent_score: toText(item.ent_score),
          ielts_score: toText(item.ielts_score),
          sat_score: toText(item.sat_score),
          school_average_score: toText(item.school_average_score),
          achievements: toText(item.achievements),
          admission_subjects: localizeCsv(toText(item.admission_subjects), locale),
          application_deadline: toText(item.application_deadline),
          student_photo: toText(item.student_photo),
        }))
        .filter(
          (item) =>
            item.student_name ||
            item.admitted_to ||
            item.ent_score ||
            item.ielts_score ||
            item.sat_score ||
            item.school_average_score ||
            item.achievements ||
            item.admission_subjects ||
            item.application_deadline ||
            item.student_photo
        )
    : [];
  const teamRows = [
    {
      label: locale === 'en' ? 'Principal' : locale === 'kk' ? 'Директор' : 'Директор',
      value: pickFirstText(school, ['basic_info.team.principal']),
    },
    {
      label: locale === 'en' ? 'Deputy principal' : locale === 'kk' ? 'Директор орынбасары' : 'Зам. директора',
      value: pickFirstText(school, ['basic_info.team.deputy_principal']),
    },
    {
      label: locale === 'en' ? 'Class curators' : locale === 'kk' ? 'Сынып кураторлары' : 'Кураторы классов',
      value: getIn(school, 'basic_info.team.class_curators_enabled') ? ui.yes : '',
    },
    {
      label: locale === 'en' ? 'Curator format' : locale === 'kk' ? 'Куратор форматы' : 'Формат кураторства',
      value: localizeCuratorFormat(
        pickFirstText(school, ['basic_info.team.class_curators_format']),
        locale
      ),
    },
    {
      label: locale === 'en' ? 'Curator comment' : locale === 'kk' ? 'Куратор түсіндірмесі' : 'Комментарий по кураторам',
      value: pickFirstText(
        school,
        ['basic_info.team.class_curators_comment', 'basic_info.team.class_curators'],
        ''
      ),
    },
  ].filter((item) => item.value);
  const personnelRows = [
    {
      label: locale === 'en' ? 'Psychologist' : locale === 'kk' ? 'Психолог' : 'Психолог',
      value: getIn(school, 'services.psychologists') ? ui.yes : '',
    },
    {
      label: locale === 'en' ? 'Speech therapist' : locale === 'kk' ? 'Логопед' : 'Логопед',
      value: getIn(school, 'services.speech_therapists') ? ui.yes : '',
    },
    {
      label: locale === 'en' ? 'Defectologist' : locale === 'kk' ? 'Дефектолог' : 'Дефектолог',
      value: getIn(school, 'services.defectologists') ? ui.yes : '',
    },
    {
      label: locale === 'en' ? 'Special educator' : locale === 'kk' ? 'Арнайы педагог' : 'Спецпедагог',
      value: getIn(school, 'services.special_educators') ? ui.yes : '',
    },
    {
      label: locale === 'en' ? 'Tutor' : locale === 'kk' ? 'Тьютор' : 'Тьютор',
      value: getIn(school, 'services.tutors') ? ui.yes : '',
    },
    {
      label: locale === 'en' ? 'Social worker' : locale === 'kk' ? 'Әлеуметтік қызметкер' : 'Социальный работник',
      value: getIn(school, 'services.social_workers') ? ui.yes : '',
    },
    {
      label: locale === 'en' ? 'Nurse' : locale === 'kk' ? 'Медбике' : 'Медсестра',
      value: getIn(school, 'services.nurses') ? ui.yes : '',
    },
  ].filter((item) => item.value);
  const personnelChips = personnelRows.map((item) => item.label);
  const socialLinksRaw: Array<{ key: SocialKey; label: string; value: string; href: string }> = [
    {
      key: 'instagram',
      label: 'Instagram',
      value: pickFirstText(school, ['media.social_links.instagram']),
      href: toExternalUrl(pickFirstText(school, ['media.social_links.instagram'])),
    },
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      value: formatKzPhone(pickFirstText(school, ['basic_info.whatsapp_phone'])),
      href: `https://wa.me/${formatKzPhone(pickFirstText(school, ['basic_info.whatsapp_phone'])).replaceAll(/[^\d]/g, '')}`,
    },
    {
      key: 'telegram',
      label: 'Telegram',
      value: pickFirstText(school, ['media.social_links.telegram']),
      href: toExternalUrl(pickFirstText(school, ['media.social_links.telegram'])),
    },
    {
      key: 'tiktok',
      label: 'TikTok',
      value: pickFirstText(school, ['media.social_links.tiktok']),
      href: toExternalUrl(pickFirstText(school, ['media.social_links.tiktok'])),
    },
    {
      key: 'youtube',
      label: 'YouTube',
      value: pickFirstText(school, ['media.social_links.youtube']),
      href: toExternalUrl(pickFirstText(school, ['media.social_links.youtube'])),
    },
    {
      key: 'facebook',
      label: 'Facebook',
      value: pickFirstText(school, ['media.social_links.facebook']),
      href: toExternalUrl(pickFirstText(school, ['media.social_links.facebook'])),
    },
    {
      key: 'vk',
      label: 'VK',
      value: pickFirstText(school, ['media.social_links.vk']),
      href: toExternalUrl(pickFirstText(school, ['media.social_links.vk'])),
    },
    {
      key: 'linkedin',
      label: 'LinkedIn',
      value: pickFirstText(school, ['media.social_links.linkedin']),
      href: toExternalUrl(pickFirstText(school, ['media.social_links.linkedin'])),
    },
  ];
  const socialLinks = socialLinksRaw.filter((item) => item.value);
  const mediaPhotos = toList(getIn(school, 'media.photos'));
  const mediaVideos = toList(getIn(school, 'media.videos'));
  const mediaCertificates = toList(getIn(school, 'media.certificates'));
  const hasMediaAssets =
    mediaPhotos.length > 0 || mediaVideos.length > 0 || mediaCertificates.length > 0;
  const teachers: TeacherCard[] = Array.isArray(getIn(school, 'services.teaching_staff.members'))
    ? (getIn(school, 'services.teaching_staff.members') as Array<Record<string, unknown>>).map((item) => ({
        full_name: toText(item.full_name) || 'Преподаватель',
        position: toText(item.position),
        category: toText(item.category),
        subjects: toText(item.subjects),
        teaching_languages: toText(item.teaching_languages),
        exam_prep: toText(item.exam_prep),
        experience_years: toText(item.experience_years),
        bio: toText(item.bio) || toText((item.bio as Record<string, unknown>)?.ru),
        photo_url: toText(item.photo_url),
      }))
    : [];
  const hasTeamSection = teamRows.length > 0 || personnelRows.length > 0 || teachers.length > 0;
  const serviceCards: ServiceCard[] = [
    {
      label: locale === 'en' ? 'After-school care' : locale === 'kk' ? 'Ұзартылған күн' : 'Продленка',
      value: formatAfterSchoolValue(school, locale, ui.available, ui.unavailable),
      tone: getIn(school, 'services.after_school') ? ('positive' as const) : ('neutral' as const),
    },
    {
      label: locale === 'en' ? 'Meals' : locale === 'kk' ? 'Тамақтану' : 'Питание',
      value: formatMealsValue(school, locale, ui.notSpecified),
      tone: 'positive' as const,
    },
    {
      label: locale === 'en' ? 'Transport' : locale === 'kk' ? 'Көлік' : 'Транспорт',
      value: getIn(school, 'services.transport') ? ui.available : ui.unavailable,
      tone: getIn(school, 'services.transport') ? ('positive' as const) : ('neutral' as const),
    },
    {
      label: locale === 'en' ? 'Inclusive education' : locale === 'kk' ? 'Инклюзивті білім' : 'Инклюзивное обучение',
      value: getIn(school, 'services.inclusive_education') ? ui.supported : ui.notSupported,
      tone: getIn(school, 'services.inclusive_education') ? ('positive' as const) : ('neutral' as const),
    },
    {
      label: locale === 'en' ? 'Medical room' : locale === 'kk' ? 'Медкабинет' : 'Медкабинет',
      value: getIn(school, 'services.medical_office') ? ui.available : ui.unavailable,
      tone: getIn(school, 'services.medical_office') ? ('positive' as const) : ('neutral' as const),
    },
    {
      label: locale === 'en' ? 'Security' : locale === 'kk' ? 'Күзет' : 'Охрана',
      value: getIn(school, 'services.safety.security') ? ui.yes : ui.no,
      tone: getIn(school, 'services.safety.security') ? ('positive' as const) : ('neutral' as const),
    },
    {
      label: locale === 'en' ? 'Cameras' : locale === 'kk' ? 'Камералар' : 'Камеры',
      value: getIn(school, 'services.safety.cameras') ? ui.yes : ui.no,
      tone: getIn(school, 'services.safety.cameras') ? ('positive' as const) : ('neutral' as const),
    },
    {
      label: locale === 'en' ? 'Access control' : locale === 'kk' ? 'Кіруді бақылау' : 'Контроль доступа',
      value: getIn(school, 'services.safety.access_control') ? ui.yes : ui.no,
      tone: getIn(school, 'services.safety.access_control') ? ('positive' as const) : ('neutral' as const),
    },
  ].filter((item) => item.value && item.value !== ui.notSpecified);

  const programInfoCatalog: Record<string, { ru: ProgramDetails; en: ProgramDetails; kk: ProgramDetails }> = {
    state_program: {
      ru: {
        title: 'Госпрограмма (Казахстан)',
        summary: 'Государственный стандарт РК для общеобразовательных школ.',
        highlights: ['Базовые предметы по стандарту МОН', 'Единые требования к оцениванию', 'Баланс учебной нагрузки'],
      },
      en: {
        title: 'State Program (Kazakhstan)',
        summary: 'National curriculum standard for Kazakhstan schools.',
        highlights: ['Core subjects by national standard', 'Unified assessment approach', 'Balanced learning workload'],
      },
      kk: {
        title: 'Мемлекеттік бағдарлама (Қазақстан)',
        summary: 'ҚР мектептеріне арналған мемлекеттік оқу стандарты.',
        highlights: ['Негізгі пәндер ұлттық стандартпен', 'Бағалау талаптары бірізденген', 'Оқу жүктемесі теңгерілген'],
      },
    },
    updated_content: {
      ru: {
        title: 'Обновленное содержание',
        summary: 'Современная модель обучения с акцентом на навыки и практику.',
        highlights: ['Критическое мышление и проектная работа', 'Формативное оценивание', 'Развитие soft skills'],
      },
      en: {
        title: 'Updated Content',
        summary: 'Modern learning model focused on practical skills.',
        highlights: ['Critical thinking and project work', 'Formative assessment', 'Soft skills development'],
      },
      kk: {
        title: 'Жаңартылған мазмұн',
        summary: 'Дағды мен тәжірибеге бағытталған заманауи оқу моделі.',
        highlights: ['Сыни ойлау және жобалық жұмыс', 'Қалыптастырушы бағалау', 'Soft skills дамыту'],
      },
    },
    nis_integrated: {
      ru: {
        title: 'Интегрированная программа НИШ',
        summary: 'Комбинация национального и международного академического подхода.',
        highlights: ['Углубленная предметная подготовка', 'Сильный языковой трек', 'Подготовка к олимпиадам и вузам'],
      },
      en: {
        title: 'Integrated NIS Program',
        summary: 'Combined national and international academic approach.',
        highlights: ['Advanced subject preparation', 'Stronger language track', 'University and olympiad readiness'],
      },
      kk: {
        title: 'НЗМ кіріктірілген бағдарламасы',
        summary: 'Ұлттық және халықаралық академиялық тәсілді біріктіреді.',
        highlights: ['Пәндік дайындық тереңдетілген', 'Тілдік трек күшейтілген', 'Олимпиада және ЖОО дайындығы'],
      },
    },
    cambridge: {
      ru: {
        title: 'Cambridge',
        summary: 'Международная образовательная линейка Cambridge.',
        highlights: ['Primary, Lower Secondary, IGCSE, A-Level', 'Подготовка к международным экзаменам', 'Академический английский'],
      },
      en: {
        title: 'Cambridge',
        summary: 'International Cambridge curriculum pathway.',
        highlights: ['Primary, Lower Secondary, IGCSE, A-Level', 'International exam readiness', 'Academic English focus'],
      },
      kk: {
        title: 'Cambridge',
        summary: 'Cambridge халықаралық білім беру бағдарламасы.',
        highlights: ['Primary, Lower Secondary, IGCSE, A-Level', 'Халықаралық емтиханға дайындық', 'Академиялық ағылшын'],
      },
    },
  };
  const resolveProgramInfo = (programName: string): ProgramDetails => {
    const normalized = programName.toLowerCase().trim();
    let key = '';
    if (normalized.includes('госпрограмм') || normalized.includes('state program') || normalized.includes('мембағдарлам')) {
      key = 'state_program';
    } else if (normalized.includes('обновлен') || normalized.includes('updated content') || normalized.includes('жаңартылған')) {
      key = 'updated_content';
    } else if (normalized.includes('ниш') || normalized.includes('nis') || normalized.includes('интегрирован')) {
      key = 'nis_integrated';
    } else if (normalized.includes('cambridge') || normalized.includes('igcse') || normalized.includes('a-level')) {
      key = 'cambridge';
    }
    if (key && programInfoCatalog[key]) return programInfoCatalog[key][locale];
    return {
      title: programName,
      summary:
        locale === 'en'
          ? 'Program description is provided by the school.'
          : locale === 'kk'
            ? 'Бағдарлама сипаттамасын мектеп ұсынады.'
            : 'Описание этой программы добавляется школой.',
      highlights:
        locale === 'en'
          ? ['Learning format', 'Key subjects', 'Goals and outcomes']
          : locale === 'kk'
            ? ['Оқу форматы', 'Негізгі пәндер', 'Мақсаттар мен нәтижелер']
            : ['Формат обучения', 'Ключевые предметы', 'Цели и результаты'],
    };
  };
  const selectedProgramInfo = activeProgram ? resolveProgramInfo(activeProgram) : null;
  const activeMediaItems = activeMedia
    ? activeMedia.kind === 'photo'
      ? mediaPhotos
      : activeMedia.kind === 'video'
        ? mediaVideos
        : mediaCertificates
    : [];
  const activeMediaUrl =
    activeMedia && activeMediaItems.length
      ? activeMediaItems[activeMedia.index] || ''
      : '';
  const activeMediaTitle = activeMedia
    ? activeMedia.kind === 'photo'
      ? `${ui.photos} ${activeMedia.index + 1}`
      : activeMedia.kind === 'video'
        ? `${ui.videos} ${activeMedia.index + 1}`
        : `${ui.document} ${activeMedia.index + 1}`
    : '';
  const canNavigateMedia = activeMediaItems.length > 1;

  const navigateMedia = (direction: -1 | 1) => {
    if (!activeMedia || !activeMediaItems.length) return;
    const total = activeMediaItems.length;
    const nextIndex = (activeMedia.index + direction + total) % total;
    setActiveMedia({ ...activeMedia, index: nextIndex });
  };

  return (
    <div className="school-mobile-page">
      <div className="school-mobile-backrow">
        <Link href="/parent/schools" className="school-mobile-back">‹ {ui.back}</Link>
      </div>

      {loading ? <p className="muted">{ui.loading}</p> : null}
      {!loading && !school ? <p className="muted">{ui.notFound}</p> : null}

      {school ? (
        <div className="school-mobile-stack">
          <section className="school-mobile-hero">
            {image ? (
              <Image src={image} alt={name} className="school-mobile-image" width={156} height={156} unoptimized />
            ) : (
              <div className="school-image-placeholder large">{name.slice(0, 1).toUpperCase() || 'Ш'}</div>
            )}
            <p className="school-mobile-type">{type}</p>
            <h1 className="school-mobile-name">{name}</h1>
            <p className="school-mobile-city">{cityLabel}</p>
          </section>
          <section className="school-mobile-facts">
            {typeInfoText ? (
              <ExpandableFactRow
                icon="type"
                label={ui.type}
                value={type}
                open={typeInfoOpen}
                onToggle={() => setTypeInfoOpen((prev) => !prev)}
              >
                <p className="muted" style={{ margin: 0, lineHeight: 1.45 }}>{typeInfoText}</p>
              </ExpandableFactRow>
            ) : (
              <FactRow icon="type" label={ui.type} value={type} />
            )}
            {isPrivateSchool ? (
              <ExpandableFactRow
                icon="price"
                label={ui.price}
                value={<span className={guest ? 'guest-price-blur' : ''}>{price}</span>}
                open={priceExpanded}
                onToggle={() =>
                  setPriceExpanded((prev) => {
                    if (!prev && trackedSchoolId) {
                      void recordEngagementEvent({
                        eventType: 'price_open',
                        schoolId: trackedSchoolId,
                        locale,
                        source: 'school_card_price',
                      }).catch(() => undefined);
                    }
                    return !prev;
                  })
                }
              >
                <div className={guest ? 'guest-price-blur' : ''}>
                  {financeMetaCards.length ? (
                    <div className="school-price-meta-grid">
                      {financeMetaCards.map((item) => (
                        <div key={`${item.label}-${item.value}`} className="school-price-meta-card">
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {feeRules.length ? (
                    <div className="school-price-rules">
                    {feeRules.map((rule, index) => (
                      <div key={`${rule.from_grade}-${rule.to_grade}-${rule.amount}-${index}`} className="school-price-rule">
                        <span>{ui.priceFromTo}: {rule.from_grade}-{rule.to_grade}</span>
                        <strong>{`${rule.amount.toLocaleString('ru-RU')} ${rule.currency === 'KZT' ? '₸' : rule.currency === 'USD' ? '$' : rule.currency === 'GBP' ? '£' : '€'}`}</strong>
                      </div>
                    ))}
                    {financeDiscounts ? (
                      <p className="school-price-comment">
                        <strong>{ui.discounts}:</strong> {financeDiscounts}
                      </p>
                    ) : null}
                    {financeGrants ? (
                      <p className="school-price-comment">
                        <strong>{ui.grants}:</strong> {financeGrants}
                      </p>
                    ) : null}
                    {!financeDiscounts && !financeGrants && legacyDiscountsGrants ? (
                      <p className="school-price-comment">
                        <strong>{locale === 'en' ? 'Discounts / Grants' : locale === 'kk' ? 'Жеңілдіктер / Гранттар' : 'Скидки / гранты'}:</strong> {legacyDiscountsGrants}
                      </p>
                    ) : null}
                    {financeComment ? (
                      <p className="school-price-comment">
                        <strong>{ui.priceComment}:</strong> {financeComment}
                      </p>
                    ) : null}
                    </div>
                  ) : (
                    <p className="school-price-comment">{price}</p>
                  )}
                </div>
              </ExpandableFactRow>
            ) : null}
            <FactRow icon="city" label={ui.city} value={cityLabel} />
            {districtLabel ? <FactRow icon="district" label={ui.district} value={districtLabel} /> : null}
            {factAddressRows.map((row, index) => (
              <FactRow
                key={`${row.label}-${index}`}
                icon="address"
                label={row.label}
                value={row.value}
              />
            ))}
          </section>

          <div className={guest ? 'guest-gated-panel school-guest-locked' : ''}>
            <div className={guest ? 'guest-gated-content school-detail-sections' : 'school-detail-sections'}>
          <div className="school-detail-actions">
            {canRequestConsultation ? (
              <button
                type="button"
                className="school-consult-btn"
                onClick={() => {
                  setConsultationOpen((prev) => !prev);
                  setConsultationError('');
                  setConsultationMessage('');
                }}
              >
                {consultationOpen ? ui.consultationClose : ui.consultationCta}
              </button>
            ) : null}
            <Link
              href={`/parent/schools/${encodeURIComponent(String(school.school_id || ''))}/clubs`}
              className="school-consult-btn"
            >
              {ui.clubs}
            </Link>
          </div>

          {canRequestConsultation && consultationOpen ? (
            <form className="school-consult-form" onSubmit={submitConsultation}>
              <div className="school-consult-form-grid">
                <label className="field" style={{ marginBottom: 0 }}>
                  <span>{ui.consultationParentName}</span>
                  <input
                    className="input"
                    value={consultationDraft.parentName}
                    onChange={(event) =>
                      setConsultationDraft((prev) => ({ ...prev, parentName: event.target.value }))
                    }
                  />
                </label>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span>{ui.consultationParentPhone}</span>
                  <input
                    className="input"
                    value={consultationDraft.parentPhone}
                    onChange={(event) =>
                      setConsultationDraft((prev) => ({ ...prev, parentPhone: event.target.value }))
                    }
                  />
                </label>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span>{ui.consultationParentEmail}</span>
                  <input
                    className="input"
                    type="email"
                    value={consultationDraft.parentEmail}
                    onChange={(event) =>
                      setConsultationDraft((prev) => ({ ...prev, parentEmail: event.target.value }))
                    }
                  />
                </label>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span>{ui.consultationChildName}</span>
                  <input
                    className="input"
                    value={consultationDraft.childName}
                    onChange={(event) =>
                      setConsultationDraft((prev) => ({ ...prev, childName: event.target.value }))
                    }
                  />
                </label>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span>{ui.consultationChildGrade}</span>
                  <select
                    value={consultationDraft.childGrade}
                    onChange={(event) =>
                      setConsultationDraft((prev) => ({ ...prev, childGrade: event.target.value }))
                    }
                  >
                    <option value="">{ui.notSpecified}</option>
                    {gradeOptions.map((grade) => (
                      <option key={grade} value={grade}>
                        {grade === 'pre-k' ? 'Pre-K' : grade}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span>{ui.consultationTypeLabel}</span>
                  <select
                    value={consultationDraft.consultationType}
                    onChange={(event) =>
                      setConsultationDraft((prev) => ({
                        ...prev,
                        consultationType: event.target.value,
                      }))
                    }
                  >
                    {consultationTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="field" style={{ marginBottom: 0 }}>
                <span>{ui.consultationComment}</span>
                <textarea
                  className="input"
                  rows={4}
                  value={consultationDraft.comment}
                  onChange={(event) =>
                    setConsultationDraft((prev) => ({ ...prev, comment: event.target.value }))
                  }
                />
              </label>
              <p className="muted" style={{ margin: 0 }}>
                {ui.consultationHint}
              </p>
              {consultationError ? (
                <p className="school-consult-status school-consult-status-error">
                  {consultationError}
                </p>
              ) : null}
              {consultationMessage ? (
                <p className="school-consult-status school-consult-status-success">
                  {consultationMessage}
                </p>
              ) : null}
              <button type="submit" className="school-consult-btn" disabled={consultationSaving}>
                {consultationSaving ? ui.consultationSending : ui.consultationSubmit}
              </button>
            </form>
          ) : consultationMessage ? (
            <p className="school-consult-status school-consult-status-success">
              {consultationMessage}
            </p>
          ) : null}

          {hasMap ? (
            <section className="school-mobile-map-card">
              <iframe
                title="Карта школы"
                src={mapSrc}
                className="school-mobile-map"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <Link
                href={fullMapHref}
                className="school-mobile-map-cta"
                onClick={() => {
                  if (!trackedSchoolId) return;
                  void recordEngagementEvent({
                    eventType: 'school_map_open',
                    schoolId: trackedSchoolId,
                    locale,
                    source: 'school_card_map',
                  }).catch(() => undefined);
                }}
              >
                Нажмите, чтобы раскрыть карту
              </Link>
            </section>
          ) : null}

          {SECTION_LABELS.map((section) => {
            const items =
              section.key === 'reviews'
                ? reviewItems
                : section.key === 'staff'
                  ? hasTeamSection
                    ? [{ label: 'team', value: 'team' }]
                    : []
                  : section.key === 'services'
                    ? serviceCards
                    : section.key === 'basic_info'
                      ? contactRows
                    : section.key === 'education'
                        ? educationRows
                      : flattenDetails(school[section.key]);
            if (!items.length) return null;
            const isOpen = Boolean(opened[section.key]);
            return (
              <div key={section.key}>
                {section.key === 'media' ? (
                  <section className="school-link-cards-row">
                    <Link
                      href={`/parent/schools/${encodeURIComponent(String(school.school_id || ''))}/admission`}
                      className="school-link-card"
                      onClick={() => {
                        if (!trackedSchoolId) return;
                        void recordEngagementEvent({
                          eventType: 'admission_open',
                          schoolId: trackedSchoolId,
                          locale,
                          source: 'school_card_admission',
                        }).catch(() => undefined);
                      }}
                    >
                      <span className="school-link-card-title">{ui.admissionPage}</span>
                      <span className="school-link-card-subtitle">{admissionHintValue}</span>
                    </Link>
                    <Link
                      href={`/parent/schools/${encodeURIComponent(String(school.school_id || ''))}/success-stories`}
                      className="school-link-card"
                    >
                      <span className="school-link-card-title">{ui.pridePage}</span>
                      <span className="school-link-card-subtitle">{ui.prideHint}</span>
                    </Link>
                  </section>
                ) : null}
                <section key={section.key} className="school-accordion-item">
                  <button
                    type="button"
                    className="school-accordion-trigger"
                    onClick={() =>
                      setOpened((prev) => ({
                        ...prev,
                        [section.key]: !prev[section.key],
                      }))
                    }
                  >
                    <span className="school-accordion-title">
                      <span className="school-accordion-icon"><SchoolIcon kind={section.icon} /></span>
                      {SECTION_TITLES[section.key]?.[locale] || section.key}
                    </span>
                    <span className={`school-accordion-arrow ${isOpen ? 'open' : ''}`}>▾</span>
                  </button>
                  {isOpen ? (
                    <div className="school-accordion-content">
                    {section.key === 'media' ? (
                      <div className="school-media-section">
                        {socialLinks.length ? (
                          <div className="school-social-grid">
                            {socialLinks.map((item) => (
                              <a
                                key={item.key}
                                href={item.href}
                                target="_blank"
                                rel="noreferrer"
                                className="school-social-card"
                              >
                                <span className={`school-social-icon social-${item.key}`}>
                                  {SOCIAL_ICON_IMAGES[item.key] ? (
                                    <Image
                                      src={SOCIAL_ICON_IMAGES[item.key] as string}
                                      alt={item.label}
                                      width={24}
                                      height={24}
                                      className="school-social-icon-image"
                                    />
                                  ) : (
                                    <SocialIcon kind={item.key} />
                                  )}
                                </span>
                                <span>{item.label}</span>
                              </a>
                            ))}
                          </div>
                        ) : null}
                        {!socialLinks.length ? (
                          <p className="muted" style={{ margin: 0 }}>{ui.socialEmpty}</p>
                        ) : null}
                      </div>
                    ) : section.key === 'services' ? (
                      <div className="school-service-card-grid">
                        {serviceCards.map((row, index) => (
                          <div
                            key={`${row.label}-${index}`}
                            className={`school-service-card${row.tone === 'positive' ? ' is-positive' : ''}`}
                          >
                            <p>{row.label}</p>
                            <strong>{row.value}</strong>
                          </div>
                        ))}
                      </div>
                    ) : section.key === 'education' ? (
                      <div className="school-service-list">
                        {educationRows.map((row, index) => (
                          <div key={`${row.label}-${index}`} className="school-service-item">
                            <p>{row.label}</p>
                            <strong>{row.value}</strong>
                          </div>
                        ))}
                        {classSizeRows.length ? (
                          <div className="school-class-size-block">
                            <p className="school-programs-title">{ui.classSizeCards}</p>
                            <div className="school-class-size-grid">
                              {classSizeRows.map((row, index) => (
                                <div key={`${row.label}-${index}`} className="school-class-size-card">
                                  <span>{row.label}</span>
                                  <strong>{row.value}</strong>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {educationPrograms.length ? (
                          <>
                            <p className="school-programs-title">{ui.schoolPrograms}</p>
                            <div className="school-staff-filters">
                              {educationPrograms.slice(0, 8).map((program, index) => (
                                <button
                                  key={`${program}-${index}`}
                                  type="button"
                                  className={activeProgram === program ? 'active-program-chip' : ''}
                                  onClick={() =>
                                    setActiveProgram((prev) => (prev === program ? '' : program))
                                  }
                                >
                                  {program}
                                </button>
                              ))}
                            </div>
                            {activeProgram ? (
                              <div className="school-program-info" key={activeProgram}>
                                <p className="school-program-info-label">{ui.programInfo}</p>
                                <h4>{selectedProgramInfo?.title}</h4>
                                <p className="school-program-info-summary">{selectedProgramInfo?.summary}</p>
                                <div className="school-program-info-points">
                                  {selectedProgramInfo?.highlights.map((point, pointIndex) => (
                                    <span key={`${point}-${pointIndex}`}>{point}</span>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    ) : section.key === 'basic_info' ? (
                      <div className="school-service-list">
                        {addressRows.length ? (
                          <div className="school-address-grid">
                            {addressRows.slice(0, 3).map((row, index) => (
                              <div
                                key={`${row.label}-${index}`}
                                className={`school-service-item school-address-item${
                                  index === 2 ? ' is-full-width' : ''
                                }`}
                              >
                                <p>{row.label}</p>
                                <strong>{row.value}</strong>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {otherContactRows.map((row, index) => (
                          <div key={`${row.label}-${index}`} className="school-service-item">
                            <p>{row.label}</p>
                            {contactItems.find((item) => item.label === row.label && item.value === row.value)?.href ? (
                              <strong>
                                <a
                                  href={
                                    contactItems.find(
                                      (item) => item.label === row.label && item.value === row.value
                                    )?.href
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={() => {
                                    if (!trackedSchoolId) return;
                                    const matchedItem = contactItems.find(
                                      (item) => item.label === row.label && item.value === row.value
                                    );
                                    const href = String(matchedItem?.href || '');
                                    const eventType = href.startsWith('tel:')
                                      ? 'contact_phone_click'
                                      : href.includes('wa.me')
                                        ? 'contact_whatsapp_click'
                                        : 'contact_website_click';
                                    void recordEngagementEvent({
                                      eventType,
                                      schoolId: trackedSchoolId,
                                      locale,
                                      source: 'school_card_contacts',
                                    }).catch(() => undefined);
                                  }}
                                >
                                  {row.value}
                                </a>
                              </strong>
                            ) : (
                              <strong>{row.value}</strong>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : section.key === 'reviews' ? (
                      <div className="school-reviews-box">
                        <div className="school-reviews-head">
                          <strong>{Number(reviews) > 0 ? `${reviews} ${ui.reviewsWord}` : ui.noReviews}</strong>
                          <button
                            type="button"
                            className="button secondary"
                            onClick={() => {
                              setReviewOpen((prev) => !prev);
                              setReviewError('');
                              setReviewMessage('');
                            }}
                          >
                            {reviewOpen ? ui.reviewClose : ui.leaveReview}
                          </button>
                        </div>
                        <p className="muted" style={{ margin: '10px 0 0' }}>
                          {ui.noReviewsHint}
                        </p>
                        {ratingBreakdownRows.length ? (
                          <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: 12,
                                alignItems: 'baseline',
                                flexWrap: 'wrap',
                              }}
                            >
                              <strong>{ui.reviewBreakdownTitle}</strong>
                              <span className="muted">
                                {ui.reviewRatedBy}: {feedbackCount} {ui.ratingsWord}
                              </span>
                            </div>
                            {ratingBreakdownRows.map((row) => (
                              <div key={row.label} style={{ display: 'grid', gap: 6 }}>
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    gap: 12,
                                    fontSize: 14,
                                  }}
                                >
                                  <span>{row.label}</span>
                                  <strong>{row.value.toFixed(1)}</strong>
                                </div>
                                <div
                                  style={{
                                    height: 10,
                                    borderRadius: 999,
                                    background: 'rgba(34, 50, 84, 0.08)',
                                    overflow: 'hidden',
                                  }}
                                >
                                  <div
                                    style={{
                                      width: `${Math.max(0, Math.min(100, (row.value / 5) * 100))}%`,
                                      height: '100%',
                                      borderRadius: 999,
                                      background:
                                        'linear-gradient(90deg, rgba(79,95,255,0.92) 0%, rgba(135,149,255,0.92) 100%)',
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {reviewOpen ? (
                          <form className="school-consult-form" onSubmit={submitReview} style={{ marginTop: 14 }}>
                            <div className="school-consult-grid">
                              <label className="field">
                                <span>{ui.reviewExperienceType}</span>
                                <select
                                  className="select"
                                  value={reviewDraft.experienceType}
                                  onChange={(event) =>
                                    setReviewDraft((prev) => ({
                                      ...prev,
                                      experienceType: event.target.value as ReviewDraft['experienceType'],
                                    }))
                                  }
                                >
                                  {reviewExperienceOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <label className="field">
                                <span>{ui.reviewExperienceFreshness}</span>
                                <select
                                  className="select"
                                  value={reviewDraft.experienceFreshness}
                                  onChange={(event) =>
                                    setReviewDraft((prev) => ({
                                      ...prev,
                                      experienceFreshness:
                                        event.target.value as ReviewDraft['experienceFreshness'],
                                    }))
                                  }
                                >
                                  {reviewFreshnessOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              {[
                                ['teachingRating', ui.reviewTeaching],
                                ['communicationRating', ui.reviewCommunication],
                                ['safetyRating', ui.reviewSafety],
                                ['atmosphereRating', ui.reviewAtmosphere],
                                ['valueRating', ui.reviewValue],
                              ].map(([field, label]) => (
                                <label key={field} className="field">
                                  <span>{label}</span>
                                  <select
                                    className="select"
                                    value={String(reviewDraft[field as keyof ReviewDraft] || '0')}
                                    onChange={(event) =>
                                      setReviewDraft((prev) => ({
                                        ...prev,
                                        [field]: event.target.value,
                                      }))
                                    }
                                  >
                                    {reviewRatingOptions.map((value) => (
                                      <option key={`${field}-${value}`} value={value}>
                                        {value === '0' ? '—' : value}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              ))}
                            </div>

                            <label className="field">
                              <span>{ui.reviewPositives}</span>
                              <textarea
                                className="input"
                                rows={3}
                                value={reviewDraft.positives}
                                onChange={(event) =>
                                  setReviewDraft((prev) => ({ ...prev, positives: event.target.value }))
                                }
                              />
                            </label>

                            <label className="field">
                              <span>{ui.reviewConcerns}</span>
                              <textarea
                                className="input"
                                rows={3}
                                value={reviewDraft.concerns}
                                onChange={(event) =>
                                  setReviewDraft((prev) => ({ ...prev, concerns: event.target.value }))
                                }
                              />
                            </label>

                            <label className="field">
                              <span>{ui.reviewRecommendationFor}</span>
                              <textarea
                                className="input"
                                rows={2}
                                value={reviewDraft.recommendationFor}
                                onChange={(event) =>
                                  setReviewDraft((prev) => ({
                                    ...prev,
                                    recommendationFor: event.target.value,
                                  }))
                                }
                              />
                            </label>

                            <label className="field">
                              <span>{ui.reviewComment}</span>
                              <textarea
                                className="input"
                                rows={3}
                                value={reviewDraft.comment}
                                onChange={(event) =>
                                  setReviewDraft((prev) => ({ ...prev, comment: event.target.value }))
                                }
                              />
                            </label>

                            {reviewError ? (
                              <p className="muted" style={{ margin: 0, color: '#d14343' }}>
                                {reviewError}
                              </p>
                            ) : null}
                            <button type="submit" className="school-consult-btn" disabled={reviewSaving}>
                              {reviewSaving ? ui.reviewSending : ui.reviewSubmit}
                            </button>
                          </form>
                        ) : null}
                        {reviewMessage ? (
                          <p className="muted" style={{ margin: '12px 0 0', color: '#1f8f4d' }}>
                            {reviewMessage}
                          </p>
                        ) : null}
                      </div>
                    ) : section.key === 'staff' ? (
                      <div className="school-staff-wrap">
                        {teamRows.length ? (
                          <div className="school-service-list" style={{ marginBottom: teachers.length ? 16 : 0 }}>
                            {teamRows.map((row, index) => (
                              <div key={`${row.label}-${index}`} className="school-service-item">
                                <p>{row.label}</p>
                                <strong>{row.value}</strong>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {personnelChips.length ? (
                          <div style={{ marginBottom: teachers.length ? 16 : 0 }}>
                            <p className="school-programs-title" style={{ marginTop: 0 }}>
                              {locale === 'en' ? 'Support team' : locale === 'kk' ? 'Қолдау командасы' : 'Члены персонала'}
                            </p>
                            <div className="school-personnel-chip-row">
                              {personnelChips.map((label, index) => (
                                <span key={`${label}-${index}`} className="school-personnel-chip">
                                  {label}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {teachers.length ? (
                          <>
                            <div className="school-staff-filters">
                              <span>{ui.allSubjects}</span>
                              <span>{ui.anyExperience}</span>
                              <span>{ui.allLanguages}</span>
                            </div>
                            <div className="school-staff-grid">
                              {teachers.map((teacher, idx) => (
                                <button key={`${teacher.full_name}-${idx}`} type="button" className="school-staff-card" onClick={() => setActiveTeacher(teacher)}>
                                  {teacher.photo_url ? (
                                    <Image src={teacher.photo_url} alt={teacher.full_name} width={160} height={130} className="school-staff-photo" unoptimized />
                                  ) : (
                                    <div className="school-staff-photo school-staff-photo-empty">{teacher.full_name.slice(0, 1)}</div>
                                  )}
                                  <p className="school-staff-name">{teacher.full_name}</p>
                                  <p className="muted">{teacher.subjects || teacher.position || '—'}</p>
                                </button>
                              ))}
                            </div>
                          </>
                        ) : !teamRows.length ? (
                          <p className="muted" style={{ margin: 0 }}>{ui.teachersEmpty}</p>
                        ) : null}
                      </div>
                    ) : (
                      <dl>
                        {items.map((item: { label: string; value: string }, itemIndex: number) => (
                          <div key={`${section.key}-${item.label}-${itemIndex}`} className="parent-school-kv">
                            <dt>{item.label}</dt>
                            <dd>{item.value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    </div>
                  ) : null}
                </section>
              </div>
            );
          })}

          {hasMediaAssets ? (
            <section className="school-mobile-photo-card">
              <h3 className="school-mobile-photo-title">{ui.mediaAssets}</h3>
              <div className="school-media-assets">
                {mediaPhotos.length ? (
                  <div className="school-media-assets-block">
                    <p className="school-media-assets-title">{`${ui.photos} (${mediaPhotos.length})`}</p>
                    <div className="school-media-thumbs">
                      {mediaPhotos.slice(0, 8).map((url, index) => (
                        <button
                          key={`${url}-${index}`}
                          type="button"
                          className="school-media-thumb-link"
                          onClick={() =>
                            setActiveMedia({
                              kind: 'photo',
                              index,
                            })
                          }
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`photo-${index + 1}`} className="school-media-thumb" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {mediaVideos.length ? (
                  <div className="school-media-assets-block">
                    <p className="school-media-assets-title">{`${ui.videos} (${mediaVideos.length})`}</p>
                    <div className="school-media-link-list">
                      {mediaVideos.slice(0, 8).map((url, index) => (
                        <button
                          key={`${url}-${index}`}
                          type="button"
                          className="school-media-link-item"
                          onClick={() =>
                            setActiveMedia({
                              kind: 'video',
                              index,
                            })
                          }
                        >
                          {`${ui.videos} ${index + 1}`}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {mediaCertificates.length ? (
                  <div className="school-media-assets-block">
                    <p className="school-media-assets-title">{`${ui.accreditations} (${mediaCertificates.length})`}</p>
                    <div className="school-media-link-list">
                      {mediaCertificates.slice(0, 8).map((url, index) => (
                        <button
                          key={`${url}-${index}`}
                          type="button"
                          className="school-media-link-item"
                          onClick={() =>
                            setActiveMedia({
                              kind: 'doc',
                              index,
                            })
                          }
                        >
                          {`${ui.document} ${index + 1}`}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {description ? (
            <section className="school-mobile-photo-card">
              <h3 className="school-mobile-photo-title">{ui.description}</h3>
              <p style={{ margin: 0, color: '#1f2a44', lineHeight: 1.45 }}>{description}</p>
            </section>
          ) : null}
            </div>
            {guest ? (
              <div className="guest-gated-overlay">
                <p className="guest-gated-title">{ui.guestGateTitle}</p>
                <p className="guest-gated-text">{ui.guestGateText}</p>
                <Link className="button" href="/login">
                  {ui.signIn}
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {activeMedia ? (
        <div className="school-teacher-modal-backdrop" onClick={() => setActiveMedia(null)}>
          <div className="school-media-viewer-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="school-teacher-close" onClick={() => setActiveMedia(null)}>
              ×
            </button>
            <h3 className="school-media-viewer-title">{activeMediaTitle}</h3>
            <div className="school-media-viewer-content">
              {activeMedia.kind === 'photo' || (activeMedia.kind === 'doc' && isImageUrl(activeMediaUrl)) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={activeMediaUrl} alt={activeMediaTitle} className="school-media-viewer-image" />
              ) : activeMedia.kind === 'video' && isVideoUrl(activeMediaUrl) ? (
                <video src={activeMediaUrl} controls className="school-media-viewer-video" />
              ) : activeMedia.kind === 'video' && toYouTubeEmbedUrl(activeMediaUrl) ? (
                <iframe
                  src={toYouTubeEmbedUrl(activeMediaUrl)}
                  title={activeMediaTitle}
                  className="school-media-viewer-frame"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <iframe
                  src={activeMediaUrl}
                  title={activeMediaTitle}
                  className="school-media-viewer-frame"
                />
              )}
            </div>
            {canNavigateMedia ? (
              <div className="school-media-viewer-nav">
                <button
                  type="button"
                  className="school-media-nav-btn"
                  onClick={() => navigateMedia(-1)}
                >
                  ‹ {ui.prev}
                </button>
                <button
                  type="button"
                  className="school-media-nav-btn"
                  onClick={() => navigateMedia(1)}
                >
                  {ui.next} ›
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {activeTeacher ? (
        <div className="school-teacher-modal-backdrop" onClick={() => setActiveTeacher(null)}>
          <div className="school-teacher-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="school-teacher-close" onClick={() => setActiveTeacher(null)}>×</button>
            <div className="school-teacher-head">
              {activeTeacher.photo_url ? (
                <Image src={activeTeacher.photo_url} alt={activeTeacher.full_name} width={90} height={90} className="school-teacher-modal-photo" unoptimized />
              ) : (
                <div className="school-teacher-modal-photo school-staff-photo-empty">{activeTeacher.full_name.slice(0, 1)}</div>
              )}
              <h3>{activeTeacher.full_name}</h3>
            </div>
            <div className="school-teacher-lines">
              {activeTeacher.position ? <p><span>Должность</span><strong>{activeTeacher.position}</strong></p> : null}
              {activeTeacher.category ? <p><span>Категория</span><strong>{activeTeacher.category}</strong></p> : null}
              {activeTeacher.subjects ? <p><span>Предметы</span><strong>{activeTeacher.subjects}</strong></p> : null}
              {activeTeacher.teaching_languages ? <p><span>Языки преподавания</span><strong>{activeTeacher.teaching_languages}</strong></p> : null}
              {activeTeacher.exam_prep ? <p><span>Подготовка к экзаменам</span><strong>{activeTeacher.exam_prep}</strong></p> : null}
              {activeTeacher.experience_years ? <p><span>Стаж (лет)</span><strong>{activeTeacher.experience_years}</strong></p> : null}
              {activeTeacher.bio ? <p><span>Описание / опыт</span><strong>{activeTeacher.bio}</strong></p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
