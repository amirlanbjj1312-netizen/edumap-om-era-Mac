'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Status = 'idle' | 'submitting' | 'sent' | 'verifying' | 'error';

function SchoolRegistrationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const errorDescription = searchParams.get('error_description');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
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
    setStatus('submitting');
    setMessage('');
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
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
