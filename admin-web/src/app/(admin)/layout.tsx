'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

const NAV_ITEMS = [
  { href: '/school-info', label: 'Информация о школе' },
  { href: '/media', label: 'Медиа' },
  { href: '/requests', label: 'Заявки' },
  { href: '/statistics', label: 'Статистика' },
  { href: '/verification', label: 'Верификация' },
  { href: '/profile', label: 'Профиль' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (!data.session) {
        router.replace('/login');
      } else {
        setReady(true);
      }
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace('/login');
      }
    });
    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  const handleSignOut = async () => {
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
          <div className="brand">EDUMAP Admin</div>
          <nav className="topnav">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={pathname === item.href ? 'active' : ''}
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
