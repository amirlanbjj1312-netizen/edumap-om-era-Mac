'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { portalHomeByRole, resolvePortalRole } from '@/lib/portalRole';
import { setGuestMode } from '@/lib/guestMode';
import { localeOptions, useParentLocale } from '@/lib/parentLocale';

function EyeOpenIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 3l18 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.6 6.3A11.9 11.9 0 0 1 12 6c6.5 0 10 6 10 6a17.8 17.8 0 0 1-4 4.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 7.7A18.6 18.6 0 0 0 2 12s3.5 6 10 6c1 0 1.9-.1 2.7-.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.9 9.9A3 3 0 0 0 12 15"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmNextPassword, setConfirmNextPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [updatePasswordLoading, setUpdatePasswordLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const { locale, setLocale, t } = useParentLocale();

  const getRecoveryModeFromUrl = () => {
    if (typeof window === 'undefined') return false;
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return search.get('mode') === 'recovery' || hash.get('type') === 'recovery';
  };

  useEffect(() => {
    const recoveryMode = getRecoveryModeFromUrl();
    if (recoveryMode) {
      setIsRecoveryMode(true);
    }
    supabase.auth.getSession().then(({ data }) => {
      const activeRecoveryMode = getRecoveryModeFromUrl();
      if (activeRecoveryMode) {
        setIsRecoveryMode(true);
        return;
      }
      if (data.session) {
        setGuestMode(false);
        const role = resolvePortalRole(
          data.session.user?.user_metadata?.role || data.session.user?.app_metadata?.role
        );
        router.replace(portalHomeByRole(role));
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
        setError('');
        setResetMessage('');
        return;
      }
      if (getRecoveryModeFromUrl()) {
        setIsRecoveryMode(true);
        return;
      }
      if (session) {
        setGuestMode(false);
        const role = resolvePortalRole(
          session.user?.user_metadata?.role || session.user?.app_metadata?.role
        );
        router.replace(portalHomeByRole(role));
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    setGuestMode(false);
    const { data } = await supabase.auth.getSession();
    const role = resolvePortalRole(
      data?.session?.user?.user_metadata?.role || data?.session?.user?.app_metadata?.role
    );
    router.replace(portalHomeByRole(role));
  };

  const handleForgotPassword = async () => {
    setError('');
    setResetMessage('');
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError(t('provide_email_for_reset'));
      return;
    }
    setResetLoading(true);
    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/login?mode=recovery`
        : undefined;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo,
    });
    setResetLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setResetMessage(t('reset_email_sent'));
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResetMessage('');
    if (!nextPassword.trim()) {
      setError(locale === 'en' ? 'Enter a new password.' : locale === 'kk' ? 'Жаңа құпиясөзді енгізіңіз.' : 'Введите новый пароль.');
      return;
    }
    if (nextPassword !== confirmNextPassword) {
      setError(
        locale === 'en'
          ? 'Passwords do not match.'
          : locale === 'kk'
            ? 'Құпиясөздер сәйкес емес.'
            : 'Пароли не совпадают.'
      );
      return;
    }
    setUpdatePasswordLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: nextPassword });
    setUpdatePasswordLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setResetMessage(
      locale === 'en'
        ? 'Password updated. Sign in with the new password.'
        : locale === 'kk'
          ? 'Құпиясөз жаңартылды. Енді жаңа құпиясөзбен кіріңіз.'
          : 'Пароль обновлен. Теперь войдите с новым паролем.'
    );
    setNextPassword('');
    setConfirmNextPassword('');
    await supabase.auth.signOut();
    setIsRecoveryMode(false);
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/login');
    }
  };

  return (
    <div className="page">
      <div className="container">
        <div className="card" style={{ maxWidth: 520, margin: '40px auto' }}>
          <h1 style={{ marginTop: 0 }}>
            {isRecoveryMode
              ? locale === 'en'
                ? 'Set a new password'
                : locale === 'kk'
                  ? 'Жаңа құпиясөз орнату'
                  : 'Установите новый пароль'
              : t('login_title')}
          </h1>
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
          <form onSubmit={isRecoveryMode ? handleUpdatePassword : handleSubmit}>
            {isRecoveryMode ? (
              <>
                <div className="field">
                  <label>
                    {locale === 'en' ? 'New password' : locale === 'kk' ? 'Жаңа құпиясөз' : 'Новый пароль'}
                  </label>
                  <div className="input-wrap">
                    <input
                      className="input"
                      value={nextPassword}
                      onChange={(e) => setNextPassword(e.target.value)}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      className="input-eye"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? t('hide_password') : t('show_password')}
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeOpenIcon />}
                    </button>
                  </div>
                </div>
                <div className="field">
                  <label>
                    {locale === 'en'
                      ? 'Confirm new password'
                      : locale === 'kk'
                        ? 'Жаңа құпиясөзді растаңыз'
                        : 'Подтвердите новый пароль'}
                  </label>
                  <input
                    className="input"
                    value={confirmNextPassword}
                    onChange={(e) => setConfirmNextPassword(e.target.value)}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </>
            ) : (
              <>
                <div className="field">
                  <label>{t('email')}</label>
                  <input
                    className="input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder={t('login_email_placeholder')}
                    required
                  />
                </div>
                <div className="field">
                  <label>{t('password')}</label>
                  <div className="input-wrap">
                    <input
                      className="input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      className="input-eye"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? t('hide_password') : t('show_password')}
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeOpenIcon />}
                    </button>
                  </div>
                </div>
                <div style={{ marginTop: -2, marginBottom: 10 }}>
                  <button
                    type="button"
                    className="muted"
                    onClick={handleForgotPassword}
                    disabled={resetLoading}
                    style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
                  >
                    {resetLoading ? t('sending_reset') : t('forgot_password')}
                  </button>
                </div>
              </>
            )}
            {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
            {resetMessage ? <p style={{ color: '#166534' }}>{resetMessage}</p> : null}
            <button className="button" type="submit" disabled={isRecoveryMode ? updatePasswordLoading : loading}>
              {isRecoveryMode
                ? updatePasswordLoading
                  ? locale === 'en'
                    ? 'Saving...'
                    : locale === 'kk'
                      ? 'Сақталуда...'
                      : 'Сохраняем...'
                  : locale === 'en'
                    ? 'Save new password'
                    : locale === 'kk'
                      ? 'Жаңа құпиясөзді сақтау'
                      : 'Сохранить новый пароль'
                : loading
                  ? t('signing_in')
                  : t('sign_in')}
            </button>
            {!isRecoveryMode ? (
              <button
                className="button secondary"
                type="button"
                style={{ marginLeft: 10 }}
                onClick={() => {
                  setGuestMode(true);
                  router.replace('/parent/news');
                }}
              >
                {t('guest_mode')}
              </button>
            ) : null}
          </form>
          <div style={{ marginTop: 16 }}>
            <a className="muted" href="/parent-registration">
              {t('no_account')}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
