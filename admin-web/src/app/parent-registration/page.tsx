'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { portalHomeByRole, resolvePortalRole } from '@/lib/portalRole';

type Status = 'idle' | 'submitting' | 'sent' | 'error';

export default function ParentRegistrationPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const session = data?.session;
      if (!session) return;
      const role = resolvePortalRole(
        session.user?.user_metadata?.role || session.user?.app_metadata?.role
      );
      router.replace(portalHomeByRole(role));
    });
    return () => {
      mounted = false;
    };
  }, [router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== passwordConfirm) {
      setStatus('error');
      setMessage('Пароли не совпадают.');
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setStatus('error');
      setMessage('Укажите email и пароль.');
      return;
    }
    setStatus('submitting');
    setMessage('');
    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/login`
        : undefined;
    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          role: 'user',
          firstName: firstName || undefined,
          name: firstName || undefined,
          lastName: lastName || undefined,
          contactPhone: phone || undefined,
          registrationSource: 'web-parent',
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
    setMessage('Письмо отправлено. Подтвердите email и войдите в кабинет.');
  };

  return (
    <div className="page">
      <div className="container">
        <div className="card" style={{ maxWidth: 560, margin: '40px auto' }}>
          <h1 style={{ marginTop: 0 }}>Регистрация родителя</h1>
          <p className="muted">После подтверждения email вход выполняется через общую страницу /login.</p>

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
                placeholder="parent@email.com"
                required
              />
            </div>
            <div className="field">
              <label>Телефон</label>
              <input
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="text"
                placeholder="+7 (___) ___-__-__"
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

            {message ? (
              <p style={{ color: status === 'error' ? '#b91c1c' : '#166534' }}>{message}</p>
            ) : null}

            <button className="button" type="submit" disabled={status === 'submitting'}>
              {status === 'submitting' ? 'Создаем аккаунт...' : 'Создать аккаунт'}
            </button>
          </form>

          <div style={{ marginTop: 16, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <Link className="muted" href="/login">
              Уже есть аккаунт? Войти
            </Link>
            <Link className="muted" href="/register">
              Назад к выбору роли
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
