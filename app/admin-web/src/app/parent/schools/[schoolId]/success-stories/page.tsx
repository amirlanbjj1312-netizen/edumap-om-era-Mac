'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { loadSchoolById } from '@/lib/api';
import { useParentLocale } from '@/lib/parentLocale';

type SchoolRow = {
  school_id?: string;
  [key: string]: unknown;
};

type StoryCard = {
  student_name: string;
  admitted_to: string;
  ent_score: string;
  ielts_score: string;
  sat_score: string;
  school_average_score: string;
  achievements: string;
  application_deadline: string;
  student_photo: string;
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

export default function ParentSchoolSuccessStoriesPage() {
  const { locale } = useParentLocale();
  const params = useParams<{ schoolId: string }>();
  const schoolId = decodeURIComponent(String(params?.schoolId || ''));
  const [school, setSchool] = useState<SchoolRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

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

  const stories = useMemo<StoryCard[]>(() => {
    const raw = getIn(school, 'education.results.student_success_stories');
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => ({
        student_name: toText((item as Record<string, unknown>)?.student_name),
        admitted_to: toText((item as Record<string, unknown>)?.admitted_to),
        ent_score: toText((item as Record<string, unknown>)?.ent_score),
        ielts_score: toText((item as Record<string, unknown>)?.ielts_score),
        sat_score: toText((item as Record<string, unknown>)?.sat_score),
        school_average_score: toText((item as Record<string, unknown>)?.school_average_score),
        achievements: toText((item as Record<string, unknown>)?.achievements),
        application_deadline: toText((item as Record<string, unknown>)?.application_deadline),
        student_photo: toText((item as Record<string, unknown>)?.student_photo),
      }))
      .filter((item) => item.student_name || item.admitted_to || item.achievements);
  }, [school]);

  const activeStory = stories[activeIndex] || null;

  const ui = {
    back: locale === 'en' ? 'Back to school' : locale === 'kk' ? 'Мектепке оралу' : 'Назад к школе',
    title: locale === 'en' ? 'Our pride' : locale === 'kk' ? 'Біздің мақтанышымыз' : 'Наша гордость',
    loading: locale === 'en' ? 'Loading...' : locale === 'kk' ? 'Жүктелуде...' : 'Загрузка...',
    empty:
      locale === 'en'
        ? 'School has not added graduates yet.'
        : locale === 'kk'
          ? 'Мектеп түлектерді әлі қоспаған.'
          : 'Школа пока не добавила выпускников.',
    admittedTo: locale === 'en' ? 'Admitted to' : locale === 'kk' ? 'Түскен орны' : 'Поступил(а) в',
    schoolGpa:
      locale === 'en' ? 'School GPA' : locale === 'kk' ? 'Мектептегі орташа балл' : 'Средний балл в школе',
    achievements:
      locale === 'en' ? 'Achievements' : locale === 'kk' ? 'Жетістіктер' : 'Достижения',
    deadline:
      locale === 'en' ? 'Application deadline' : locale === 'kk' ? 'Құжат тапсыру мерзімі' : 'Срок подачи документов',
  };

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
        {!loading && !stories.length ? <p className="muted">{ui.empty}</p> : null}
        {!loading && stories.length ? (
          <>
            <div className="success-stories-strip">
              {stories.map((story, index) => (
                <button
                  key={`${story.student_name || 'story'}-${index}`}
                  type="button"
                  className={`success-story-chip ${activeIndex === index ? 'active' : ''}`}
                  onClick={() => setActiveIndex(index)}
                >
                  {story.student_photo ? (
                    <Image
                      src={story.student_photo}
                      alt={story.student_name || `story-${index + 1}`}
                      width={56}
                      height={56}
                      className="success-story-chip-photo"
                      unoptimized
                    />
                  ) : (
                    <div className="success-story-chip-photo success-story-chip-empty">
                      {(story.student_name || 'В').slice(0, 1)}
                    </div>
                  )}
                  <span className="success-story-chip-name">{story.student_name || `Выпускник ${index + 1}`}</span>
                </button>
              ))}
            </div>
            {activeStory ? (
              <div className="success-story-detail">
                <div className="success-story-detail-head">
                  {activeStory.student_photo ? (
                    <Image
                      src={activeStory.student_photo}
                      alt={activeStory.student_name || 'graduate'}
                      width={112}
                      height={112}
                      className="success-story-detail-photo"
                      unoptimized
                    />
                  ) : (
                    <div className="success-story-detail-photo success-story-chip-empty">
                      {(activeStory.student_name || 'В').slice(0, 1)}
                    </div>
                  )}
                  <div className="success-story-detail-meta">
                    <h4>{activeStory.student_name || 'Выпускник'}</h4>
                    {activeStory.admitted_to ? <p>{`${ui.admittedTo}: ${activeStory.admitted_to}`}</p> : null}
                  </div>
                </div>
                <div className="school-service-list">
                  {activeStory.school_average_score ? (
                    <div className="school-service-item">
                      <p>{ui.schoolGpa}</p>
                      <strong>{activeStory.school_average_score}</strong>
                    </div>
                  ) : null}
                  {(activeStory.ent_score || activeStory.ielts_score || activeStory.sat_score) ? (
                    <div className="school-service-item">
                      <p>Scores</p>
                      <strong>
                        {[
                          activeStory.ent_score ? `ЕНТ: ${activeStory.ent_score}` : '',
                          activeStory.ielts_score ? `IELTS: ${activeStory.ielts_score}` : '',
                          activeStory.sat_score ? `SAT: ${activeStory.sat_score}` : '',
                        ]
                          .filter(Boolean)
                          .join(' • ')}
                      </strong>
                    </div>
                  ) : null}
                  {activeStory.application_deadline ? (
                    <div className="school-service-item">
                      <p>{ui.deadline}</p>
                      <strong>{activeStory.application_deadline}</strong>
                    </div>
                  ) : null}
                  {activeStory.achievements ? (
                    <div className="school-service-item">
                      <p>{ui.achievements}</p>
                      <strong>{activeStory.achievements}</strong>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  );
}
