'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  loadAuthUsers,
  loadAuthUserDetails,
  setAuthUserStatus,
  updateAuthUserSettings,
} from '@/lib/api';
import { supabase } from '@/lib/supabaseClient';

const CAN_MANAGE_ROLES = new Set(['moderator', 'superadmin']);

type AdminUser = {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  firstName?: string;
  lastName?: string;
  bannedUntil?: string | null;
  isActive?: boolean;
};

type DetailsPayload = {
  user: {
    id: string;
    email: string;
    role: string;
    firstName?: string;
    lastName?: string;
    createdAt?: string;
    lastSignInAt?: string;
    bannedUntil?: string | null;
    isActive?: boolean;
  };
  settings: {
    user_id: string;
    email: string;
    first_name?: string;
    last_name?: string;
    subscription?: {
      plan?: string;
      status?: string;
      starts_at?: string;
      ends_at?: string;
      auto_renew?: boolean;
    };
    ai_limits?: {
      chat_bonus?: number;
      selector_bonus?: number;
      bonus_expires_at?: string;
    };
    notes?: string;
    updated_at?: string;
    updated_by?: string;
  };
  analytics: {
    surveyResponsesCount: number;
    consultationRequestsCount: number;
    aiChatRequestsCount: number;
    aiMatchRequestsCount: number;
    mostVisitedSections: string[];
    lastActivityAt?: string;
  };
};

type SettingsDraft = {
  first_name: string;
  last_name: string;
  subscription_plan: string;
  subscription_status: string;
  subscription_starts_at: string;
  subscription_ends_at: string;
  auto_renew: boolean;
  chat_bonus: number;
  selector_bonus: number;
  bonus_expires_at: string;
  notes: string;
};

const toDateInput = (value: string | undefined) =>
  String(value || '').includes('T') ? String(value).slice(0, 10) : String(value || '');

const USERS_PAGE_VISIBLE_ROLES = new Set(['user', 'student', 'parent', 'moderator', 'superadmin']);

const normalizeRole = (role: string | undefined) => String(role || '').trim().toLowerCase();

const getRoleLabel = (role: string | undefined) => {
  const normalized = normalizeRole(role);
  if (normalized === 'user' || normalized === 'student' || normalized === 'parent') {
    return 'parent';
  }
  if (normalized === 'moderator') return 'moderator';
  if (normalized === 'superadmin') return 'superadmin';
  return normalized || 'parent';
};

export default function UsersPage() {
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [token, setToken] = useState('');
  const [actorRole, setActorRole] = useState('');
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [details, setDetails] = useState<DetailsPayload | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft | null>(null);
  const [detailsStatus, setDetailsStatus] = useState('');
  const canManageUsers = CAN_MANAGE_ROLES.has(actorRole);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const session = data?.session;
      setToken(session?.access_token || '');
      const role =
        session?.user?.user_metadata?.role || session?.user?.app_metadata?.role || '';
      setActorRole(role);
      setForbidden(!CAN_MANAGE_ROLES.has(role));
    });
    return () => {
      mounted = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!token || !canManageUsers) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const usersResult = await loadAuthUsers(token);
      setUsers(Array.isArray(usersResult?.data) ? usersResult.data : []);
    } catch (error) {
      setMessage((error as Error)?.message || 'Не удалось загрузить пользователей');
    } finally {
      setLoading(false);
    }
  }, [canManageUsers, token]);

  useEffect(() => {
    reload();
  }, [reload]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visibleUsers = users.filter((item) =>
      USERS_PAGE_VISIBLE_ROLES.has(normalizeRole(item.role))
    );
    const sorted = [...visibleUsers].sort((a, b) =>
      String(a.email || '').localeCompare(String(b.email || ''))
    );
    if (!q) return sorted;
    return sorted.filter((item) =>
      `${item.email} ${item.firstName || ''} ${item.lastName || ''} ${getRoleLabel(item.role)}`
        .toLowerCase()
        .includes(q)
    );
  }, [query, users]);

  const openDetails = useCallback(
    async (userId: string) => {
      if (!token || !canManageUsers || !userId) return;
      setSelectedUserId(userId);
      setDetailsLoading(true);
      setDetailsStatus('');
      try {
        const result = await loadAuthUserDetails(token, userId);
        const payload = result?.data || null;
        setDetails(payload);
        if (payload) {
          setSettingsDraft({
            first_name: payload?.settings?.first_name || payload?.user?.firstName || '',
            last_name: payload?.settings?.last_name || payload?.user?.lastName || '',
            subscription_plan: payload?.settings?.subscription?.plan || 'free',
            subscription_status: payload?.settings?.subscription?.status || 'inactive',
            subscription_starts_at: toDateInput(payload?.settings?.subscription?.starts_at),
            subscription_ends_at: toDateInput(payload?.settings?.subscription?.ends_at),
            auto_renew: Boolean(payload?.settings?.subscription?.auto_renew),
            chat_bonus: Number(payload?.settings?.ai_limits?.chat_bonus) || 0,
            selector_bonus: Number(payload?.settings?.ai_limits?.selector_bonus) || 0,
            bonus_expires_at: toDateInput(payload?.settings?.ai_limits?.bonus_expires_at),
            notes: payload?.settings?.notes || '',
          });
        } else {
          setSettingsDraft(null);
        }
      } catch (error) {
        setDetails(null);
        setSettingsDraft(null);
        setDetailsStatus((error as Error)?.message || 'Не удалось загрузить детали пользователя');
      } finally {
        setDetailsLoading(false);
      }
    },
    [canManageUsers, token]
  );

  const toggleUserStatus = useCallback(
    async (userId: string, active: boolean) => {
      if (!token || !canManageUsers) return;
      setMessage('');
      try {
        await setAuthUserStatus(token, userId, active);
        setMessage('Статус пользователя обновлен');
        setUsers((prev) =>
          prev.map((item) =>
            item.id === userId
              ? {
                  ...item,
                  isActive: active,
                  bannedUntil: active
                    ? null
                    : new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 100).toISOString(),
                }
              : item
          )
        );
        if (details?.user?.id === userId) {
          setDetails((prev) =>
            prev
              ? {
                  ...prev,
                  user: {
                    ...prev.user,
                    isActive: active,
                    bannedUntil: active
                      ? null
                      : new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 100).toISOString(),
                  },
                }
              : prev
          );
        }
      } catch (error) {
        setMessage((error as Error)?.message || 'Не удалось обновить статус');
      }
    },
    [canManageUsers, details?.user?.id, token]
  );

  const saveDetails = useCallback(async () => {
    if (!token || !selectedUserId || !settingsDraft) return;
    setDetailsStatus('');
    try {
      await updateAuthUserSettings(token, selectedUserId, {
        first_name: settingsDraft.first_name,
        last_name: settingsDraft.last_name,
        subscription: {
          plan: settingsDraft.subscription_plan,
          status: settingsDraft.subscription_status,
          starts_at: settingsDraft.subscription_starts_at || '',
          ends_at: settingsDraft.subscription_ends_at || '',
          auto_renew: settingsDraft.auto_renew,
        },
        ai_limits: {
          chat_bonus: Number(settingsDraft.chat_bonus) || 0,
          selector_bonus: Number(settingsDraft.selector_bonus) || 0,
          bonus_expires_at: settingsDraft.bonus_expires_at || '',
        },
        notes: settingsDraft.notes,
      });
      setDetailsStatus('Сохранено');
      await openDetails(selectedUserId);
      setUsers((prev) =>
        prev.map((item) =>
          item.id === selectedUserId
            ? {
                ...item,
                firstName: settingsDraft.first_name,
                lastName: settingsDraft.last_name,
              }
            : item
        )
      );
    } catch (error) {
      setDetailsStatus((error as Error)?.message || 'Не удалось сохранить');
    }
  }, [openDetails, selectedUserId, settingsDraft, token]);

  if (forbidden) {
    return <div className="card">Только модератор и супер-админ могут управлять пользователями.</div>;
  }

  return (
    <div className="card">
      <div className="requests-head">
        <h2>Пользователи</h2>
        <button type="button" className="button secondary" onClick={reload}>
          Обновить
        </button>
      </div>
      <p className="muted">
        Управление пользователями кабинета родителей и модераторами: деактивация, аналитика,
        подписка, AI-кредиты.
      </p>

      <label className="field" style={{ marginTop: 12 }}>
        <span>Поиск (email, имя, фамилия)</span>
        <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>

      {message ? (
        <p className="muted" style={{ marginTop: 10, color: 'var(--danger)' }}>
          {message}
        </p>
      ) : null}

      {loading ? (
        <p className="muted">Загрузка...</p>
      ) : (
        <div style={{ marginTop: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
            <thead>
              <tr>
                {['Email', 'Имя', 'Фамилия', 'Роль', 'Статус', 'Действия'].map((head) => (
                  <th
                    key={head}
                    style={{
                      textAlign: 'left',
                      padding: '10px',
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
              {filteredUsers.map((user) => {
                const isActive =
                  typeof user.isActive === 'boolean' ? user.isActive : !user.bannedUntil;
                return (
                  <tr key={user.id}>
                    <td style={{ padding: '10px', borderBottom: '1px solid var(--line)' }}>
                      {user.email || '—'}
                    </td>
                    <td style={{ padding: '10px', borderBottom: '1px solid var(--line)' }}>
                      {user.firstName || '—'}
                    </td>
                    <td style={{ padding: '10px', borderBottom: '1px solid var(--line)' }}>
                      {user.lastName || '—'}
                    </td>
                    <td style={{ padding: '10px', borderBottom: '1px solid var(--line)' }}>
                      {getRoleLabel(user.role)}
                    </td>
                    <td style={{ padding: '10px', borderBottom: '1px solid var(--line)' }}>
                      <span className={`schools-status ${isActive ? 'ok' : 'warn'}`}>
                        {isActive ? 'Активен' : 'Деактивирован'}
                      </span>
                    </td>
                    <td style={{ padding: '10px', borderBottom: '1px solid var(--line)' }}>
                      <div className="schools-admin-actions">
                        <button
                          type="button"
                          className="button secondary"
                          onClick={() => openDetails(user.id)}
                        >
                          Подробнее
                        </button>
                        <button
                          type="button"
                          className="button secondary"
                          onClick={() => toggleUserStatus(user.id, !isActive)}
                        >
                          {isActive ? 'Деактивировать' : 'Активировать'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedUserId ? (
        <div className="card" style={{ marginTop: 16, border: '1px solid var(--line)' }}>
          <div className="requests-head">
            <h3 style={{ margin: 0 }}>Карточка пользователя</h3>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setSelectedUserId('');
                setDetails(null);
                setSettingsDraft(null);
                setDetailsStatus('');
              }}
            >
              Закрыть
            </button>
          </div>

          {detailsLoading ? (
            <p className="muted">Загрузка деталей...</p>
          ) : !details || !settingsDraft ? (
            <p className="muted">{detailsStatus || 'Данные не найдены.'}</p>
          ) : (
            <>
              <p className="muted" style={{ marginBottom: 10 }}>
                {details.user.email} · ID: {details.user.id}
              </p>
              <div className="form-row">
                <label className="field">
                  <span>Имя</span>
                  <input
                    className="input"
                    value={settingsDraft.first_name}
                    onChange={(event) =>
                      setSettingsDraft((prev) =>
                        prev ? { ...prev, first_name: event.target.value } : prev
                      )
                    }
                  />
                </label>
                <label className="field">
                  <span>Фамилия</span>
                  <input
                    className="input"
                    value={settingsDraft.last_name}
                    onChange={(event) =>
                      setSettingsDraft((prev) =>
                        prev ? { ...prev, last_name: event.target.value } : prev
                      )
                    }
                  />
                </label>
              </div>

              <h4 style={{ marginBottom: 8 }}>Подписка</h4>
              <div className="form-row">
                <label className="field">
                  <span>План</span>
                  <input
                    className="input"
                    value={settingsDraft.subscription_plan}
                    onChange={(event) =>
                      setSettingsDraft((prev) =>
                        prev ? { ...prev, subscription_plan: event.target.value } : prev
                      )
                    }
                    placeholder="free / premium / family"
                  />
                </label>
                <label className="field">
                  <span>Статус</span>
                  <select
                    value={settingsDraft.subscription_status}
                    onChange={(event) =>
                      setSettingsDraft((prev) =>
                        prev ? { ...prev, subscription_status: event.target.value } : prev
                      )
                    }
                  >
                    {['inactive', 'active', 'paused', 'expired'].map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label className="field">
                  <span>Начало подписки</span>
                  <input
                    className="input"
                    type="date"
                    value={settingsDraft.subscription_starts_at}
                    onChange={(event) =>
                      setSettingsDraft((prev) =>
                        prev ? { ...prev, subscription_starts_at: event.target.value } : prev
                      )
                    }
                  />
                </label>
                <label className="field">
                  <span>Окончание подписки</span>
                  <input
                    className="input"
                    type="date"
                    value={settingsDraft.subscription_ends_at}
                    onChange={(event) =>
                      setSettingsDraft((prev) =>
                        prev ? { ...prev, subscription_ends_at: event.target.value } : prev
                      )
                    }
                  />
                </label>
              </div>
              <label className="field" style={{ marginTop: 8 }}>
                <span>
                  <input
                    type="checkbox"
                    checked={settingsDraft.auto_renew}
                    onChange={(event) =>
                      setSettingsDraft((prev) =>
                        prev ? { ...prev, auto_renew: event.target.checked } : prev
                      )
                    }
                    style={{ marginRight: 8 }}
                  />
                  Автопродление
                </span>
              </label>

              <h4 style={{ marginBottom: 8 }}>AI лимиты и бонусы</h4>
              <div className="form-row">
                <label className="field">
                  <span>Доп. кредиты AI чата</span>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={settingsDraft.chat_bonus}
                    onChange={(event) =>
                      setSettingsDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              chat_bonus: Math.max(0, Number.parseInt(event.target.value || '0', 10) || 0),
                            }
                          : prev
                      )
                    }
                  />
                </label>
                <label className="field">
                  <span>Доп. кредиты AI подбора</span>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={settingsDraft.selector_bonus}
                    onChange={(event) =>
                      setSettingsDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              selector_bonus: Math.max(
                                0,
                                Number.parseInt(event.target.value || '0', 10) || 0
                              ),
                            }
                          : prev
                      )
                    }
                  />
                </label>
              </div>
              <label className="field">
                <span>Бонусы активны до</span>
                <input
                  className="input"
                  type="date"
                  value={settingsDraft.bonus_expires_at}
                  onChange={(event) =>
                    setSettingsDraft((prev) =>
                      prev ? { ...prev, bonus_expires_at: event.target.value } : prev
                    )
                  }
                />
              </label>

              <label className="field" style={{ marginTop: 8 }}>
                <span>Заметка по пользователю</span>
                <textarea
                  className="input"
                  rows={3}
                  value={settingsDraft.notes}
                  onChange={(event) =>
                    setSettingsDraft((prev) =>
                      prev ? { ...prev, notes: event.target.value } : prev
                    )
                  }
                />
              </label>

              <h4 style={{ marginBottom: 8 }}>Аналитика пользователя</h4>
              <div className="schools-admin-statuses" style={{ flexWrap: 'wrap', gap: 8 }}>
                <span className="schools-status ok">
                  Ответов в анкетах: {details.analytics.surveyResponsesCount || 0}
                </span>
                <span className="schools-status ok">
                  Заявок на консультацию: {details.analytics.consultationRequestsCount || 0}
                </span>
                <span className="schools-status ok">
                  AI чат запросов: {details.analytics.aiChatRequestsCount || 0}
                </span>
                <span className="schools-status ok">
                  AI подбор запросов: {details.analytics.aiMatchRequestsCount || 0}
                </span>
              </div>
              <p className="muted" style={{ marginTop: 8 }}>
                Часто заходит в: {(details.analytics.mostVisitedSections || []).join(', ') || '—'}
              </p>
              <p className="muted">
                Последняя активность:{' '}
                {details.analytics.lastActivityAt
                  ? new Date(details.analytics.lastActivityAt).toLocaleString()
                  : '—'}
              </p>

              <div className="schools-admin-actions" style={{ marginTop: 10 }}>
                <button type="button" className="primary" onClick={saveDetails}>
                  Сохранить настройки пользователя
                </button>
                {detailsStatus ? <span className="status saved">{detailsStatus}</span> : null}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
