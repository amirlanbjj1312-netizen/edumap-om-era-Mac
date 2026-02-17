'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadSchools, upsertSchool } from '@/lib/api';
import { useAdminLocale } from '@/lib/adminLocale';
import { supabase } from '@/lib/supabaseClient';

const SELECTED_SCHOOL_STORAGE_KEY = 'EDUMAP_ADMIN_SELECTED_SCHOOL_ID';

const normalizeText = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

export default function SchoolsPage() {
  const { t } = useAdminLocale();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [actorEmail, setActorEmail] = useState('');
  const [actorRole, setActorRole] = useState('user');

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
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

  const editSchool = useCallback((schoolId: string) => {
    localStorage.setItem(SELECTED_SCHOOL_STORAGE_KEY, schoolId);
    window.location.href = '/school-info';
  }, []);

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
