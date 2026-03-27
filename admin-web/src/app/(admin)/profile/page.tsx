'use client';

import { useEffect, useMemo, useState } from 'react';
import { loadSchools, upsertSchool } from '@/lib/api';
import { buildFallbackSchoolId } from '@/lib/auth';
import { useAdminLocale } from '@/lib/adminLocale';
import { createEmptySchoolProfile } from '@/lib/schoolProfile';
import { formatKzPhone } from '@/lib/phone';
import { supabase } from '@/lib/supabaseClient';

type ProfileForm = {
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  organization: string;
  contactPhone: string;
  website: string;
  bin: string;
  iin: string;
  licenseNumber: string;
  licenseIssuedAt: string;
  licenseExpiresAt: string;
};

type StatusState = 'idle' | 'saving' | 'saved' | 'error' | 'deleting' | 'deleted';

const normalizeText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
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

const toProfileForm = (user: any): ProfileForm => {
  const meta = user?.user_metadata || {};
  const fromMeta = (...keys: string[]) => {
    for (const key of keys) {
      const value = meta?.[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return '';
  };
  return {
    firstName: normalizeText(fromMeta('firstName', 'first_name', 'name')),
    lastName: normalizeText(fromMeta('lastName', 'last_name')),
    name: normalizeText(fromMeta('name', 'full_name')),
    email: normalizeText(user?.email || meta.email),
    organization: normalizeText(fromMeta('organization', 'schoolName', 'school_name')),
    contactPhone: formatKzPhone(fromMeta('contactPhone', 'contact_phone', 'phone')),
    website: normalizeText(fromMeta('website', 'site', 'url')),
    bin: normalizeText(fromMeta('bin')),
    iin: normalizeText(fromMeta('iin')),
    licenseNumber: normalizeText(fromMeta('licenseNumber', 'license_number', 'licenseNo', 'license_no')),
    licenseIssuedAt: normalizeText(fromMeta('licenseIssuedAt', 'license_issued_at', 'licenseIssueDate', 'license_issue_date')),
    licenseExpiresAt: normalizeText(fromMeta('licenseExpiresAt', 'license_expires_at', 'licenseExpiryDate', 'license_expiry_date', 'licenseValidUntil', 'license_valid_until')),
  };
};

export default function ProfilePage() {
  const { locale, setLocale, t } = useAdminLocale();
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusState>('idle');
  const [message, setMessage] = useState('');
  const [isPasswordEditing, setIsPasswordEditing] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [hasLeadAccess, setHasLeadAccess] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      const sessionUser = data.session?.user;
      const nextForm = toProfileForm(sessionUser);
      setForm(nextForm);
      try {
        const email = normalizeEmail(nextForm.email);
        const schoolId = resolveSessionSchoolId(sessionUser) || buildFallbackSchoolId(email);
        const result = await loadSchools();
        const ownSchool = result.data.find((item: any) => {
          const itemEmail = normalizeEmail(item?.basic_info?.email);
          return item?.school_id === schoolId || (itemEmail && itemEmail === email);
        });
        setHasLeadAccess(hasLeadAccessForSchool(ownSchool));
      } catch {
        setHasLeadAccess(false);
      }
      setLoading(false);
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const computedFullName = useMemo(() => {
    if (!form) return '';
    const parts = [form.firstName, form.lastName].filter(Boolean);
    return parts.join(' ').trim() || form.name;
  }, [form]);

  const changePassword = async () => {
    if (!form) return;
    const normalizedEmail = normalizeEmail(form.email);
    if (!normalizedEmail) {
      setStatus('error');
      setMessage('Email аккаунта не найден.');
      return;
    }
    if (!currentPassword.trim()) {
      setStatus('error');
      setMessage('Введите текущий пароль.');
      return;
    }
    if (nextPassword.length < 8) {
      setStatus('error');
      setMessage('Новый пароль должен содержать минимум 8 символов.');
      return;
    }
    if (nextPassword !== confirmPassword) {
      setStatus('error');
      setMessage('Новый пароль и подтверждение не совпадают.');
      return;
    }
    if (currentPassword === nextPassword) {
      setStatus('error');
      setMessage('Новый пароль должен отличаться от текущего.');
      return;
    }

    setStatus('saving');
    setMessage('');
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: currentPassword,
    });
    if (signInError) {
      setStatus('error');
      setMessage('Текущий пароль введен неверно.');
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: nextPassword });
    if (updateError) {
      setStatus('error');
      setMessage(updateError.message || t('saveError'));
      return;
    }
    setCurrentPassword('');
    setNextPassword('');
    setConfirmPassword('');
    setIsPasswordEditing(false);
    setStatus('saved');
    setMessage('Пароль обновлен.');
    setTimeout(() => setStatus('idle'), 1500);
  };

  const removeSchoolProfile = async () => {
    if (!form) return;
    if (!window.confirm(t('confirmDelete'))) return;

    setStatus('deleting');
    setMessage('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionUser = sessionData.session?.user;
      const email = normalizeEmail(form.email);
      const schoolId = resolveSessionSchoolId(sessionUser) || buildFallbackSchoolId(email);
      const result = await loadSchools();
      const existing = result.data.find((item: any) => {
        const itemEmail = normalizeEmail(item?.basic_info?.email);
        return item?.school_id === schoolId || (itemEmail && itemEmail === email);
      });
      const profile = existing
        ? createEmptySchoolProfile(existing)
        : createEmptySchoolProfile({ school_id: schoolId });
      profile.school_id = profile.school_id || schoolId;
      profile.system = {
        ...(profile.system || {}),
        is_active: false,
        updated_at: new Date().toISOString(),
      };
      await upsertSchool(profile);
      setStatus('deleted');
      setMessage('Профиль деактивирован.');
    } catch (error) {
      setStatus('error');
      setMessage((error as Error)?.message || t('deleteError'));
    }
  };

  if (loading) {
    return <div className="card">{t('loadingProfile')}</div>;
  }

  if (!form) {
    return <div className="card">{t('profileUnavailable')}</div>;
  }

  const ui =
    locale === 'en'
      ? {
          greeting: 'Hello',
          cabinet: 'School account',
          editProfile: 'Change password',
          cancel: 'Cancel',
          languageTitle: 'Language',
          languageHint: 'Language is applied to the whole account.',
          contactSupport: 'Contact support',
          notifications: 'Notifications',
          faq: 'FAQ',
        }
      : locale === 'kk'
        ? {
            greeting: 'Сәлеметсіз бе',
            cabinet: 'Мектеп кабинеті',
            editProfile: 'Құпиясөзді өзгерту',
            cancel: 'Бас тарту',
            languageTitle: 'Тіл',
            languageHint: 'Тіл бүкіл кабинетке қолданылады.',
            contactSupport: 'Қолдауға жазу',
            notifications: 'Хабарламалар',
            faq: 'Жиі қойылатын сұрақтар',
          }
        : {
            greeting: 'Здравствуйте',
            cabinet: 'Кабинет школы',
            editProfile: 'Сменить пароль',
            cancel: 'Отмена',
            languageTitle: 'Язык',
            languageHint: 'Изменение языка применяется ко всему кабинету.',
            contactSupport: 'Связаться с поддержкой',
            notifications: 'Уведомления',
            faq: 'Часто задаваемые вопросы',
          };
  const fullName = [form.firstName, form.lastName].filter(Boolean).join(' ').trim() || form.name || 'School';
  const initial = (form.firstName || form.lastName || form.organization || form.email || 'S')
    .trim()
    .charAt(0)
    .toUpperCase() || 'S';

  return (
    <div className="card">
      <div
        style={{
          borderRadius: 16,
          padding: '22px 20px',
          background: 'linear-gradient(135deg, #1f4db7 0%, #4f5fff 100%)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            width: 76,
            height: 76,
            borderRadius: '50%',
            border: '3px solid #ffc107',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 34,
            fontWeight: 800,
            background: 'rgba(255,255,255,0.08)',
            flexShrink: 0,
          }}
        >
          {initial}
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            {ui.greeting}, {fullName}!
          </p>
          <p style={{ margin: '4px 0 0', opacity: 0.9 }}>{ui.cabinet}</p>
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
        <div style={{ border: '1px solid rgba(120,106,255,0.2)', borderRadius: 14, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
            <p style={{ margin: 0, fontWeight: 700 }}>{ui.editProfile}</p>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                if (isPasswordEditing) {
                  setCurrentPassword('');
                  setNextPassword('');
                  setConfirmPassword('');
                }
                setIsPasswordEditing((prev) => !prev);
                setMessage('');
              }}
              disabled={status === 'saving' || status === 'deleting'}
            >
              {isPasswordEditing ? ui.cancel : ui.editProfile}
            </button>
          </div>
          {isPasswordEditing ? (
            <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
              <label className="field">
                <span>Текущий пароль</span>
                <input
                  className="input"
                  value={currentPassword}
                  type="password"
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Новый пароль</span>
                <input
                  className="input"
                  value={nextPassword}
                  type="password"
                  onChange={(event) => setNextPassword(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Подтвердите новый пароль</span>
                <input
                  className="input"
                  value={confirmPassword}
                  type="password"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="button"
                  disabled={status === 'saving' || status === 'deleting'}
                  onClick={changePassword}
                >
                  {status === 'saving' ? t('saving') : 'Сохранить пароль'}
                </button>
                <button
                  type="button"
                  className="button secondary"
                  disabled={status === 'saving' || status === 'deleting'}
                  onClick={() => {
                    setCurrentPassword('');
                    setNextPassword('');
                    setConfirmPassword('');
                    setIsPasswordEditing(false);
                    setMessage('');
                  }}
                >
                  {ui.cancel}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 10 }}>
              <p style={{ margin: 0, fontWeight: 700 }}>{fullName}</p>
              <p className="muted" style={{ margin: '4px 0 0' }}>{form.email || '—'}</p>
              <p className="muted" style={{ margin: '4px 0 0' }}>{form.organization || '—'}</p>
            </div>
          )}
          {message ? (
            <p
              style={{
                margin: '8px 0 0',
                color: status === 'error' ? '#b91c1c' : '#15803d',
              }}
            >
              {message}
            </p>
          ) : null}
        </div>
      </div>

      <div style={{ marginTop: 10, border: '1px solid rgba(120,106,255,0.2)', borderRadius: 14, padding: 12 }}>
        <p style={{ margin: 0, fontWeight: 700 }}>{ui.languageTitle}</p>
        <p className="muted" style={{ margin: '4px 0 8px' }}>{ui.languageHint}</p>
        <div className="locale-toggle" style={{ justifyContent: 'flex-start', marginBottom: 0 }}>
          {(['ru', 'kk', 'en'] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              className={`locale-chip${locale === lang ? ' active' : ''}`}
              onClick={() => setLocale(lang)}
            >
              {lang === 'kk' ? 'KZ' : lang.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {hasLeadAccess ? (
          <button
            type="button"
            className="button secondary"
            onClick={() => window.location.assign('/requests')}
          >
            {ui.contactSupport}
          </button>
        ) : null}
        <button
          type="button"
          className="button secondary"
          onClick={() => window.location.assign('/news')}
        >
          {ui.notifications}
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => window.location.assign('/statistics')}
        >
          {ui.faq}
        </button>
      </div>

      <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="button secondary"
          disabled={status === 'saving' || status === 'deleting'}
          onClick={removeSchoolProfile}
        >
          {status === 'deleting' ? t('deleting') : t('deleteSchoolProfile')}
        </button>
      </div>
    </div>
  );
}
