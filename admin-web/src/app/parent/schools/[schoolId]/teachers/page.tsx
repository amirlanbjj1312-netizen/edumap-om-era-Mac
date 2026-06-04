'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { loadSchoolById } from '@/lib/api';
import { useParentLocale } from '@/lib/parentLocale';

type Locale = 'ru' | 'en' | 'kk';

type TeacherCard = {
  id: string;
  full_name: string;
  position: string;
  subjects: string;
  bio: string;
  experience_years: string;
  teaching_languages: string;
  photo_url: string;
};

const toText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    const loc = value as Record<string, unknown>;
    const picked = loc.ru ?? loc.kk ?? loc.en;
    if (typeof picked === 'string') return picked;
  }
  return '';
};

const pickFirst = (source: unknown, paths: string[], fallback = ''): string => {
  if (!source || typeof source !== 'object') return fallback;
  for (const path of paths) {
    const parts = path.split('.');
    let cur: unknown = source;
    for (const p of parts) {
      if (!cur || typeof cur !== 'object') { cur = undefined; break; }
      cur = (cur as Record<string, unknown>)[p];
    }
    const val = toText(cur);
    if (val) return val;
  }
  return fallback;
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

const toLocaleText = (value: unknown, locale: Locale): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    const loc = value as Record<string, unknown>;
    const picked = loc[locale] ?? loc.ru ?? loc.kk ?? loc.en;
    if (typeof picked === 'string') return picked;
  }
  return '';
};

export default function SchoolTeachersPage() {
  const { locale } = useParentLocale();
  const params = useParams<{ schoolId: string }>();
  const schoolId = decodeURIComponent(String(params?.schoolId || ''));

  const [school, setSchool] = useState<unknown | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTeacher, setActiveTeacher] = useState<TeacherCard | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const result = await loadSchoolById(schoolId);
        if (!active) return;
        setSchool(result?.data || null);
      } catch {
        if (!active) return;
        setSchool(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [schoolId]);

  const ui = useMemo(() => ({
    back: locale === 'en' ? 'Back to school' : locale === 'kk' ? 'Мектепке оралу' : 'Назад к школе',
    title: locale === 'en' ? 'School team' : locale === 'kk' ? 'Мектеп командасы' : 'Команда школы',
    loading: locale === 'en' ? 'Loading...' : locale === 'kk' ? 'Жүктелуде...' : 'Загрузка...',
    empty: locale === 'en' ? 'Team info not added yet.' : locale === 'kk' ? 'Команда туралы ақпарат әлі қосылмаған.' : 'Информация о команде пока не добавлена.',
    management: locale === 'en' ? 'Management' : locale === 'kk' ? 'Басшылық' : 'Руководство',
    supportTeam: locale === 'en' ? 'Support team' : locale === 'kk' ? 'Қолдау командасы' : 'Команда поддержки',
    teachers: locale === 'en' ? 'Teachers' : locale === 'kk' ? 'Мұғалімдер' : 'Педагоги',
    principal: locale === 'en' ? 'Principal' : locale === 'kk' ? 'Директор' : 'Директор',
    deputy: locale === 'en' ? 'Deputy principal' : locale === 'kk' ? 'Директор орынбасары' : 'Зам. директора',
    curators: locale === 'en' ? 'Class curators' : locale === 'kk' ? 'Сынып кураторлары' : 'Кураторы классов',
    yes: locale === 'en' ? 'Yes' : locale === 'kk' ? 'Иә' : 'Да',
    experience: locale === 'en' ? 'Experience' : locale === 'kk' ? 'Тәжірибе' : 'Опыт',
    years: locale === 'en' ? 'yrs' : locale === 'kk' ? 'жыл' : 'лет',
    languages: locale === 'en' ? 'Languages' : locale === 'kk' ? 'Тілдер' : 'Языки',
    close: locale === 'en' ? 'Close' : locale === 'kk' ? 'Жабу' : 'Закрыть',
    psychologist: locale === 'en' ? 'Psychologist' : locale === 'kk' ? 'Психолог' : 'Психолог',
    speechTherapist: locale === 'en' ? 'Speech therapist' : locale === 'kk' ? 'Логопед' : 'Логопед',
    defectologist: locale === 'en' ? 'Defectologist' : locale === 'kk' ? 'Дефектолог' : 'Дефектолог',
    specialEducator: locale === 'en' ? 'Special educator' : locale === 'kk' ? 'Арнайы педагог' : 'Спецпедагог',
    tutor: locale === 'en' ? 'Tutor' : locale === 'kk' ? 'Тьютор' : 'Тьютор',
  }), [locale]);

  const schoolName = useMemo(() => toLocaleText(getIn(school, 'basic_info.display_name'), locale)
    || toLocaleText(getIn(school, 'basic_info.name'), locale) || '', [school, locale]);

  const managementRows = useMemo(() => [
    { label: ui.principal, value: pickFirst(school, [`basic_info.team.principal.${locale}`, 'basic_info.team.principal.ru', 'basic_info.team.principal']) },
    { label: ui.deputy, value: pickFirst(school, [`basic_info.team.deputy_principal.${locale}`, 'basic_info.team.deputy_principal.ru', 'basic_info.team.deputy_principal']) },
    getIn(school, 'basic_info.team.class_curators_enabled') ? { label: ui.curators, value: ui.yes } : null,
  ].filter((r): r is { label: string; value: string } => !!r && !!r.value), [school, locale, ui]);

  const specialistChips = useMemo(() => [
    getIn(school, 'services.psychologists') ? ui.psychologist : '',
    getIn(school, 'services.speech_therapists') ? ui.speechTherapist : '',
    getIn(school, 'services.defectologists') ? ui.defectologist : '',
    getIn(school, 'services.special_educators') ? ui.specialEducator : '',
    getIn(school, 'services.tutors') ? ui.tutor : '',
  ].filter(Boolean), [school, ui]);

  const teachers = useMemo<TeacherCard[]>(() => {
    const members = getIn(school, 'services.teaching_staff.members');
    if (!Array.isArray(members)) return [];
    return members.map((item, idx) => ({
      id: String((item as Record<string, unknown>)?.id || idx),
      full_name: pickFirst(item, [`full_name.${locale}`, 'full_name.ru', 'full_name.kk', 'full_name.en', 'full_name'])
        || (locale === 'en' ? 'Teacher' : locale === 'kk' ? 'Мұғалім' : 'Преподаватель'),
      position: pickFirst(item, [`position.${locale}`, 'position.ru', 'position.en', 'position']),
      subjects: pickFirst(item, [`subjects.${locale}`, 'subjects.ru', 'subjects.en', 'subjects']),
      bio: pickFirst(item, [`bio.${locale}`, 'bio.ru', 'bio.en', 'bio']),
      experience_years: toText((item as Record<string, unknown>)?.experience_years),
      teaching_languages: toText((item as Record<string, unknown>)?.teaching_languages),
      photo_url: toText((item as Record<string, unknown>)?.photo_url),
    }));
  }, [school, locale]);

  const isEmpty = !loading && !managementRows.length && !specialistChips.length && !teachers.length;

  return (
    <div className="school-mobile-page">
      <div className="school-mobile-backrow">
        <Link href={`/parent/schools/${encodeURIComponent(schoolId)}`} className="school-mobile-back">
          ‹ {ui.back}
        </Link>
      </div>

      {/* Header */}
      <section className="teachers-hero">
        {schoolName ? <p className="teachers-hero-school">{schoolName}</p> : null}
        <h1 className="teachers-hero-title">{ui.title}</h1>
        {!loading && teachers.length ? (
          <p className="teachers-hero-count">{teachers.length} {ui.teachers.toLowerCase()}</p>
        ) : null}
      </section>

      {loading ? <p className="muted">{ui.loading}</p> : null}
      {isEmpty ? <p className="muted">{ui.empty}</p> : null}

      {/* Management */}
      {!loading && managementRows.length ? (
        <section className="teachers-section">
          <h2 className="teachers-section-title">{ui.management}</h2>
          <div className="teachers-mgmt-list">
            {managementRows.map((row) => (
              <div key={row.label} className="teachers-mgmt-row">
                <span className="teachers-mgmt-label">{row.label}</span>
                <strong className="teachers-mgmt-value">{row.value}</strong>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Specialists */}
      {!loading && specialistChips.length ? (
        <section className="teachers-section">
          <h2 className="teachers-section-title">{ui.supportTeam}</h2>
          <div className="teachers-chip-row">
            {specialistChips.map((chip) => (
              <span key={chip} className="teachers-chip">{chip}</span>
            ))}
          </div>
        </section>
      ) : null}

      {/* Teachers grid */}
      {!loading && teachers.length ? (
        <section className="teachers-section">
          <h2 className="teachers-section-title">{ui.teachers}</h2>
          <div className="teachers-grid">
            {teachers.map((teacher) => (
              <button
                key={teacher.id}
                type="button"
                className="teachers-card"
                onClick={() => setActiveTeacher(teacher)}
              >
                {teacher.photo_url ? (
                  <Image
                    src={teacher.photo_url}
                    alt={teacher.full_name}
                    width={80}
                    height={80}
                    className="teachers-card-photo"
                    unoptimized
                  />
                ) : (
                  <div className="teachers-card-photo teachers-card-photo-empty">
                    {teacher.full_name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <p className="teachers-card-name">{teacher.full_name}</p>
                <p className="teachers-card-role">{teacher.subjects || teacher.position || '—'}</p>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {/* Teacher modal */}
      {activeTeacher ? (
        <div className="teachers-modal-backdrop" onClick={() => setActiveTeacher(null)}>
          <div className="teachers-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="teachers-modal-close" onClick={() => setActiveTeacher(null)}>×</button>
            <div className="teachers-modal-head">
              {activeTeacher.photo_url ? (
                <Image
                  src={activeTeacher.photo_url}
                  alt={activeTeacher.full_name}
                  width={80}
                  height={80}
                  className="teachers-modal-photo"
                  unoptimized
                />
              ) : (
                <div className="teachers-modal-photo teachers-card-photo-empty">
                  {activeTeacher.full_name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div>
                <p className="teachers-modal-name">{activeTeacher.full_name}</p>
                {activeTeacher.position ? <p className="teachers-modal-role">{activeTeacher.position}</p> : null}
              </div>
            </div>
            {activeTeacher.subjects ? (
              <div className="teachers-modal-row">
                <span className="teachers-modal-label">📚 {activeTeacher.subjects}</span>
              </div>
            ) : null}
            {activeTeacher.experience_years ? (
              <div className="teachers-modal-row">
                <span className="teachers-modal-label">⏱ {activeTeacher.experience_years} {ui.years}</span>
              </div>
            ) : null}
            {activeTeacher.teaching_languages ? (
              <div className="teachers-modal-row">
                <span className="teachers-modal-label">🌐 {activeTeacher.teaching_languages}</span>
              </div>
            ) : null}
            {activeTeacher.bio ? (
              <p className="teachers-modal-bio">{activeTeacher.bio}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
