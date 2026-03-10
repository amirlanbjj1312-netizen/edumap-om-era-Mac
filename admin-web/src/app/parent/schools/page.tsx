'use client';

import { useEffect, useMemo, useState } from 'react';
import { loadSchools } from '@/lib/api';

type SchoolRow = {
  school_id?: string;
  basic_info?: {
    name?: string;
    city?: string;
    district?: string;
  };
  system?: {
    rating?: number;
    reviews_count?: number;
  };
};

export default function ParentSchoolsPage() {
  const [rows, setRows] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let mounted = true;
    loadSchools()
      .then((payload) => {
        if (!mounted) return;
        setRows(Array.isArray(payload?.data) ? payload.data : []);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const name = String(row.basic_info?.name || '').toLowerCase();
      const city = String(row.basic_info?.city || '').toLowerCase();
      const district = String(row.basic_info?.district || '').toLowerCase();
      return name.includes(q) || city.includes(q) || district.includes(q);
    });
  }, [query, rows]);

  return (
    <div className="card">
      <h2 className="section-title">Школы</h2>
      <div className="field" style={{ marginBottom: 12 }}>
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по названию, городу, району"
        />
      </div>
      {loading ? <p className="muted">Загрузка...</p> : null}
      {!loading && !filtered.length ? <p className="muted">Школы не найдены.</p> : null}
      <div style={{ display: 'grid', gap: 10 }}>
        {filtered.slice(0, 80).map((row, index) => (
          <div
            key={row.school_id || String(index)}
            style={{
              border: '1px solid rgba(120,106,255,0.18)',
              borderRadius: 14,
              background: '#fff',
              padding: 12,
            }}
          >
            <p style={{ margin: 0, fontWeight: 700 }}>
              {row.basic_info?.name || 'Школа'}
            </p>
            <p className="muted" style={{ margin: '6px 0 0' }}>
              {[row.basic_info?.city, row.basic_info?.district].filter(Boolean).join(', ') || '—'}
            </p>
            <p className="muted" style={{ margin: '6px 0 0' }}>
              Рейтинг: {row.system?.rating ?? '—'} · Отзывы: {row.system?.reviews_count ?? 0}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
