'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabaseAuth as supabase } from '@/lib/supabaseAuth';
import { portalHomeByRole, resolvePortalRole } from '@/lib/portalRole';
import { isGuestMode, setGuestMode } from '@/lib/guestMode';
import { localeOptions, useParentLocale } from '@/lib/parentLocale';
import { loadParentFooterSettings } from '@/lib/api';

const NAV_ITEMS = [
  { href: '/parent/news', labelKey: 'nav_news' },
  { href: '/parent/schools', labelKey: 'nav_schools' },
  { href: '/parent/profile', labelKey: 'nav_profile' },
];

export default function ParentLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [guest, setGuest] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [footerSettings, setFooterSettings] = useState<any>(null);
  const { t, locale, setLocale } = useParentLocale();
  const isMapFullscreen = pathname === '/parent/schools/map' || pathname.startsWith('/parent/schools/map/');
  const footerUi =
    locale === 'en'
      ? {
          roleTag: 'Parent account',
          navTitle: 'Navigation',
          socialsTitle: 'Social',
          contactsTitle: 'Contacts',
          legalTitle: 'Legal',
          support: 'Support',
          faq: 'FAQ',
          compare: 'Comparison',
          schools: 'Schools',
          news: 'News',
          profile: 'Profile',
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
            roleTag: 'Ата-ана кабинеті',
            navTitle: 'Навигация',
            socialsTitle: 'Әлеуметтік желілер',
            contactsTitle: 'Байланыс',
            legalTitle: 'Құқықтық ақпарат',
            support: 'Қолдау',
            faq: 'FAQ',
            compare: 'Салыстыру',
            schools: 'Мектептер',
            news: 'Жаңалықтар',
            profile: 'Профиль',
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
            roleTag: 'Кабинет родителя',
            navTitle: 'Навигация',
            socialsTitle: 'Мы в соцсетях',
            contactsTitle: 'Контакты',
            legalTitle: 'Правовая информация',
            support: 'Поддержка',
            faq: 'FAQ',
            compare: 'Сравнение',
            schools: 'Школы',
            news: 'Новости',
            profile: 'Профиль',
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

  useEffect(() => {
    loadParentFooterSettings()
      .then((payload) => setFooterSettings(payload?.data || null))
      .catch(() => setFooterSettings(null));
  }, []);

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

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (!ready) {
    return (
      <div className="page">
        <div className="container">
          <div className="card">{t('checking_session')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page parent-page">
      <div className="container parent-layout-shell">
        {!isMapFullscreen ? (
          <header className="topbar">
            <div className="topbar-brand-wrap">
              <Link href="/parent/schools" className="brand parent-brand">
                EDUMAP
              </Link>
            </div>
            <nav className={`topnav ${guest ? 'guest-nav' : ''}`}>
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${pathname === item.href || pathname.startsWith(`${item.href}/`) ? 'active' : ''} ${guest ? 'guest-nav-item' : ''}`}
                >
                  {t(item.labelKey)}
                </Link>
              ))}
              <div className="topbar-locale" role="group" aria-label={t('language')}>
                {localeOptions.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setLocale(item.value)}
                    className={`topbar-locale-btn${locale === item.value ? ' active' : ''}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {guest ? (
                <Link href="/login" className="topnav-logout">
                  {t('sign_in')}
                </Link>
              ) : (
                <button type="button" className="topnav-logout" onClick={handleSignOut}>
                  {t('logout')}
                </button>
              )}
            </nav>
            <div className="topbar-mobile-actions">
              {guest ? (
                <Link href="/login" className="topnav-logout">
                  {t('sign_in')}
                </Link>
              ) : (
                <button type="button" className="topnav-logout" onClick={handleSignOut}>
                  {t('logout')}
                </button>
              )}
              <button
                type="button"
                className={`topbar-menu-toggle${mobileMenuOpen ? ' active' : ''}`}
                aria-label="Открыть меню"
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen((prev) => !prev)}
              >
                <span />
                <span />
                <span />
              </button>
            </div>
            {mobileMenuOpen ? (
              <div className="topbar-mobile-menu">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={pathname === item.href || pathname.startsWith(`${item.href}/`) ? 'active' : ''}
                  >
                    {t(item.labelKey)}
                  </Link>
                ))}
                <div className="topbar-locale mobile">
                  {localeOptions.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setLocale(item.value)}
                      className={`topbar-locale-btn${locale === item.value ? ' active' : ''}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </header>
        ) : null}
        <main className="parent-layout-main">{children}</main>
      </div>
      {!isMapFullscreen ? (
        <div className="parent-footer-band">
          <div className="container">
            <footer className="app-footer parent-app-footer">
              <div className="app-footer-main">
                <div className="app-footer-grid">
                  <div className="app-footer-col app-footer-brand-col">
                    <p className="app-footer-brand">EDUMAP Parent</p>
                    <p className="app-footer-text">{footerUi.roleTag}</p>
                  </div>
                  <div className="app-footer-col">
                    <p className="app-footer-title">{footerUi.navTitle}</p>
                    <Link href="/parent/news">{footerUi.news}</Link>
                    <Link href="/parent/schools">{footerUi.schools}</Link>
                    <Link href="/parent/profile">{footerUi.profile}</Link>
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
      ) : null}
    </div>
  );
}
