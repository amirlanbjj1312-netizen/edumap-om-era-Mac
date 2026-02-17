'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { AdminLocaleProvider, useAdminLocale } from '@/lib/adminLocale';

const NAV_ITEMS: Array<{
  href: string;
  labelKey: string;
  minRole?: 'moderator' | 'superadmin';
}> = [
  { href: '/school-info', labelKey: 'navSchoolInfo' },
  { href: '/schools', labelKey: 'navSchools', minRole: 'moderator' },
  { href: '/users', labelKey: 'navUsers', minRole: 'moderator' },
  { href: '/requests', labelKey: 'navRequests' },
  { href: '/statistics', labelKey: 'navStatistics' },
  { href: '/profile', labelKey: 'navProfile' },
];

const ROLE_PRIORITY: Record<string, number> = {
  user: 0,
  admin: 1,
  moderator: 2,
  superadmin: 3,
};

function AdminLayoutBody({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useAdminLocale();
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState('user');

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (!data.session) {
        router.replace('/login');
      } else {
        const nextRole =
          data.session.user?.user_metadata?.role ||
          data.session.user?.app_metadata?.role ||
          'user';
        setRole(nextRole);
        setReady(true);
      }
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace('/login');
      } else {
        const nextRole =
          session.user?.user_metadata?.role ||
          session.user?.app_metadata?.role ||
          'user';
        setRole(nextRole);
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
          <div className="card">{t('checkingSession')}</div>
        </div>
      </div>
    );
  }

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (!item.minRole) return true;
    return (ROLE_PRIORITY[role] || 0) >= (ROLE_PRIORITY[item.minRole] || 0);
  });

  return (
    <div className="page">
      <div className="container">
        <header className="topbar">
          <div className="brand">EDUMAP Admin</div>
          <nav className="topnav">
            {visibleNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={pathname === item.href ? 'active' : ''}
                onClick={() => {
                  if (item.href === '/school-info') {
                    localStorage.removeItem('EDUMAP_ADMIN_SELECTED_SCHOOL_ID');
                  }
                }}
              >
                {t(item.labelKey)}
              </Link>
            ))}
            <button type="button" className="topnav-logout" onClick={handleSignOut}>
              {t('logout')}
            </button>
          </nav>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminLocaleProvider>
      <AdminLayoutBody>{children}</AdminLayoutBody>
    </AdminLocaleProvider>
  );
}
