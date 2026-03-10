'use client';

import Link from 'next/link';

export default function RegisterPage() {
  return (
    <div className="page">
      <div className="container">
        <div className="card" style={{ maxWidth: 760, margin: '40px auto' }}>
          <h1 style={{ marginTop: 0 }}>Регистрация в EDUMAP</h1>
          <p className="muted">
            Выберите тип кабинета. Вход для всех ролей один: через страницу /login.
          </p>

          <div
            style={{
              marginTop: 16,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 14,
            }}
          >
            <div
              style={{
                border: '1px solid rgba(120,106,255,0.2)',
                borderRadius: 16,
                padding: 16,
                background: '#fff',
              }}
            >
              <h3 style={{ marginTop: 0 }}>Родитель</h3>
              <p className="muted">Подбор школы, подписка и чат поддержки.</p>
              <Link className="button" href="/parent-registration">
                Зарегистрироваться как родитель
              </Link>
            </div>

            <div
              style={{
                border: '1px solid rgba(120,106,255,0.2)',
                borderRadius: 16,
                padding: 16,
                background: '#fff',
              }}
            >
              <h3 style={{ marginTop: 0 }}>Школа / Админ</h3>
              <p className="muted">Профиль школы, заявки, статистика и админ-раздел.</p>
              <Link className="button" href="/school-registration">
                Зарегистрировать школу
              </Link>
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <Link className="muted" href="/login">
              Уже есть аккаунт? Войти
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
