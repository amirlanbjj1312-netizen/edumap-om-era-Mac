'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParentLocale } from '@/lib/parentLocale';

export default function ParentFaqPage() {
  const { locale } = useParentLocale();
  const [openIndex, setOpenIndex] = useState<number | null>(0);
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
      <div className="faq-list">
        {ui.items.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <section key={item.q} className={`faq-item${isOpen ? ' open' : ''}`}>
              <button
                type="button"
                className="faq-trigger"
                onClick={() => setOpenIndex((prev) => (prev === index ? null : index))}
                aria-expanded={isOpen}
              >
                <span className="faq-question">{item.q}</span>
                <span className={`faq-arrow${isOpen ? ' open' : ''}`} aria-hidden="true">
                  ▾
                </span>
              </button>
              {isOpen ? (
                <div className="faq-answer-wrap">
                  <p className="faq-answer">{item.a}</p>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
      <div className="faq-back-row">
        <Link className="button secondary" href="/parent/profile">
          {ui.back}
        </Link>
      </div>
    </div>
  );
}
