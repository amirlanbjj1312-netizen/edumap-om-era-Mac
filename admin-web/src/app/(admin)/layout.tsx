'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { AdminLocaleProvider, useAdminLocale } from '@/lib/adminLocale';

const NAV_ITEMS = [
  { href: '/school-info', labelKey: 'navSchoolInfo', resetSelectedSchool: true },
  { href: '/schools', labelKey: 'navSchools' },
  { href: '/users', labelKey: 'navUsers' },
  { href: '/requests', labelKey: 'navRequests' },
  { href: '/statistics', labelKey: 'navStatistics' },
  { href: '/profile', labelKey: 'navProfile' },
] as const;

function AdminLayoutBody({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useAdminLocale();
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
          <div className="card">{t('checkingSession')}</div>
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
                onClick={() => {
                  if (item.resetSelectedSchool) {
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
