'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type ProfileView = {
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

const normalizeText = (value: unknown) => {
  if (typeof value === 'string') return value.trim();
  return '';
};

const toProfileView = (user: any): ProfileView => {
  const meta = user?.user_metadata || {};
  return {
    firstName: normalizeText(meta.firstName || meta.first_name),
    lastName: normalizeText(meta.lastName || meta.last_name),
    name: normalizeText(meta.name),
    email: normalizeText(user?.email || meta.email),
    organization: normalizeText(meta.organization),
    contactPhone: normalizeText(meta.contactPhone || meta.contact_phone),
    website: normalizeText(meta.website),
    bin: normalizeText(meta.bin),
    iin: normalizeText(meta.iin),
    licenseNumber: normalizeText(meta.licenseNumber || meta.license_number),
    licenseIssuedAt: normalizeText(meta.licenseIssuedAt || meta.license_issued_at),
    licenseExpiresAt: normalizeText(meta.licenseExpiresAt || meta.license_expires_at),
  };
};

const ReadonlyField = ({ label, value }: { label: string; value: string }) => (
  <label className="field">
    <span>{label}</span>
    <input className="input" value={value || '—'} readOnly />
  </label>
);

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setProfile(toProfileView(data.session?.user));
      setLoading(false);
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const fullName = useMemo(() => {
    if (!profile) return '';
    const parts = [profile.firstName, profile.lastName].filter(Boolean);
    return parts.join(' ').trim() || profile.name || profile.organization;
  }, [profile]);

  if (loading) {
    return <div className="card">Загрузка профиля...</div>;
  }

  if (!profile) {
    return <div className="card">Профиль недоступен.</div>;
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Профиль школы</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Данные подтягиваются из регистрации и профиля аккаунта.
      </p>

      <div className="form-row">
        <ReadonlyField label="ФИО" value={fullName} />
        <ReadonlyField label="Email" value={profile.email} />
      </div>

      <div className="form-row">
        <ReadonlyField label="Организация" value={profile.organization} />
        <ReadonlyField label="Контактный телефон" value={profile.contactPhone} />
      </div>

      <div className="form-row">
        <ReadonlyField label="Сайт" value={profile.website} />
        <ReadonlyField label="БИН" value={profile.bin} />
      </div>

      <div className="form-row">
        <ReadonlyField label="ИИН представителя" value={profile.iin} />
        <ReadonlyField label="Номер лицензии" value={profile.licenseNumber} />
      </div>

      <div className="form-row">
        <ReadonlyField label="Дата выдачи лицензии" value={profile.licenseIssuedAt} />
        <ReadonlyField label="Срок действия лицензии" value={profile.licenseExpiresAt} />
      </div>
    </div>
  );
}
