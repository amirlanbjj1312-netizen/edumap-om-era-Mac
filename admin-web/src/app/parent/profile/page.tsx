'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { isGuestMode } from '@/lib/guestMode';

type UserState = {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
};

export default function ParentProfilePage() {
  const [guest] = useState(() => isGuestMode());
  const [profile, setProfile] = useState<UserState>({
    email: '',
    firstName: '',
    lastName: '',
    role: '',
  });

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const user = data?.session?.user;
      setProfile({
        email: String(user?.email || ''),
        firstName: String(user?.user_metadata?.firstName || user?.user_metadata?.name || ''),
        lastName: String(user?.user_metadata?.lastName || ''),
        role: String(user?.user_metadata?.role || user?.app_metadata?.role || 'user'),
      });
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="card">
      <h2 className="section-title">Профиль</h2>
      <p className="muted">Личный кабинет родителя.</p>
      {guest ? <p className="muted">Вы находитесь в гостевом режиме.</p> : null}

      <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
        <div style={{ border: '1px solid rgba(120,106,255,0.2)', borderRadius: 14, padding: 12 }}>
          <p style={{ margin: 0, fontWeight: 700 }}>
            {[profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Родитель'}
          </p>
          <p className="muted" style={{ margin: '4px 0 0' }}>{profile.email || '—'}</p>
          <p className="muted" style={{ margin: '4px 0 0' }}>Роль: {profile.role || 'user'}</p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="button" href="/parent/subscription">
            Подписка
          </Link>
          <Link className="button secondary" href="/parent/chat">
            Поддержка
          </Link>
          {guest ? (
            <Link className="button secondary" href="/login">
              Войти в аккаунт
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
