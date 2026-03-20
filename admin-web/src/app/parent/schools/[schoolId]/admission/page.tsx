'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { loadSchoolById } from '@/lib/api';
import { useParentLocale } from '@/lib/parentLocale';

type SchoolRow = {
  school_id?: string;
  [key: string]: unknown;
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

const pickImage = (school: SchoolRow | null) => {
  if (!school) return '';
  return pickFirstText(school, ['media.logo', 'media.photos', 'basic_info.logo'], '');
};

const OPTION_I18N: Record<string, { ru: string; en: string; kk: string }> = {
  Exam: { ru: 'Экзамен', en: 'Exam', kk: 'Емтихан' },
  Interview: { ru: 'Собеседование', en: 'Interview', kk: 'Сұхбат' },
  Test: { ru: 'Тест', en: 'Test', kk: 'Тест' },
  'No competition': { ru: 'Без конкурса', en: 'No competition', kk: 'Конкурссіз' },
  'April-June': { ru: 'Апрель-июнь', en: 'April-June', kk: 'Сәуір-маусым' },
  'May-August': { ru: 'Май-август', en: 'May-August', kk: 'Мамыр-тамыз' },
  'Year-round': { ru: 'Круглый год', en: 'Year-round', kk: 'Жыл бойы' },
};

const OPTION_ALIASES: Record<string, string> = {
  exam: 'Exam',
  interview: 'Interview',
  test: 'Test',
  'no competition': 'No competition',
  'april-june': 'April-June',
  'may-august': 'May-August',
  'year-round': 'Year-round',
};

const localizeOption = (value: string, locale: 'ru' | 'en' | 'kk') => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const alias = OPTION_ALIASES[raw.toLowerCase()] || raw;
  return OPTION_I18N[alias]?.[locale] || raw;
};

export default function ParentSchoolAdmissionPage() {
  const { locale } = useParentLocale();
  const params = useParams<{ schoolId: string }>();
  const schoolId = decodeURIComponent(String(params?.schoolId || ''));
  const [school, setSchool] = useState<SchoolRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    loadSchoolById(schoolId)
      .then((payload) => {
        if (!active) return;
        setSchool((payload?.data as SchoolRow) || null);
      })
      .catch(() => {
        if (!active) return;
        setSchool(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const ui = {
    back: locale === 'en' ? 'Back to school' : locale === 'kk' ? 'Мектепке оралу' : 'Назад к школе',
    title: locale === 'en' ? 'Admission' : locale === 'kk' ? 'Қабылдау' : 'Поступление',
    loading: locale === 'en' ? 'Loading...' : locale === 'kk' ? 'Жүктелуде...' : 'Загрузка...',
    empty:
      locale === 'en'
        ? 'School has not filled this section yet.'
        : locale === 'kk'
          ? 'Мектеп бұл бөлімді әлі толтырмаған.'
          : 'Школа пока не заполнила этот раздел.',
    exam: locale === 'en' ? 'Entrance exam' : locale === 'kk' ? 'Түсу емтиханы' : 'Вступительный экзамен',
    format: locale === 'en' ? 'Format' : locale === 'kk' ? 'Формат' : 'Формат',
    deadline:
      locale === 'en' ? 'Application deadline' : locale === 'kk' ? 'Құжат тапсыру мерзімі' : 'Срок подачи документов',
    stages: locale === 'en' ? 'Admission stages' : locale === 'kk' ? 'Қабылдау кезеңдері' : 'Этапы набора',
    period: locale === 'en' ? 'Enrollment period' : locale === 'kk' ? 'Қабылдау кезеңі' : 'Период набора',
    competition: locale === 'en' ? 'Competition per seat' : locale === 'kk' ? 'Бір орынға конкурс' : 'Конкурс на место',
    yes: locale === 'en' ? 'Yes' : locale === 'kk' ? 'Иә' : 'Да',
    no: locale === 'en' ? 'No' : locale === 'kk' ? 'Жоқ' : 'Нет',
    heroText:
      locale === 'en'
        ? 'Exam, deadlines and admission stages'
        : locale === 'kk'
          ? 'Емтихан, мерзімдер және қабылдау кезеңдері'
          : 'Экзамен, сроки и этапы набора',
    stageHint:
      locale === 'en'
        ? 'How admission works'
        : locale === 'kk'
          ? 'Қабылдау қалай өтеді'
          : 'Как проходит поступление',
  };

  const examRequired = Boolean(getIn(school, 'education.entrance_exam.required'));
  const examFormat = localizeOption(
    pickFirstText(school, ['education.entrance_exam.format_other', 'education.entrance_exam.format']),
    locale
  );
  const deadline = pickFirstText(school, ['education.admission_details.document_deadlines']);
  const stages = pickFirstText(
    school,
    ['education.admission_details.admission_stages_detail', 'education.entrance_exam.stages']
  );
  const period = localizeOption(
    pickFirstText(school, ['education.admission_details.enrollment_period']),
    locale
  );
  const competition = localizeOption(
    pickFirstText(school, ['education.admission_details.competition_per_seat']),
    locale
  );
  const schoolName = pickFirstText(school, ['basic_info.display_name', 'basic_info.name'], '');
  const logo = pickImage(school);

  const chips = [
    { label: ui.exam, value: examRequired ? ui.yes : ui.no },
    { label: ui.period, value: period },
    { label: ui.competition, value: competition || ui.no },
  ].filter((item) => item.value);

  const statCards = [
    { label: ui.format, value: examRequired ? examFormat : '' },
    { label: ui.deadline, value: deadline },
    { label: ui.period, value: period },
    { label: ui.competition, value: competition },
  ].filter((item) => item.value);

  return (
    <div className="school-mobile-page">
      <section className="school-admission-hero">
        <div className="school-admission-hero-main">
          <div className="school-admission-hero-copy">
            <p className="school-admission-eyebrow">{schoolName || ui.title}</p>
            <h1 className="school-admission-title">{ui.title}</h1>
            <p className="school-admission-subtitle">{ui.heroText}</p>
          </div>
          {logo ? (
            <div className="school-admission-logo-shell">
              <Image src={logo} alt={schoolName || ui.title} width={112} height={112} className="school-admission-logo" unoptimized />
            </div>
          ) : null}
        </div>
        {chips.length ? (
          <div className="school-admission-chip-row">
            {chips.map((item) => (
              <div key={`${item.label}-${item.value}`} className="school-admission-chip">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        ) : null}
      </section>
      <section className="school-mobile-photo-card school-admission-card">
        {loading ? <p className="muted">{ui.loading}</p> : null}
        {!loading && !statCards.length && !stages ? <p className="muted">{ui.empty}</p> : null}
        {!loading && statCards.length ? (
          <div className="school-admission-grid">
            {statCards.map((item, index) => (
              <div key={`${item.label}-${index}`} className="school-admission-stat">
                <p>{item.label}</p>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        ) : null}
        {!loading && stages ? (
          <div className="school-admission-stage-box">
            <p className="school-admission-stage-label">{ui.stageHint}</p>
            <div className="school-admission-stage-content">{stages}</div>
          </div>
        ) : null}
        {!loading ? (
          <div className="school-admission-actions">
            <Link href={`/parent/schools/${encodeURIComponent(schoolId)}`} className="school-consult-btn">
              {ui.back}
            </Link>
          </div>
        ) : null}
      </section>
    </div>
  );
}
