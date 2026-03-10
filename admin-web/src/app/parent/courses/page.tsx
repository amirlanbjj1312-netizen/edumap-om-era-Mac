'use client';

import { useEffect, useState } from 'react';
import { loadCourseTests } from '@/lib/api';

const SUBJECT_TITLES: Record<string, string> = {
  math: 'Mathematics',
  reading: 'Reading & Language',
  science: 'Science Basics',
  art: 'Art & Creativity',
};

export default function ParentCoursesPage() {
  const [rows, setRows] = useState<Record<string, Array<{ id: string; title: string; grade?: string }>>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    loadCourseTests()
      .then((payload) => {
        if (!mounted) return;
        setRows((payload?.data || {}) as Record<string, Array<{ id: string; title: string; grade?: string }>>);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="card">
      <h2 className="section-title">Курсы</h2>
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
              {SUBJECT_TITLES[subjectId] || subjectId}
            </p>
            <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
              {(tests || []).map((test) => (
                <div key={test.id} style={{ borderRadius: 10, background: '#f6f8ff', padding: 10 }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>{test.title || 'Тест'}</p>
                  <p className="muted" style={{ margin: '4px 0 0' }}>
                    Класс: {test.grade || '—'}
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
