'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { loadSchools } from '@/lib/api';
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
  const [rows, setRows] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    loadSchools()
      .then((payload) => {
        if (!active) return;
        setRows(Array.isArray(payload?.data) ? payload.data : []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const school = useMemo(
    () => rows.find((item) => String(item.school_id || '') === schoolId) || null,
    [rows, schoolId]
  );

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

  const items = [
    { label: ui.exam, value: examRequired ? ui.yes : ui.no },
    { label: ui.format, value: examRequired ? examFormat : '' },
    { label: ui.deadline, value: deadline },
    { label: ui.stages, value: stages },
    { label: ui.period, value: period },
    { label: ui.competition, value: competition },
  ].filter((item) => item.value);

  return (
    <div className="school-mobile-page">
      <div className="school-mobile-backrow">
        <Link href={`/parent/schools/${encodeURIComponent(schoolId)}`} className="school-mobile-back">
          ‹ {ui.back}
        </Link>
      </div>
      <section className="school-mobile-photo-card">
        <h3 className="school-mobile-photo-title">{ui.title}</h3>
        {loading ? <p className="muted">{ui.loading}</p> : null}
        {!loading && !items.length ? <p className="muted">{ui.empty}</p> : null}
        {!loading && items.length ? (
          <div className="school-service-list">
            {items.map((item, index) => (
              <div key={`${item.label}-${index}`} className="school-service-item">
                <p>{item.label}</p>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
