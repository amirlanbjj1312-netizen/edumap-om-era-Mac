'use client';

import { useEffect, useState } from 'react';
import { loadCourseTests } from '@/lib/api';
import Link from 'next/link';
import { isGuestMode } from '@/lib/guestMode';
import { useParentLocale } from '@/lib/parentLocale';

const SUBJECT_TITLES: Record<string, string> = {
  math: 'Mathematics',
  reading: 'Reading & Language',
  science: 'Science Basics',
  art: 'Art & Creativity',
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

export default function ParentCoursesPage() {
  const { locale, t } = useParentLocale();
  const [guest] = useState(() => isGuestMode());
  const [rows, setRows] = useState<Record<string, Array<{ id: string; title?: unknown; grade?: unknown }>>>({});
  const [loading, setLoading] = useState(() => !isGuestMode());

  useEffect(() => {
    if (guest) return;
    let mounted = true;
    loadCourseTests()
      .then((payload) => {
        if (!mounted) return;
        setRows((payload?.data || {}) as Record<string, Array<{ id: string; title?: unknown; grade?: unknown }>>);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [guest]);

  const ui =
    locale === 'en'
      ? {
          lockedTitle: 'Courses are available after sign in',
          lockedHint: 'Sign in as a parent to take tests and save progress.',
          empty: 'No courses have been added yet.',
          subject: 'Subject',
          test: 'Test',
          grade: 'Grade',
        }
      : locale === 'kk'
      ? {
          lockedTitle: 'Курстар кіруден кейін қолжетімді',
          lockedHint: 'Тесттерден өтіп, прогресті сақтау үшін ата-ана ретінде кіріңіз.',
          empty: 'Курстар әлі қосылмаған.',
          subject: 'Пән',
          test: 'Тест',
          grade: 'Сынып',
        }
      : {
          lockedTitle: 'Курсы доступны после входа',
          lockedHint: 'Войдите как родитель, чтобы пройти тесты и сохранить прогресс.',
          empty: 'Курсы пока не добавлены.',
          subject: 'Предмет',
          test: 'Тест',
          grade: 'Класс',
        };

  return (
    <div className="card">
      <h2 className="section-title">{t('nav_courses')}</h2>
      {guest ? (
        <div
          style={{
            marginBottom: 12,
            border: '1px solid rgba(86,103,253,0.22)',
            borderRadius: 12,
            padding: 12,
            background: '#f4f7ff',
          }}
        >
          <p style={{ margin: 0, fontWeight: 700 }}>{ui.lockedTitle}</p>
          <p className="muted" style={{ margin: '6px 0 0' }}>{ui.lockedHint}</p>
          <Link className="button" href="/login">
            {t('sign_in')}
          </Link>
        </div>
      ) : null}
      {loading ? <p className="muted">{t('loading')}</p> : null}
      {!loading && !Object.keys(rows).length ? <p className="muted">{ui.empty}</p> : null}
      <div style={{ display: 'grid', gap: 14 }}>
        {Object.entries(rows).map(([subjectId, tests]) => (
          <div
            key={subjectId}
            style={{
              border: '1px solid rgba(120,106,255,0.18)',
              borderRadius: 14,
              background: '#fff',
              padding: 12,
            }}
          >
            <p style={{ margin: 0, fontWeight: 700 }}>
              {SUBJECT_TITLES[subjectId] || toText(subjectId) || ui.subject}
            </p>
            <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
              {(tests || []).map((test) => (
                <div key={test.id} style={{ borderRadius: 10, background: '#f6f8ff', padding: 10 }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>
                    {toText((test.title as any)?.[locale] ?? test.title) || ui.test}
                  </p>
                  <p className="muted" style={{ margin: '4px 0 0' }}>
                    {ui.grade}: {toText(test.grade) || '—'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
