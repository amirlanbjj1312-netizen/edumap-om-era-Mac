'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  loadSchools,
  upsertSchool,
  loadTestBillingTariffs,
  runSchoolTestPayment,
} from '@/lib/api';
import { useAdminLocale } from '@/lib/adminLocale';
import { supabase } from '@/lib/supabaseClient';

const SELECTED_SCHOOL_STORAGE_KEY = 'EDUMAP_ADMIN_SELECTED_SCHOOL_ID';
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
const getPaymentHistory = (profile: any) => {
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
    .filter((item) => item.id);
};

export default function SchoolsPage() {
  const { t } = useAdminLocale();
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

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSessionToken(data?.session?.access_token || '');
      setActorEmail(data?.session?.user?.email || '');
      setActorRole(
        data?.session?.user?.user_metadata?.role ||
          data?.session?.user?.app_metadata?.role ||
          'user'
      );
    });
    return () => {
      mounted = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!['moderator', 'superadmin'].includes(actorRole)) {
      setLoading(false);
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const result = await loadSchools();
      setItems(Array.isArray(result?.data) ? result.data : []);
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
  const isSuperadmin = actorRole === 'superadmin';
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
    if (!q) return items;
    return items.filter((item) => {
      const displayName =
        normalizeText(item?.basic_info?.display_name?.ru) ||
        normalizeText(item?.basic_info?.name?.ru);
      const email = normalizeText(item?.basic_info?.email);
      const schoolId = normalizeText(item?.school_id);
      const haystack = `${displayName} ${email} ${schoolId}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [items, query]);

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

      {loading ? (
        <p className="muted">{t('schoolsLoading')}</p>
      ) : filtered.length ? (
        <div className="schools-admin-list">
          {filtered.map((item) => {
            const isActive = item?.system?.is_active !== false;
            const isHidden = item?.system?.hidden_from_users === true;
            const displayName =
              normalizeText(item?.basic_info?.display_name?.ru) ||
              normalizeText(item?.basic_info?.name?.ru) ||
              item?.school_id;
            const auditLog = Array.isArray(item?.system?.audit_log)
              ? item.system.audit_log
              : [];
            const promotionActive = isPromotionActive(item);
            const monetization = item?.monetization || {};
            const currentStatus = normalizeText(monetization.subscription_status || 'inactive') || 'inactive';
            const draft = getDraft(item);
            const payments = getPaymentHistory(item);
            return (
              <div key={item.school_id} className="schools-admin-card">
                <div className="schools-admin-top">
                  <div>
                    <p className="request-title">{displayName}</p>
                    <p className="muted">{item.school_id}</p>
                    <p className="muted">{normalizeText(item?.basic_info?.email) || '—'}</p>
                  </div>
                  <div className="schools-admin-statuses">
                    <span className={`schools-status ${isActive ? 'ok' : 'warn'}`}>
                      {isActive ? t('schoolsStatusActive') : t('schoolsStatusInactive')}
                    </span>
                    <span className={`schools-status ${isHidden ? 'warn' : 'ok'}`}>
                      {isHidden ? t('schoolsStatusHidden') : t('schoolsStatusVisible')}
                    </span>
                    <span className={`schools-status ${promotionActive ? 'ok' : 'warn'}`}>
                      {promotionActive
                        ? t('schoolsMonetizationTopActive')
                        : `${t('schoolsMonetizationTopOff')} (${currentStatus})`}
                    </span>
                  </div>
                </div>

                <div className="schools-admin-actions">
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => editSchool(item.school_id)}
                  >
                    {t('schoolsEdit')}
                  </button>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => sendNotification(item)}
                  >
                    {t('schoolsNotify')}
                  </button>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => toggleActive(item)}
                  >
                    {isActive ? t('schoolsDeactivate') : t('schoolsActivate')}
                  </button>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => toggleVisibility(item)}
                  >
                    {isHidden ? `👁 ${t('schoolsShow')}` : `🙈 ${t('schoolsHide')}`}
                  </button>
                </div>

                <div className="schools-monetization">
                  <p className="muted">{t('schoolsMonetizationTitle')}</p>
                  <div className="form-row">
                    <label className="field">
                      <span>{t('schoolsMonetizationStatus')}</span>
                      <select
                        value={draft.status}
                        onChange={(event) =>
                          setDraftField(item.school_id, 'status', event.target.value)
                        }
                        disabled={!isSuperadmin}
                      >
                        {['inactive', 'active', 'paused', 'expired'].map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>{t('schoolsMonetizationPlan')}</span>
                      <input
                        className="input"
                        value={draft.planName}
                        placeholder="Top placement"
                        onChange={(event) =>
                          setDraftField(item.school_id, 'planName', event.target.value)
                        }
                        disabled={!isSuperadmin}
                      />
                    </label>
                    <label className="field">
                      <span>{t('schoolsMonetizationTariff')}</span>
                      <select
                        value={draft.tariffId || tariffs[0]?.id || ''}
                        onChange={(event) =>
                          setDraftField(item.school_id, 'tariffId', event.target.value)
                        }
                        disabled={!isSuperadmin}
                      >
                        {tariffs.length ? (
                          tariffs.map((tariff) => (
                            <option key={tariff.id} value={tariff.id}>
                              {`${tariff.name} · ${Number(tariff.price_kzt || 0).toLocaleString('ru-RU')} ₸ · ${tariff.duration_days} дн`}
                            </option>
                          ))
                        ) : (
                          <option value="">{t('schoolsTestPaymentNoTariff')}</option>
                        )}
                      </select>
                    </label>
                  </div>
                  {draft.tariffId ? (
                    <p className="muted">
                      {(() => {
                        const selected = tariffs.find((item) => item.id === draft.tariffId);
                        return selected?.description || '';
                      })()}
                    </p>
                  ) : null}
                  <div className="form-row">
                    <label className="field">
                      <span>{t('schoolsMonetizationPriority')}</span>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        value={draft.priorityWeight}
                        onChange={(event) =>
                          setDraftField(item.school_id, 'priorityWeight', event.target.value)
                        }
                        disabled={!isSuperadmin}
                      />
                    </label>
                    <label className="field">
                      <span>{t('schoolsMonetizationStartsAt')}</span>
                      <input
                        className="input"
                        type="date"
                        value={draft.startsAt}
                        onChange={(event) =>
                          setDraftField(item.school_id, 'startsAt', event.target.value)
                        }
                        disabled={!isSuperadmin}
                      />
                    </label>
                    <label className="field">
                      <span>{t('schoolsMonetizationEndsAt')}</span>
                      <input
                        className="input"
                        type="date"
                        value={draft.endsAt}
                        onChange={(event) =>
                          setDraftField(item.school_id, 'endsAt', event.target.value)
                        }
                        disabled={!isSuperadmin}
                      />
                    </label>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={draft.isPromoted}
                      onChange={(event) =>
                        setDraftField(item.school_id, 'isPromoted', event.target.checked)
                      }
                      disabled={!isSuperadmin}
                    />
                    <span>{t('schoolsMonetizationIsPromoted')}</span>
                  </label>
                  {isSuperadmin ? (
                    <div className="schools-admin-actions">
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => payTestTariff(item)}
                        disabled={payingSchoolId === item.school_id || !tariffs.length}
                      >
                        {payingSchoolId === item.school_id
                          ? t('schoolsTestPaymentProcessing')
                          : t('schoolsTestPaymentAction')}
                      </button>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => renewCurrentTariff(item)}
                        disabled={
                          payingSchoolId === item.school_id ||
                          !normalizeText(item?.monetization?.last_tariff_id)
                        }
                      >
                        {t('schoolsTestPaymentRenew')}
                      </button>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => saveMonetization(item)}
                      >
                        {t('schoolsMonetizationSave')}
                      </button>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => resetMonetizationDraft(item)}
                      >
                        {t('schoolsMonetizationReset')}
                      </button>
                    </div>
                  ) : (
                    <p className="muted">{t('schoolsMonetizationSuperadminOnly')}</p>
                  )}
                  <div className="schools-payments">
                    <p className="muted">{t('schoolsPaymentsHistory')}</p>
                    {payments.length ? (
                      payments.slice(0, 5).map((payment) => (
                        <p key={payment.id} className="muted">
                          {new Date(payment.paid_at || 0).toLocaleString()} · {payment.tariff_name} ·{' '}
                          {Number(payment.amount_kzt || 0).toLocaleString('ru-RU')} ₸ · {payment.status}
                        </p>
                      ))
                    ) : (
                      <p className="muted">{t('schoolsPaymentsEmpty')}</p>
                    )}
                  </div>
                </div>

                {auditLog.length ? (
                  <div className="schools-audit">
                    <p className="muted">{t('schoolsAudit')}</p>
                    {auditLog.slice(0, 5).map((entry: any) => (
                      <p key={entry.id} className="muted">
                        {new Date(entry.at).toLocaleString()} · {entry.actor} · {entry.action}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="muted">{t('schoolsEmpty')}</p>
      )}
    </div>
  );
}
