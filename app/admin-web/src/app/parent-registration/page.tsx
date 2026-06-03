'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { portalHomeByRole, resolvePortalRole } from '@/lib/portalRole';
import { localeOptions, useParentLocale } from '@/lib/parentLocale';

type Status = 'idle' | 'submitting' | 'sent' | 'error';

export default function ParentRegistrationPage() {
  const router = useRouter();
  const { locale, setLocale, t } = useParentLocale();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
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
      setMessage(t('passwords_mismatch'));
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setStatus('error');
      setMessage(t('provide_email_password'));
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
    router.replace(`/onboarding?email=${encodeURIComponent(normalizedEmail)}`);
  };

  return (
    <div className="page">
      <div className="container">
        <div className="card" style={{ maxWidth: 560, margin: '40px auto' }}>
          <h1 style={{ marginTop: 0 }}>{t('parent_reg_title')}</h1>
          <div className="locale-toggle" style={{ marginTop: 8, marginBottom: 20, justifyContent: 'flex-start' }}>
            {localeOptions.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`locale-chip ${locale === item.value ? 'active' : ''}`}
                onClick={() => setLocale(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>{t('first_name')}</label>
              <input
                className="input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                type="text"
                placeholder={t('first_name_placeholder')}
              />
            </div>
            <div className="field">
              <label>{t('last_name')}</label>
              <input
                className="input"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                type="text"
                placeholder={t('last_name_placeholder')}
              />
            </div>
            <div className="field">
              <label>{t('email')}</label>
              <input
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder={t('parent_email_placeholder')}
                required
              />
            </div>
            <div className="field">
              <label>{t('password')}</label>
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
              <label>{t('confirm_password')}</label>
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
              {status === 'submitting' ? t('creating_account') : t('create_account')}
            </button>
          </form>

          <div style={{ marginTop: 16, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <Link className="muted" href="/login">
              {t('have_account')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
