'use client';

import { useEffect, useState } from 'react';
import { loadCourseTests } from '@/lib/api';
import Link from 'next/link';
import { isGuestMode } from '@/lib/guestMode';

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

  return (
    <div className="card">
      <h2 className="section-title">Курсы</h2>
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
          <p style={{ margin: 0, fontWeight: 700 }}>Курсы доступны после входа</p>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            Войдите как родитель, чтобы пройти тесты и сохранить прогресс.
          </p>
          <Link className="button" href="/login">
            Войти
          </Link>
        </div>
      ) : null}
      {loading ? <p className="muted">Загрузка...</p> : null}
      {!loading && !Object.keys(rows).length ? <p className="muted">Курсы пока не добавлены.</p> : null}
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
              {SUBJECT_TITLES[subjectId] || toText(subjectId) || 'Предмет'}
            </p>
            <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
              {(tests || []).map((test) => (
                <div key={test.id} style={{ borderRadius: 10, background: '#f6f8ff', padding: 10 }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>{toText(test.title) || 'Тест'}</p>
                  <p className="muted" style={{ margin: '4px 0 0' }}>
                    Класс: {toText(test.grade) || '—'}
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
