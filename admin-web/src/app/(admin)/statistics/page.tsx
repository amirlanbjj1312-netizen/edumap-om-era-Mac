'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadProgramInfoAnalytics } from '@/lib/api';
import { useAdminLocale } from '@/lib/adminLocale';
import { supabase } from '@/lib/supabaseClient';

export default function StatisticsPage() {
  const { t } = useAdminLocale();
  const [token, setToken] = useState('');
  const [actorRole, setActorRole] = useState('user');
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [message, setMessage] = useState('');
  const [summary, setSummary] = useState<{
    days: number;
    totals: { open: number; read_more: number; close: number };
    topPrograms: Array<{ program_name: string; open: number; read_more: number; close: number }>;
    topSchools: Array<{
      school_id: string;
      school_name: string;
      open: number;
      read_more: number;
      close: number;
    }>;
    sampled_events: number;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const session = data?.session;
      setToken(session?.access_token || '');
      setActorRole(
        session?.user?.user_metadata?.role || session?.user?.app_metadata?.role || 'user'
      );
      setAuthReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const canView = actorRole === 'moderator' || actorRole === 'superadmin';

  const reload = useCallback(async () => {
    if (!token || !canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const response = await loadProgramInfoAnalytics(token, { days, limit: 12 });
      setSummary(response?.data || null);
    } catch (error) {
      setMessage((error as Error)?.message || t('saveError'));
    } finally {
      setLoading(false);
    }
  }, [canView, days, t, token]);

  useEffect(() => {
    reload();
  }, [reload]);

  const readMoreRate = useMemo(() => {
    const open = Number(summary?.totals?.open || 0);
    const readMore = Number(summary?.totals?.read_more || 0);
    if (!open) return 0;
    return Math.round((readMore / open) * 100);
  }, [summary]);

  if (!authReady) {
    return <div className="card">{t('checkingSession')}</div>;
  }

  if (!canView) {
    return <div className="card">{t('usersForbidden')}</div>;
  }

  return (
    <div className="card">
      <div className="requests-head">
        <h2>{t('statisticsTitle')}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={String(days)} onChange={(event) => setDays(Number(event.target.value))}>
            <option value="7">7d</option>
            <option value="30">30d</option>
            <option value="90">90d</option>
          </select>
          <button type="button" className="button secondary" onClick={reload}>
            {t('usersRefresh')}
          </button>
        </div>
      </div>

      <p className="muted">{t('statisticsProgramInfoHint')}</p>
      {message ? <p className="status">{message}</p> : null}

      {loading ? (
        <p className="muted">{t('usersLoading')}</p>
      ) : (
        <>
          <div className="schools-admin-list">
            <div className="schools-admin-card">
              <p className="request-title">{t('statisticsProgramInfoOpen')}</p>
              <p className="muted">{summary?.totals?.open || 0}</p>
            </div>
            <div className="schools-admin-card">
              <p className="request-title">{t('statisticsProgramInfoReadMore')}</p>
              <p className="muted">{summary?.totals?.read_more || 0}</p>
            </div>
            <div className="schools-admin-card">
              <p className="request-title">{t('statisticsProgramInfoClose')}</p>
              <p className="muted">{summary?.totals?.close || 0}</p>
            </div>
            <div className="schools-admin-card">
              <p className="request-title">{t('statisticsProgramInfoRate')}</p>
              <p className="muted">{readMoreRate}%</p>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>{t('statisticsTopPrograms')}</h3>
            {summary?.topPrograms?.length ? (
              <div className="schools-admin-list">
                {summary.topPrograms.map((row) => (
                  <div key={row.program_name} className="schools-admin-card">
                    <p className="request-title">{row.program_name}</p>
                    <p className="muted">
                      {t('statisticsProgramInfoOpen')}: {row.open}
                    </p>
                    <p className="muted">
                      {t('statisticsProgramInfoReadMore')}: {row.read_more}
                    </p>
                    <p className="muted">
                      {t('statisticsProgramInfoClose')}: {row.close}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">{t('usersReviewsEmpty')}</p>
            )}
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>{t('statisticsTopSchools')}</h3>
            {summary?.topSchools?.length ? (
              <div className="schools-admin-list">
                {summary.topSchools.map((row) => (
                  <div key={row.school_id} className="schools-admin-card">
                    <p className="request-title">{row.school_name || row.school_id}</p>
                    <p className="muted">{row.school_id}</p>
                    <p className="muted">
                      {t('statisticsProgramInfoOpen')}: {row.open}
                    </p>
                    <p className="muted">
                      {t('statisticsProgramInfoReadMore')}: {row.read_more}
                    </p>
                    <p className="muted">
                      {t('statisticsProgramInfoClose')}: {row.close}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">{t('usersReviewsEmpty')}</p>
            )}
          </div>

          <p className="muted" style={{ marginTop: 12 }}>
            {t('statisticsSampledEvents')}: {summary?.sampled_events || 0}
          </p>
        </>
      )}
    </div>
  );
}
