'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAdminLocale } from '@/lib/adminLocale';
import { loadSchools, requestJson } from '@/lib/api';
import { buildFallbackSchoolId } from '@/lib/auth';
import { formatKzPhone } from '@/lib/phone';
import { supabase } from '@/lib/supabaseClient';

type ConsultationRequest = {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
  schoolId?: string;
  schoolName?: string;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
  childName?: string;
  childGrade?: string;
  consultationType?: string;
  comment?: string;
  status?: string;
  internalNote?: string;
  assignedTo?: string;
  followUpAt?: string;
};

const CRM_STATUS_OPTIONS = [
  { value: 'new', label: 'Новая' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'contacted', label: 'Связались' },
  { value: 'consultation_scheduled', label: 'Консультация назначена' },
  { value: 'waiting', label: 'Ждём ответ' },
  { value: 'enrolled', label: 'Поступил' },
  { value: 'closed', label: 'Закрыта' },
  { value: 'rejected', label: 'Отказ' },
];

const STATUS_TONE: Record<string, string> = {
  new: '#2d62d8',
  in_progress: '#6d5efc',
  contacted: '#1f9d55',
  consultation_scheduled: '#0f766e',
  waiting: '#c27b12',
  enrolled: '#15803d',
  closed: '#475569',
  rejected: '#b91c1c',
};

const normalizeEmail = (value: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const resolveSessionSchoolId = (user: any) => {
  const appSchoolId =
    typeof user?.app_metadata?.school_id === 'string' ? user.app_metadata.school_id.trim() : '';
  if (appSchoolId) return appSchoolId;
  const userSchoolId =
    typeof user?.user_metadata?.school_id === 'string' ? user.user_metadata.school_id.trim() : '';
  return userSchoolId;
};

const hasLeadAccessForSchool = (school: any) => {
  const plan = String(school?.monetization?.plan_name || 'Starter').trim().toLowerCase();
  return plan === 'growth' || plan === 'pro';
};

export default function RequestsPage() {
  const { t } = useAdminLocale();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<ConsultationRequest[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [token, setToken] = useState('');
  const [actorRole, setActorRole] = useState('user');
  const [actorEmail, setActorEmail] = useState('');
  const [message, setMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [draftStatus, setDraftStatus] = useState('new');
  const [draftAssignedTo, setDraftAssignedTo] = useState('');
  const [draftFollowUpAt, setDraftFollowUpAt] = useState('');
  const [draftInternalNote, setDraftInternalNote] = useState('');
  const [hasLeadAccess, setHasLeadAccess] = useState(true);
  const [accessResolved, setAccessResolved] = useState(false);

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
    });
    return () => {
      mounted = false;
    };
  }, []);

  const canView =
    actorRole === 'admin' || actorRole === 'moderator' || actorRole === 'superadmin';

  const loadRequests = useCallback(async () => {
    if (!token || !canView) {
      setRows([]);
      setLoading(false);
      setAccessResolved(true);
      return;
    }
    setLoading(true);
    try {
      if (actorRole === 'admin') {
        const schoolsResponse = await loadSchools();
        const allSchools = Array.isArray(schoolsResponse?.data) ? schoolsResponse.data : [];
        const email = normalizeEmail(actorEmail);
        const fallbackSchoolId = buildFallbackSchoolId(email).toLowerCase();
        const { data: sessionData } = await supabase.auth.getSession();
        const assignedSchoolId = resolveSessionSchoolId(sessionData?.session?.user).toLowerCase();
        const ownSchool =
          allSchools.find((item) => normalizeEmail(item?.basic_info?.email) === email) ||
          allSchools.find(
            (item) => String(item?.school_id || '').trim().toLowerCase() === assignedSchoolId
          ) ||
          allSchools.find(
            (item) => String(item?.school_id || '').trim().toLowerCase() === fallbackSchoolId
          ) ||
          null;
        const nextHasLeadAccess = hasLeadAccessForSchool(ownSchool);
        setHasLeadAccess(nextHasLeadAccess);
        setAccessResolved(true);
        if (!nextHasLeadAccess) {
          setRows([]);
          setSelectedId('');
          setLoading(false);
          return;
        }
      } else {
        setHasLeadAccess(true);
        setAccessResolved(true);
      }
      const payload = await requestJson<{ data?: ConsultationRequest[] }>('/consultations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const nextRows = Array.isArray(payload?.data) ? payload.data : [];
      setRows(nextRows);
      setSelectedId((prev) =>
        prev && nextRows.some((item) => item.id === prev) ? prev : nextRows[0]?.id || ''
      );
    } catch (_error) {
      setRows([]);
      setHasLeadAccess(actorRole !== 'admin');
      setAccessResolved(true);
    } finally {
      setLoading(false);
    }
  }, [actorEmail, actorRole, canView, token]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const filteredRows = useMemo(
    () => rows.filter((item) => (!statusFilter ? true : String(item.status || 'new') === statusFilter)),
    [rows, statusFilter]
  );

  const selectedRequest = useMemo(
    () => filteredRows.find((item) => item.id === selectedId) || filteredRows[0] || null,
    [filteredRows, selectedId]
  );

  useEffect(() => {
    if (!selectedRequest) return;
    setDraftStatus(String(selectedRequest.status || 'new'));
    setDraftAssignedTo(String(selectedRequest.assignedTo || ''));
    setDraftFollowUpAt(
      selectedRequest.followUpAt
        ? new Date(selectedRequest.followUpAt).toISOString().slice(0, 16)
        : ''
    );
    setDraftInternalNote(String(selectedRequest.internalNote || ''));
  }, [selectedRequest]);

  const summaryCards = useMemo(() => {
    const countByStatus = (status: string) =>
      rows.filter((item) => String(item.status || 'new') === status).length;
    return [
      { label: 'Всего заявок', value: rows.length },
      { label: 'Новые', value: countByStatus('new') },
      { label: 'В работе', value: countByStatus('in_progress') + countByStatus('contacted') },
      { label: 'Назначены', value: countByStatus('consultation_scheduled') },
      { label: 'Поступили', value: countByStatus('enrolled') },
    ];
  }, [rows]);

  const saveRequest = async () => {
    if (!token || !selectedRequest?.id) return;
    setSaving(true);
    setMessage('');
    try {
      const response = await requestJson<{ data?: ConsultationRequest }>(
        `/consultations/${encodeURIComponent(selectedRequest.id)}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            status: draftStatus,
            assignedTo: draftAssignedTo,
            followUpAt: draftFollowUpAt ? new Date(draftFollowUpAt).toISOString() : '',
            internalNote: draftInternalNote,
          }),
        }
      );
      const updated = response?.data;
      setRows((prev) =>
        prev.map((item) => (item.id === updated?.id ? { ...item, ...updated } : item))
      );
      setMessage('Заявка обновлена.');
    } catch (error) {
      setMessage((error as Error)?.message || 'Не удалось обновить заявку');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      {!canView ? <p className="muted">{t('usersForbidden')}</p> : null}
      {canView && actorRole === 'admin' && accessResolved && !hasLeadAccess ? (
        <div
          style={{
            border: '1px solid rgba(120,106,255,0.18)',
            borderRadius: 18,
            background: '#fff',
            padding: 18,
            marginBottom: 16,
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Заявки доступны на Growth и Pro</h3>
          <p className="muted" style={{ margin: 0 }}>
            На Starter родители не могут отправлять заявки на консультацию. Поднимите тариф в
            разделе «Информация о школе → Тариф и продвижение».
          </p>
        </div>
      ) : null}
      <div className="requests-head">
        <h2>{t('requestsTitle')}</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">Все статусы</option>
            {CRM_STATUS_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <button type="button" className="button secondary" onClick={loadRequests}>
            {t('requestsRefresh')}
          </button>
        </div>
      </div>

      {message ? <p className="status">{message}</p> : null}

      {canView && actorRole === 'admin' && accessResolved && !hasLeadAccess ? (
        <p className="muted">Лиды скрыты, пока у школы нет тарифа Growth или Pro.</p>
      ) : loading ? (
        <p className="muted">{t('requestsLoading')}</p>
      ) : !rows.length ? (
        <p className="muted">{t('requestsEmpty')}</p>
      ) : (
        <>
          <div className="schools-admin-list" style={{ marginBottom: 16 }}>
            {summaryCards.map((item) => (
              <div key={item.label} className="schools-admin-card">
                <p className="request-title">{item.label}</p>
                <p className="muted" style={{ fontSize: 28, margin: '8px 0 0' }}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(320px, 0.95fr) minmax(360px, 1.05fr)',
              gap: 16,
            }}
          >
            <div className="card" style={{ margin: 0, maxHeight: 820, overflow: 'auto' }}>
              <h3 style={{ marginTop: 0 }}>Лиды</h3>
              <div className="requests-list">
                {filteredRows.map((request) => {
                  const isActive = selectedRequest?.id === request.id;
                  const statusValue = String(request.status || 'new');
                  const statusLabel =
                    CRM_STATUS_OPTIONS.find((item) => item.value === statusValue)?.label || statusValue;
                  return (
                    <button
                      key={request.id}
                      type="button"
                      className={`request-card${isActive ? ' active' : ''}`}
                      onClick={() => setSelectedId(request.id)}
                    >
                      <div className="request-body">
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 12,
                            alignItems: 'flex-start',
                          }}
                        >
                          <p className="request-title" style={{ margin: 0 }}>
                            {request.parentName || '—'} {'→'} {request.childName || '—'}
                          </p>
                          <span
                            style={{
                              padding: '4px 10px',
                              borderRadius: 999,
                              background: `${STATUS_TONE[statusValue] || '#475569'}18`,
                              color: STATUS_TONE[statusValue] || '#475569',
                              fontWeight: 700,
                              fontSize: 12,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {statusLabel}
                          </span>
                        </div>
                        <p className="muted">
                          {request.consultationType || 'First meeting'} ·{' '}
                          {request.createdAt ? new Date(request.createdAt).toLocaleString() : '—'}
                        </p>
                        <p>
                          <strong>{t('requestsPhone')}</strong> {formatKzPhone(request.parentPhone) || '—'}
                        </p>
                        {request.parentEmail ? (
                          <p>
                            <strong>{t('requestsEmail')}</strong> {request.parentEmail}
                          </p>
                        ) : null}
                        <p>
                          <strong>Класс ребенка</strong> {request.childGrade || '—'}
                        </p>
                        {request.schoolName ? (
                          <p>
                            <strong>{t('requestsSchool')}</strong> {request.schoolName}
                          </p>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="card" style={{ margin: 0 }}>
              <h3 style={{ marginTop: 0 }}>Карточка заявки</h3>
              {selectedRequest ? (
                <div style={{ display: 'grid', gap: 16 }}>
                  <div className="school-service-list">
                    <div className="school-service-item">
                      <p>Родитель</p>
                      <strong>{selectedRequest.parentName || '—'}</strong>
                    </div>
                    <div className="school-service-item">
                      <p>Телефон</p>
                      <strong>{formatKzPhone(selectedRequest.parentPhone) || '—'}</strong>
                    </div>
                    <div className="school-service-item">
                      <p>Email</p>
                      <strong>{selectedRequest.parentEmail || '—'}</strong>
                    </div>
                    <div className="school-service-item">
                      <p>Ребенок</p>
                      <strong>{selectedRequest.childName || '—'}</strong>
                    </div>
                    <div className="school-service-item">
                      <p>Класс</p>
                      <strong>{selectedRequest.childGrade || '—'}</strong>
                    </div>
                    <div className="school-service-item">
                      <p>Тип запроса</p>
                      <strong>{selectedRequest.consultationType || '—'}</strong>
                    </div>
                    <div className="school-service-item">
                      <p>Школа</p>
                      <strong>{selectedRequest.schoolName || selectedRequest.schoolId || '—'}</strong>
                    </div>
                    <div className="school-service-item">
                      <p>Создана</p>
                      <strong>
                        {selectedRequest.createdAt
                          ? new Date(selectedRequest.createdAt).toLocaleString()
                          : '—'}
                      </strong>
                    </div>
                  </div>

                  {selectedRequest.comment ? (
                    <div
                      style={{
                        border: '1px solid rgba(120,106,255,0.18)',
                        borderRadius: 16,
                        padding: 16,
                        background: '#fff',
                      }}
                    >
                      <p className="request-title" style={{ marginTop: 0 }}>
                        Что заполнил родитель
                      </p>
                      <p style={{ margin: 0, lineHeight: 1.55 }}>{selectedRequest.comment}</p>
                    </div>
                  ) : null}

                  <div
                    style={{
                      border: '1px solid rgba(120,106,255,0.18)',
                      borderRadius: 16,
                      padding: 16,
                      background: '#fff',
                      display: 'grid',
                      gap: 12,
                    }}
                  >
                    <p className="request-title" style={{ marginTop: 0 }}>
                      CRM-поля школы
                    </p>
                    <label className="field" style={{ marginBottom: 0 }}>
                      <span>Статус</span>
                      <select value={draftStatus} onChange={(e) => setDraftStatus(e.target.value)}>
                        {CRM_STATUS_OPTIONS.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field" style={{ marginBottom: 0 }}>
                      <span>Ответственный</span>
                      <input
                        className="input"
                        value={draftAssignedTo}
                        onChange={(e) => setDraftAssignedTo(e.target.value)}
                        placeholder="Например: Алия, admissions manager"
                      />
                    </label>
                    <label className="field" style={{ marginBottom: 0 }}>
                      <span>Следующий контакт</span>
                      <input
                        className="input"
                        type="datetime-local"
                        value={draftFollowUpAt}
                        onChange={(e) => setDraftFollowUpAt(e.target.value)}
                      />
                    </label>
                    <label className="field" style={{ marginBottom: 0 }}>
                      <span>Внутренний комментарий</span>
                      <textarea
                        className="input"
                        rows={5}
                        value={draftInternalNote}
                        onChange={(e) => setDraftInternalNote(e.target.value)}
                        placeholder="Созвонились, интересует 5 класс, нужен follow-up после экскурсии"
                      />
                    </label>
                    <button
                      type="button"
                      className="button"
                      onClick={saveRequest}
                      disabled={saving}
                    >
                      {saving ? 'Сохраняем...' : 'Сохранить CRM-данные'}
                    </button>
                  </div>

                  <div className="muted" style={{ fontSize: 14 }}>
                    Обновлено:{' '}
                    {selectedRequest.updatedAt
                      ? new Date(selectedRequest.updatedAt).toLocaleString()
                      : 'еще не обновлялось'}
                    {selectedRequest.updatedBy ? ` · ${selectedRequest.updatedBy}` : ''}
                  </div>
                </div>
              ) : (
                <p className="muted">Выберите заявку слева.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
