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

const EditableField = ({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  readOnly?: boolean;
}) => (
  <label className="field">
    <span>{label}</span>
    <input
      className="input"
      value={value}
      type={type}
      placeholder={placeholder}
      readOnly={readOnly}
      onChange={(event) => onChange(event.target.value)}
    />
  </label>
);

export default function ProfilePage() {
  const { locale, setLocale, t } = useAdminLocale();
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusState>('idle');
  const [message, setMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [draftFirstName, setDraftFirstName] = useState('');
  const [draftLastName, setDraftLastName] = useState('');
  const [draftName, setDraftName] = useState('');
  const [draftOrganization, setDraftOrganization] = useState('');
  const [draftPhone, setDraftPhone] = useState('');
  const [draftWebsite, setDraftWebsite] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      const nextForm = toProfileForm(data.session?.user);
      setForm(nextForm);
      setDraftFirstName(nextForm.firstName);
      setDraftLastName(nextForm.lastName);
      setDraftName(nextForm.name);
      setDraftOrganization(nextForm.organization);
      setDraftPhone(nextForm.contactPhone);
      setDraftWebsite(nextForm.website);
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

  const saveProfile = async () => {
    if (!form) return;
    setStatus('saving');
    setMessage('');
    const firstName = draftFirstName.trim();
    const lastName = draftLastName.trim();
    const name = draftName.trim() || [firstName, lastName].filter(Boolean).join(' ').trim();
    const organization = draftOrganization.trim();
    const contactPhone = formatKzPhone(draftPhone);
    const website = draftWebsite.trim();

    const metadata = {
      firstName,
      lastName,
      name: name || computedFullName,
      email: form.email.trim(),
      organization,
      contactPhone,
      website,
      bin: form.bin.trim(),
      iin: form.iin.trim(),
      licenseNumber: form.licenseNumber.trim(),
      licenseIssuedAt: form.licenseIssuedAt.trim(),
      licenseExpiresAt: form.licenseExpiresAt.trim(),
    };

    const { error } = await supabase.auth.updateUser({ data: metadata });
    if (error) {
      setStatus('error');
      setMessage(error.message || t('saveError'));
      return;
    }

    // Sync key profile fields into school profile used by school-info/parent views.
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
      const nextProfile = existing
        ? createEmptySchoolProfile(existing)
        : createEmptySchoolProfile({ school_id: schoolId });
      const targetSchoolId = existing?.school_id || schoolId;

      const org = organization;
      if (org) {
        nextProfile.basic_info.display_name.ru = org;
        nextProfile.basic_info.display_name.en = org;
        nextProfile.basic_info.display_name.kk = org;
        nextProfile.basic_info.name.ru = org;
        nextProfile.basic_info.name.en = org;
        nextProfile.basic_info.name.kk = org;
      }
      if (contactPhone.trim()) {
        nextProfile.basic_info.phone = contactPhone;
      }
      if (website.trim()) {
        nextProfile.basic_info.website = website;
      }
      if (form.licenseNumber.trim()) {
        nextProfile.basic_info.license_details.number = form.licenseNumber.trim();
      }
      if (form.licenseIssuedAt.trim()) {
        nextProfile.basic_info.license_details.issued_at = form.licenseIssuedAt.trim();
      }
      if (form.licenseExpiresAt.trim()) {
        nextProfile.basic_info.license_details.valid_until = form.licenseExpiresAt.trim();
      }

      nextProfile.school_id = targetSchoolId;
      await upsertSchool(nextProfile);
    } catch {
      // Keep profile save successful even if school profile sync fails.
    }

    setForm((prev) =>
      prev
        ? {
            ...prev,
            firstName,
            lastName,
            name,
            organization,
            contactPhone,
            website,
          }
        : prev
    );
    setIsEditing(false);
    setStatus('saved');
    setMessage(t('saved'));
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
          editProfile: 'Edit profile',
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
            editProfile: 'Профильді өңдеу',
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
            editProfile: 'Редактировать профиль',
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
                if (isEditing) {
                  setDraftFirstName(form.firstName);
                  setDraftLastName(form.lastName);
                  setDraftName(form.name);
                  setDraftOrganization(form.organization);
                  setDraftPhone(form.contactPhone);
                  setDraftWebsite(form.website);
                }
                setIsEditing((prev) => !prev);
                setMessage('');
              }}
              disabled={status === 'saving' || status === 'deleting'}
            >
              {isEditing ? ui.cancel : ui.editProfile}
            </button>
          </div>
          {isEditing ? (
            <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
              <div className="form-row">
                <EditableField
                  label={t('firstName')}
                  value={draftFirstName}
                  onChange={setDraftFirstName}
                />
                <EditableField
                  label={t('lastName')}
                  value={draftLastName}
                  onChange={setDraftLastName}
                />
              </div>
              <EditableField
                label={t('fullName')}
                value={draftName}
                onChange={setDraftName}
              />
              <div className="form-row">
                <EditableField
                  label={t('organization')}
                  value={draftOrganization}
                  onChange={setDraftOrganization}
                />
                <EditableField
                  label={t('contactPhone')}
                  value={draftPhone}
                  type="tel"
                  placeholder="+7 (___) ___-__-__"
                  onChange={(value) => setDraftPhone(formatKzPhone(value))}
                />
              </div>
              <div className="form-row">
                <EditableField
                  label={t('website')}
                  value={draftWebsite}
                  onChange={setDraftWebsite}
                />
                <EditableField
                  label={t('email')}
                  value={form.email}
                  readOnly
                  onChange={() => {}}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="button"
                  disabled={status === 'saving' || status === 'deleting'}
                  onClick={saveProfile}
                >
                  {status === 'saving' ? t('saving') : t('save')}
                </button>
                <button
                  type="button"
                  className="button secondary"
                  disabled={status === 'saving' || status === 'deleting'}
                  onClick={() => {
                    setDraftFirstName(form.firstName);
                    setDraftLastName(form.lastName);
                    setDraftName(form.name);
                    setDraftOrganization(form.organization);
                    setDraftPhone(form.contactPhone);
                    setDraftWebsite(form.website);
                    setIsEditing(false);
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
        <button
          type="button"
          className="button secondary"
          onClick={() => window.location.assign('/requests')}
        >
          {ui.contactSupport}
        </button>
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
