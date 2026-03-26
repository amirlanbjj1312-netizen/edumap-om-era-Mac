'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { loadParentFooterSettings, loadSchools } from '@/lib/api';
import { buildFallbackSchoolId } from '@/lib/auth';
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
  { href: '/pricing', labelKey: 'navPricing', minRole: 'moderator' },
  { href: '/site-settings', labelKey: 'navSiteSettings', minRole: 'moderator' },
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

const normalizeEmail = (value: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const resolveSessionSchoolId = (user: any) => {
  const appSchoolId =
    typeof user?.app_metadata?.school_id === 'string' ? user.app_metadata.school_id.trim() : '';
  if (appSchoolId) return appSchoolId;
  const userSchoolId =
    typeof user?.user_metadata?.school_id === 'string' ? user.user_metadata.school_id.trim() : '';
  return userSchoolId;
};

const hasLeadAccessForSchool = (school: any) => {
  const plan = String(school?.monetization?.plan_name || 'Starter').trim().toLowerCase();
  return plan === 'growth' || plan === 'pro';
};

function AdminLayoutBody({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t, locale } = useAdminLocale();
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState('user');
  const [hasLeadAccess, setHasLeadAccess] = useState(false);
  const [footerSettings, setFooterSettings] = useState<any>(null);

  useEffect(() => {
    loadParentFooterSettings()
      .then((payload) => setFooterSettings(payload?.data || null))
      .catch(() => setFooterSettings(null));
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!mounted) return;
        if (!data.session) {
          router.replace('/login');
        } else {
          const sessionUser = data.session.user;
          const nextRole = resolvePortalRole(
            sessionUser?.user_metadata?.role ||
              sessionUser?.app_metadata?.role
          );
          if (nextRole === 'user') {
            router.replace(portalHomeByRole(nextRole));
            return;
          }
          if (nextRole === 'admin') {
            try {
              const email = normalizeEmail(sessionUser?.email);
              const fallbackSchoolId = buildFallbackSchoolId(email).toLowerCase();
              const assignedSchoolId = resolveSessionSchoolId(sessionUser).toLowerCase();
              const schoolsResponse = await loadSchools();
              const allSchools = Array.isArray(schoolsResponse?.data) ? schoolsResponse.data : [];
              const ownSchool =
                allSchools.find((item) => normalizeEmail(item?.basic_info?.email) === email) ||
                allSchools.find(
                  (item) => String(item?.school_id || '').trim().toLowerCase() === assignedSchoolId
                ) ||
                allSchools.find(
                  (item) => String(item?.school_id || '').trim().toLowerCase() === fallbackSchoolId
                ) ||
                null;
              setHasLeadAccess(hasLeadAccessForSchool(ownSchool));
            } catch {
              setHasLeadAccess(false);
            }
          } else {
            setHasLeadAccess(true);
          }
          setRole(nextRole);
          setReady(true);
        }
      })
      .catch(() => {
        if (!mounted) return;
        router.replace('/login');
      });
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        router.replace('/login');
      } else {
        const sessionUser = session.user;
        const nextRole =
          resolvePortalRole(
            sessionUser?.user_metadata?.role ||
            sessionUser?.app_metadata?.role
          );
        if (nextRole === 'user') {
          router.replace(portalHomeByRole(nextRole));
          return;
        }
        if (nextRole === 'admin') {
          try {
            const email = normalizeEmail(sessionUser?.email);
            const fallbackSchoolId = buildFallbackSchoolId(email).toLowerCase();
            const assignedSchoolId = resolveSessionSchoolId(sessionUser).toLowerCase();
            const schoolsResponse = await loadSchools();
            const allSchools = Array.isArray(schoolsResponse?.data) ? schoolsResponse.data : [];
            const ownSchool =
              allSchools.find((item) => normalizeEmail(item?.basic_info?.email) === email) ||
              allSchools.find(
                (item) => String(item?.school_id || '').trim().toLowerCase() === assignedSchoolId
              ) ||
              allSchools.find(
                (item) => String(item?.school_id || '').trim().toLowerCase() === fallbackSchoolId
              ) ||
              null;
            setHasLeadAccess(hasLeadAccessForSchool(ownSchool));
          } catch {
            setHasLeadAccess(false);
          }
        } else {
          setHasLeadAccess(true);
        }
        setRole(nextRole);
      }
    });
    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleLeadAccessChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ hasLeadAccess?: boolean }>;
      setHasLeadAccess(Boolean(customEvent.detail?.hasLeadAccess));
    };
    window.addEventListener('edumap:school-lead-access-changed', handleLeadAccessChange);
    return () => {
      window.removeEventListener('edumap:school-lead-access-changed', handleLeadAccessChange);
    };
  }, []);

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
    if (item.href === '/requests' && role === 'admin' && !hasLeadAccess) {
      return false;
    }
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
          privacy: 'Privacy policy',
          terms: 'Terms of use',
          faq: 'FAQ',
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
            privacy: 'Құпиялық саясаты',
            terms: 'Платформа ережелері',
            faq: 'FAQ',
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
            privacy: 'Политика конфиденциальности',
            terms: 'Правила пользования',
            faq: 'FAQ',
            rights: 'Все права защищены.',
          };

  return (
    <div className="page">
      <div className="container">
        <header className="topbar">
          <div className="brand brand-with-icon">
            <Image src="/admin-brand-logo.png" alt="EDUMAP" width={42} height={42} className="brand-logo" priority />
            <span>EDUMAP Admin</span>
          </div>
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
              {(footerSettings?.socials?.instagram_url ||
                footerSettings?.socials?.telegram_url ||
                footerSettings?.socials?.whatsapp_url) ? (
                <div className="app-footer-col">
                  <p className="app-footer-title">{footerUi.socialsTitle}</p>
                  {footerSettings?.socials?.instagram_url ? (
                    <a href={footerSettings.socials.instagram_url} target="_blank" rel="noreferrer">
                      {footerUi.instagram}
                    </a>
                  ) : null}
                  {footerSettings?.socials?.telegram_url ? (
                    <a href={footerSettings.socials.telegram_url} target="_blank" rel="noreferrer">
                      {footerUi.telegram}
                    </a>
                  ) : null}
                  {footerSettings?.socials?.whatsapp_url ? (
                    <a href={footerSettings.socials.whatsapp_url} target="_blank" rel="noreferrer">
                      {footerUi.whatsapp}
                    </a>
                  ) : null}
                </div>
              ) : null}
              {(footerSettings?.contacts?.phone_primary ||
                footerSettings?.contacts?.phone_secondary ||
                footerSettings?.contacts?.email) ? (
                <div className="app-footer-col">
                  <p className="app-footer-title">{footerUi.contactsTitle}</p>
                  {footerSettings?.contacts?.phone_primary ? (
                    <a href={`tel:${String(footerSettings.contacts.phone_primary).replace(/\s+/g, '')}`}>
                      {footerSettings.contacts.phone_primary}
                    </a>
                  ) : null}
                  {footerSettings?.contacts?.phone_secondary ? (
                    <a href={`tel:${String(footerSettings.contacts.phone_secondary).replace(/\s+/g, '')}`}>
                      {footerSettings.contacts.phone_secondary}
                    </a>
                  ) : null}
                  {footerSettings?.contacts?.email ? (
                    <a href={`mailto:${footerSettings.contacts.email}`}>{footerSettings.contacts.email}</a>
                  ) : null}
                </div>
              ) : null}
              {(footerSettings?.legal?.privacy_url ||
                footerSettings?.legal?.terms_url ||
                footerSettings?.legal?.faq_url) ? (
                <div className="app-footer-col">
                  <p className="app-footer-title">{footerUi.legalTitle}</p>
                  {footerSettings?.legal?.privacy_url ? (
                    <a href={footerSettings.legal.privacy_url} target="_blank" rel="noreferrer">
                      {footerUi.privacy}
                    </a>
                  ) : null}
                  {footerSettings?.legal?.terms_url ? (
                    <a href={footerSettings.legal.terms_url} target="_blank" rel="noreferrer">
                      {footerUi.terms}
                    </a>
                  ) : null}
                  {footerSettings?.legal?.faq_url ? (
                    <a href={footerSettings.legal.faq_url} target="_blank" rel="noreferrer">
                      {footerUi.faq}
                    </a>
                  ) : null}
                </div>
              ) : null}
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
