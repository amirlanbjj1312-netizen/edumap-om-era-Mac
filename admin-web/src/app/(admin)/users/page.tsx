'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  deleteReviewById,
  loadAllReviews,
  loadAuthUsers,
  setAuthUserStatus,
  setUserRole,
} from '@/lib/api';
import { useAdminLocale } from '@/lib/adminLocale';
import { supabase } from '@/lib/supabaseClient';

const ROLE_OPTIONS = ['user', 'admin', 'moderator', 'superadmin'];
const CAN_MANAGE_ROLES = new Set(['moderator', 'superadmin']);
const CAN_ASSIGNABLE_ROLES: Record<string, string[]> = {
  superadmin: ROLE_OPTIONS,
  moderator: ['user', 'admin', 'moderator'],
};

export default function UsersPage() {
  const { t } = useAdminLocale();
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [users, setUsers] = useState<
    Array<{
      id: string;
      email: string;
      role: string;
      createdAt: string;
      bannedUntil?: string | null;
      isActive?: boolean;
    }>
  >([]);
  const [reviews, setReviews] = useState<
    Array<{
      id: string;
      school_id: string;
      school_name: string;
      author: string;
      text: string;
      rating: number;
      created_at: string;
    }>
  >([]);
  const [token, setToken] = useState('');
  const [actorRole, setActorRole] = useState('');
  const [targetEmail, setTargetEmail] = useState('');
  const [targetRole, setTargetRole] = useState('moderator');
  const [message, setMessage] = useState('');
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
      const [usersResult, reviewsResult] = await Promise.all([
        loadAuthUsers(token),
        loadAllReviews(token),
      ]);
      setUsers(Array.isArray(usersResult?.data) ? usersResult.data : []);
      setReviews(Array.isArray(reviewsResult?.data) ? reviewsResult.data : []);
    } catch (error) {
      setMessage((error as Error)?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [canManageUsers, token]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const allowedRoles = CAN_ASSIGNABLE_ROLES[actorRole] || [];
    if (!allowedRoles.length) return;
    if (!allowedRoles.includes(targetRole)) {
      setTargetRole(allowedRoles[0]);
    }
  }, [actorRole, targetRole]);

  const submitRole = useCallback(async () => {
    if (!token || !canManageUsers) return;
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
  }, [canManageUsers, targetEmail, targetRole, t, token]);

  const toggleUserStatus = useCallback(
    async (userId: string, active: boolean) => {
      if (!token || !canManageUsers) return;
      setMessage('');
      try {
        await setAuthUserStatus(token, userId, active);
        setMessage(t('usersSaved'));
        setUsers((prev) =>
          prev.map((item) =>
            item.id === userId
              ? {
                  ...item,
                  isActive: active,
                  bannedUntil: active
                    ? null
                    : new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 100)
                        .toISOString(),
                }
              : item
          )
        );
      } catch (error) {
        setMessage((error as Error)?.message || t('saveError'));
      }
    },
    [canManageUsers, t, token]
  );

  const handleDeleteReview = useCallback(
    async (reviewId: string) => {
      if (!token || !canManageUsers) return;
      setMessage('');
      try {
        await deleteReviewById(token, reviewId);
        setReviews((prev) => prev.filter((item) => item.id !== reviewId));
      } catch (error) {
        setMessage((error as Error)?.message || t('saveError'));
      }
    },
    [canManageUsers, t, token]
  );

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
            {(CAN_ASSIGNABLE_ROLES[actorRole] || []).map((role) => (
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
        <>
          <div className="schools-admin-list">
            {sorted.map((user) => {
              const isActive =
                typeof user.isActive === 'boolean'
                  ? user.isActive
                  : !user.bannedUntil;
              return (
                <div key={user.id} className="schools-admin-card">
                  <div className="schools-admin-top">
                    <div>
                      <p className="request-title">{user.email}</p>
                      <p className="muted">{user.id}</p>
                    </div>
                    <div className="schools-admin-statuses">
                      <span className={`schools-status ${isActive ? 'ok' : 'warn'}`}>
                        {isActive ? t('usersStatusActive') : t('usersStatusInactive')}
                      </span>
                      <span className="schools-status ok">{user.role || 'user'}</span>
                    </div>
                  </div>
                  <div className="schools-admin-actions">
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => toggleUserStatus(user.id, !isActive)}
                    >
                      {isActive ? t('usersDeactivate') : t('usersActivate')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>{t('usersReviewsTitle')}</h3>
            {reviews.length ? (
              <div className="schools-admin-list">
                {reviews.map((review) => (
                  <div key={review.id} className="schools-admin-card">
                    <p className="request-title">{review.text || '—'}</p>
                    <p className="muted">
                      <strong>{t('usersSchool')}</strong> {review.school_name || review.school_id}
                    </p>
                    <p className="muted">
                      <strong>{t('usersAuthor')}</strong> {review.author || '—'}
                    </p>
                    <p className="muted">
                      <strong>{t('usersRating')}</strong> {review.rating || 0}
                    </p>
                    <p className="muted">
                      {review.created_at
                        ? new Date(review.created_at).toLocaleString()
                        : '—'}
                    </p>
                    <div className="schools-admin-actions">
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => handleDeleteReview(review.id)}
                      >
                        {t('usersReviewDelete')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">{t('usersReviewsEmpty')}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
