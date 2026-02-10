'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Status = 'idle' | 'submitting' | 'sent' | 'verifying' | 'error';

const normalizeEmail = (value: string) => (value ? value.trim().toLowerCase() : '');

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

  const redirectTo = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/school-registration`;
  }, []);

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
                onChange={(e) => setContactPhone(e.target.value)}
                type="tel"
                placeholder="+7..."
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
