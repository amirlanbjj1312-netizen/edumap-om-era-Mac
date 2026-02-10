'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import rawSchools from '../../../../assets/data/schools.json';

type Status = 'idle' | 'submitting' | 'sent' | 'verifying' | 'error';

const normalizeEmail = (value: string) => (value ? value.trim().toLowerCase() : '');

const normalizeRegistryValue = (value = '') =>
  value
    .toLowerCase()
    .replace(/[^a-zа-я0-9ё]/gi, '')
    .trim();

const collectRegistryNames = (school: any) => {
  if (!school) return [];
  const names = [school.name, school.name_ru, school.name_en].filter(Boolean);
  if (Array.isArray(school.aliases)) {
    names.push(...school.aliases);
  }
  return names;
};

const registryNames = Array.from(
  new Set(
    rawSchools
      .flatMap((school) => collectRegistryNames(school))
      .map((name) => normalizeRegistryValue(name))
      .filter(Boolean)
  )
);

const isSchoolInRegistry = (organization: string) => {
  const normalized = normalizeRegistryValue(organization);
  if (!normalized) return false;
  return registryNames.some((name) => name.includes(normalized) || normalized.includes(name));
};

const extractDigits = (value = '') => value.replace(/\D/g, '');

const isValidDateString = (value = '') => {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
  const [yearStr, monthStr, dayStr] = trimmed.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!Number.isFinite(year) || year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const compareDates = (fromValue: string, toValue: string) => {
  if (!fromValue || !toValue) return true;
  const from = new Date(`${fromValue}T00:00:00Z`);
  const to = new Date(`${toValue}T00:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return true;
  return to.getTime() >= from.getTime();
};

const formatKzPhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  let local = digits;
  if (local.startsWith('7') || local.startsWith('8')) {
    local = local.slice(1);
  }
  local = local.slice(0, 10);
  const parts = [
    local.slice(0, 3),
    local.slice(3, 6),
    local.slice(6, 8),
    local.slice(8, 10),
  ];
  let formatted = '+7';
  if (parts[0]) formatted += ` (${parts[0]}`;
  if (parts[0]?.length === 3) formatted += ')';
  if (parts[1]) formatted += ` ${parts[1]}`;
  if (parts[2]) formatted += `-${parts[2]}`;
  if (parts[3]) formatted += `-${parts[3]}`;
  return formatted;
};

function SchoolRegistrationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const errorDescription = searchParams.get('error_description');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [organization, setOrganization] = useState('');
  const [bin, setBin] = useState('');
  const [iin, setIin] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseIssuedAt, setLicenseIssuedAt] = useState('');
  const [licenseExpiresAt, setLicenseExpiresAt] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  const redirectTo = useMemo(() => 'https://ed-kappa-one.vercel.app/school-registration', []);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (errorDescription) {
        setStatus('error');
        setMessage(decodeURIComponent(errorDescription));
        return;
      }

      if (code) {
        setStatus('verifying');
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!active) return;
        if (error) {
          setStatus('error');
          setMessage(error.message);
          return;
        }
        router.replace('/school-info');
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session) {
        router.replace('/school-info');
      }
    };

    run();
    return () => {
      active = false;
    };
  }, [code, errorDescription, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!redirectTo) return;
    if (password !== passwordConfirm) {
      setStatus('error');
      setMessage('Пароли не совпадают.');
      return;
    }
    const emailInput = normalizeEmail(email);
    if (!emailInput || !password) {
      setStatus('error');
      setMessage('Укажите email и пароль.');
      return;
    }
    if (!isSchoolInRegistry(organization)) {
      setStatus('error');
      setMessage('Школа не найдена в реестре.');
      return;
    }
    const trimmedIin = extractDigits(iin);
    if (trimmedIin.startsWith('28')) {
      setStatus('error');
      setMessage('ИИН не может начинаться с 28.');
      return;
    }
    if (trimmedIin && trimmedIin.length !== 12) {
      setStatus('error');
      setMessage('ИИН должен содержать 12 цифр.');
      return;
    }
    const trimmedBin = extractDigits(bin);
    if (trimmedBin && trimmedBin.length !== 12) {
      setStatus('error');
      setMessage('БИН должен содержать 12 цифр.');
      return;
    }
    if (!isValidDateString(licenseIssuedAt)) {
      setStatus('error');
      setMessage('Неверный формат даты выдачи лицензии.');
      return;
    }
    if (!isValidDateString(licenseExpiresAt)) {
      setStatus('error');
      setMessage('Неверный формат срока действия лицензии.');
      return;
    }
    if (licenseIssuedAt && licenseExpiresAt && !compareDates(licenseIssuedAt, licenseExpiresAt)) {
      setStatus('error');
      setMessage('Срок действия лицензии должен быть позже даты выдачи.');
      return;
    }
    setStatus('submitting');
    setMessage('');
    const { error } = await supabase.auth.signUp({
      email: emailInput,
      password,
      options: {
        data: {
          role: 'admin',
          firstName: firstName || undefined,
          name: firstName || undefined,
          lastName: lastName || undefined,
          organization: organization || undefined,
          bin: bin || undefined,
          iin: iin || undefined,
          licenseNumber: licenseNumber || undefined,
          licenseIssuedAt: licenseIssuedAt || undefined,
          licenseExpiresAt: licenseExpiresAt || undefined,
          contactPhone: contactPhone || undefined,
          website: website || undefined,
          schoolVerified: false,
          verificationStatus: 'pending',
          verificationSource: 'web',
        },
        emailRedirectTo: redirectTo,
      },
    });
    if (error) {
      setStatus('error');
      setMessage(error.message);
      return;
    }
    setStatus('sent');
    setMessage('Письмо отправлено. Подтвердите email, чтобы войти.');
  };

  return (
    <div className="page">
      <div className="container">
        <div className="card" style={{ maxWidth: 560, margin: '40px auto' }}>
          <h1 style={{ marginTop: 0 }}>Регистрация школы</h1>
          <p className="muted">
            Зарегистрируйтесь, подтвердите email по ссылке из письма и перейдите в личный кабинет.
          </p>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Имя</label>
              <input
                className="input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                type="text"
                placeholder="Имя"
              />
            </div>
            <div className="field">
              <label>Фамилия</label>
              <input
                className="input"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                type="text"
                placeholder="Фамилия"
              />
            </div>
            <div className="field">
              <label>Email</label>
              <input
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="admin@school.kz"
                required
              />
            </div>
            <div className="field">
              <label>Пароль</label>
              <input
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="••••••••"
                required
              />
            </div>
            <div className="field">
              <label>Повторите пароль</label>
              <input
                className="input"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                type="password"
                placeholder="••••••••"
                required
              />
            </div>
            <div className="field">
              <label>Школа / организация</label>
              <input
                className="input"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                type="text"
                placeholder="Название школы"
              />
            </div>
            <div className="field">
              <label>БИН</label>
              <input
                className="input"
                value={bin}
                onChange={(e) => setBin(e.target.value)}
                type="text"
                placeholder="12 цифр"
              />
            </div>
            <div className="field">
              <label>ИИН представителя</label>
              <input
                className="input"
                value={iin}
                onChange={(e) => setIin(e.target.value)}
                type="text"
                placeholder="12 цифр"
              />
            </div>
            <div className="field">
              <label>Номер лицензии</label>
              <input
                className="input"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                type="text"
                placeholder="Лицензия"
              />
            </div>
            <div className="field">
              <label>Дата выдачи лицензии</label>
              <input
                className="input"
                value={licenseIssuedAt}
                onChange={(e) => setLicenseIssuedAt(e.target.value)}
                type="date"
              />
            </div>
            <div className="field">
              <label>Срок действия лицензии</label>
              <input
                className="input"
                value={licenseExpiresAt}
                onChange={(e) => setLicenseExpiresAt(e.target.value)}
                type="date"
              />
            </div>
            <div className="field">
              <label>Контактный телефон</label>
              <input
                className="input"
                value={contactPhone}
                onChange={(e) => setContactPhone(formatKzPhone(e.target.value))}
                type="tel"
                placeholder="+7 (___) ___-__-__"
              />
            </div>
            <div className="field">
              <label>Сайт</label>
              <input
                className="input"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                type="url"
                placeholder="https://"
              />
            </div>
            {message ? <p style={{ color: status === 'error' ? '#b91c1c' : '#1d4ed8' }}>{message}</p> : null}
            <button className="button" type="submit" disabled={status === 'submitting'}>
              {status === 'submitting' ? 'Отправляем...' : 'Зарегистрироваться'}
            </button>
          </form>
          <div style={{ marginTop: 16 }}>
            <Link className="muted" href="/login">
              Уже есть аккаунт? Войти
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SchoolRegistrationPage() {
  return (
    <Suspense
      fallback={
        <div className="page">
          <div className="container">
            <div className="card" style={{ maxWidth: 560, margin: '40px auto' }}>
              <h1 style={{ marginTop: 0 }}>Регистрация школы</h1>
              <p className="muted">Загрузка...</p>
            </div>
          </div>
        </div>
      }
    >
      <SchoolRegistrationContent />
    </Suspense>
  );
}
