'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadProgramInfoAnalytics } from '@/lib/api';
import { useAdminLocale } from '@/lib/adminLocale';
import { supabase } from '@/lib/supabaseClient';
import { requestJson } from '@/lib/api';

type ConsultationRequest = {
  id: string;
  createdAt?: string;
  schoolId?: string;
  parentName?: string;
  parentPhone?: string;
  childName?: string;
  consultationType?: string;
};

const normalizeEmail = (value: string) => String(value || '').trim().toLowerCase();
const buildFallbackSchoolId = (email: string) => {
  const base = normalizeEmail(email)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `local-${base || 'school'}`;
};
const splitToList = (value: unknown) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
const getLocalizedValue = (value: any, locale: 'ru' | 'en' | 'kk' = 'ru') => {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    return String(value?.[locale] || value?.ru || value?.en || value?.kk || '').trim();
  }
  return '';
};

export default function StatisticsPage() {
  const { t } = useAdminLocale();
  const [token, setToken] = useState('');
  const [actorRole, setActorRole] = useState('user');
  const [actorEmail, setActorEmail] = useState('');
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [message, setMessage] = useState('');
  const [ownSchool, setOwnSchool] = useState<any | null>(null);
  const [consultations, setConsultations] = useState<ConsultationRequest[]>([]);
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
      setActorEmail(String(session?.user?.email || ''));
      setAuthReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const canView =
    actorRole === 'admin' || actorRole === 'moderator' || actorRole === 'superadmin';
  const isSchoolAdmin = actorRole === 'admin';

  const reload = useCallback(async () => {
    if (!token || !canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      if (isSchoolAdmin) {
        const [consultationsResponse, schoolsResponse] = await Promise.all([
          requestJson<{ data?: ConsultationRequest[] }>('/consultations', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          requestJson<{ data?: any[] }>('/schools?include_inactive=1&include_hidden=1'),
        ]);
        const allSchools = Array.isArray(schoolsResponse?.data) ? schoolsResponse.data : [];
        const email = normalizeEmail(actorEmail);
        const fallbackSchoolId = buildFallbackSchoolId(email).toLowerCase();
        const school =
          allSchools.find((item) => normalizeEmail(item?.basic_info?.email) === email) ||
          allSchools.find(
            (item) => String(item?.school_id || '').trim().toLowerCase() === fallbackSchoolId
          ) ||
          null;
        setOwnSchool(school);
        setConsultations(
          Array.isArray(consultationsResponse?.data) ? consultationsResponse.data : []
        );
        setSummary(null);
      } else {
        const response = await loadProgramInfoAnalytics(token, { days, limit: 12 });
        setSummary(response?.data || null);
        setOwnSchool(null);
        setConsultations([]);
      }
    } catch (error) {
      setMessage((error as Error)?.message || t('saveError'));
    } finally {
      setLoading(false);
    }
  }, [actorEmail, canView, days, isSchoolAdmin, t, token]);

  useEffect(() => {
    reload();
  }, [reload]);

  const readMoreRate = useMemo(() => {
    const open = Number(summary?.totals?.open || 0);
    const readMore = Number(summary?.totals?.read_more || 0);
    if (!open) return 0;
    return Math.round((readMore / open) * 100);
  }, [summary]);

  const schoolStats = useMemo(() => {
    if (!ownSchool) return null;
    const reviews = Array.isArray(ownSchool?.reviews?.items) ? ownSchool.reviews.items : [];
    const ratingAvg = reviews.length
      ? (
          reviews.reduce((acc: number, row: any) => acc + Number(row?.rating || 0), 0) /
          reviews.length
        ).toFixed(1)
      : '0.0';
    const photos = splitToList(ownSchool?.media?.photos);
    const staff = Array.isArray(ownSchool?.services?.teaching_staff?.members)
      ? ownSchool.services.teaching_staff.members
      : [];
    const programs = splitToList(getLocalizedValue(ownSchool?.education?.programs, 'ru'));

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const requestsToday = consultations.filter((row) => {
      const ts = new Date(row?.createdAt || 0).getTime();
      return Number.isFinite(ts) && now - ts <= dayMs;
    }).length;
    const requestsWeek = consultations.filter((row) => {
      const ts = new Date(row?.createdAt || 0).getTime();
      return Number.isFinite(ts) && now - ts <= 7 * dayMs;
    }).length;
    const requestsMonth = consultations.filter((row) => {
      const ts = new Date(row?.createdAt || 0).getTime();
      return Number.isFinite(ts) && now - ts <= 30 * dayMs;
    }).length;

    return {
      ratingAvg,
      reviewsCount: reviews.length,
      photosCount: photos.length,
      staffCount: staff.length,
      programsCount: programs.length,
      requestsTotal: consultations.length,
      requestsToday,
      requestsWeek,
      requestsMonth,
    };
  }, [consultations, ownSchool]);

  const recentConsultations = useMemo(
    () =>
      [...consultations]
        .sort(
          (a, b) =>
            new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime()
        )
        .slice(0, 10),
    [consultations]
  );

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

      {isSchoolAdmin ? (
        <p className="muted">Базовая аналитика вашей школы: заявки, рейтинг, контент и профиль.</p>
      ) : (
        <p className="muted">{t('statisticsProgramInfoHint')}</p>
      )}
      {message ? <p className="status">{message}</p> : null}

      {loading ? (
        <p className="muted">{t('usersLoading')}</p>
      ) : (
        <>
          {isSchoolAdmin ? (
            <>
              {ownSchool ? (
                <>
                  <div className="schools-admin-list">
                    <div className="schools-admin-card">
                      <p className="request-title">Заявки всего</p>
                      <p className="muted">{schoolStats?.requestsTotal || 0}</p>
                    </div>
                    <div className="schools-admin-card">
                      <p className="request-title">Заявки за сегодня</p>
                      <p className="muted">{schoolStats?.requestsToday || 0}</p>
                    </div>
                    <div className="schools-admin-card">
                      <p className="request-title">Заявки за 7 дней</p>
                      <p className="muted">{schoolStats?.requestsWeek || 0}</p>
                    </div>
                    <div className="schools-admin-card">
                      <p className="request-title">Заявки за 30 дней</p>
                      <p className="muted">{schoolStats?.requestsMonth || 0}</p>
                    </div>
                    <div className="schools-admin-card">
                      <p className="request-title">Средний рейтинг</p>
                      <p className="muted">{schoolStats?.ratingAvg || '0.0'}</p>
                    </div>
                    <div className="schools-admin-card">
                      <p className="request-title">Количество отзывов</p>
                      <p className="muted">{schoolStats?.reviewsCount || 0}</p>
                    </div>
                    <div className="schools-admin-card">
                      <p className="request-title">Фото в карточке</p>
                      <p className="muted">{schoolStats?.photosCount || 0}</p>
                    </div>
                    <div className="schools-admin-card">
                      <p className="request-title">Карточек преподавателей</p>
                      <p className="muted">{schoolStats?.staffCount || 0}</p>
                    </div>
                    <div className="schools-admin-card">
                      <p className="request-title">Учебных программ</p>
                      <p className="muted">{schoolStats?.programsCount || 0}</p>
                    </div>
                  </div>

                  <div className="card" style={{ marginTop: 16 }}>
                    <h3 style={{ marginTop: 0 }}>Последние заявки</h3>
                    {recentConsultations.length ? (
                      <div className="requests-list">
                        {recentConsultations.map((request) => (
                          <div key={request.id} className="request-card">
                            <div className="request-body">
                              <p className="request-title">
                                {request.parentName || '—'} {'→'} {request.childName || '—'}
                              </p>
                              <p className="muted">
                                {request.consultationType || 'First meeting'} ·{' '}
                                {request.createdAt
                                  ? new Date(request.createdAt).toLocaleString()
                                  : '—'}
                              </p>
                              <p>
                                <strong>Телефон:</strong> {request.parentPhone || '—'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="muted">Заявок пока нет.</p>
                    )}
                  </div>
                </>
              ) : (
                <p className="muted">
                  Школа для этого аккаунта не найдена. Укажите email школы в разделе контактов.
                </p>
              )}
            </>
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
        </>
      )}
    </div>
  );
}
