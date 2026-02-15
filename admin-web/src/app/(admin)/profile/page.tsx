'use client';

import { useEffect, useMemo, useState } from 'react';
import { deleteSchool, loadSchools, upsertSchool } from '@/lib/api';
import { buildFallbackSchoolId } from '@/lib/auth';
import { useAdminLocale } from '@/lib/adminLocale';
import { createEmptySchoolProfile } from '@/lib/schoolProfile';
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
    contactPhone: normalizeText(fromMeta('contactPhone', 'contact_phone', 'phone')),
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
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  readOnly?: boolean;
}) => (
  <label className="field">
    <span>{label}</span>
    <input
      className="input"
      value={value}
      type={type}
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

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setForm(toProfileForm(data.session?.user));
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

  const updateField = (field: keyof ProfileForm, value: string) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const saveProfile = async () => {
    if (!form) return;
    setStatus('saving');
    setMessage('');
    const metadata = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      name: (form.name || computedFullName).trim(),
      email: form.email.trim(),
      organization: form.organization.trim(),
      contactPhone: form.contactPhone.trim(),
      website: form.website.trim(),
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
      const email = normalizeEmail(form.email);
      const schoolId = buildFallbackSchoolId(email);
      const result = await loadSchools();
      const existing =
        result.data.find((item: any) => item.school_id === schoolId) ||
        result.data.find((item: any) => normalizeEmail(item?.basic_info?.email) === email);
      const nextProfile = existing
        ? createEmptySchoolProfile(existing)
        : createEmptySchoolProfile({ school_id: schoolId });
      const targetSchoolId = existing?.school_id || schoolId;

      const org = form.organization.trim();
      if (org) {
        nextProfile.basic_info.display_name.ru = org;
        nextProfile.basic_info.display_name.en = org;
        nextProfile.basic_info.display_name.kk = org;
        nextProfile.basic_info.name.ru = org;
        nextProfile.basic_info.name.en = org;
        nextProfile.basic_info.name.kk = org;
      }
      if (form.contactPhone.trim()) {
        nextProfile.basic_info.phone = form.contactPhone.trim();
      }
      if (form.email.trim()) {
        nextProfile.basic_info.email = form.email.trim();
      }
      if (form.website.trim()) {
        nextProfile.basic_info.website = form.website.trim();
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

    setStatus('saved');
    setMessage(t('saved'));
    setTimeout(() => setStatus('idle'), 1500);
  };

  const removeSchoolProfile = async () => {
    if (!form) return;
    if (!window.confirm(t('confirmDelete'))) return;

    setStatus('deleting');
    setMessage('');

    const schoolId = buildFallbackSchoolId(normalizeEmail(form.email));
    try {
      await deleteSchool(schoolId);
      setStatus('deleted');
      setMessage(t('deleted'));
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

  return (
    <div className="card">
      <div className="locale-toggle" style={{ marginBottom: 8 }}>
        {(['ru', 'en', 'kk'] as const).map((lang) => (
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
      <h2 style={{ marginTop: 0 }}>{t('profileTitle')}</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        {t('profileHint')}
      </p>

      <div className="form-row">
        <EditableField
          label={t('firstName')}
          value={form.firstName}
          onChange={(value) => updateField('firstName', value)}
        />
        <EditableField
          label={t('lastName')}
          value={form.lastName}
          onChange={(value) => updateField('lastName', value)}
        />
      </div>

      <div className="form-row">
        <EditableField
          label={t('fullName')}
          value={form.name}
          onChange={(value) => updateField('name', value)}
        />
        <EditableField
          label={t('email')}
          value={form.email}
          readOnly
          onChange={() => {}}
        />
      </div>

      <div className="form-row">
        <EditableField
          label={t('organization')}
          value={form.organization}
          onChange={(value) => updateField('organization', value)}
        />
        <EditableField
          label={t('contactPhone')}
          value={form.contactPhone}
          onChange={(value) => updateField('contactPhone', value)}
        />
      </div>

      <div className="form-row">
        <EditableField
          label={t('website')}
          value={form.website}
          onChange={(value) => updateField('website', value)}
        />
        <EditableField
          label={t('bin')}
          value={form.bin}
          onChange={(value) => updateField('bin', value)}
        />
      </div>

      <div className="form-row">
        <EditableField
          label={t('iin')}
          value={form.iin}
          onChange={(value) => updateField('iin', value)}
        />
        <EditableField
          label={t('licenseNumber')}
          value={form.licenseNumber}
          onChange={(value) => updateField('licenseNumber', value)}
        />
      </div>

      <div className="form-row">
        <EditableField
          label={t('licenseIssuedAt')}
          value={form.licenseIssuedAt}
          type="date"
          onChange={(value) => updateField('licenseIssuedAt', value)}
        />
        <EditableField
          label={t('licenseExpiresAt')}
          value={form.licenseExpiresAt}
          type="date"
          onChange={(value) => updateField('licenseExpiresAt', value)}
        />
      </div>

      <div className="actions">
        <button
          type="button"
          className="primary"
          disabled={status === 'saving' || status === 'deleting'}
          onClick={saveProfile}
        >
          {status === 'saving' ? t('saving') : t('save')}
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={status === 'saving' || status === 'deleting'}
          onClick={removeSchoolProfile}
        >
          {status === 'deleting' ? t('deleting') : t('deleteSchoolProfile')}
        </button>
        <span className={`status ${status === 'error' ? 'error' : status === 'saved' ? 'saved' : ''}`}>
          {message}
        </span>
      </div>
    </div>
  );
}
