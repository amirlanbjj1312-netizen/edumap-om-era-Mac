'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { AdminLocaleProvider, useAdminLocale } from '@/lib/adminLocale';
import { portalHomeByRole, resolvePortalRole } from '@/lib/portalRole';

const NAV_ITEMS: Array<{
  href: string;
  labelKey: string;
  minRole?: 'moderator' | 'superadmin';
}> = [
  { href: '/school-info', labelKey: 'navSchoolInfo' },
  { href: '/schools', labelKey: 'navSchools', minRole: 'moderator' },
  { href: '/news', labelKey: 'navNews', minRole: 'moderator' },
  { href: '/courses', labelKey: 'navCourses', minRole: 'moderator' },
  { href: '/pricing', labelKey: 'navPricing' },
  { href: '/users', labelKey: 'navUsers', minRole: 'moderator' },
  { href: '/requests', labelKey: 'navRequests' },
  { href: '/statistics', labelKey: 'navStatistics', minRole: 'moderator' },
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
  const { t, locale } = useAdminLocale();
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState('user');

  useEffect(() => {
    let mounted = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        if (!data.session) {
          router.replace('/login');
        } else {
          const nextRole = resolvePortalRole(
            data.session.user?.user_metadata?.role ||
              data.session.user?.app_metadata?.role
          );
          if (nextRole === 'user') {
            router.replace(portalHomeByRole(nextRole));
            return;
          }
          setRole(nextRole);
          setReady(true);
        }
      })
      .catch(() => {
        if (!mounted) return;
        router.replace('/login');
      });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace('/login');
      } else {
        const nextRole =
          resolvePortalRole(
            session.user?.user_metadata?.role ||
            session.user?.app_metadata?.role
          );
        if (nextRole === 'user') {
          router.replace(portalHomeByRole(nextRole));
          return;
        }
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
  const footerUi =
    locale === 'en'
      ? {
          roleTag: 'Admin panel',
          navTitle: 'Navigation',
          socialsTitle: 'Social',
          contactsTitle: 'Contacts',
          legalTitle: 'Legal',
          schoolInfo: 'School info',
          schools: 'Schools',
          news: 'News',
          users: 'Users',
          instagram: 'Instagram',
          telegram: 'Telegram',
          whatsapp: 'WhatsApp',
          phonePrimary: '+7 747 550 0012',
          phoneSecondary: '+7 701 536 4689',
          email: 'info@edumap.kz',
          privacy: 'Privacy policy',
          terms: 'Terms of use',
          rights: 'All rights reserved.',
        }
      : locale === 'kk'
        ? {
            roleTag: 'Әкімші кабинеті',
            navTitle: 'Навигация',
            socialsTitle: 'Әлеуметтік желілер',
            contactsTitle: 'Байланыс',
            legalTitle: 'Құқықтық ақпарат',
            schoolInfo: 'Мектеп туралы',
            schools: 'Мектептер',
            news: 'Жаңалықтар',
            users: 'Пайдаланушылар',
            instagram: 'Instagram',
            telegram: 'Telegram',
            whatsapp: 'WhatsApp',
            phonePrimary: '+7 747 550 0012',
            phoneSecondary: '+7 701 536 4689',
            email: 'info@edumap.kz',
            privacy: 'Құпиялық саясаты',
            terms: 'Платформа ережелері',
            rights: 'Барлық құқықтар қорғалған.',
          }
        : {
            roleTag: 'Кабинет администратора',
            navTitle: 'Навигация',
            socialsTitle: 'Мы в соцсетях',
            contactsTitle: 'Контакты',
            legalTitle: 'Правовая информация',
            schoolInfo: 'Информация о школе',
            schools: 'Школы',
            news: 'Новости',
            users: 'Пользователи',
            instagram: 'Instagram',
            telegram: 'Telegram',
            whatsapp: 'WhatsApp',
            phonePrimary: '+7 747 550 0012',
            phoneSecondary: '+7 701 536 4689',
            email: 'info@edumap.kz',
            privacy: 'Политика конфиденциальности',
            terms: 'Правила пользования',
            rights: 'Все права защищены.',
          };

  return (
    <div className="page">
      <div className="container">
        <header className="topbar">
          <div className="brand">EDUMAP Admin</div>
          <div className="topbar-actions">
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
            </nav>
            <button type="button" className="topnav-logout" onClick={handleSignOut}>
              {t('logout')}
            </button>
          </div>
        </header>
        <main>{children}</main>
        <footer className="app-footer admin-app-footer">
          <div className="app-footer-main">
            <div className="app-footer-grid">
              <div className="app-footer-col app-footer-brand-col">
                <p className="app-footer-brand">EDUMAP Admin</p>
                <p className="app-footer-text">{footerUi.roleTag}</p>
              </div>
              <div className="app-footer-col">
                <p className="app-footer-title">{footerUi.navTitle}</p>
                <Link href="/school-info">{footerUi.schoolInfo}</Link>
                <Link href="/schools">{footerUi.schools}</Link>
                <Link href="/news">{footerUi.news}</Link>
                <Link href="/users">{footerUi.users}</Link>
              </div>
              <div className="app-footer-col">
                <p className="app-footer-title">{footerUi.socialsTitle}</p>
                <a href="#" aria-disabled="true">
                  {footerUi.instagram}
                </a>
                <a href="#" aria-disabled="true">
                  {footerUi.telegram}
                </a>
                <a href="#" aria-disabled="true">
                  {footerUi.whatsapp}
                </a>
              </div>
              <div className="app-footer-col">
                <p className="app-footer-title">{footerUi.contactsTitle}</p>
                <a href={`tel:${footerUi.phonePrimary.replace(/\s+/g, '')}`}>
                  {footerUi.phonePrimary}
                </a>
                <a href={`tel:${footerUi.phoneSecondary.replace(/\s+/g, '')}`}>
                  {footerUi.phoneSecondary}
                </a>
                <a href={`mailto:${footerUi.email}`}>{footerUi.email}</a>
              </div>
              <div className="app-footer-col">
                <p className="app-footer-title">{footerUi.legalTitle}</p>
                <a href="#" aria-disabled="true">
                  {footerUi.privacy}
                </a>
                <a href="#" aria-disabled="true">
                  {footerUi.terms}
                </a>
              </div>
            </div>
            <div className="app-footer-bottom">
              © {new Date().getFullYear()} EDUMAP. {footerUi.rights}
            </div>
          </div>
        </footer>
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
