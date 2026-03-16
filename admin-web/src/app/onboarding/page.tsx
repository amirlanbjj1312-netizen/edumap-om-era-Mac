'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { localeOptions, useParentLocale } from '@/lib/parentLocale';

export default function OnboardingPage() {
  const searchParams = useSearchParams();
  const email = String(searchParams.get('email') || '').trim();
  const { locale, setLocale, t } = useParentLocale();

  return (
    <div className="page">
      <div className="container">
        <div className="card" style={{ maxWidth: 620, margin: '40px auto' }}>
          <div className="locale-toggle" style={{ marginBottom: 8 }}>
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

          <h1 style={{ marginTop: 0 }}>{t('onboarding_title')}</h1>
          <p className="muted">{t('onboarding_subtitle')}</p>

          {email ? (
            <div
              style={{
                marginTop: 16,
                border: '1px solid rgba(120,106,255,0.2)',
                borderRadius: 12,
                padding: 12,
                background: '#fff',
              }}
            >
              <p className="muted" style={{ marginTop: 0, marginBottom: 6 }}>
                {t('onboarding_email_label')}
              </p>
              <strong>{email}</strong>
            </div>
          ) : null}

          <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
            <div className="muted">1. {t('onboarding_step_1')}</div>
            <div className="muted">2. {t('onboarding_step_2')}</div>
            <div className="muted">3. {t('onboarding_step_3')}</div>
          </div>

          <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link className="button" href="/login">
              {t('onboarding_cta_login')}
            </Link>
            <Link className="button secondary" href="/parent-registration">
              {t('onboarding_cta_register')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
