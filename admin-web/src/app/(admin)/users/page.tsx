'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadAuthUsers, setUserRole } from '@/lib/api';
import { useAdminLocale } from '@/lib/adminLocale';
import { supabase } from '@/lib/supabaseClient';

const ROLE_OPTIONS = ['user', 'admin', 'moderator', 'superadmin'];

export default function UsersPage() {
  const { t } = useAdminLocale();
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; email: string; role: string; createdAt: string }>>([]);
  const [token, setToken] = useState('');
  const [actorRole, setActorRole] = useState('');
  const [targetEmail, setTargetEmail] = useState('');
  const [targetRole, setTargetRole] = useState('moderator');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const session = data?.session;
      setToken(session?.access_token || '');
      const role =
        session?.user?.user_metadata?.role || session?.user?.app_metadata?.role || '';
      setActorRole(role);
      setForbidden(role !== 'superadmin');
    });
    return () => {
      mounted = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!token || actorRole !== 'superadmin') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const result = await loadAuthUsers(token);
      setUsers(Array.isArray(result?.data) ? result.data : []);
    } catch (error) {
      setMessage((error as Error)?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [actorRole, token]);

  useEffect(() => {
    reload();
  }, [reload]);

  const submitRole = useCallback(async () => {
    if (!token || actorRole !== 'superadmin') return;
    if (!targetEmail.trim()) return;
    setMessage('');
    try {
      const result = await setUserRole(token, targetEmail.trim(), targetRole);
      setMessage(t('usersSaved'));
      setUsers((prev) =>
        prev.map((item) =>
          item.email.toLowerCase() === targetEmail.trim().toLowerCase()
            ? { ...item, role: result.data.role }
            : item
        )
      );
      setTargetEmail('');
    } catch (error) {
      setMessage((error as Error)?.message || t('saveError'));
    }
  }, [actorRole, targetEmail, targetRole, t, token]);

  const sorted = useMemo(
    () =>
      [...users].sort((a, b) =>
        String(a.email || '').localeCompare(String(b.email || ''))
      ),
    [users]
  );

  if (forbidden) {
    return <div className="card">{t('usersForbidden')}</div>;
  }

  return (
    <div className="card">
      <div className="requests-head">
        <h2>{t('usersTitle')}</h2>
        <button type="button" className="button secondary" onClick={reload}>
          {t('usersRefresh')}
        </button>
      </div>
      <p className="muted">{t('usersHint')}</p>

      <div className="form-row">
        <label className="field">
          <span>{t('usersEmail')}</span>
          <input
            className="input"
            value={targetEmail}
            onChange={(event) => setTargetEmail(event.target.value)}
            placeholder="name@example.com"
          />
        </label>
        <label className="field">
          <span>{t('usersRole')}</span>
          <select
            value={targetRole}
            onChange={(event) => setTargetRole(event.target.value)}
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="actions" style={{ marginTop: 4, marginBottom: 14 }}>
        <button type="button" className="primary" onClick={submitRole}>
          {t('usersSetRole')}
        </button>
        {message ? <span className="status saved">{message}</span> : null}
      </div>

      {loading ? (
        <p className="muted">{t('usersLoading')}</p>
      ) : (
        <div className="schools-admin-list">
          {sorted.map((user) => (
            <div key={user.id} className="schools-admin-card">
              <div className="schools-admin-top">
                <div>
                  <p className="request-title">{user.email}</p>
                  <p className="muted">{user.id}</p>
                </div>
                <span className="schools-status ok">{user.role || 'user'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
