'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SchoolRegistrationPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      router.replace('/parent-registration');
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [router]);

  return (
    <div className="page">
      <div className="container">
        <div className="card" style={{ maxWidth: 560, margin: '40px auto' }}>
          <h1 style={{ marginTop: 0 }}>Регистрация школы недоступна</h1>
          <p className="muted">
            На сайте доступна только регистрация пользователей.
          </p>
          <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link className="button" href="/parent-registration">
              Регистрация пользователя
            </Link>
            <Link className="button secondary" href="/login">
              Войти
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
