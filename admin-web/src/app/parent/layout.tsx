'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { portalHomeByRole, resolvePortalRole } from '@/lib/portalRole';
import { isGuestMode, setGuestMode } from '@/lib/guestMode';

const NAV_ITEMS = [
  { href: '/parent/news', label: 'Новости' },
  { href: '/parent/schools', label: 'Школы' },
  { href: '/parent/courses', label: 'Курсы' },
  { href: '/parent/chat', label: 'Чат' },
  { href: '/parent/profile', label: 'Профиль' },
];

export default function ParentLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [guest, setGuest] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const session = data?.session;
      if (!session) {
        if (isGuestMode()) {
          setGuest(true);
          setReady(true);
          return;
        }
        router.replace('/login');
        return;
      }
      setGuest(false);
      const role = resolvePortalRole(
        session.user?.user_metadata?.role || session.user?.app_metadata?.role
      );
      if (role !== 'user') {
        router.replace(portalHomeByRole(role));
        return;
      }
      setReady(true);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        if (isGuestMode()) {
          setGuest(true);
          setReady(true);
          return;
        }
        router.replace('/login');
        return;
      }
      setGuest(false);
      const role = resolvePortalRole(
        session.user?.user_metadata?.role || session.user?.app_metadata?.role
      );
      if (role !== 'user') {
        router.replace(portalHomeByRole(role));
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  const handleSignOut = async () => {
    setGuestMode(false);
    await supabase.auth.signOut();
    router.replace('/login');
  };

  if (!ready) {
    return (
      <div className="page">
        <div className="container">
          <div className="card">Проверяем сессию...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container">
        <header className="topbar">
          <div className="brand">EDUMAP Parent</div>
          <nav className="topnav">
            {guest ? <span className="guest-pill">Гость</span> : null}
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={pathname === item.href || pathname.startsWith(`${item.href}/`) ? 'active' : ''}
              >
                {item.label}
              </Link>
            ))}
            <button type="button" className="topnav-logout" onClick={handleSignOut}>
              Выйти
            </button>
          </nav>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
