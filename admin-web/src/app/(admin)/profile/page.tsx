'use client';

import { useEffect, useMemo, useState } from 'react';
import { deleteSchool } from '@/lib/api';
import { buildFallbackSchoolId } from '@/lib/auth';
import { useAdminLocale } from '@/lib/adminLocale';
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
  const { t } = useAdminLocale();
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

    setStatus('saved');
    setMessage(t('saved'));
    setTimeout(() => setStatus('idle'), 1500);
  };

  const removeSchoolProfile = async () => {
    if (!form) return;
    if (!window.confirm(t('confirmDelete'))) return;

    setStatus('deleting');
    setMessage('');

    const schoolId = buildFallbackSchoolId(`${form.email} ${form.name || computedFullName}`.trim());
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
