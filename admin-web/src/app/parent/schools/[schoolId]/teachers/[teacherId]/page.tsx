'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { loadSchools } from '@/lib/api';
import { useParentLocale } from '@/lib/parentLocale';
import { buildSchoolTeachers } from '@/lib/clubViews';

const getSchoolId = (value: unknown): string => {
  if (!value || typeof value !== 'object') return '';
  const raw = (value as Record<string, unknown>).school_id;
  return typeof raw === 'string' ? raw : '';
};

export default function ParentSchoolTeacherPage() {
  const { locale } = useParentLocale();
  const params = useParams<{ schoolId: string; teacherId: string }>();
  const schoolId = decodeURIComponent(String(params?.schoolId || ''));
  const teacherId = decodeURIComponent(String(params?.teacherId || ''));

  const [rows, setRows] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

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
  const teachers = useMemo(() => buildSchoolTeachers(school, locale), [school, locale]);
  const teacher = useMemo(
    () => teachers.find((item) => item.id === teacherId) || null,
    [teachers, teacherId]
  );

  const ui = {
    back: locale === 'en' ? 'Back' : locale === 'kk' ? 'Артқа' : 'Назад',
    notFound:
      locale === 'en'
        ? 'Teacher profile not found.'
        : locale === 'kk'
          ? 'Мұғалім профилі табылмады.'
          : 'Профиль преподавателя не найден.',
    about: locale === 'en' ? 'About teacher' : locale === 'kk' ? 'Мұғалім туралы' : 'О преподавателе',
    subjects: locale === 'en' ? 'Subjects' : locale === 'kk' ? 'Пәндер' : 'Предметы',
    experience: locale === 'en' ? 'Experience' : locale === 'kk' ? 'Тәжірибе' : 'Стаж',
    category: locale === 'en' ? 'Category' : locale === 'kk' ? 'Санат' : 'Категория',
    languages: locale === 'en' ? 'Languages' : locale === 'kk' ? 'Тілдер' : 'Языки',
    years: locale === 'en' ? 'years' : locale === 'kk' ? 'жыл' : 'лет',
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
        {!loading && !teacher ? <p className="muted">{ui.notFound}</p> : null}
        {teacher ? (
          <div className="teacher-profile">
            {teacher.photo_url ? (
              <Image
                src={teacher.photo_url}
                alt={teacher.full_name}
                width={180}
                height={180}
                className="teacher-profile-photo"
                unoptimized
              />
            ) : (
              <div className="teacher-profile-photo teacher-profile-photo-empty">
                {teacher.full_name.slice(0, 1)}
              </div>
            )}
            <h3 className="school-mobile-photo-title">{teacher.full_name}</h3>
            {teacher.position ? <p className="muted" style={{ marginTop: -4 }}>{teacher.position}</p> : null}
            <div className="club-detail-lines">
              {teacher.subjects ? <p><strong>{ui.subjects}:</strong> {teacher.subjects}</p> : null}
              {teacher.experience_years ? <p><strong>{ui.experience}:</strong> {teacher.experience_years} {ui.years}</p> : null}
              {teacher.category ? <p><strong>{ui.category}:</strong> {teacher.category}</p> : null}
              {teacher.teaching_languages ? <p><strong>{ui.languages}:</strong> {teacher.teaching_languages}</p> : null}
            </div>
            {teacher.bio ? (
              <div className="club-detail-about">
                <p className="club-detail-about-title">{ui.about}</p>
                <p>{teacher.bio}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
