'use client';

import Link from 'next/link';
import { useParentLocale } from '@/lib/parentLocale';

export default function ParentNotificationsPage() {
  const { locale } = useParentLocale();
  const ui =
    locale === 'en'
      ? {
          title: 'Notifications',
          subtitle: 'Important updates and alerts will appear here.',
          empty: 'No notifications yet.',
          back: 'Back to profile',
        }
      : locale === 'kk'
        ? {
            title: 'Хабарламалар',
            subtitle: 'Маңызды жаңартулар мен ескертулер осы жерде көрсетіледі.',
            empty: 'Әзірге хабарлама жоқ.',
            back: 'Профильге оралу',
          }
        : {
            title: 'Уведомления',
            subtitle: 'Здесь будут отображаться важные обновления и оповещения.',
            empty: 'Пока уведомлений нет.',
            back: 'Вернуться в профиль',
          };

  return (
    <div className="card">
      <h2 className="section-title">{ui.title}</h2>
      <p className="muted">{ui.subtitle}</p>
      <div style={{ marginTop: 12, border: '1px solid rgba(120,106,255,0.2)', borderRadius: 14, padding: 12 }}>
        <p className="muted" style={{ margin: 0 }}>{ui.empty}</p>
      </div>
      <div style={{ marginTop: 12 }}>
        <Link className="button secondary" href="/parent/profile">
          {ui.back}
        </Link>
      </div>
    </div>
  );
}

