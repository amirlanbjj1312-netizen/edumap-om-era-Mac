'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { loadSchoolById } from '@/lib/api';
import { useParentLocale } from '@/lib/parentLocale';
import {
  formatAdmissionGradeLabel,
  normalizeAdmissionRules,
  pickLocalizedText,
} from '@/lib/admission';

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
  Essay: { ru: 'Эссе', en: 'Essay', kk: 'Эссе' },
  Portfolio: { ru: 'Портфолио', en: 'Portfolio', kk: 'Портфолио' },
  'Video intro': { ru: 'Видео-визитка', en: 'Video intro', kk: 'Бейне-визитка' },
  'Trial day': { ru: 'Пробный день', en: 'Trial day', kk: 'Сынақ күні' },
  Psychologist: { ru: 'Психолог', en: 'Psychologist', kk: 'Психолог' },
  Competition: { ru: 'Конкурс', en: 'Competition', kk: 'Байқау' },
  Other: { ru: 'Другое', en: 'Other', kk: 'Басқа' },
  'Application form': { ru: 'Заявление о зачислении', en: 'Enrollment application', kk: 'Қабылдау туралы өтініш' },
  Transcript: { ru: 'Табель / выписка оценок', en: 'Transcript / grade report', kk: 'Табель / бағалар көшірмесі' },
  Recommendations: { ru: 'Рекомендации', en: 'Recommendations', kk: 'Ұсынымдар' },
  'Medical certificate': { ru: 'Медицинская справка (форма № 065/у)', en: 'Medical certificate (form No. 065/u)', kk: 'Медициналық анықтама (№ 065/у нысаны)' },
  'Health status certificate (forms No. 065/u and No. 026/u-3)': { ru: 'Медицинская карта ребенка (форма № 026/у-3)', en: 'Child medical record (form No. 026/u-3)', kk: 'Баланың медициналық картасы (№ 026/у-3 нысаны)' },
  'Birth certificate': { ru: 'Свидетельство о рождении', en: 'Birth certificate', kk: 'Туу туралы куәлік' },
  'Health passport': { ru: 'Медицинская карта ребенка (форма № 026/у-3)', en: 'Child medical record (form No. 026/u-3)', kk: 'Баланың медициналық картасы (№ 026/у-3 нысаны)' },
  'Form 063': { ru: 'Карта профилактических прививок (форма № 063/у)', en: 'Immunization record (form No. 063/u)', kk: 'Профилактикалық егулер картасы (№ 063/у нысаны)' },
  '3x4 photos': { ru: 'Фото 3×4', en: '3×4 photos', kk: '3×4 фото' },
  'Student file': { ru: 'Личное дело учащегося', en: 'Student record file', kk: 'Оқушының жеке ісі' },
  'Withdrawal slip from the previous school': { ru: 'Открепительный талон о выбытии из предыдущей школы', en: 'Withdrawal slip from the previous school', kk: 'Алдыңғы мектептен шығу туралы анықтама' },
  'Original identity document': { ru: 'Копия документа, удостоверяющего личность учащегося', en: 'Copy of the student identity document', kk: 'Оқушының жеке басын куәландыратын құжаттың көшірмесі' },
  'Parent ID': { ru: 'Документ, удостоверяющий личность законного представителя', en: 'Identity document of the legal representative', kk: 'Заңды өкілдің жеке басын куәландыратын құжат' },
  'No competition': { ru: 'Без конкурса', en: 'No competition', kk: 'Конкурссіз' },
  'April-June': { ru: 'Апрель-июнь', en: 'April-June', kk: 'Сәуір-маусым' },
  'May-August': { ru: 'Май-август', en: 'May-August', kk: 'Мамыр-тамыз' },
  'Year-round': { ru: 'Круглый год', en: 'Year-round', kk: 'Жыл бойы' },
};

const OPTION_ALIASES: Record<string, string> = {
  exam: 'Exam', interview: 'Interview', test: 'Test', essay: 'Essay', portfolio: 'Portfolio',
  video: 'Video intro', trial_day: 'Trial day', psychologist: 'Psychologist',
  competition: 'Competition', other: 'Other', application_form: 'Application form',
  transcript: 'Transcript', recommendations: 'Recommendations',
  medical_certificate: 'Medical certificate',
  health_status_certificate: 'Health status certificate (forms No. 065/u and No. 026/u-3)',
  birth_certificate: 'Birth certificate', health_passport: 'Health passport',
  form_063: 'Form 063', photo_3x4: '3x4 photos', student_file: 'Student file',
  withdrawal_slip: 'Withdrawal slip from the previous school',
  original_identity_document: 'Original identity document',
  parent_id: 'Parent ID', 'no competition': 'No competition',
  'april-june': 'April-June', 'may-august': 'May-August', 'year-round': 'Year-round',
};

const localizeOption = (value: string, locale: 'ru' | 'en' | 'kk') => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const alias = OPTION_ALIASES[raw.toLowerCase()] || raw;
  return OPTION_I18N[alias]?.[locale] || raw;
};

const renderStageContent = (value: string) => {
  const lines = String(value || '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  const isNumbered = lines.every((l) => /^\d+\.\s+/.test(l));
  if (isNumbered) {
    return (
      <ol className="admission-steps-list">
        {lines.map((l, i) => (
          <li key={i} className="admission-step-item">
            <span className="admission-step-num">{i + 1}</span>
            <span>{l.replace(/^\d+\.\s+/, '')}</span>
          </li>
        ))}
      </ol>
    );
  }
  const isBulleted = lines.every((l) => /^(?:•|-)\s+/.test(l));
  if (isBulleted) {
    return (
      <ul className="admission-bullet-list">
        {lines.map((l, i) => <li key={i}>{l.replace(/^(?:•|-)\s+/, '')}</li>)}
      </ul>
    );
  }
  return (
    <div className="admission-rich-text">
      {lines.map((l, i) => <p key={i}>{l}</p>)}
    </div>
  );
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
      .then((payload) => { if (!active) return; setSchool((payload?.data as SchoolRow) || null); })
      .catch(() => { if (!active) return; setSchool(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const ui = useMemo(() => ({
    back: locale === 'en' ? 'Back to school' : locale === 'kk' ? 'Мектепке оралу' : 'Назад к школе',
    title: locale === 'en' ? 'Admission' : locale === 'kk' ? 'Қабылдау' : 'Поступление',
    loading: locale === 'en' ? 'Loading...' : locale === 'kk' ? 'Жүктелуде...' : 'Загрузка...',
    empty: locale === 'en' ? 'School has not filled this section yet.' : locale === 'kk' ? 'Мектеп бұл бөлімді әлі толтырмаған.' : 'Школа пока не заполнила этот раздел.',
    exam: locale === 'en' ? 'Entrance exam' : locale === 'kk' ? 'Түсу емтиханы' : 'Вступительный экзамен',
    format: locale === 'en' ? 'Format' : locale === 'kk' ? 'Формат' : 'Формат',
    deadline: locale === 'en' ? 'Application deadline' : locale === 'kk' ? 'Құжат тапсыру мерзімі' : 'Срок подачи документов',
    period: locale === 'en' ? 'Enrollment period' : locale === 'kk' ? 'Қабылдау кезеңі' : 'Период набора',
    competition: locale === 'en' ? 'Competition per seat' : locale === 'kk' ? 'Бір орынға конкурс' : 'Конкурс на место',
    yes: locale === 'en' ? 'Yes' : locale === 'kk' ? 'Иә' : 'Да',
    no: locale === 'en' ? 'No' : locale === 'kk' ? 'Жоқ' : 'Нет',
    heroSubtitle: locale === 'en' ? 'Exam, deadlines and admission stages' : locale === 'kk' ? 'Емтихан, мерзімдер және қабылдау кезеңдері' : 'Экзамен, сроки и этапы набора',
    howItWorks: locale === 'en' ? 'How admission works' : locale === 'kk' ? 'Қабылдау қалай өтеді' : 'Как проходит поступление',
    scenarios: locale === 'en' ? 'Admission scenarios' : locale === 'kk' ? 'Қабылдау сценарийлері' : 'Сценарии поступления',
    steps: locale === 'en' ? 'What to complete' : locale === 'kk' ? 'Не өту керек' : 'Что нужно пройти',
    requirements: locale === 'en' ? 'What is assessed' : locale === 'kk' ? 'Не бағаланады' : 'Что оценивают',
    documents: locale === 'en' ? 'Required documents' : locale === 'kk' ? 'Қажет құжаттар' : 'Требуемые документы',
    note: locale === 'en' ? 'Comment' : locale === 'kk' ? 'Түсініктеме' : 'Комментарий',
    selectionTypes: locale === 'en' ? 'Selection types' : locale === 'kk' ? 'Іріктеу түрлері' : 'Типы отбора',
    parentNeeds: locale === 'en' ? 'For parents' : locale === 'kk' ? 'Ата-аналарға' : 'Для родителей',
    documentsNeed: locale === 'en' ? 'Required documents' : locale === 'kk' ? 'Қажет құжаттар' : 'Какие документы нужны',
    parentComment: locale === 'en' ? 'Note for parents' : locale === 'kk' ? 'Ата-анаға түсініктеме' : 'Комментарий для родителей',
  }), [locale]);

  const currentLocale = locale as 'ru' | 'en' | 'kk';

  const examRequired = Boolean(getIn(school, 'education.entrance_exam.required'));
  const examFormat = localizeOption(
    pickFirstText(school, ['education.entrance_exam.format_other', 'education.entrance_exam.format']),
    locale
  );
  const deadline = pickFirstText(school, ['education.admission_details.document_deadlines']);
  const stages = pickFirstText(school, ['education.admission_details.admission_stages_detail', 'education.entrance_exam.stages']);
  const period = localizeOption(pickFirstText(school, ['education.admission_details.enrollment_period']), locale);
  const competition = localizeOption(pickFirstText(school, ['education.admission_details.competition_per_seat']), locale);
  const schoolName = toLocaleText(getIn(school, 'basic_info.display_name'), locale)
    || toLocaleText(getIn(school, 'basic_info.name'), locale) || '';
  const logo = pickImage(school);
  const admissionRules = useMemo(() => normalizeAdmissionRules(school), [school]);
  const documentsDetail = pickLocalizedText(getIn(school, 'education.admission_details.documents_detail'), currentLocale);
  const parentComment = pickLocalizedText(getIn(school, 'education.admission_details.parent_comment'), currentLocale);

  const keyInfoCards = [
    examRequired !== undefined
      ? { label: ui.exam, value: examRequired ? ui.yes : ui.no, highlight: examRequired }
      : null,
    examFormat ? { label: ui.format, value: examFormat, highlight: false } : null,
    deadline ? { label: ui.deadline, value: deadline, highlight: false } : null,
    period ? { label: ui.period, value: period, highlight: false } : null,
    competition ? { label: ui.competition, value: competition, highlight: false } : null,
  ].filter(Boolean) as Array<{ label: string; value: string; highlight: boolean }>;

  const isEmpty = !loading && !keyInfoCards.length && !stages && !admissionRules.length && !documentsDetail && !parentComment;

  return (
    <div className="school-mobile-page">
      <div className="school-mobile-backrow">
        <Link href={`/parent/schools/${encodeURIComponent(schoolId)}`} className="school-mobile-back">
          ‹ {ui.back}
        </Link>
      </div>

      {/* Hero */}
      <section className="adm-hero">
        <div className="adm-hero-inner">
          <div className="adm-hero-copy">
            {schoolName ? <p className="adm-hero-school">{schoolName}</p> : null}
            <h1 className="adm-hero-title">{ui.title}</h1>
            <p className="adm-hero-sub">{ui.heroSubtitle}</p>
          </div>
          {logo ? (
            <div className="adm-hero-logo-wrap">
              <Image src={logo} alt={schoolName || ui.title} width={96} height={96} className="adm-hero-logo" unoptimized />
            </div>
          ) : null}
        </div>
      </section>

      {loading ? <p className="muted" style={{ padding: '12px 0' }}>{ui.loading}</p> : null}
      {isEmpty ? <p className="muted" style={{ padding: '12px 0' }}>{ui.empty}</p> : null}

      {/* Key info cards */}
      {!loading && keyInfoCards.length ? (
        <div className="adm-info-grid">
          {keyInfoCards.map((card) => (
            <div key={card.label} className={`adm-info-card${card.highlight ? ' adm-info-card-yes' : ''}`}>
              <span className="adm-info-label">{card.label}</span>
              <strong className="adm-info-value">{card.value}</strong>
            </div>
          ))}
        </div>
      ) : null}

      {/* How admission works */}
      {!loading && stages ? (
        <section className="adm-section">
          <h2 className="adm-section-title">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
            {ui.howItWorks}
          </h2>
          <div className="adm-section-body">
            {renderStageContent(stages)}
          </div>
        </section>
      ) : null}

      {/* For parents */}
      {!loading && (documentsDetail || parentComment) ? (
        <section className="adm-section">
          <h2 className="adm-section-title">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            {ui.parentNeeds}
          </h2>
          <div className="adm-section-body">
            {documentsDetail ? (
              <div className="adm-subsection">
                <p className="adm-subsection-label">{ui.documentsNeed}</p>
                {renderStageContent(documentsDetail)}
              </div>
            ) : null}
            {parentComment ? (
              <div className="adm-subsection">
                <p className="adm-subsection-label">{ui.parentComment}</p>
                {renderStageContent(parentComment)}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Admission scenarios */}
      {!loading && admissionRules.length ? (
        <section className="adm-section">
          <h2 className="adm-section-title">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            {ui.scenarios}
          </h2>
          <div className="adm-rules-list">
            {admissionRules.map((rule, index) => {
              const steps = pickLocalizedText(rule.stages, currentLocale);
              const requirements = pickLocalizedText(rule.requirements, currentLocale);
              const note = pickLocalizedText(rule.comment, currentLocale);
              const assessmentOther = pickLocalizedText(rule.assessment_other, currentLocale);
              const documentOther = pickLocalizedText(rule.documents_other, currentLocale);
              const format = localizeOption(
                pickLocalizedText(rule.format_other, currentLocale) || rule.format,
                locale
              );
              const assessmentTypes = [
                ...(Array.isArray(rule.assessment_types) ? rule.assessment_types.filter((i) => String(i) !== 'other') : []),
                ...(assessmentOther ? [assessmentOther] : []),
              ].map((i) => localizeOption(String(i), locale)).filter((i) => i && i !== localizeOption('other', locale));

              const documentTypes = [
                ...(Array.isArray(rule.required_documents) ? rule.required_documents.filter((i) => String(i) !== 'other') : []),
                ...(documentOther ? [documentOther] : []),
              ].map((i) => {
                const raw = String(i);
                const localized = localizeOption(raw, locale);
                if (raw === 'photo_3x4' && String(rule.photo_count || '').trim()) {
                  const suffix = locale === 'en' ? `${rule.photo_count} pcs.` : locale === 'kk' ? `${rule.photo_count} дана` : `${rule.photo_count} шт.`;
                  return `${localized} (${suffix})`;
                }
                return localized;
              }).filter((i) => i && i !== localizeOption('other', locale));

              return (
                <article key={String(rule.id || `rule-${index}`)} className="adm-rule-card">
                  <div className="adm-rule-header">
                    <h3 className="adm-rule-grade">{formatAdmissionGradeLabel(rule, currentLocale)}</h3>
                    <div className="adm-rule-badges">
                      {format ? <span className="adm-rule-badge">{format}</span> : null}
                      {rule.deadline ? <span className="adm-rule-badge adm-rule-badge-date">{rule.deadline}</span> : null}
                    </div>
                  </div>
                  {assessmentTypes.length ? (
                    <div className="adm-rule-block">
                      <p className="adm-rule-block-label">{ui.selectionTypes}</p>
                      <div className="adm-tag-row">
                        {assessmentTypes.map((item) => (
                          <span key={item} className="adm-tag">{item}</span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {steps ? (
                    <div className="adm-rule-block">
                      <p className="adm-rule-block-label">{ui.steps}</p>
                      <div className="adm-rule-text">{renderStageContent(steps)}</div>
                    </div>
                  ) : null}
                  {requirements ? (
                    <div className="adm-rule-block">
                      <p className="adm-rule-block-label">{ui.requirements}</p>
                      <div className="adm-rule-text">{renderStageContent(requirements)}</div>
                    </div>
                  ) : null}
                  {documentTypes.length ? (
                    <div className="adm-rule-block">
                      <p className="adm-rule-block-label">{ui.documents}</p>
                      <ul className="adm-doc-list">
                        {documentTypes.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                  ) : null}
                  {note ? (
                    <div className="adm-rule-block adm-rule-note">
                      <p className="adm-rule-block-label">{ui.note}</p>
                      <div className="adm-rule-text">{renderStageContent(note)}</div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
