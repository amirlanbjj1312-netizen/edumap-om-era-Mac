'use client';

import Link from 'next/link';
import { useParentLocale } from '@/lib/parentLocale';

export default function ParentFaqPage() {
  const { locale } = useParentLocale();
  const ui =
    locale === 'en'
      ? {
          title: 'Frequently asked questions',
          back: 'Back to profile',
          items: [
            { q: 'How to compare schools?', a: 'Open schools list, select schools for compare, then open the compare table.' },
            { q: 'How to contact support?', a: 'Open support section in profile and send your question in chat.' },
            { q: 'How to change language?', a: 'Use language switch in profile. The whole parent cabinet will update.' },
          ],
        }
      : locale === 'kk'
        ? {
            title: 'Жиі қойылатын сұрақтар',
            back: 'Профильге оралу',
            items: [
              { q: 'Мектептерді қалай салыстырамын?', a: 'Мектептер тізімінен салыстыруға таңдаңыз, кейін салыстыру кестесін ашыңыз.' },
              { q: 'Қолдауға қалай жазамын?', a: 'Профильдегі қолдау бөліміне өтіп, чатқа сұрағыңызды жазыңыз.' },
              { q: 'Тілді қалай ауыстырамын?', a: 'Профильдегі тіл ауыстырғышын қолданыңыз. Бүкіл кабинет тілі өзгереді.' },
            ],
          }
        : {
            title: 'Часто задаваемые вопросы',
            back: 'Вернуться в профиль',
            items: [
              { q: 'Как сравнить школы?', a: 'Откройте список школ, выберите школы для сравнения и перейдите в таблицу сравнения.' },
              { q: 'Как связаться с поддержкой?', a: 'Перейдите в раздел поддержки в профиле и отправьте вопрос в чат.' },
              { q: 'Как сменить язык кабинета?', a: 'Используйте переключатель языка в профиле. Язык изменится во всем кабинете.' },
            ],
          };

  return (
    <div className="card">
      <h2 className="section-title">{ui.title}</h2>
      <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
        {ui.items.map((item) => (
          <div key={item.q} style={{ border: '1px solid rgba(120,106,255,0.2)', borderRadius: 14, padding: 12 }}>
            <p style={{ margin: 0, fontWeight: 700 }}>{item.q}</p>
            <p className="muted" style={{ margin: '6px 0 0' }}>{item.a}</p>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <Link className="button secondary" href="/parent/profile">
          {ui.back}
        </Link>
      </div>
    </div>
  );
}

