'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAdminLocale } from '@/lib/adminLocale';
import { requestJson } from '@/lib/api';
import { supabase } from '@/lib/supabaseClient';

type ConsultationRequest = {
  id: string;
  createdAt?: string;
  schoolName?: string;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
  childName?: string;
  childGrade?: string;
  consultationType?: string;
  comment?: string;
};

export default function RequestsPage() {
  const { t } = useAdminLocale();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ConsultationRequest[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [token, setToken] = useState('');
  const [actorRole, setActorRole] = useState('user');

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const session = data?.session;
      setToken(session?.access_token || '');
      setActorRole(
        session?.user?.user_metadata?.role || session?.user?.app_metadata?.role || 'user'
      );
    });
    return () => {
      mounted = false;
    };
  }, []);

  const canView = actorRole === 'admin' || actorRole === 'moderator' || actorRole === 'superadmin';

  const loadRequests = useCallback(async () => {
    if (!token || !canView) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const payload = await requestJson<{ data?: ConsultationRequest[] }>(
        '/consultations',
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setRows(Array.isArray(payload?.data) ? payload.data : []);
    } catch (_error) {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [canView, token]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const cards = useMemo(() => rows.slice(0, 50), [rows]);

  return (
    <div className="card">
      {!canView ? <p className="muted">{t('usersForbidden')}</p> : null}
      <div className="requests-head">
        <h2>{t('requestsTitle')}</h2>
        <button type="button" className="button secondary" onClick={loadRequests}>
          {t('requestsRefresh')}
        </button>
      </div>

      {loading ? (
        <p className="muted">{t('requestsLoading')}</p>
      ) : cards.length ? (
        <div className="requests-list">
          {cards.map((request) => {
            const isActive = selectedIds.has(request.id);
            return (
              <button
                key={request.id}
                type="button"
                className={`request-card${isActive ? ' active' : ''}`}
                onClick={() =>
                  setSelectedIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(request.id)) next.delete(request.id);
                    else next.add(request.id);
                    return next;
                  })
                }
              >
                <div className={`request-check${isActive ? ' active' : ''}`}>
                  {isActive ? '✓' : ''}
                </div>
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
                    <strong>{t('requestsPhone')}</strong> {request.parentPhone || '—'}
                  </p>
                  {request.parentEmail ? (
                    <p>
                      <strong>{t('requestsEmail')}</strong> {request.parentEmail}
                    </p>
                  ) : null}
                  {request.schoolName ? (
                    <p>
                      <strong>{t('requestsSchool')}</strong> {request.schoolName}
                    </p>
                  ) : null}
                  {request.comment ? (
                    <p>
                      <strong>{t('requestsComment')}</strong> {request.comment}
                    </p>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="muted">{t('requestsEmpty')}</p>
      )}
    </div>
  );
}
