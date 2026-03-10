'use client';

import { useEffect, useState } from 'react';
import { loadNewsFeed } from '@/lib/api';

type NewsItem = {
  id: string;
  title?: string;
  title_ru?: string;
  title_en?: string;
  title_kk?: string;
  summary?: string;
  summary_ru?: string;
  summary_en?: string;
  summary_kk?: string;
  published_at?: string;
};

const pickLocalized = (item: NewsItem) =>
  item.title_ru || item.title || item.title_en || item.title_kk || 'Новость';

const pickSummary = (item: NewsItem) =>
  item.summary_ru || item.summary || item.summary_en || item.summary_kk || '';

export default function ParentNewsPage() {
  const [rows, setRows] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    loadNewsFeed()
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

  return (
    <div className="card">
      <h2 className="section-title">Новости</h2>
      {loading ? <p className="muted">Загрузка...</p> : null}
      {!loading && !rows.length ? <p className="muted">Новостей пока нет.</p> : null}
      <div style={{ display: 'grid', gap: 12 }}>
        {rows.map((item) => (
          <div
            key={item.id}
            style={{
              border: '1px solid rgba(120,106,255,0.18)',
              borderRadius: 14,
              background: '#fff',
              padding: 14,
            }}
          >
            <p style={{ margin: 0, fontWeight: 700, fontSize: 18 }}>{pickLocalized(item)}</p>
            {pickSummary(item) ? <p className="muted" style={{ marginTop: 8 }}>{pickSummary(item)}</p> : null}
            <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
              {item.published_at ? new Date(item.published_at).toLocaleString() : '—'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
