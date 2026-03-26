'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  approveReviewById,
  createRatingSurveyCampaign,
  closeRatingSurveyCampaign,
  deleteReviewById,
  loadEngagementAnalytics,
  loadAllReviews,
  loadProgramInfoAnalytics,
  loadRatingSurveyAnalytics,
  loadRatingSurveyCampaigns,
  loadRatingSurveyConfig,
  resetProgramInfoAnalytics,
  resetSchoolRating,
  rejectReviewById,
  resetEngagementAnalytics,
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

type ReviewModerationRow = {
  id: string;
  school_id: string;
  school_name: string;
  author: string;
  text: string;
  rating: number;
  created_at: string;
  status?: string;
  source?: string;
};

type EngagementSummaryPayload = {
  days: number;
  mode?: 'global' | 'school';
  school_id?: string;
  school_name?: string;
  reset_at?: string | null;
  sampled_events: number;
  unique_auth_parents?: number;
  totals?: {
    school_card_view: number;
    unique_auth_parents: number;
    compare_add: number;
    favorite_add: number;
    school_map_open: number;
    contact_phone_click: number;
    contact_whatsapp_click: number;
    contact_website_click: number;
    contact_click_total: number;
    price_open: number;
    admission_open: number;
    ai_school_mention: number;
  };
  topEvents: Array<{
    event_type: string;
    all: number;
    guest: number;
    auth: number;
  }>;
  timeline: Array<{
    date: string;
    school_card_view: number;
    compare_add: number;
    favorite_add?: number;
    school_map_open?: number;
    contact_phone_click?: number;
    contact_whatsapp_click?: number;
    contact_website_click?: number;
    price_open?: number;
    admission_open?: number;
    ai_school_mention?: number;
    ai_match_run: number;
    ai_chat_open: number;
    ai_chat_message: number;
    guest_gate_click: number;
  }>;
  topSchools?: Array<{
    school_id: string;
    school_name: string;
    views: number;
    compare_adds: number;
    guest_views: number;
    auth_views: number;
  }>;
};

const ENGAGEMENT_LABELS: Record<string, string> = {
  school_card_view: 'Открытия карточек школ',
  compare_add: 'Добавления в сравнение',
  favorite_add: 'Добавления в избранное',
  school_map_open: 'Открытия карты',
  contact_phone_click: 'Клики по телефону',
  contact_whatsapp_click: 'Клики по WhatsApp',
  contact_website_click: 'Клики по сайту',
  price_open: 'Переходы в цену',
  admission_open: 'Переходы в поступление',
  ai_school_mention: 'Попадания в AI',
  ai_match_run: 'Запуски AI подбора',
  ai_chat_open: 'Открытия AI чата',
  ai_chat_message: 'Сообщения в AI чате',
  guest_gate_click: 'Нажатия на закрытые функции',
};

const normalizeEmail = (value: string) => String(value || '').trim().toLowerCase();
const buildFallbackSchoolId = (email: string) => {
  const base = normalizeEmail(email)
    .split('@')[0]
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `school-${base || 'school'}`;
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
const hasValue = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((item) => hasValue(item));
  }
  return Boolean(String(value || '').trim());
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
    reset_at?: string | null;
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
  const [engagementSummary, setEngagementSummary] = useState<EngagementSummaryPayload | null>(null);
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
  const [allReviews, setAllReviews] = useState<ReviewModerationRow[]>([]);
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
        const [consultationsResponse, schoolsResponse, engagementResponse] = await Promise.all([
          requestJson<{ data?: ConsultationRequest[] }>('/consultations', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          requestJson<{ data?: any[] }>('/schools?include_inactive=1&include_hidden=1'),
          loadEngagementAnalytics(token, { days, limit: 12 }),
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
        setEngagementSummary(engagementResponse?.data || null);
      } else {
        const [programResponse, engagementResponse] = await Promise.all([
          loadProgramInfoAnalytics(token, { days, limit: 12 }),
          loadEngagementAnalytics(token, { days, limit: 12 }),
        ]);
        setSummary(programResponse?.data || null);
        setEngagementSummary(engagementResponse?.data || null);
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
      const reviewsRes = await loadAllReviews(token);
      setAllReviews(Array.isArray(reviewsRes?.data) ? reviewsRes.data : []);
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
  const schoolPlan = String(ownSchool?.monetization?.plan_name || 'Starter').trim() || 'Starter';
  const normalizedSchoolPlan = schoolPlan.toLowerCase();
  const hasGrowthAnalytics = normalizedSchoolPlan === 'growth' || normalizedSchoolPlan === 'pro';
  const hasProAnalytics = normalizedSchoolPlan === 'pro';

  const schoolEngagementTotals = useMemo(
    () => ({
      school_card_view: Number(engagementSummary?.totals?.school_card_view || 0),
      unique_auth_parents:
        Number(engagementSummary?.totals?.unique_auth_parents || 0) ||
        Number(engagementSummary?.unique_auth_parents || 0),
      compare_add: Number(engagementSummary?.totals?.compare_add || 0),
      favorite_add: Number(engagementSummary?.totals?.favorite_add || 0),
      school_map_open: Number(engagementSummary?.totals?.school_map_open || 0),
      contact_phone_click: Number(engagementSummary?.totals?.contact_phone_click || 0),
      contact_whatsapp_click: Number(engagementSummary?.totals?.contact_whatsapp_click || 0),
      contact_website_click: Number(engagementSummary?.totals?.contact_website_click || 0),
      contact_click_total: Number(engagementSummary?.totals?.contact_click_total || 0),
      price_open: Number(engagementSummary?.totals?.price_open || 0),
      admission_open: Number(engagementSummary?.totals?.admission_open || 0),
      ai_school_mention: Number(engagementSummary?.totals?.ai_school_mention || 0),
    }),
    [engagementSummary]
  );

  const schoolEngagementCards = useMemo(
    () => [
      { key: 'school_card_view', label: 'Просмотры карточки', value: schoolEngagementTotals.school_card_view },
      { key: 'unique_auth_parents', label: 'Уникальные родители', value: schoolEngagementTotals.unique_auth_parents },
      { key: 'compare_add', label: 'Добавления в сравнение', value: schoolEngagementTotals.compare_add },
      { key: 'favorite_add', label: 'Добавления в избранное', value: schoolEngagementTotals.favorite_add },
      { key: 'school_map_open', label: 'Открытия карты', value: schoolEngagementTotals.school_map_open },
      { key: 'contact_click_total', label: 'Клики в контакты', value: schoolEngagementTotals.contact_click_total },
      { key: 'price_open', label: 'Переходы в цену', value: schoolEngagementTotals.price_open },
      { key: 'admission_open', label: 'Переходы в поступление', value: schoolEngagementTotals.admission_open },
      { key: 'ai_school_mention', label: 'Попадания в AI', value: schoolEngagementTotals.ai_school_mention },
    ],
    [schoolEngagementTotals]
  );

  const schoolTimelinePeak = useMemo(
    () =>
      Math.max(
        1,
        ...(engagementSummary?.timeline || []).map(
          (row) =>
            Number(row.school_card_view || 0) +
            Number(row.price_open || 0) +
            Number(row.admission_open || 0) +
            Number(row.compare_add || 0) +
            Number(row.favorite_add || 0) +
            Number(row.contact_phone_click || 0) +
            Number(row.contact_whatsapp_click || 0) +
            Number(row.contact_website_click || 0) +
            Number(row.ai_school_mention || 0)
        )
      ),
    [engagementSummary]
  );

  const schoolActionRows = useMemo(
    () => [
      { key: 'price_open', label: 'Цена', value: schoolEngagementTotals.price_open },
      { key: 'admission_open', label: 'Поступление', value: schoolEngagementTotals.admission_open },
      { key: 'school_map_open', label: 'Карта', value: schoolEngagementTotals.school_map_open },
      { key: 'compare_add', label: 'Сравнение', value: schoolEngagementTotals.compare_add },
      { key: 'favorite_add', label: 'Избранное', value: schoolEngagementTotals.favorite_add },
      { key: 'contact_phone_click', label: 'Телефон', value: schoolEngagementTotals.contact_phone_click },
      { key: 'contact_whatsapp_click', label: 'WhatsApp', value: schoolEngagementTotals.contact_whatsapp_click },
      { key: 'contact_website_click', label: 'Сайт', value: schoolEngagementTotals.contact_website_click },
      { key: 'ai_school_mention', label: 'AI', value: schoolEngagementTotals.ai_school_mention },
    ].filter((item) => item.value > 0),
    [schoolEngagementTotals]
  );

  const schoolActionPeak = useMemo(
    () => Math.max(1, ...schoolActionRows.map((item) => item.value)),
    [schoolActionRows]
  );
  const schoolAiAudit = useMemo(() => {
    if (!ownSchool || !schoolStats) return null;

    const financeRules = Array.isArray(ownSchool?.finance?.fee_rules)
      ? ownSchool.finance.fee_rules
      : [];
    const teachers = Array.isArray(ownSchool?.services?.teaching_staff?.members)
      ? ownSchool.services.teaching_staff.members
      : [];
    const reviews = Array.isArray(ownSchool?.reviews?.items) ? ownSchool.reviews.items : [];
    const clubsCount = Array.isArray(ownSchool?.services?.clubs_catalog)
      ? ownSchool.services.clubs_catalog.length
      : Array.isArray(ownSchool?.services?.clubs_unified)
        ? ownSchool.services.clubs_unified.length
        : 0;
    const strengths: string[] = [];
    const critical: string[] = [];
    const growth: string[] = [];

    const hasLogo = hasValue(ownSchool?.media?.logo);
    const hasDescription = hasValue(ownSchool?.basic_info?.description);
    const hasPrograms = schoolStats.programsCount > 0;
    const hasTeachers = schoolStats.staffCount > 0;
    const hasPhotos = schoolStats.photosCount > 0;
    const hasEnoughPhotos = schoolStats.photosCount >= 8;
    const hasFinance = financeRules.length > 0 || hasValue(ownSchool?.finance?.monthly_fee);
    const hasAdmission =
      hasValue(ownSchool?.admission?.process) ||
      hasValue(ownSchool?.admission?.requirements) ||
      hasValue(ownSchool?.admission?.admission_rules);
    const hasContacts =
      hasValue(ownSchool?.basic_info?.phone) &&
      hasValue(ownSchool?.basic_info?.email) &&
      hasValue(ownSchool?.basic_info?.website);
    const hasCoordinates =
      hasValue(ownSchool?.basic_info?.coordinates?.latitude) &&
      hasValue(ownSchool?.basic_info?.coordinates?.longitude);
    const hasReviews = reviews.length > 0;
    const hasStrongReviews = reviews.length >= 5;

    if (hasLogo) strengths.push('У школы есть узнаваемый визуальный якорь: логотип загружен.');
    if (hasEnoughPhotos) strengths.push(`Фото уже работают на доверие: в карточке ${schoolStats.photosCount} изображений.`);
    if (hasPrograms) strengths.push(`Учебное предложение раскрыто: заполнено программ ${schoolStats.programsCount}.`);
    if (hasTeachers) strengths.push(`Команда школы видна родителям: карточек преподавателей ${schoolStats.staffCount}.`);
    if (hasFinance) strengths.push('Финансовый блок заполнен, барьер неопределенности по цене снижен.');
    if (hasAdmission) strengths.push('Блок поступления заполнен и снижает трение перед обращением.');
    if (hasStrongReviews) strengths.push(`Социальное доказательство уже есть: отзывов ${reviews.length}.`);
    if (schoolEngagementTotals.contact_click_total > 0) {
      strengths.push(`Карточка уже доводит родителей до контакта: кликов ${schoolEngagementTotals.contact_click_total}.`);
    }

    if (!hasLogo) critical.push('Нет логотипа: карточка выглядит незавершенной и теряет узнаваемость.');
    if (!hasDescription) critical.push('Нет описания школы: родитель не понимает позиционирование и сильные стороны.');
    if (!hasPrograms) critical.push('Не раскрыты учебные программы: карточка не отвечает на главный вопрос “чему здесь учат”.');
    if (!hasTeachers) critical.push('Нет карточек преподавателей: падает доверие к качеству обучения.');
    if (!hasPhotos) critical.push('Нет фото школы: карточка выглядит пустой и хуже конвертирует в интерес.');
    else if (!hasEnoughPhotos) critical.push('Фото мало: визуального материала недостаточно для сильной карточки.');
    if (!hasFinance) critical.push('Не заполнена стоимость: родитель уходит с карточки с ключевым вопросом без ответа.');
    if (!hasAdmission) critical.push('Не раскрыт блок поступления: неясны этапы, сроки и правила входа.');
    if (!hasContacts) critical.push('Контакты заполнены не полностью: школа теряет часть теплых обращений.');
    if (!hasCoordinates) critical.push('Нет координат: школа теряет полноту на карте и локальный контекст.');
    if (clubsCount === 0) critical.push('Не показаны кружки и секции: карточка выглядит слабее конкурентов по наполнению.');

    if (critical.length === 0) {
      if (!hasStrongReviews) {
        growth.push('Доберите минимум 5 отзывов: сейчас карточке не хватает социального доказательства.');
      }
      if (schoolEngagementTotals.price_open === 0 && hasFinance) {
        growth.push('Цена не открывается: перепакуйте блок стоимости в более понятный и быстрый для считывания формат.');
      }
      if (schoolEngagementTotals.admission_open === 0 && hasAdmission) {
        growth.push('Блок поступления не дожимает интерес: добавьте четкие сроки, экзамены, документы и CTA.');
      }
      if (schoolEngagementTotals.contact_click_total === 0) {
        growth.push('Есть просмотры без переходов в контакт: усилите CTA и вынесите способ связи в более заметную точку.');
      }
      if (schoolEngagementTotals.compare_add === 0 && schoolEngagementTotals.school_card_view > 20) {
        growth.push('Школу почти не добавляют в сравнение: не хватает четко сформулированных преимуществ на первом экране.');
      }
      if (schoolEngagementTotals.favorite_add === 0 && schoolEngagementTotals.school_card_view > 20) {
        growth.push('Школу почти не сохраняют: добавьте короткий блок “почему выбрать нас” в верхнюю часть карточки.');
      }
      if (clubsCount < 3) {
        growth.push('Блок внеучебки слабый: расширьте список кружков и секций, чтобы увеличить perceived value.');
      }
      if (schoolStats.photosCount < 15) {
        growth.push('Добавьте больше живых фото учебной среды, а не только общих или фасадных кадров.');
      }
    }

    const scoreBase = [
      hasLogo,
      hasDescription,
      hasPrograms,
      hasTeachers,
      hasPhotos,
      hasFinance,
      hasAdmission,
      hasContacts,
      hasCoordinates,
      clubsCount > 0,
    ].filter(Boolean).length;
    const readinessScore = Math.round((scoreBase / 10) * 100);

    return {
      readinessScore,
      strengths,
      critical,
      growth,
      mode: critical.length ? 'fix_gaps' : 'optimize',
    };
  }, [ownSchool, schoolStats, schoolEngagementTotals]);

  const canManageSurveys = actorRole === 'moderator' || actorRole === 'superadmin';
  const canResetProgramAnalytics = actorRole === 'superadmin';
  const canResetEngagement = actorRole === 'superadmin';

  const engagementByType = useMemo(() => {
    const map = new Map<string, { event_type: string; all: number; guest: number; auth: number }>();
    (engagementSummary?.topEvents || []).forEach((row) => {
      map.set(row.event_type, row);
    });
    return map;
  }, [engagementSummary]);

  const engagementCards = useMemo(
    () => [
      engagementByType.get('school_card_view'),
      engagementByType.get('compare_add'),
      engagementByType.get('ai_match_run'),
      engagementByType.get('ai_chat_open'),
      engagementByType.get('ai_chat_message'),
      engagementByType.get('guest_gate_click'),
    ].filter(Boolean) as Array<{ event_type: string; all: number; guest: number; auth: number }>,
    [engagementByType]
  );

  const timelinePeak = useMemo(
    () =>
      Math.max(
        1,
        ...(engagementSummary?.timeline || []).map(
          (row) =>
            Number(row.school_card_view || 0) +
            Number(row.compare_add || 0) +
            Number(row.ai_match_run || 0) +
            Number(row.ai_chat_open || 0) +
            Number(row.ai_chat_message || 0)
        )
      ),
    [engagementSummary]
  );

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

  const handleResetEngagement = async () => {
    if (!token || !canResetEngagement) return;
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(
        'Начать новый период статистики? История не удалится, но новые отчеты будут считаться от текущего момента.'
      );
      if (!confirmed) return;
    }
    setLoading(true);
    setMessage('');
    try {
      await resetEngagementAnalytics(token);
      await reload();
      setMessage('Период статистики сброшен.');
    } catch (error) {
      setMessage((error as Error)?.message || 'Не удалось сбросить период статистики');
    } finally {
      setLoading(false);
    }
  };

  const handleResetProgramAnalytics = async () => {
    if (!token || !canResetProgramAnalytics) return;
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(
        'Начать новый период для статистики программ? История не удалится, но отчеты будут считаться от текущего момента.'
      );
      if (!confirmed) return;
    }
    setLoading(true);
    setMessage('');
    try {
      await resetProgramInfoAnalytics(token);
      await reload();
      setMessage('Статистика программ сброшена на новый период.');
    } catch (error) {
      setMessage((error as Error)?.message || 'Не удалось сбросить статистику программ');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!token || !reviewId) return;
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('Удалить этот отзыв? Действие нельзя отменить.');
      if (!confirmed) return;
    }
    setSurveyLoading(true);
    setMessage('');
    try {
      await deleteReviewById(token, reviewId);
      await Promise.all([reload(), loadSurveyControlData()]);
      setMessage('Отзыв удален.');
    } catch (error) {
      setMessage((error as Error)?.message || 'Не удалось удалить отзыв');
    } finally {
      setSurveyLoading(false);
    }
  };

  const handleApproveReview = async (reviewId: string) => {
    if (!token || !reviewId) return;
    setSurveyLoading(true);
    setMessage('');
    try {
      await approveReviewById(token, reviewId);
      await Promise.all([reload(), loadSurveyControlData()]);
      setMessage('Отзыв опубликован.');
    } catch (error) {
      setMessage((error as Error)?.message || 'Не удалось опубликовать отзыв');
    } finally {
      setSurveyLoading(false);
    }
  };

  const handleRejectReview = async (reviewId: string) => {
    if (!token || !reviewId) return;
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('Отклонить этот отзыв? Он не будет опубликован.');
      if (!confirmed) return;
    }
    setSurveyLoading(true);
    setMessage('');
    try {
      await rejectReviewById(token, reviewId);
      await Promise.all([reload(), loadSurveyControlData()]);
      setMessage('Отзыв отклонен.');
    } catch (error) {
      setMessage((error as Error)?.message || 'Не удалось отклонить отзыв');
    } finally {
      setSurveyLoading(false);
    }
  };

  const handleResetSchoolRating = async (schoolId: string, schoolName: string) => {
    if (!token || !schoolId) return;
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(
        `Сбросить рейтинг школы "${schoolName || schoolId}" и удалить все ее отзывы? Действие нельзя отменить.`
      );
      if (!confirmed) return;
    }
    setSurveyLoading(true);
    setMessage('');
    try {
      await resetSchoolRating(token, schoolId);
      await Promise.all([reload(), loadSurveyControlData()]);
      setMessage('Рейтинг школы сброшен, отзывы очищены.');
    } catch (error) {
      setMessage((error as Error)?.message || 'Не удалось сбросить рейтинг школы');
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
                  <div className="card" style={{ marginBottom: 16 }}>
                    <div className="requests-head" style={{ marginBottom: 8 }}>
                      <h3 style={{ margin: 0 }}>Доступ к статистике по тарифу</h3>
                      <strong>{schoolPlan}</strong>
                    </div>
                    <p className="muted" style={{ margin: 0 }}>
                      {normalizedSchoolPlan === 'starter'
                        ? 'На Starter доступна только базовая сводка по заявкам, рейтингу и наполнению карточки.'
                        : normalizedSchoolPlan === 'growth'
                          ? 'Growth открывает базовую аналитику интереса родителей. Расширенная динамика и AI-инсайты доступны на Pro.'
                          : 'На Pro доступна полная аналитика интереса родителей, динамика, воронка и AI-показатели.'}
                    </p>
                  </div>

                  <div className="card" style={{ marginBottom: 16 }}>
                    <div className="requests-head" style={{ marginBottom: 12 }}>
                      <h3 style={{ margin: 0 }}>
                        Аналитика интереса к школе
                        {engagementSummary?.school_name ? `: ${engagementSummary.school_name}` : ''}
                      </h3>
                      {engagementSummary?.reset_at ? (
                        <span className="muted">
                          Считаем с {new Date(engagementSummary.reset_at).toLocaleString()}
                        </span>
                      ) : null}
                    </div>

                    {hasGrowthAnalytics ? (
                      <div className="schools-admin-list">
                        {schoolEngagementCards.map((item) => (
                          <div key={item.key} className="schools-admin-card">
                            <p className="request-title">{item.label}</p>
                            <p className="muted" style={{ fontSize: 28, margin: '8px 0 0' }}>
                              {item.value}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {hasGrowthAnalytics ? (
                      hasProAnalytics ? (
                        <>
                          <div
                            style={{
                              marginTop: 16,
                              display: 'grid',
                              gridTemplateColumns: 'minmax(320px, 1.5fr) minmax(280px, 1fr)',
                              gap: 16,
                            }}
                          >
                            <div
                              style={{
                                border: '1px solid rgba(120,106,255,0.18)',
                                borderRadius: 16,
                                padding: 16,
                                background: '#fff',
                              }}
                            >
                              <div className="requests-head" style={{ marginBottom: 8 }}>
                                <h3 style={{ margin: 0 }}>Динамика по дням</h3>
                                <p className="muted" style={{ margin: 0 }}>
                                  Просмотры, цена, поступление, сравнение и контакты
                                </p>
                              </div>
                              {(engagementSummary?.timeline || []).length ? (
                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: `repeat(${Math.min(
                                      Math.max((engagementSummary?.timeline || []).length, 1),
                                      14
                                    )}, minmax(28px, 1fr))`,
                                    gap: 8,
                                    alignItems: 'end',
                                  }}
                                >
                                  {(engagementSummary?.timeline || []).map((row) => {
                                    const total =
                                      Number(row.school_card_view || 0) +
                                      Number(row.price_open || 0) +
                                      Number(row.admission_open || 0) +
                                      Number(row.compare_add || 0) +
                                      Number(row.favorite_add || 0) +
                                      Number(row.contact_phone_click || 0) +
                                      Number(row.contact_whatsapp_click || 0) +
                                      Number(row.contact_website_click || 0) +
                                      Number(row.ai_school_mention || 0);
                                    const height = Math.max(
                                      10,
                                      Math.round((total / schoolTimelinePeak) * 140)
                                    );
                                    return (
                                      <div key={row.date} style={{ display: 'grid', gap: 6 }}>
                                        <div
                                          title={`${row.date}: ${total}`}
                                          style={{
                                            height,
                                            borderRadius: 10,
                                            background:
                                              'linear-gradient(180deg, rgba(79,95,255,0.92) 0%, rgba(255,164,30,0.88) 100%)',
                                          }}
                                        />
                                        <span className="muted" style={{ fontSize: 11, textAlign: 'center' }}>
                                          {row.date.slice(5)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="muted" style={{ marginBottom: 0 }}>
                                  Событий пока нет.
                                </p>
                              )}
                            </div>

                            <div
                              style={{
                                border: '1px solid rgba(120,106,255,0.18)',
                                borderRadius: 16,
                                padding: 16,
                                background: '#fff',
                              }}
                            >
                              <h3 style={{ marginTop: 0 }}>Воронка интереса</h3>
                              <div style={{ display: 'grid', gap: 10 }}>
                                {[
                                  { label: 'Просмотры карточки', value: schoolEngagementTotals.school_card_view },
                                  { label: 'Переходы в цену', value: schoolEngagementTotals.price_open },
                                  { label: 'Переходы в поступление', value: schoolEngagementTotals.admission_open },
                                  { label: 'Добавления в сравнение', value: schoolEngagementTotals.compare_add },
                                  { label: 'Добавления в избранное', value: schoolEngagementTotals.favorite_add },
                                  { label: 'Клики в контакты', value: schoolEngagementTotals.contact_click_total },
                                ].map((item, index) => (
                                  <div
                                    key={item.label}
                                    style={{
                                      padding: '12px 14px',
                                      borderRadius: 14,
                                      background: `rgba(79,95,255,${Math.max(0.14, 0.42 - index * 0.05)})`,
                                      color: index < 3 ? '#23314d' : '#1d2840',
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                      <span>{item.label}</span>
                                      <strong>{item.value}</strong>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div
                            style={{
                              marginTop: 16,
                              display: 'grid',
                              gridTemplateColumns: 'minmax(320px, 1.2fr) minmax(260px, 0.8fr)',
                              gap: 16,
                            }}
                          >
                            <div
                              style={{
                                border: '1px solid rgba(120,106,255,0.18)',
                                borderRadius: 16,
                                padding: 16,
                                background: '#fff',
                              }}
                            >
                              <h3 style={{ marginTop: 0 }}>Что интересует родителей</h3>
                              {schoolActionRows.length ? (
                                <div style={{ display: 'grid', gap: 12 }}>
                                  {schoolActionRows.map((row) => (
                                    <div key={row.key}>
                                      <div
                                        style={{
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          gap: 10,
                                          marginBottom: 4,
                                        }}
                                      >
                                        <span>{row.label}</span>
                                        <strong>{row.value}</strong>
                                      </div>
                                      <div
                                        style={{
                                          height: 10,
                                          borderRadius: 999,
                                          background: 'rgba(120,106,255,0.12)',
                                          overflow: 'hidden',
                                        }}
                                      >
                                        <div
                                          style={{
                                            width: `${Math.max(6, Math.round((row.value / schoolActionPeak) * 100))}%`,
                                            height: '100%',
                                            background: '#4f5fff',
                                          }}
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="muted" style={{ marginBottom: 0 }}>
                                  Пока нет действий, связанных с карточкой школы.
                                </p>
                              )}
                            </div>

                            <div
                              style={{
                                border: '1px solid rgba(120,106,255,0.18)',
                                borderRadius: 16,
                                padding: 16,
                                background: '#fff',
                              }}
                            >
                              <h3 style={{ marginTop: 0 }}>Контакты и AI</h3>
                              <div style={{ display: 'grid', gap: 10 }}>
                                <div className="schools-admin-card" style={{ margin: 0 }}>
                                  <p className="request-title">Телефон</p>
                                  <p className="muted">{schoolEngagementTotals.contact_phone_click}</p>
                                </div>
                                <div className="schools-admin-card" style={{ margin: 0 }}>
                                  <p className="request-title">WhatsApp</p>
                                  <p className="muted">{schoolEngagementTotals.contact_whatsapp_click}</p>
                                </div>
                                <div className="schools-admin-card" style={{ margin: 0 }}>
                                  <p className="request-title">Сайт</p>
                                  <p className="muted">{schoolEngagementTotals.contact_website_click}</p>
                                </div>
                                <div className="schools-admin-card" style={{ margin: 0 }}>
                                  <p className="request-title">AI-попадания</p>
                                  <p className="muted">{schoolEngagementTotals.ai_school_mention}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div
                          style={{
                            marginTop: 16,
                            border: '1px solid rgba(120,106,255,0.18)',
                            borderRadius: 16,
                            padding: 16,
                            background: '#fff',
                          }}
                        >
                          <h3 style={{ marginTop: 0 }}>Расширенная аналитика Pro</h3>
                          <p className="muted" style={{ marginBottom: 0 }}>
                            На Growth доступна базовая аналитика интереса и сводные метрики выше.
                            Динамика по дням, воронка интереса, разрез по действиям и AI-инсайты
                            открываются на тарифе Pro.
                          </p>
                        </div>
                      )
                    ) : (
                      <div
                        style={{
                          marginTop: 16,
                          border: '1px solid rgba(120,106,255,0.18)',
                          borderRadius: 16,
                          padding: 16,
                          background: '#fff',
                        }}
                      >
                        <h3 style={{ marginTop: 0 }}>Аналитика интереса доступна на Growth</h3>
                        <p className="muted" style={{ marginBottom: 0 }}>
                          На Starter доступна только базовая сводка по заявкам, рейтингу и
                          наполнению карточки. Чтобы видеть интерес родителей к карточке школы,
                          откройте Growth или выше.
                        </p>
                      </div>
                    )}

                    {hasGrowthAnalytics ? (
                      <p className="muted" style={{ margin: '12px 0 0' }}>
                        Всего событий в выборке: {engagementSummary?.sampled_events || 0}
                      </p>
                    ) : null}
                  </div>

                  {hasProAnalytics && schoolAiAudit ? (
                    <div className="card" style={{ marginBottom: 16 }}>
                      <div className="requests-head" style={{ marginBottom: 12 }}>
                        <div>
                          <h3 style={{ margin: 0 }}>AI-рекомендации по улучшению карточки</h3>
                          <p className="muted" style={{ margin: '6px 0 0' }}>
                            Доступно только на Pro. Рекомендации строятся по заполненности карточки и интересу родителей.
                          </p>
                        </div>
                        <strong>{schoolAiAudit.readinessScore}%</strong>
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(280px, 1fr) minmax(280px, 1fr)',
                          gap: 16,
                        }}
                      >
                        <div
                          style={{
                            border: '1px solid rgba(120,106,255,0.18)',
                            borderRadius: 16,
                            padding: 16,
                            background: '#fff',
                          }}
                        >
                          <h4 style={{ marginTop: 0 }}>
                            {schoolAiAudit.mode === 'fix_gaps' ? 'Что нужно исправить в первую очередь' : 'Сильные стороны карточки'}
                          </h4>
                          <div style={{ display: 'grid', gap: 10 }}>
                            {(schoolAiAudit.mode === 'fix_gaps' ? schoolAiAudit.critical : schoolAiAudit.strengths).map((item) => (
                              <div
                                key={item}
                                style={{
                                  padding: '12px 14px',
                                  borderRadius: 14,
                                  background:
                                    schoolAiAudit.mode === 'fix_gaps'
                                      ? 'rgba(245, 158, 11, 0.12)'
                                      : 'rgba(34, 197, 94, 0.12)',
                                }}
                              >
                                {item}
                              </div>
                            ))}
                            {!((schoolAiAudit.mode === 'fix_gaps' ? schoolAiAudit.critical : schoolAiAudit.strengths).length) ? (
                              <p className="muted" style={{ marginBottom: 0 }}>
                                Явных проблем не найдено.
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <div
                          style={{
                            border: '1px solid rgba(120,106,255,0.18)',
                            borderRadius: 16,
                            padding: 16,
                            background: '#fff',
                          }}
                        >
                          <h4 style={{ marginTop: 0 }}>
                            {schoolAiAudit.mode === 'fix_gaps' ? 'Что усилить после заполнения' : 'Как усилить конверсию'}
                          </h4>
                          <div style={{ display: 'grid', gap: 10 }}>
                            {(schoolAiAudit.mode === 'fix_gaps' ? schoolAiAudit.growth : schoolAiAudit.growth).map((item) => (
                              <div
                                key={item}
                                style={{
                                  padding: '12px 14px',
                                  borderRadius: 14,
                                  background: 'rgba(79,95,255,0.10)',
                                }}
                              >
                                {item}
                              </div>
                            ))}
                            {!schoolAiAudit.growth.length ? (
                              <p className="muted" style={{ marginBottom: 0 }}>
                                Карточка выглядит сильной. Следующий шаг: собирать больше отзывов, кейсов и заявок.
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="schools-admin-list">
                    {hasGrowthAnalytics ? (
                      <>
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
                      </>
                    ) : null}
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

                </>
              ) : (
                <p className="muted">
                  Школа для этого аккаунта не найдена. Укажите email школы в разделе контактов.
                </p>
              )}
            </>
          ) : (
            <>
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="requests-head" style={{ marginBottom: 12 }}>
                  <h3 style={{ margin: 0 }}>Статистика родителей</h3>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {engagementSummary?.reset_at ? (
                      <span className="muted" style={{ alignSelf: 'center' }}>
                        Считаем с {new Date(engagementSummary.reset_at).toLocaleString()}
                      </span>
                    ) : null}
                    {canResetEngagement ? (
                      <button
                        type="button"
                        className="button secondary"
                        onClick={handleResetEngagement}
                        disabled={loading}
                      >
                        Сбросить период
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="schools-admin-list">
                  {engagementCards.map((row) => (
                    <div key={row.event_type} className="schools-admin-card">
                      <p className="request-title">
                        {ENGAGEMENT_LABELS[row.event_type] || row.event_type}
                      </p>
                      <p className="muted" style={{ fontSize: 28, margin: '8px 0 4px' }}>
                        {row.all}
                      </p>
                      <p className="muted" style={{ margin: 0 }}>
                        Авторизованные: {row.auth}
                      </p>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    marginTop: 16,
                    border: '1px solid rgba(120,106,255,0.18)',
                    borderRadius: 16,
                    padding: 16,
                    background: '#fff',
                  }}
                >
                  <div className="requests-head" style={{ marginBottom: 8 }}>
                    <h3 style={{ margin: 0 }}>Динамика по дням</h3>
                    <p className="muted" style={{ margin: 0 }}>
                      Просмотры карточек, сравнение и AI за {days} дней
                    </p>
                  </div>
                  {(engagementSummary?.timeline || []).length ? (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${Math.min(
                          Math.max((engagementSummary?.timeline || []).length, 1),
                          14
                        )}, minmax(28px, 1fr))`,
                        gap: 8,
                        alignItems: 'end',
                      }}
                    >
                      {(engagementSummary?.timeline || []).map((row) => {
                        const total =
                          row.school_card_view +
                          row.compare_add +
                          row.ai_match_run +
                          row.ai_chat_open +
                          row.ai_chat_message;
                        const height = Math.max(10, Math.round((total / timelinePeak) * 140));
                        return (
                          <div key={row.date} style={{ display: 'grid', gap: 6 }}>
                            <div
                              title={`${row.date}: ${total}`}
                              style={{
                                height,
                                borderRadius: 10,
                                background:
                                  'linear-gradient(180deg, rgba(79,95,255,0.92) 0%, rgba(255,164,30,0.88) 100%)',
                              }}
                            />
                            <span
                              className="muted"
                              style={{ fontSize: 11, textAlign: 'center' }}
                            >
                              {row.date.slice(5)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="muted" style={{ marginBottom: 0 }}>
                      Событий пока нет.
                    </p>
                  )}
                </div>

                <div
                  style={{
                    marginTop: 16,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                    gap: 16,
                  }}
                >
                  <div
                    style={{
                      border: '1px solid rgba(120,106,255,0.18)',
                      borderRadius: 16,
                      padding: 16,
                      background: '#fff',
                    }}
                  >
                    <h3 style={{ marginTop: 0 }}>События по функциям</h3>
                    <div style={{ display: 'grid', gap: 10 }}>
                      {(engagementSummary?.topEvents || []).map((row) => {
                        const width = Math.max(
                          4,
                          Math.round((Number(row.all || 0) / Math.max(1, engagementCards[0]?.all || 1, ...engagementCards.map((item) => item.all))) * 100)
                        );
                        return (
                          <div key={row.event_type}>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: 10,
                                marginBottom: 4,
                              }}
                            >
                              <span>{ENGAGEMENT_LABELS[row.event_type] || row.event_type}</span>
                              <strong>{row.all}</strong>
                            </div>
                            <div
                              style={{
                                height: 10,
                                borderRadius: 999,
                                background: 'rgba(120,106,255,0.12)',
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: `${width}%`,
                                  height: '100%',
                                  background: '#4f5fff',
                                }}
                              />
                            </div>
                            <p className="muted" style={{ margin: '4px 0 0' }}>
                              guest {row.guest} · auth {row.auth}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div
                    style={{
                      border: '1px solid rgba(120,106,255,0.18)',
                      borderRadius: 16,
                      padding: 16,
                      background: '#fff',
                      overflowX: 'auto',
                    }}
                  >
                    <h3 style={{ marginTop: 0 }}>Топ школ</h3>
                    {engagementSummary?.topSchools?.length ? (
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', padding: '6px 8px' }}>Школа</th>
                            <th style={{ textAlign: 'left', padding: '6px 8px' }}>Просмотры</th>
                            <th style={{ textAlign: 'left', padding: '6px 8px' }}>Сравнение</th>
                            <th style={{ textAlign: 'left', padding: '6px 8px' }}>Авторизованные</th>
                          </tr>
                        </thead>
                        <tbody>
                          {engagementSummary.topSchools.map((row) => (
                            <tr key={row.school_id}>
                              <td style={{ padding: '8px', borderTop: '1px solid rgba(120,106,255,0.15)' }}>
                                <strong>{row.school_name || row.school_id}</strong>
                                <p className="muted" style={{ margin: '4px 0 0' }}>
                                  {row.school_id}
                                </p>
                              </td>
                              <td style={{ padding: '8px', borderTop: '1px solid rgba(120,106,255,0.15)' }}>
                                {row.views}
                              </td>
                              <td style={{ padding: '8px', borderTop: '1px solid rgba(120,106,255,0.15)' }}>
                                {row.compare_adds}
                              </td>
                              <td style={{ padding: '8px', borderTop: '1px solid rgba(120,106,255,0.15)' }}>
                                {row.auth_views}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="muted" style={{ marginBottom: 0 }}>
                        Пока нет просмотров карточек школ.
                      </p>
                    )}
                  </div>
                </div>

                <p className="muted" style={{ margin: '12px 0 0' }}>
                  Всего событий в выборке: {engagementSummary?.sampled_events || 0}
                </p>
              </div>

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

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                  marginTop: 12,
                }}
              >
                {summary?.reset_at ? (
                  <p className="muted" style={{ margin: 0 }}>
                    Статистика программ считается с{' '}
                    {new Date(summary.reset_at).toLocaleString()}
                  </p>
                ) : (
                  <span />
                )}
                {canResetProgramAnalytics ? (
                  <button
                    type="button"
                    className="button secondary"
                    onClick={handleResetProgramAnalytics}
                    disabled={loading}
                  >
                    Сбросить статистику программ
                  </button>
                ) : null}
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
                          <th style={{ textAlign: 'left', padding: '6px 8px' }}>Действия</th>
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
                            <td style={{ padding: '6px 8px', borderTop: '1px solid rgba(120,106,255,0.15)' }}>
                              <button
                                type="button"
                                className="button secondary"
                                onClick={() => handleResetSchoolRating(row.school_id, row.school_name)}
                                disabled={surveyLoading}
                              >
                                Сбросить рейтинг
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div
                    style={{
                      border: '1px solid rgba(120,106,255,0.2)',
                      borderRadius: 12,
                      padding: 12,
                      marginTop: 12,
                    }}
                  >
                    <p style={{ marginTop: 0, fontWeight: 700 }}>Модерация отзывов</p>
                    {allReviews.length ? (
                      <div style={{ display: 'grid', gap: 10 }}>
                        {allReviews.slice(0, 20).map((review) => (
                          <div
                            key={review.id}
                            style={{
                              border: '1px solid rgba(120,106,255,0.2)',
                              borderRadius: 10,
                              padding: 12,
                              background: '#fff',
                            }}
                          >
                            <p style={{ margin: 0, fontWeight: 700 }}>
                              {review.school_name || review.school_id}
                            </p>
                            <p className="muted" style={{ margin: '4px 0 0' }}>
                              Автор: {review.author || '—'} · Рейтинг: {review.rating || 0} ·{' '}
                              {review.created_at ? new Date(review.created_at).toLocaleString() : '—'} · Статус:{' '}
                              {review.status || 'published'}
                            </p>
                            <p style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>
                              {review.text || '—'}
                            </p>
                            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                              {review.status === 'pending' ? (
                                <>
                                  <button
                                    type="button"
                                    className="button"
                                    onClick={() => handleApproveReview(review.id)}
                                    disabled={surveyLoading}
                                  >
                                    Одобрить
                                  </button>
                                  <button
                                    type="button"
                                    className="button secondary"
                                    onClick={() => handleRejectReview(review.id)}
                                    disabled={surveyLoading}
                                  >
                                    Отклонить
                                  </button>
                                </>
                              ) : null}
                              <button
                                type="button"
                                className="button secondary"
                                onClick={() => handleDeleteReview(review.id)}
                                disabled={surveyLoading}
                              >
                                Удалить отзыв
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="muted" style={{ marginBottom: 0 }}>
                        Отзывов пока нет.
                      </p>
                    )}
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
