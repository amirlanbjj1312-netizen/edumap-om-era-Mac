'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createRatingSurveyCampaign,
  closeRatingSurveyCampaign,
  loadProgramInfoAnalytics,
  loadRatingSurveyAnalytics,
  loadRatingSurveyCampaigns,
  loadRatingSurveyConfig,
  updateRatingSurveyConfig,
} from '@/lib/api';
import { useAdminLocale } from '@/lib/adminLocale';
import { formatKzPhone } from '@/lib/phone';
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

type SurveyQuestion = {
  id?: string;
  text: string;
  description?: string;
  type?: 'rating' | 'single_choice' | 'text';
  options?: Array<{ id?: string; label: string; score?: number }>;
  required?: boolean;
  order?: number;
  enabled?: boolean;
};

type SurveyAnalyticsRow = {
  school_id: string;
  school_name: string;
  responses_count: number;
  survey_average: number;
  consultations_count: number;
  popularity_count: number;
  current_rating: number;
  calculated_rating: number;
};

type SurveyAnalyticsPayload = {
  config: {
    cycle_days: number;
    questions: SurveyQuestion[];
  };
  campaigns_count: number;
  responses_count: number;
  schools: SurveyAnalyticsRow[];
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
  const [surveyConfig, setSurveyConfig] = useState<{
    cycle_days: number;
    updated_at?: string;
    updated_by?: string;
    questions: SurveyQuestion[];
  } | null>(null);
  const [surveyQuestionsDraft, setSurveyQuestionsDraft] = useState<SurveyQuestion[]>([]);
  const [surveyCycleDaysDraft, setSurveyCycleDaysDraft] = useState(60);
  const [surveyCampaigns, setSurveyCampaigns] = useState<Array<any>>([]);
  const [surveyAnalytics, setSurveyAnalytics] = useState<SurveyAnalyticsPayload | null>(null);
  const [surveyTitle, setSurveyTitle] = useState('Опрос удовлетворенности');
  const [surveyDescription, setSurveyDescription] = useState('');
  const [surveyTargetType, setSurveyTargetType] = useState<'school' | 'all_parents' | 'specific_parents'>('school');
  const [surveySchoolIds, setSurveySchoolIds] = useState('');
  const [surveyParentEmails, setSurveyParentEmails] = useState('');
  const [surveySendAt, setSurveySendAt] = useState('');
  const [surveyLoading, setSurveyLoading] = useState(false);

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

  const loadSurveyControlData = useCallback(async () => {
    if (!token) return;
    if (!(actorRole === 'moderator' || actorRole === 'superadmin')) return;
    setSurveyLoading(true);
    try {
      const [configRes, campaignsRes, analyticsRes] = await Promise.all([
        loadRatingSurveyConfig(token),
        loadRatingSurveyCampaigns(token),
        loadRatingSurveyAnalytics(token),
      ]);
      const configData = configRes?.data || null;
      setSurveyConfig(configData);
      setSurveyQuestionsDraft(Array.isArray(configData?.questions) ? configData.questions : []);
      setSurveyCycleDaysDraft(Number(configData?.cycle_days || 60));
      setSurveyCampaigns(Array.isArray(campaignsRes?.data) ? campaignsRes.data : []);
      setSurveyAnalytics(analyticsRes?.data || null);
    } catch (error) {
      setMessage((error as Error)?.message || 'Не удалось загрузить управление анкетами');
    } finally {
      setSurveyLoading(false);
    }
  }, [actorRole, token]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    loadSurveyControlData();
  }, [loadSurveyControlData]);

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

  const canManageSurveys = actorRole === 'moderator' || actorRole === 'superadmin';

  const addSurveyQuestion = () => {
    setSurveyQuestionsDraft((prev) => [
      ...prev,
      {
        id: `question_${prev.length + 1}`,
        text: '',
        description: '',
        type: 'rating',
        options: [],
        required: true,
        order: prev.length + 1,
        enabled: true,
      },
    ]);
  };

  const updateSurveyQuestion = (
    index: number,
    field: 'text' | 'description' | 'type' | 'required' | 'enabled',
    value: string | boolean
  ) => {
    setSurveyQuestionsDraft((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const next: SurveyQuestion = { ...item, [field]: value as never };
        if (field === 'type') {
          const questionType = String(value || 'rating') as SurveyQuestion['type'];
          next.type = questionType;
          if (questionType !== 'single_choice') {
            next.options = [];
          }
        }
        return next;
      })
    );
  };

  const removeSurveyQuestion = (index: number) => {
    setSurveyQuestionsDraft((prev) => prev.filter((_, idx) => idx !== index));
  };

  const moveSurveyQuestion = (index: number, direction: -1 | 1) => {
    setSurveyQuestionsDraft((prev) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const draft = [...prev];
      const temp = draft[index];
      draft[index] = draft[nextIndex];
      draft[nextIndex] = temp;
      return draft.map((item, idx) => ({ ...item, order: idx + 1 }));
    });
  };

  const addQuestionOption = (questionIndex: number) => {
    setSurveyQuestionsDraft((prev) =>
      prev.map((item, idx) => {
        if (idx !== questionIndex) return item;
        const current = Array.isArray(item.options) ? item.options : [];
        return {
          ...item,
          options: [
            ...current,
            { id: `opt_${current.length + 1}`, label: '', score: 0 },
          ],
        };
      })
    );
  };

  const updateQuestionOption = (
    questionIndex: number,
    optionIndex: number,
    field: 'label' | 'score',
    value: string | number
  ) => {
    setSurveyQuestionsDraft((prev) =>
      prev.map((item, idx) => {
        if (idx !== questionIndex) return item;
        const options = Array.isArray(item.options) ? [...item.options] : [];
        if (!options[optionIndex]) return item;
        options[optionIndex] = { ...options[optionIndex], [field]: value as never };
        return { ...item, options };
      })
    );
  };

  const removeQuestionOption = (questionIndex: number, optionIndex: number) => {
    setSurveyQuestionsDraft((prev) =>
      prev.map((item, idx) => {
        if (idx !== questionIndex) return item;
        const options = Array.isArray(item.options)
          ? item.options.filter((_, optIdx) => optIdx !== optionIndex)
          : [];
        return { ...item, options };
      })
    );
  };

  const saveSurveyConfig = async () => {
    if (!token || !canManageSurveys) return;
    setSurveyLoading(true);
    setMessage('');
    try {
      await updateRatingSurveyConfig(token, {
        cycleDays: Math.max(1, surveyCycleDaysDraft || 60),
        questions: surveyQuestionsDraft,
      });
      await loadSurveyControlData();
      setMessage('Анкета сохранена.');
    } catch (error) {
      setMessage((error as Error)?.message || 'Не удалось сохранить анкету');
    } finally {
      setSurveyLoading(false);
    }
  };

  const createSurveyBroadcast = async () => {
    if (!token || !canManageSurveys) return;
    const schoolIds = surveySchoolIds
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const parentEmails = surveyParentEmails
      .split(',')
      .map((item) => normalizeEmail(item))
      .filter(Boolean);
    if (surveyTargetType === 'school' && !schoolIds.length) {
      setMessage('Укажите минимум один school_id для рассылки.');
      return;
    }
    if (surveyTargetType === 'specific_parents' && !parentEmails.length) {
      setMessage('Укажите минимум один email родителя.');
      return;
    }
    setSurveyLoading(true);
    setMessage('');
    try {
      await createRatingSurveyCampaign(token, {
        title: surveyTitle.trim() || 'Опрос удовлетворенности',
        description: surveyDescription.trim(),
        targetType: surveyTargetType,
        schoolIds,
        parentEmails,
        sendAt: surveySendAt ? new Date(surveySendAt).toISOString() : undefined,
      });
      setSurveyDescription('');
      setSurveySchoolIds('');
      setSurveyParentEmails('');
      setSurveySendAt('');
      await loadSurveyControlData();
      setMessage('Рассылка анкеты создана.');
    } catch (error) {
      setMessage((error as Error)?.message || 'Не удалось создать рассылку анкеты');
    } finally {
      setSurveyLoading(false);
    }
  };

  const closeCampaign = async (campaignId: string) => {
    if (!token || !campaignId) return;
    setSurveyLoading(true);
    setMessage('');
    try {
      await closeRatingSurveyCampaign(token, campaignId);
      await loadSurveyControlData();
      setMessage('Кампания закрыта.');
    } catch (error) {
      setMessage((error as Error)?.message || 'Не удалось закрыть кампанию');
    } finally {
      setSurveyLoading(false);
    }
  };

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
                                <strong>Телефон:</strong> {formatKzPhone(request.parentPhone) || '—'}
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

              {canManageSurveys ? (
                <div className="card" style={{ marginTop: 16 }}>
                  <h3 style={{ marginTop: 0 }}>Анкеты и рейтинг школ</h3>
                  <p className="muted" style={{ marginTop: 0 }}>
                    Модератор/суперадмин может менять вопросы, запускать рассылку и смотреть
                    результаты.
                  </p>

                  <div className="survey-builder-block" style={{ border: '1px solid rgba(120,106,255,0.2)', borderRadius: 12, padding: 12 }}>
                    <p style={{ marginTop: 0, fontWeight: 700 }}>Конструктор анкеты</p>
                    <label className="field" style={{ marginBottom: 10 }}>
                      <span>Периодичность рассылки (дней)</span>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        value={String(surveyCycleDaysDraft)}
                        onChange={(event) => setSurveyCycleDaysDraft(Number(event.target.value || 60))}
                      />
                    </label>
                    <div
                      style={{
                        border: '2px solid rgba(79,95,255,0.55)',
                        borderRadius: 10,
                        padding: 10,
                        background: 'rgba(79,95,255,0.06)',
                        marginBottom: 10,
                      }}
                    >
                      <p style={{ margin: '0 0 6px', fontWeight: 700 }}>Системный вопрос #1</p>
                      <p style={{ margin: 0, fontWeight: 600 }}>
                        В какой школе учитесь? (обязательно)
                      </p>
                      <p className="muted" style={{ margin: '6px 0 0' }}>
                        Этот вопрос всегда первый, его нельзя удалить. Родитель выбирает школу через
                        поиск с подсказками.
                      </p>
                    </div>
                    <div className="survey-question-list" style={{ display: 'grid', gap: 10 }}>
                      {surveyQuestionsDraft.map((question, index) => (
                        <div
                          key={`${question.id || 'q'}-${index}`}
                          className="survey-question-card"
                          style={{
                            border: '1px solid rgba(120,106,255,0.2)',
                            borderRadius: 10,
                            padding: 10,
                            display: 'grid',
                            gap: 8,
                          }}
                        >
                          <label className="field survey-question-title-field">
                            <span>Вопрос #{index + 2}</span>
                            <input
                              className="input"
                              value={String(question.text || '')}
                              onChange={(event) =>
                                updateSurveyQuestion(index, 'text', event.target.value)
                              }
                            />
                          </label>
                          <label className="field">
                            <span>Пояснение (опционально)</span>
                            <input
                              className="input"
                              value={String(question.description || '')}
                              onChange={(event) =>
                                updateSurveyQuestion(index, 'description', event.target.value)
                              }
                            />
                          </label>
                          <label className="field">
                            <span>Тип вопроса</span>
                            <select
                              className="select"
                              value={String(question.type || 'rating')}
                              onChange={(event) =>
                                updateSurveyQuestion(
                                  index,
                                  'type',
                                  event.target.value as 'rating' | 'single_choice' | 'text'
                                )
                              }
                            >
                              <option value="rating">Шкала 1–5</option>
                              <option value="single_choice">Один вариант</option>
                              <option value="text">Текстовый ответ</option>
                            </select>
                          </label>
                          {question.type === 'single_choice' ? (
                            <div className="survey-option-box" style={{ border: '1px dashed rgba(120,106,255,0.35)', borderRadius: 8, padding: 8 }}>
                              <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Варианты ответа</p>
                              <div style={{ display: 'grid', gap: 8 }}>
                                {(question.options || []).map((option, optionIndex) => (
                                  <div key={`${option.id || optionIndex}-${optionIndex}`} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <input
                                      className="input"
                                      style={{ flex: 1, minWidth: 200 }}
                                      placeholder={`Вариант #${optionIndex + 1}`}
                                      value={String(option.label || '')}
                                      onChange={(event) =>
                                        updateQuestionOption(index, optionIndex, 'label', event.target.value)
                                      }
                                    />
                                    <input
                                      className="input"
                                      type="number"
                                      min={0}
                                      max={5}
                                      style={{ width: 90 }}
                                      value={String(option.score ?? 0)}
                                      onChange={(event) =>
                                        updateQuestionOption(
                                          index,
                                          optionIndex,
                                          'score',
                                          Number(event.target.value || 0)
                                        )
                                      }
                                      title="Баллы для расчета рейтинга (0-5)"
                                    />
                                    <button
                                      type="button"
                                      className="button secondary"
                                      onClick={() => removeQuestionOption(index, optionIndex)}
                                    >
                                      Удалить
                                    </button>
                                  </div>
                                ))}
                              </div>
                              <button
                                type="button"
                                className="button secondary"
                                style={{ marginTop: 8 }}
                                onClick={() => addQuestionOption(index)}
                              >
                                Добавить вариант
                              </button>
                            </div>
                          ) : null}
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                              <input
                                type="checkbox"
                                checked={question.required !== false}
                                onChange={(event) =>
                                  updateSurveyQuestion(index, 'required', event.target.checked)
                                }
                              />
                              Обязательный
                            </label>
                            <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                              <input
                                type="checkbox"
                                checked={question.enabled !== false}
                                onChange={(event) =>
                                  updateSurveyQuestion(index, 'enabled', event.target.checked)
                                }
                              />
                              Активен
                            </label>
                            <button
                              type="button"
                              className="button secondary"
                              onClick={() => moveSurveyQuestion(index, -1)}
                              disabled={index === 0}
                            >
                              Выше
                            </button>
                            <button
                              type="button"
                              className="button secondary"
                              onClick={() => moveSurveyQuestion(index, 1)}
                              disabled={index === surveyQuestionsDraft.length - 1}
                            >
                              Ниже
                            </button>
                            <button
                              type="button"
                              className="button secondary"
                              onClick={() => removeSurveyQuestion(index)}
                            >
                              Удалить вопрос
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      <button type="button" className="button secondary" onClick={addSurveyQuestion}>
                        Добавить вопрос
                      </button>
                      <button
                        type="button"
                        className="button"
                        onClick={saveSurveyConfig}
                        disabled={surveyLoading}
                      >
                        {surveyLoading ? 'Сохраняем...' : 'Сохранить анкету'}
                      </button>
                    </div>
                    {surveyConfig?.updated_at ? (
                      <p className="muted" style={{ margin: '8px 0 0' }}>
                        Последнее обновление: {new Date(surveyConfig.updated_at).toLocaleString()}
                      </p>
                    ) : null}
                  </div>

                  <div
                    style={{
                      border: '1px solid rgba(120,106,255,0.2)',
                      borderRadius: 12,
                      padding: 12,
                      marginTop: 12,
                    }}
                  >
                    <p style={{ marginTop: 0, fontWeight: 700 }}>Рассылка анкеты</p>
                    <div style={{ display: 'grid', gap: 10 }}>
                      <label className="field">
                        <span>Название кампании</span>
                        <input
                          className="input"
                          value={surveyTitle}
                          onChange={(event) => setSurveyTitle(event.target.value)}
                        />
                      </label>
                      <label className="field">
                        <span>Описание (опционально)</span>
                        <input
                          className="input"
                          value={surveyDescription}
                          onChange={(event) => setSurveyDescription(event.target.value)}
                        />
                      </label>
                      <label className="field">
                        <span>Кому отправить анкету</span>
                        <select
                          className="input"
                          value={surveyTargetType}
                          onChange={(event) =>
                            setSurveyTargetType(
                              event.target.value as 'school' | 'all_parents' | 'specific_parents'
                            )
                          }
                        >
                          <option value="school">По списку школ</option>
                          <option value="all_parents">Всем родителям</option>
                          <option value="specific_parents">Конкретным родителям</option>
                        </select>
                      </label>
                      {surveyTargetType === 'school' ? (
                        <label className="field">
                          <span>school_id школ (через запятую)</span>
                          <input
                            className="input"
                            value={surveySchoolIds}
                            onChange={(event) => setSurveySchoolIds(event.target.value)}
                            placeholder="school-haileybury.astana,school-spectrum.astana"
                          />
                        </label>
                      ) : null}
                      {surveyTargetType === 'specific_parents' ? (
                        <label className="field">
                          <span>Email родителей (через запятую)</span>
                          <input
                            className="input"
                            value={surveyParentEmails}
                            onChange={(event) => setSurveyParentEmails(event.target.value)}
                            placeholder="parent1@mail.com,parent2@mail.com"
                          />
                        </label>
                      ) : null}
                      <label className="field">
                        <span>Дата/время отправки (пусто = сразу)</span>
                        <input
                          className="input"
                          type="datetime-local"
                          value={surveySendAt}
                          onChange={(event) => setSurveySendAt(event.target.value)}
                        />
                      </label>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button
                        type="button"
                        className="button"
                        onClick={createSurveyBroadcast}
                        disabled={surveyLoading}
                      >
                        {surveyLoading ? 'Отправляем...' : 'Создать рассылку'}
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      border: '1px solid rgba(120,106,255,0.2)',
                      borderRadius: 12,
                      padding: 12,
                      marginTop: 12,
                    }}
                  >
                    <p style={{ marginTop: 0, fontWeight: 700 }}>Кампании</p>
                    {surveyCampaigns.length ? (
                      <div style={{ display: 'grid', gap: 10 }}>
                        {surveyCampaigns.map((campaign) => (
                          <div
                            key={campaign.id}
                            style={{
                              border: '1px solid rgba(120,106,255,0.2)',
                              borderRadius: 10,
                              padding: 10,
                            }}
                          >
                            <p style={{ margin: 0, fontWeight: 700 }}>{campaign.title}</p>
                            <p className="muted" style={{ margin: '4px 0 0' }}>
                              Статус: {campaign.status} · Ответов: {campaign.responses_count || 0} ·
                              Уникальных родителей: {campaign.unique_users_count || 0}
                            </p>
                            <p className="muted" style={{ margin: '4px 0 0' }}>
                              Аудитория: {campaign.target_label || 'По школам'}
                            </p>
                            {Array.isArray(campaign.parent_emails) && campaign.parent_emails.length ? (
                              <p className="muted" style={{ margin: '4px 0 0' }}>
                                Родители: {campaign.parent_emails.join(', ')}
                              </p>
                            ) : null}
                            {Array.isArray(campaign.school_ids) && campaign.school_ids.length ? (
                              <p className="muted" style={{ margin: '4px 0 0' }}>
                                Школы: {(campaign.school_names || campaign.school_ids || []).join(', ')}
                              </p>
                            ) : null}
                            {campaign.status !== 'closed' ? (
                              <button
                                type="button"
                                className="button secondary"
                                style={{ marginTop: 8 }}
                                onClick={() => closeCampaign(String(campaign.id || ''))}
                                disabled={surveyLoading}
                              >
                                Закрыть кампанию
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="muted" style={{ marginBottom: 0 }}>
                        Кампаний пока нет.
                      </p>
                    )}
                  </div>

                  <div
                    style={{
                      border: '1px solid rgba(120,106,255,0.2)',
                      borderRadius: 12,
                      padding: 12,
                      marginTop: 12,
                      overflowX: 'auto',
                    }}
                  >
                    <p style={{ marginTop: 0, fontWeight: 700 }}>
                      Результаты и расчет рейтинга (по школам)
                    </p>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '6px 8px' }}>Школа</th>
                          <th style={{ textAlign: 'left', padding: '6px 8px' }}>Ответов</th>
                          <th style={{ textAlign: 'left', padding: '6px 8px' }}>Средний опрос</th>
                          <th style={{ textAlign: 'left', padding: '6px 8px' }}>Консультации</th>
                          <th style={{ textAlign: 'left', padding: '6px 8px' }}>Популярность</th>
                          <th style={{ textAlign: 'left', padding: '6px 8px' }}>Текущий рейтинг</th>
                          <th style={{ textAlign: 'left', padding: '6px 8px' }}>Расчетный рейтинг</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(surveyAnalytics?.schools || []).map((row) => (
                          <tr key={row.school_id}>
                            <td style={{ padding: '6px 8px', borderTop: '1px solid rgba(120,106,255,0.15)' }}>
                              {row.school_name}
                            </td>
                            <td style={{ padding: '6px 8px', borderTop: '1px solid rgba(120,106,255,0.15)' }}>
                              {row.responses_count}
                            </td>
                            <td style={{ padding: '6px 8px', borderTop: '1px solid rgba(120,106,255,0.15)' }}>
                              {row.survey_average || 0}
                            </td>
                            <td style={{ padding: '6px 8px', borderTop: '1px solid rgba(120,106,255,0.15)' }}>
                              {row.consultations_count || 0}
                            </td>
                            <td style={{ padding: '6px 8px', borderTop: '1px solid rgba(120,106,255,0.15)' }}>
                              {row.popularity_count || 0}
                            </td>
                            <td style={{ padding: '6px 8px', borderTop: '1px solid rgba(120,106,255,0.15)' }}>
                              {row.current_rating || 0}
                            </td>
                            <td style={{ padding: '6px 8px', borderTop: '1px solid rgba(120,106,255,0.15)' }}>
                              {row.calculated_rating || 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </>
      )}
    </div>
  );
}
