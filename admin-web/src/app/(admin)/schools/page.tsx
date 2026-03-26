'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  loadSchools,
  upsertSchool,
  loadTestBillingTariffs,
  runSchoolTestPayment,
  createSchoolAccount,
  loadSchoolAccessLog,
  clearSchoolAccessLog,
  loadAuthUsers,
  upsertSchoolAccessLogEntry,
  deleteSchoolAccessLogEntryFull,
} from '@/lib/api';
import { useAdminLocale } from '@/lib/adminLocale';
import { supabase } from '@/lib/supabaseClient';

const SELECTED_SCHOOL_STORAGE_KEY = 'EDUMAP_ADMIN_SELECTED_SCHOOL_ID';
type SchoolAccessLogItem = {
  id: string;
  email: string;
  password: string;
  schoolId: string;
  createdAt: string;
  status: 'создан' | 'выдан' | 'заполнен';
};

const isPlaceholderSchoolId = (value: string): boolean => {
  const normalized = normalizeText(value).toLowerCase();
  return !normalized || normalized.startsWith('school-astana.private');
};

const chooseBetterLogItem = (current: SchoolAccessLogItem, candidate: SchoolAccessLogItem): SchoolAccessLogItem => {
  const currentScore = (current.password && current.password !== '—' ? 1 : 0) + (isPlaceholderSchoolId(current.schoolId) ? 0 : 1);
  const candidateScore = (candidate.password && candidate.password !== '—' ? 1 : 0) + (isPlaceholderSchoolId(candidate.schoolId) ? 0 : 1);
  if (candidateScore > currentScore) return candidate;
  if (candidateScore < currentScore) return current;
  const currentTs = Date.parse(current.createdAt || '') || 0;
  const candidateTs = Date.parse(candidate.createdAt || '') || 0;
  return candidateTs > currentTs ? candidate : current;
};
type MonetizationDraft = {
  isPromoted: boolean;
  status: string;
  planName: string;
  priorityWeight: string;
  startsAt: string;
  endsAt: string;
  tariffId: string;
};

const normalizeText = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';
const normalizeLocalizedText = (value: unknown) => {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return String(record.ru || record.kk || record.en || '').trim();
  }
  return '';
};
const hasListItems = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean).length > 0;
  }
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((item) => hasListItems(item));
  }
  return Boolean(value);
};
const hasPrivatePrice = (profile: any) =>
  Boolean(
    normalizeText(profile?.finance?.monthly_fee) ||
      normalizeText(profile?.finance?.tuition_monthly) ||
      normalizeText(profile?.finance?.price_monthly) ||
      (Array.isArray(profile?.finance?.fee_rules) && profile.finance.fee_rules.length > 0)
  );
const isSchoolProfileFilled = (profile: any) => {
  const logo = normalizeText(profile?.media?.logo);
  const brandName =
    normalizeLocalizedText(profile?.basic_info?.display_name) ||
    normalizeLocalizedText(profile?.basic_info?.brand_name);
  const latitude = normalizeText(profile?.basic_info?.coordinates?.latitude);
  const longitude = normalizeText(profile?.basic_info?.coordinates?.longitude);
  const city = normalizeText(profile?.basic_info?.city);
  const district = normalizeText(profile?.basic_info?.district);
  const address = normalizeLocalizedText(profile?.basic_info?.address);
  const type = normalizeText(profile?.basic_info?.type);
  const languages = normalizeText(profile?.education?.languages);
  const isPrivate = String(type).toLowerCase().includes('private') || String(type).toLowerCase().includes('част') || String(type).toLowerCase().includes('жеке');
  if (!logo || !brandName || !latitude || !longitude || !city || !district || !address || !type || !languages) {
    return false;
  }
  if (isPrivate && !hasPrivatePrice(profile)) return false;
  return true;
};
const buildSchoolDetailChecklist = (profile: any) => {
  const schoolType = normalizeText(profile?.basic_info?.type);
  const isPrivate =
    schoolType.toLowerCase().includes('private') ||
    schoolType.toLowerCase().includes('част') ||
    schoolType.toLowerCase().includes('жеке');
  const checks = [
    {
      label: 'Название школы',
      done: Boolean(
        normalizeLocalizedText(profile?.basic_info?.display_name) ||
          normalizeLocalizedText(profile?.basic_info?.name)
      ),
    },
    { label: 'Логотип', done: Boolean(normalizeText(profile?.media?.logo)) },
    { label: 'Тип школы', done: Boolean(schoolType) },
    { label: 'Город', done: Boolean(normalizeText(profile?.basic_info?.city)) },
    { label: 'Район', done: Boolean(normalizeText(profile?.basic_info?.district)) },
    { label: 'Адрес', done: Boolean(normalizeLocalizedText(profile?.basic_info?.address)) },
    {
      label: 'Координаты на карте',
      done: Boolean(
        normalizeText(profile?.basic_info?.coordinates?.latitude) &&
          normalizeText(profile?.basic_info?.coordinates?.longitude)
      ),
    },
    { label: 'Телефон', done: Boolean(normalizeText(profile?.basic_info?.phone)) },
    { label: 'Email', done: Boolean(normalizeText(profile?.basic_info?.email)) },
    { label: 'Сайт', done: Boolean(normalizeText(profile?.basic_info?.website)) },
    { label: 'Языки обучения', done: Boolean(hasListItems(profile?.education?.languages)) },
    { label: 'Классы', done: Boolean(hasListItems(profile?.education?.grades)) },
    { label: 'Программы', done: Boolean(hasListItems(profile?.education?.programs)) },
    {
      label: 'Фото галереи',
      done: Boolean(
        normalizeText(profile?.media?.photos) ||
          (Array.isArray(profile?.media?.photos) && profile.media.photos.length > 0)
      ),
    },
    {
      label: 'Кружки / секции',
      done: Boolean(
        (Array.isArray(profile?.services?.clubs_catalog) && profile.services.clubs_catalog.length > 0) ||
          (Array.isArray(profile?.services?.clubs_unified) && profile.services.clubs_unified.length > 0)
      ),
    },
    {
      label: isPrivate ? 'Стоимость обучения' : 'Финансовый блок',
      done: isPrivate ? hasPrivatePrice(profile) : true,
    },
  ];
  const completed = checks.filter((item) => item.done);
  const missing = checks.filter((item) => !item.done);
  return {
    checks,
    completed,
    missing,
    completionPercent: checks.length ? Math.round((completed.length / checks.length) * 100) : 0,
  };
};
const toLocalSchoolIdFromEmail = (email: string) => {
  const localPart = String(email || '')
    .trim()
    .toLowerCase()
    .split('@')[0];
  const normalized = localPart
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return normalized ? `school-${normalized}` : '';
};
const inferSchoolIdFromAdminEmail = (email: string) => {
  const localPart = String(email || '')
    .trim()
    .toLowerCase()
    .split('@')[0];
  const normalized = localPart
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return normalized ? `school-${normalized}` : '';
};
const formatDateInput = (value: unknown) => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.includes('T') ? trimmed.slice(0, 10) : trimmed;
};
const toTimestamp = (value: unknown) => {
  if (!value) return null;
  const ts = new Date(String(value)).getTime();
  return Number.isFinite(ts) ? ts : null;
};
const buildMonetizationDraft = (profile: any) => {
  const source = profile?.monetization || {};
  return {
    isPromoted: source.is_promoted === true,
    status: normalizeText(source.subscription_status || 'inactive') || 'inactive',
    planName: normalizeText(source.plan_name),
    priorityWeight: String(source.priority_weight ?? '0'),
    startsAt: formatDateInput(source.starts_at),
    endsAt: formatDateInput(source.ends_at),
    tariffId: normalizeText(source.last_tariff_id),
  };
};
const isPromotionActive = (profile: any) => {
  const monetization = profile?.monetization || {};
  const status = normalizeText(monetization.subscription_status || '').toLowerCase();
  if (monetization.is_promoted !== true || status !== 'active') return false;
  const now = Date.now();
  const startsAt = toTimestamp(monetization.starts_at);
  const endsAt = toTimestamp(monetization.ends_at);
  const startsOk = !startsAt || startsAt <= now;
  const endsOk = !endsAt || endsAt >= now;
  return startsOk && endsOk;
};
const getPaymentHistory = (
  profile: any
): Array<{
  id: string;
  paid_at: string;
  tariff_name: string;
  amount_kzt: number;
  status: string;
}> => {
  const list = Array.isArray(profile?.monetization?.payments)
    ? profile.monetization.payments
    : [];
  return list
    .map((item: any) => ({
      id: String(item?.id || ''),
      paid_at: String(item?.paid_at || ''),
      tariff_name: String(item?.tariff_name || item?.tariff_id || ''),
      amount_kzt: Number(item?.amount_kzt) || 0,
      status: String(item?.status || ''),
    }))
    .filter((item: { id: string }) => Boolean(item.id));
};

export default function SchoolsPage() {
  const { t, locale } = useAdminLocale();
  const accessLogUi =
    locale === 'en'
      ? {
          title: 'Issued school access',
          clear: 'Clear log',
          clearConfirm: 'Clear issued access log?',
          loadError: 'Log failed to load',
          empty: 'Log is empty.',
          headers: ['Date', 'Email', 'Password', 'School ID', 'Status', 'Action'],
          statusCreated: 'created',
          statusIssued: 'issued',
          statusFilled: 'completed',
          delete: 'Delete',
          details: 'Details',
          deleteConfirm: 'Delete fully: school admin account, school profile and log entry?',
          deleteError: 'Failed to delete entry',
          dateLocale: 'en-US',
        }
      : locale === 'kk'
        ? {
            title: 'Мектепке берілген қолжетімділіктер',
            clear: 'Журналды тазалау',
            clearConfirm: 'Берілген қолжетімділік журналын тазалау керек пе?',
            loadError: 'Журнал жүктелмеді',
            empty: 'Журнал әзірге бос.',
            headers: ['Күні', 'Email', 'Құпиясөз', 'School ID', 'Мәртебе', 'Әрекет'],
            statusCreated: 'құрылды',
            statusIssued: 'берілді',
            statusFilled: 'толтырылды',
            delete: 'Жою',
            details: 'Толығырақ',
            deleteConfirm: 'Толық жою керек пе: мектеп admin аккаунты, мектеп профилі және журнал жазбасы?',
            deleteError: 'Жазбаны жою мүмкін болмады',
            dateLocale: 'kk-KZ',
          }
        : {
            title: 'Выданные доступы школам',
            clear: 'Очистить журнал',
            clearConfirm: 'Очистить журнал выданных доступов?',
            loadError: 'Журнал не загрузился',
            empty: 'Журнал пока пуст.',
            headers: ['Дата', 'Email', 'Пароль', 'School ID', 'Статус', 'Действие'],
            statusCreated: 'создан',
            statusIssued: 'выдан',
            statusFilled: 'заполнен',
            delete: 'Удалить',
            details: 'Подробнее',
            deleteConfirm: 'Удалить полностью: аккаунт школы, профиль школы и запись журнала?',
            deleteError: 'Не удалось удалить запись',
            dateLocale: 'ru-RU',
          };
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [actorEmail, setActorEmail] = useState('');
  const [actorRole, setActorRole] = useState('user');
  const [sessionToken, setSessionToken] = useState('');
  const [tariffs, setTariffs] = useState<
    Array<{
      id: string;
      name: string;
      description?: string;
      price_kzt: number;
      duration_days: number;
      priority_weight: number;
    }>
  >([]);
  const [payingSchoolId, setPayingSchoolId] = useState('');
  const [monetizationDrafts, setMonetizationDrafts] = useState<
    Record<string, MonetizationDraft>
  >({});
  const [newSchoolAccountEmail, setNewSchoolAccountEmail] = useState('');
  const [newSchoolAccountPassword, setNewSchoolAccountPassword] = useState('');
  const [creatingSchoolAccount, setCreatingSchoolAccount] = useState(false);
  const [schoolAccountStatus, setSchoolAccountStatus] = useState('');
  const [schoolAccessLog, setSchoolAccessLog] = useState<SchoolAccessLogItem[]>([]);
  const [schoolAccessLogError, setSchoolAccessLogError] = useState('');
  const [updatingLogStatusId, setUpdatingLogStatusId] = useState('');
  const [deletingLogId, setDeletingLogId] = useState('');
  const [savingLogPasswordId, setSavingLogPasswordId] = useState('');
  const [logPasswordDrafts, setLogPasswordDrafts] = useState<Record<string, string>>({});
  const [loadStatus, setLoadStatus] = useState('');
  const [detailsRow, setDetailsRow] = useState<SchoolAccessLogItem | null>(null);
  const isSuperadmin = actorRole === 'superadmin';

  useEffect(() => {
    let mounted = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSessionToken(data?.session?.access_token || '');
        setActorEmail(data?.session?.user?.email || '');
        setActorRole(
          data?.session?.user?.user_metadata?.role ||
            data?.session?.user?.app_metadata?.role ||
            'user'
        );
      })
      .catch(() => {
        if (!mounted) return;
        setSessionToken('');
        setActorEmail('');
        setActorRole('user');
      });
    return () => {
      mounted = false;
    };
  }, []);
  const reloadSchoolAccessLog = useCallback(async () => {
    if (!isSuperadmin || !sessionToken) {
      setSchoolAccessLog([]);
      setSchoolAccessLogError('');
      return;
    }
    try {
      const [result, usersResult] = await Promise.all([
        loadSchoolAccessLog(sessionToken),
        loadAuthUsers(sessionToken),
      ]);
      const rows = Array.isArray(result?.data) ? result.data : [];
      const byId = new Map<string, SchoolAccessLogItem>();
      const byEmail = new Map<string, SchoolAccessLogItem>();
      const registerRow = (row: SchoolAccessLogItem) => {
        const emailKey = normalizeText(row.email).toLowerCase();
        const existingByEmail = emailKey ? byEmail.get(emailKey) : null;
        if (existingByEmail) {
          const chosen = chooseBetterLogItem(existingByEmail, row);
          byEmail.set(emailKey, chosen);
          byId.delete(existingByEmail.id);
          byId.set(chosen.id, chosen);
          return;
        }
        byId.set(row.id, row);
        if (emailKey) byEmail.set(emailKey, row);
      };

      rows.forEach((item) => {
        const row: SchoolAccessLogItem = {
          id: String(item?.id || ''),
          email: normalizeText(item?.email),
          password: String(item?.password || ''),
          schoolId: normalizeText(item?.schoolId),
          createdAt: String(item?.createdAt || ''),
          status:
            ['создан', 'выдан', 'заполнен'].includes(String(item?.status || '').toLowerCase())
              ? (String(item?.status || '').toLowerCase() as SchoolAccessLogItem['status'])
              : 'создан',
        };
        if (!row.id || !row.email) return;
        registerRow(row);
      });
      const users = Array.isArray(usersResult?.data) ? usersResult.data : [];
      users
        .filter((user) => String(user?.role || '').toLowerCase() === 'admin')
        .forEach((user) => {
          const userId = String(user?.id || '').trim();
          const email = String(user?.email || '')
            .trim()
            .toLowerCase();
          if (!userId || !email) return;
          const legacyId = `legacy-${userId}`;
          if (byId.has(legacyId)) return;
          registerRow({
            id: legacyId,
            email,
            password: '—',
            schoolId: inferSchoolIdFromAdminEmail(email),
            createdAt: String(user?.createdAt || ''),
            status: 'создан',
          });
        });
      setSchoolAccessLog(
        Array.from(byId.values())
          .sort((a, b) => (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0))
          .map((item) => ({
          id: String(item?.id || ''),
          email: normalizeText(item?.email),
          password: String(item?.password || ''),
          schoolId: normalizeText(item?.schoolId),
          createdAt: String(item?.createdAt || ''),
          status:
            ['создан', 'выдан', 'заполнен'].includes(String(item?.status || '').toLowerCase())
              ? (String(item?.status || '').toLowerCase() as SchoolAccessLogItem['status'])
              : 'создан',
          }))
      );
      setLogPasswordDrafts({});
      setSchoolAccessLogError('');
    } catch (error) {
      setSchoolAccessLog([]);
      const message =
        error instanceof Error && error.message ? error.message : 'Не удалось загрузить журнал';
      setSchoolAccessLogError(message);
    }
  }, [isSuperadmin, sessionToken]);
  const onChangeSchoolAccessStatus = useCallback(
    async (id: string, status: SchoolAccessLogItem['status']) => {
      if (!sessionToken || !id) return;
      setUpdatingLogStatusId(id);
      try {
        const row = schoolAccessLog.find((item) => item.id === id);
        if (!row) return;
        await upsertSchoolAccessLogEntry(sessionToken, {
          id: row.id,
          email: row.email,
          password: row.password === '—' ? '' : row.password,
          schoolId: row.schoolId,
          createdAt: row.createdAt,
          status,
        });
        setSchoolAccessLog((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status } : item))
        );
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : 'Не удалось обновить статус';
        setSchoolAccessLogError(message);
      } finally {
        setUpdatingLogStatusId('');
      }
    },
    [schoolAccessLog, sessionToken]
  );
  const saveLogPassword = useCallback(
    async (row: SchoolAccessLogItem) => {
      if (!sessionToken || !row?.id) return;
      const nextPassword = String(logPasswordDrafts[row.id] ?? row.password ?? '');
      setSavingLogPasswordId(row.id);
      try {
        await upsertSchoolAccessLogEntry(sessionToken, {
          id: row.id,
          email: row.email,
          password: nextPassword,
          schoolId: row.schoolId,
          createdAt: row.createdAt,
          status: row.status,
        });
        setSchoolAccessLog((prev) =>
          prev.map((item) =>
            item.id === row.id
              ? {
                  ...item,
                  password: nextPassword,
                }
              : item
          )
        );
        setLogPasswordDrafts((prev) => {
          const next = { ...prev };
          delete next[row.id];
          return next;
        });
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : 'Не удалось сохранить пароль';
        setSchoolAccessLogError(message);
      } finally {
        setSavingLogPasswordId('');
      }
    },
    [logPasswordDrafts, sessionToken]
  );
  useEffect(() => {
    reloadSchoolAccessLog();
  }, [reloadSchoolAccessLog]);

  const reload = useCallback(async () => {
    if (!['moderator', 'superadmin'].includes(actorRole)) {
      setLoading(false);
      setItems([]);
      setLoadStatus('');
      return;
    }
    setLoading(true);
    setLoadStatus('');
    try {
      const result = await loadSchools();
      setItems(Array.isArray(result?.data) ? result.data : []);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Не удалось загрузить школы. Проверьте backend (http://localhost:4000).';
      setItems([]);
      setLoadStatus(message);
    } finally {
      setLoading(false);
    }
  }, [actorRole]);

  useEffect(() => {
    reload();
  }, [reload]);
  useEffect(() => {
    let active = true;
    const loadTariffs = async () => {
      try {
        const result = await loadTestBillingTariffs();
        if (!active) return;
        setTariffs(Array.isArray(result?.data) ? result.data : []);
      } catch {
        if (!active) return;
        setTariffs([]);
      }
    };
    loadTariffs();
    return () => {
      active = false;
    };
  }, []);

  const appendAudit = useCallback(
    (profile: any, action: string) => {
      const current = Array.isArray(profile?.system?.audit_log)
        ? profile.system.audit_log
        : [];
      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        at: new Date().toISOString(),
        action,
        actor: actorEmail || 'unknown',
      };
      return [entry, ...current].slice(0, 100);
    },
    [actorEmail]
  );

  const saveMutated = useCallback(
    async (profile: any, action: string) => {
      const next = {
        ...profile,
        system: {
          ...(profile?.system || {}),
          updated_at: new Date().toISOString(),
          audit_log: appendAudit(profile, action),
        },
      };
      await upsertSchool(next);
      setItems((prev) =>
        prev.map((item) => (item.school_id === next.school_id ? next : item))
      );
    },
    [appendAudit]
  );

  const toggleActive = useCallback(
    async (profile: any) => {
      const isActive = profile?.system?.is_active !== false;
      await saveMutated(
        {
          ...profile,
          system: { ...(profile?.system || {}), is_active: !isActive },
        },
        isActive ? 'deactivate' : 'activate'
      );
    },
    [saveMutated]
  );

  const toggleVisibility = useCallback(
    async (profile: any) => {
      const hidden = profile?.system?.hidden_from_users === true;
      await saveMutated(
        {
          ...profile,
          system: { ...(profile?.system || {}), hidden_from_users: !hidden },
        },
        hidden ? 'show_in_user_lk' : 'hide_from_user_lk'
      );
    },
    [saveMutated]
  );

  const sendNotification = useCallback(
    async (profile: any) => {
      const text = window.prompt(t('schoolsNotifyPrompt'));
      const message = normalizeText(text);
      if (!message) return;

      const currentNotifications = Array.isArray(profile?.system?.notifications)
        ? profile.system.notifications
        : [];
      const nextNotifications = [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          text: message,
          created_at: new Date().toISOString(),
          from: actorEmail || 'moderator',
          read_at: '',
        },
        ...currentNotifications,
      ].slice(0, 100);

      await saveMutated(
        {
          ...profile,
          system: {
            ...(profile?.system || {}),
            notifications: nextNotifications,
          },
        },
        'send_notification'
      );
      window.alert(t('schoolsNotifySent'));
    },
    [actorEmail, saveMutated, t]
  );

  const editSchool = useCallback((schoolId: string) => {
    localStorage.setItem(SELECTED_SCHOOL_STORAGE_KEY, schoolId);
    window.location.href = '/school-info';
  }, []);
  const generateTempPassword = useCallback(() => {
    const chunk = Math.random().toString(36).slice(2, 8);
    const suffix = Math.floor(100 + Math.random() * 900);
    const next = `Edumap${chunk}${suffix}`;
    setNewSchoolAccountPassword(next);
  }, []);
  const createSchoolAdminAccount = useCallback(async () => {
    if (!isSuperadmin || !sessionToken) return;
    const rawEmail = normalizeText(newSchoolAccountEmail).toLowerCase();
    const email = rawEmail.includes('@') ? rawEmail : `${rawEmail}@edumap.kz`;
    const password = String(newSchoolAccountPassword || '');
    if (!email || password.length < 8) {
      setSchoolAccountStatus('Заполните email и пароль (минимум 8 символов).');
      return;
    }
    if (!email.endsWith('@edumap.kz')) {
      setSchoolAccountStatus('Email должен заканчиваться на @edumap.kz');
      return;
    }

    setCreatingSchoolAccount(true);
    setSchoolAccountStatus('');
    try {
      const result = await createSchoolAccount(sessionToken, { email, password });
      const generatedSchoolId = result?.data?.schoolId || '';
      setSchoolAccountStatus(`Аккаунт создан: ${email}. Роль admin. ID: ${generatedSchoolId}`);
      await reloadSchoolAccessLog();
      setNewSchoolAccountEmail('');
      setNewSchoolAccountPassword('');
    } catch (error) {
      const rawMessage =
        error instanceof Error && error.message ? error.message : '';
      if (
        !rawMessage ||
        rawMessage === 'Request failed' ||
        rawMessage.includes('Failed to fetch')
      ) {
        setSchoolAccountStatus(
          'Не удалось вызвать API создания аккаунта. Проверь, что backend обновлен и содержит POST /api/auth/create-school-account.'
        );
      } else {
      setSchoolAccountStatus(
          rawMessage || 'Не удалось создать аккаунт школы'
      );
      }
    } finally {
      setCreatingSchoolAccount(false);
    }
  }, [
    isSuperadmin,
    newSchoolAccountEmail,
    newSchoolAccountPassword,
    reloadSchoolAccessLog,
    sessionToken,
  ]);
  const getDraft = useCallback(
    (profile: any) =>
      monetizationDrafts[profile.school_id] || buildMonetizationDraft(profile),
    [monetizationDrafts]
  );
  const setDraftField = useCallback(
    (schoolId: string, key: keyof MonetizationDraft, value: string | boolean) => {
      setMonetizationDrafts((prev) => {
        const current: MonetizationDraft = prev[schoolId] || {
          isPromoted: false,
          status: 'inactive',
          planName: '',
          priorityWeight: '0',
          startsAt: '',
          endsAt: '',
          tariffId: '',
        };
        return {
          ...prev,
          [schoolId]: { ...current, [key]: value } as MonetizationDraft,
        };
      });
    },
    []
  );
  const resetMonetizationDraft = useCallback((profile: any) => {
    setMonetizationDrafts((prev) => {
      const next = { ...prev };
      delete next[profile.school_id];
      return next;
    });
  }, []);
  const saveMonetization = useCallback(
    async (profile: any) => {
      if (!isSuperadmin) return;
      const draft = getDraft(profile);
      const priority = Number.parseInt(draft.priorityWeight, 10);
      await saveMutated(
        {
          ...profile,
          monetization: {
            is_promoted: Boolean(draft.isPromoted),
            subscription_status: normalizeText(draft.status || 'inactive').toLowerCase(),
            plan_name: normalizeText(draft.planName),
            priority_weight: Number.isFinite(priority) ? priority : 0,
            starts_at: draft.startsAt || '',
            ends_at: draft.endsAt || '',
            last_tariff_id: draft.tariffId || '',
          },
        },
        'update_monetization'
      );
      resetMonetizationDraft(profile);
    },
    [getDraft, isSuperadmin, resetMonetizationDraft, saveMutated]
  );
  const payTestTariff = useCallback(
    async (profile: any) => {
      if (!isSuperadmin) return;
      if (!sessionToken) {
        window.alert(t('schoolsTestPaymentNeedAuth'));
        return;
      }
      const draft = getDraft(profile);
      const fallbackTariff = tariffs[0]?.id || '';
      const tariffId = draft.tariffId || fallbackTariff;
      if (!tariffId) {
        window.alert(t('schoolsTestPaymentNoTariff'));
        return;
      }
      const selectedTariff = tariffs.find((item) => item.id === tariffId);
      const tariffName = selectedTariff?.name || tariffId;
      const confirmed = window.confirm(
        `${t('schoolsTestPaymentConfirm')} ${tariffName}?`
      );
      if (!confirmed) return;

      setPayingSchoolId(profile.school_id);
      try {
        const result = await runSchoolTestPayment(sessionToken, profile.school_id, {
          tariffId,
        });
        const nextProfile = result?.data?.profile;
        if (nextProfile?.school_id) {
          setItems((prev) =>
            prev.map((item) =>
              item.school_id === nextProfile.school_id ? nextProfile : item
            )
          );
        } else {
          await reload();
        }
        resetMonetizationDraft(profile);
        window.alert(t('schoolsTestPaymentSuccess'));
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : t('schoolsTestPaymentFailed');
        window.alert(message);
      } finally {
        setPayingSchoolId('');
      }
    },
    [getDraft, isSuperadmin, reload, resetMonetizationDraft, sessionToken, t, tariffs]
  );
  const renewCurrentTariff = useCallback(
    async (profile: any) => {
      if (!isSuperadmin) return;
      const lastTariffId = normalizeText(profile?.monetization?.last_tariff_id);
      if (!lastTariffId) {
        window.alert(t('schoolsTestPaymentNoLastTariff'));
        return;
      }
      const hasTariff = tariffs.some((item) => item.id === lastTariffId);
      if (!hasTariff) {
        window.alert(t('schoolsTestPaymentNoTariff'));
        return;
      }
      await payTestTariff({
        ...profile,
        monetization: {
          ...(profile?.monetization || {}),
          last_tariff_id: lastTariffId,
        },
      });
    },
    [isSuperadmin, payTestTariff, t, tariffs]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const actorLocalSchoolId =
      isSuperadmin && actorEmail ? toLocalSchoolIdFromEmail(actorEmail) : '';
    const visibleItems = items.filter((item) => {
      const schoolId = normalizeText(item?.school_id);
      if (actorLocalSchoolId && schoolId === actorLocalSchoolId) return false;
      return true;
    });
    if (!q) return visibleItems;
    return visibleItems.filter((item) => {
      const displayName =
        normalizeText(item?.basic_info?.display_name?.ru) ||
        normalizeText(item?.basic_info?.name?.ru);
      const email = normalizeText(item?.basic_info?.email);
      const schoolId = normalizeText(item?.school_id);
      const haystack = `${displayName} ${email} ${schoolId}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [actorEmail, isSuperadmin, items, query]);
  const filledSchoolIds = useMemo(
    () =>
      new Set(
        items
          .filter((item) => isSchoolProfileFilled(item))
          .map((item) => normalizeText(item?.school_id))
          .filter(Boolean)
      ),
    [items]
  );
  const detailsProfile = useMemo(() => {
    if (!detailsRow) return null;
    const schoolId = normalizeText(detailsRow.schoolId);
    const email = normalizeText(detailsRow.email).toLowerCase();
    return (
      items.find((item) => normalizeText(item?.school_id) === schoolId) ||
      items.find((item) => normalizeText(item?.basic_info?.email).toLowerCase() === email) ||
      null
    );
  }, [detailsRow, items]);
  const detailsChecklist = useMemo(
    () => (detailsProfile ? buildSchoolDetailChecklist(detailsProfile) : null),
    [detailsProfile]
  );
  const hasSchoolDetails = useCallback(
    (schoolId: string) =>
      items.some((item) => normalizeText(item?.school_id) === normalizeText(schoolId)),
    [items]
  );
  const getEffectiveLogStatus = useCallback(
    (row: SchoolAccessLogItem): SchoolAccessLogItem['status'] =>
      filledSchoolIds.has(normalizeText(row.schoolId)) ? 'заполнен' : row.status,
    [filledSchoolIds]
  );

  useEffect(() => {
    if (!sessionToken || !schoolAccessLog.length) return;
    const rowsToPromote = schoolAccessLog.filter(
      (row) =>
        filledSchoolIds.has(normalizeText(row.schoolId)) &&
        row.status !== 'заполнен' &&
        !String(row.id || '').startsWith('legacy-')
    );
    if (!rowsToPromote.length) return;
    rowsToPromote.forEach((row) => {
      void upsertSchoolAccessLogEntry(sessionToken, {
        id: row.id,
        email: row.email,
        password: row.password === '—' ? '' : row.password,
        schoolId: row.schoolId,
        createdAt: row.createdAt,
        status: 'заполнен',
      }).catch(() => undefined);
    });
    setSchoolAccessLog((prev) =>
      prev.map((row) =>
        filledSchoolIds.has(normalizeText(row.schoolId)) ? { ...row, status: 'заполнен' } : row
      )
    );
  }, [filledSchoolIds, schoolAccessLog, sessionToken]);

  if (!['moderator', 'superadmin'].includes(actorRole)) {
    return <div className="card">{t('schoolsForbidden')}</div>;
  }

  return (
    <div className="card">
      <div className="requests-head">
        <h2>{t('schoolsTitle')}</h2>
        <button type="button" className="button secondary" onClick={reload}>
          {t('schoolsRefresh')}
        </button>
      </div>
      <p className="muted">{t('schoolsHint')}</p>

      <label className="field" style={{ marginTop: 12 }}>
        <span>{t('schoolsSearch')}</span>
        <input
          className="input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      {isSuperadmin ? (
        <div
          className="card"
          style={{ marginTop: 12, padding: 12, border: '1px solid var(--line)' }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Выдать доступ школе</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Создает новый пустой аккаунт школы с ролью `admin`. Существующие школы не удаляются.
          </p>
          <div className="form-row">
            <label className="field">
              <span>Email для входа (@edumap.kz)</span>
              <input
                className="input"
                value={newSchoolAccountEmail}
                onChange={(event) => setNewSchoolAccountEmail(event.target.value)}
                placeholder="school-admin"
              />
            </label>
            <label className="field">
              <span>Пароль</span>
              <input
                className="input"
                value={newSchoolAccountPassword}
                onChange={(event) => setNewSchoolAccountPassword(event.target.value)}
                placeholder="Минимум 8 символов"
              />
            </label>
          </div>
          <div className="schools-admin-actions">
            <button
              type="button"
              className="button secondary"
              onClick={generateTempPassword}
              disabled={creatingSchoolAccount}
            >
              Сгенерировать пароль
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={createSchoolAdminAccount}
              disabled={creatingSchoolAccount}
            >
              {creatingSchoolAccount ? 'Создание...' : 'Создать аккаунт'}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setNewSchoolAccountEmail('');
                setNewSchoolAccountPassword('');
                setSchoolAccountStatus('');
              }}
              disabled={creatingSchoolAccount}
            >
              Очистить
            </button>
            {schoolAccountStatus ? (
              <span className="muted" style={{ maxWidth: 640 }}>
                {schoolAccountStatus}
              </span>
            ) : null}
          </div>
          <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <div className="requests-head" style={{ marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>{accessLogUi.title}</h3>
              <button
                type="button"
                className="button secondary"
                onClick={async () => {
                  if (!window.confirm(accessLogUi.clearConfirm)) return;
                  if (!sessionToken) return;
                  await clearSchoolAccessLog(sessionToken);
                  await reloadSchoolAccessLog();
                }}
              >
                {accessLogUi.clear}
              </button>
            </div>
            {schoolAccessLogError ? (
              <p className="muted" style={{ color: 'var(--danger)', marginTop: 0 }}>
                {accessLogUi.loadError}: {schoolAccessLogError}
              </p>
            ) : null}
            {detailsRow ? (
              <div
                className="card"
                style={{ marginBottom: 12, border: '1px solid var(--line)', background: '#fff' }}
              >
                <div className="requests-head" style={{ marginBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: 0 }}>
                      Сводка по школе:{' '}
                      {detailsProfile
                        ? normalizeLocalizedText(detailsProfile?.basic_info?.display_name) ||
                          normalizeLocalizedText(detailsProfile?.basic_info?.name) ||
                          detailsRow.schoolId
                        : detailsRow.schoolId || detailsRow.email}
                    </h3>
                    <p className="muted" style={{ margin: '6px 0 0' }}>
                      {detailsRow.email} · {detailsRow.schoolId || 'School ID не задан'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {detailsProfile ? (
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => editSchool(detailsProfile.school_id)}
                      >
                        Открыть профиль школы
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => setDetailsRow(null)}
                    >
                      Закрыть
                    </button>
                  </div>
                </div>
                {detailsProfile && detailsChecklist ? (
                  <>
                    <div className="schools-admin-list" style={{ marginBottom: 16 }}>
                      <div className="schools-admin-card">
                        <p className="request-title">Заполнено</p>
                        <p className="muted" style={{ fontSize: 28, margin: '8px 0 0' }}>
                          {detailsChecklist.completed.length}/{detailsChecklist.checks.length}
                        </p>
                      </div>
                      <div className="schools-admin-card">
                        <p className="request-title">Процент готовности</p>
                        <p className="muted" style={{ fontSize: 28, margin: '8px 0 0' }}>
                          {detailsChecklist.completionPercent}%
                        </p>
                      </div>
                      <div className="schools-admin-card">
                        <p className="request-title">Не хватает</p>
                        <p className="muted" style={{ fontSize: 28, margin: '8px 0 0' }}>
                          {detailsChecklist.missing.length}
                        </p>
                      </div>
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
                        <h4 style={{ marginTop: 0 }}>Чего не хватает</h4>
                        {detailsChecklist.missing.length ? (
                          <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>
                            {detailsChecklist.missing.map((item) => (
                              <li key={item.label}>{item.label}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="muted" style={{ marginBottom: 0 }}>
                            Основные поля заполнены.
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
                        <h4 style={{ marginTop: 0 }}>Что уже заполнено</h4>
                        {detailsChecklist.completed.length ? (
                          <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>
                            {detailsChecklist.completed.map((item) => (
                              <li key={item.label}>{item.label}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="muted" style={{ marginBottom: 0 }}>
                            Пока почти ничего не заполнено.
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="muted" style={{ marginBottom: 0 }}>
                    Профиль школы пока не найден в каталоге. Есть только выданный доступ.
                  </p>
                )}
              </div>
            ) : null}
            {!schoolAccessLog.length ? (
              <p className="muted" style={{ marginTop: 0 }}>
                {accessLogUi.empty}
              </p>
            ) : null}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                <thead>
                  <tr>
                    {accessLogUi.headers.map((head) => (
                      <th
                        key={head}
                        style={{
                          textAlign: 'left',
                          padding: '8px 10px',
                          borderBottom: '1px solid var(--line)',
                          color: 'var(--muted)',
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {schoolAccessLog.map((row) => (
                    <tr key={row.id}>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--line)' }}>
                        {row.createdAt ? new Date(row.createdAt).toLocaleString(accessLogUi.dateLocale) : '—'}
                      </td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--line)' }}>
                        {row.email}
                      </td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--line)' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            className="input"
                            style={{ minWidth: 160 }}
                            value={logPasswordDrafts[row.id] ?? row.password}
                            onChange={(event) =>
                              setLogPasswordDrafts((prev) => ({
                                ...prev,
                                [row.id]: event.target.value,
                              }))
                            }
                          />
                          <button
                            type="button"
                            className="button secondary"
                            disabled={savingLogPasswordId === row.id}
                            onClick={() => saveLogPassword(row)}
                          >
                            {savingLogPasswordId === row.id ? '...' : 'Сохранить'}
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--line)' }}>
                        {row.schoolId || '—'}
                      </td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--line)' }}>
                        {(() => {
                          const effectiveStatus = getEffectiveLogStatus(row);
                          const isAutoFilled = effectiveStatus === 'заполнен';
                          return (
                            <select
                              value={effectiveStatus}
                              disabled={updatingLogStatusId === row.id || isAutoFilled}
                              style={
                                isAutoFilled
                                  ? {
                                      background: '#dcfce7',
                                      color: '#166534',
                                      borderColor: '#86efac',
                                      fontWeight: 700,
                                    }
                                  : undefined
                              }
                              onChange={(event) =>
                                onChangeSchoolAccessStatus(
                                  row.id,
                                  event.target.value as SchoolAccessLogItem['status']
                                )
                              }
                            >
                              <option value="создан">{accessLogUi.statusCreated}</option>
                              <option value="выдан">{accessLogUi.statusIssued}</option>
                              <option value="заполнен">{accessLogUi.statusFilled}</option>
                            </select>
                          );
                        })()}
                      </td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--line)' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="button secondary"
                            onClick={() => setDetailsRow(row)}
                          >
                            {accessLogUi.details}
                          </button>
                          <button
                            type="button"
                            className="button secondary"
                            disabled={deletingLogId === row.id}
                            onClick={async () => {
                              if (!sessionToken) return;
                              if (!window.confirm(accessLogUi.deleteConfirm)) return;
                              setDeletingLogId(row.id);
                              const deletedEmail = normalizeText(row.email).toLowerCase();
                              const deletedSchoolId = normalizeText(row.schoolId);
                              const previousLog = schoolAccessLog;
                              setSchoolAccessLog((prev) =>
                                prev.filter((item) => {
                                  const sameId = item.id === row.id;
                                  const sameEmail =
                                    deletedEmail &&
                                    normalizeText(item.email).toLowerCase() === deletedEmail;
                                  const sameSchool =
                                    deletedSchoolId &&
                                    normalizeText(item.schoolId) === deletedSchoolId;
                                  return !(sameId || sameEmail || sameSchool);
                                })
                              );
                              try {
                                await deleteSchoolAccessLogEntryFull(sessionToken, {
                                  id: row.id,
                                  email: row.email,
                                  schoolId: row.schoolId,
                                });
                              } catch (error) {
                                setSchoolAccessLog(previousLog);
                                const message =
                                  error instanceof Error && error.message
                                    ? error.message
                                    : accessLogUi.deleteError;
                                setSchoolAccessLogError(message);
                              } finally {
                                setDeletingLogId('');
                              }
                            }}
                          >
                            {accessLogUi.delete}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
