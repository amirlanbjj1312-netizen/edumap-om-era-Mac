'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { loadSchools } from '@/lib/api';
import { useParentLocale } from '@/lib/parentLocale';
import { buildSchoolClubs, buildSchoolTeachers } from '@/lib/clubViews';

const getSchoolId = (value: unknown): string => {
  if (!value || typeof value !== 'object') return '';
  const raw = (value as Record<string, unknown>).school_id;
  return typeof raw === 'string' ? raw : '';
};

const getName = (school: unknown, locale: 'ru' | 'en' | 'kk') => {
  const root = school && typeof school === 'object' ? (school as Record<string, unknown>) : {};
  const basicInfo =
    root.basic_info && typeof root.basic_info === 'object'
      ? (root.basic_info as Record<string, unknown>)
      : {};
  const displayName = basicInfo.display_name;
  if (displayName && typeof displayName === 'object') {
    const localized = displayName as Partial<Record<'ru' | 'en' | 'kk', unknown>>;
    return String(localized[locale] || localized.ru || localized.en || localized.kk || '');
  }
  return '';
};

export default function ParentSchoolClubDetailsPage() {
  const { locale } = useParentLocale();
  const params = useParams<{ schoolId: string; clubId: string }>();
  const schoolId = decodeURIComponent(String(params?.schoolId || ''));
  const clubId = decodeURIComponent(String(params?.clubId || ''));

  const [rows, setRows] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTrainerCardOpen, setIsTrainerCardOpen] = useState(false);
  const [activeSectionPhoto, setActiveSectionPhoto] = useState('');

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      try {
        const result = await loadSchools();
        if (!active) return;
        setRows(Array.isArray(result.data) ? result.data : []);
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, []);

  const school = useMemo(
    () => rows.find((item) => getSchoolId(item) === schoolId) || null,
    [rows, schoolId]
  );
  const schoolName = useMemo(() => getName(school, locale), [school, locale]);
  const clubs = useMemo(() => buildSchoolClubs(school, locale), [school, locale]);
  const club = useMemo(
    () => clubs.find((item) => item.id === clubId) || null,
    [clubs, clubId]
  );
  const teachers = useMemo(() => buildSchoolTeachers(school, locale), [school, locale]);
  const teacher = useMemo(() => {
    if (!club) return null;
    if (club.teacher_id) {
      const byId = teachers.find((item) => item.id === club.teacher_id);
      if (byId) return byId;
    }
    return teachers.find((item) => item.full_name === club.teacher_name) || null;
  }, [club, teachers]);
  const trainerName = teacher?.full_name || club?.teacher_name || '';
  const trainerDescription = club?.trainer_info || teacher?.bio || '';
  const trainerPhoto = club?.trainer_photo || teacher?.photo_url || '';

  const ui = {
    back: locale === 'en' ? 'Back to clubs' : locale === 'kk' ? 'Үйірмелерге оралу' : 'Назад к кружкам',
    notFound: locale === 'en' ? 'Club not found.' : locale === 'kk' ? 'Үйірме табылмады.' : 'Кружок не найден.',
    teacher: locale === 'en' ? 'Teacher' : locale === 'kk' ? 'Мұғалім' : 'Преподаватель',
    classes: locale === 'en' ? 'Classes' : locale === 'kk' ? 'Сыныптар' : 'Классы',
    age: locale === 'en' ? 'Age' : locale === 'kk' ? 'Жас' : 'Возраст',
    duration: locale === 'en' ? 'Duration' : locale === 'kk' ? 'Ұзақтығы' : 'Длительность',
    location: locale === 'en' ? 'Location' : locale === 'kk' ? 'Орны' : 'Место',
    schedule: locale === 'en' ? 'Schedule' : locale === 'kk' ? 'Кесте' : 'Расписание',
    description: locale === 'en' ? 'Description' : locale === 'kk' ? 'Сипаттама' : 'Описание',
    price: locale === 'en' ? 'Price' : locale === 'kk' ? 'Бағасы' : 'Цена',
    minutes: locale === 'en' ? 'min' : locale === 'kk' ? 'мин' : 'мин',
    close: locale === 'en' ? 'Close' : locale === 'kk' ? 'Жабу' : 'Закрыть',
  };

  return (
    <div className="school-mobile-page">
      <div className="school-mobile-backrow">
        <Link href={`/parent/schools/${encodeURIComponent(schoolId)}/clubs`} className="school-mobile-back">
          ‹ {ui.back}
        </Link>
      </div>
      <section className="school-mobile-photo-card">
        {loading ? <p className="muted">...</p> : null}
        {!loading && !club ? <p className="muted">{ui.notFound}</p> : null}
        {club ? (
          <>
            <h3 className="school-mobile-photo-title">{club.name}</h3>
            <p className="muted" style={{ marginTop: 0 }}>{schoolName}</p>
            <div className="club-detail-lines">
              {club.schedule ? <p><strong>{ui.schedule}:</strong> {club.schedule}</p> : null}
              {club.class_range ? <p><strong>{ui.classes}:</strong> {club.class_range}</p> : null}
              {club.age_group ? <p><strong>{ui.age}:</strong> {club.age_group}</p> : null}
              {club.duration_minutes ? <p><strong>{ui.duration}:</strong> {club.duration_minutes} {ui.minutes}</p> : null}
              {club.location ? <p><strong>{ui.location}:</strong> {club.location}</p> : null}
              {club.price_label ? <p><strong>{ui.price}:</strong> {club.price_label}</p> : null}
            </div>
            {trainerName ? (
              <button
                type="button"
                className="club-trainer-preview"
                onClick={() => setIsTrainerCardOpen(true)}
              >
                <p className="club-detail-about-title">{ui.teacher}</p>
                <div className="club-trainer-preview-row">
                  {trainerPhoto ? (
                    <Image
                      src={trainerPhoto}
                      alt={trainerName}
                      width={72}
                      height={72}
                      className="club-trainer-avatar"
                      unoptimized
                    />
                  ) : (
                    <span className="club-trainer-avatar club-trainer-avatar-fallback">
                      {trainerName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <p className="club-trainer-name">{trainerName}</p>
                </div>
              </button>
            ) : null}
            {club.description ? (
              <div className="club-detail-about">
                <p className="club-detail-about-title">{ui.description}</p>
                <p>{club.description}</p>
              </div>
            ) : null}
            {club.section_photos?.length ? (
              <div className="club-detail-about">
                <p className="club-detail-about-title">
                  {locale === 'en' ? 'Section photos' : locale === 'kk' ? 'Секция фотолары' : 'Фото секции'}
                </p>
                <div className="school-media-thumbs">
                  {club.section_photos.map((url, index) => (
                    <button
                      key={`${url}-${index}`}
                      type="button"
                      className="school-media-thumb-button"
                      onClick={() => setActiveSectionPhoto(url)}
                      aria-label={`${locale === 'en' ? 'Open photo' : locale === 'kk' ? 'Фотоны ашу' : 'Открыть фото'} ${index + 1}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`section-${index + 1}`} className="school-media-thumb" />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </section>
      {activeSectionPhoto ? (
        <div
          className="school-teacher-modal-backdrop"
          onClick={() => setActiveSectionPhoto('')}
          role="presentation"
        >
          <div
            className="school-teacher-modal club-photo-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={locale === 'en' ? 'Section photo' : locale === 'kk' ? 'Секция фотосы' : 'Фото секции'}
          >
            <button
              type="button"
              className="school-teacher-close"
              onClick={() => setActiveSectionPhoto('')}
              aria-label={ui.close}
            >
              ×
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={activeSectionPhoto} alt="section-full" className="club-photo-modal-image" />
          </div>
        </div>
      ) : null}
      {club && trainerName && isTrainerCardOpen ? (
        <div
          className="school-teacher-modal-backdrop"
          onClick={() => setIsTrainerCardOpen(false)}
          role="presentation"
        >
          <div
            className="school-teacher-modal club-trainer-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={ui.teacher}
          >
            <button
              type="button"
              className="school-teacher-close"
              onClick={() => setIsTrainerCardOpen(false)}
              aria-label={ui.close}
            >
              ×
            </button>
            <div className="club-trainer-modal-head">
              {trainerPhoto ? (
                <Image
                  src={trainerPhoto}
                  alt={trainerName}
                  width={160}
                  height={160}
                  className="club-trainer-avatar club-trainer-avatar-large"
                  unoptimized
                />
              ) : (
                <span className="club-trainer-avatar club-trainer-avatar-fallback club-trainer-avatar-large">
                  {trainerName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <h3>{trainerName}</h3>
            </div>
            {trainerDescription ? (
              <div className="club-detail-about" style={{ marginTop: 12 }}>
                <p className="club-detail-about-title">
                  {locale === 'en' ? 'Trainer info' : locale === 'kk' ? 'Жаттықтырушы туралы' : 'О тренере'}
                </p>
                <p className="club-trainer-description-inline">{trainerDescription}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
