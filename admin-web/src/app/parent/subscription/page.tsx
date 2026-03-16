'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  PLAN_LIMITS,
  type ParentPlanId,
  getParentPlan,
  setParentPlan,
} from '@/lib/parentSubscription';
import { isGuestMode } from '@/lib/guestMode';

const PLAN_LABEL: Record<ParentPlanId, string> = {
  trial: 'Trial',
  standard: 'Monthly',
  pro: 'Pro',
};

const PLAN_PRICE: Record<ParentPlanId, string> = {
  trial: 'Бесплатно 3 дня',
  standard: '2 990 ₸ / 30 дней',
  pro: '6 990 ₸ / 90 дней',
};

export default function ParentSubscriptionPage() {
  const [guest] = useState(() => isGuestMode());
  const [state, setState] = useState(() => getParentPlan());
  const [inlineStatus, setInlineStatus] = useState('');
  const [nowTs, setNowTs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const remainingDays = useMemo(() => {
    const ts = new Date(state.expiresAt || '').getTime();
    if (!Number.isFinite(ts)) return 0;
    const diff = Math.ceil((ts - nowTs) / (24 * 60 * 60 * 1000));
    return Math.max(0, diff);
  }, [nowTs, state.expiresAt]);

  const limits = PLAN_LIMITS[state.planId];

  const switchPlan = (planId: ParentPlanId) => {
    if (guest) return;
    const next = setParentPlan(planId);
    setState(next);
    setInlineStatus(`Тариф ${PLAN_LABEL[planId]} активирован`);
    window.setTimeout(() => setInlineStatus(''), 2200);
  };

  return (
    <div className="card">
      <h2 className="section-title">Подписка родителя</h2>
      <p className="muted">Текущий план и управление тарифами в веб-кабинете.</p>
      {guest ? (
        <div
          style={{
            marginTop: 10,
            border: '1px solid rgba(86,103,253,0.22)',
            borderRadius: 12,
            padding: 12,
            background: '#f4f7ff',
          }}
        >
          <p style={{ margin: 0, fontWeight: 700 }}>Управление подпиской доступно после входа</p>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            В гостевом режиме вы видите демо-тарифы без сохранения.
          </p>
          <Link className="button" href="/login">
            Войти
          </Link>
        </div>
      ) : null}

      <div
        style={{
          marginTop: 14,
          border: '1px solid rgba(86,103,253,0.22)',
          borderRadius: 16,
          padding: 14,
          background: '#fff',
        }}
      >
        <p style={{ margin: 0, fontWeight: 700, fontSize: 24 }}>
          {PLAN_LABEL[state.planId]}
        </p>
        <p style={{ margin: '6px 0 0', color: '#4b5878', fontWeight: 600 }}>{PLAN_PRICE[state.planId]}</p>
        <p style={{ margin: '8px 0 0' }}>Осталось: {remainingDays} дней</p>

        <div
          style={{
            marginTop: 10,
            borderRadius: 12,
            border: '1px solid rgba(86,103,253,0.18)',
            background: '#f4f7ff',
            padding: 12,
          }}
        >
          <p style={{ margin: 0, fontWeight: 700 }}>Ваши лимиты сейчас</p>
          <p style={{ margin: '8px 0 0' }}>AI-чат: 0/{limits.aiChat} день</p>
          <p style={{ margin: '4px 0 0' }}>
            AI-подбор:{' '}
            {limits.aiMatch == null ? 'без лимита' : `0/${limits.aiMatch} ${state.planId === 'trial' ? 'период' : 'день'}`}
          </p>
          <p style={{ margin: '4px 0 0' }}>Сравнение: {limits.compare} школ</p>
        </div>

        {inlineStatus ? (
          <p style={{ marginTop: 10, color: '#166534', fontWeight: 700 }}>{inlineStatus}</p>
        ) : null}
      </div>

      <h3 style={{ marginTop: 20, marginBottom: 10 }}>Другие тарифы</h3>
      <div style={{ display: 'grid', gap: 12 }}>
        <PlanCard
          title="Monthly"
          price="2 990 ₸ / 30 дней"
          features={[
            'Полные карточки школ',
            'Сравнение: до 3 школ',
            'AI-чат: 3 вопроса/день',
            'AI-подбор: 5 запросов/день',
          ]}
          active={state.planId === 'standard'}
          guest={guest}
          onSelect={() => switchPlan('standard')}
        />
        <PlanCard
          title="Pro"
          price="6 990 ₸ / 90 дней"
          badge="-22%"
          features={[
            'Полные карточки школ',
            'Сравнение: до 5 школ',
            'AI-чат: 10 вопросов/день',
            'AI-подбор: без лимита',
          ]}
          active={state.planId === 'pro'}
          guest={guest}
          onSelect={() => switchPlan('pro')}
        />
      </div>
    </div>
  );
}

function PlanCard({
  title,
  price,
  features,
  badge,
  active,
  guest,
  onSelect,
}: {
  title: string;
  price: string;
  features: string[];
  badge?: string;
  active?: boolean;
  guest?: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      style={{
        border: active ? '1.5px solid #5667FD' : '1px solid rgba(120,106,255,0.18)',
        borderRadius: 16,
        padding: 14,
        background: active ? '#f4f6ff' : '#fff',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <p style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{title}</p>
        {badge ? (
          <span
            style={{
              background: '#FFD65A',
              color: '#5B4A00',
              borderRadius: 999,
              fontWeight: 700,
              padding: '4px 10px',
            }}
          >
            {badge}
          </span>
        ) : null}
      </div>
      <p style={{ margin: '6px 0 0', color: '#283454', fontWeight: 700 }}>{price}</p>
      <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
        {features.map((item) => (
          <p key={item} style={{ margin: 0 }}>{`✓ ${item}`}</p>
        ))}
      </div>
      <button
        type="button"
        className="button"
        style={{ marginTop: 12, opacity: active || guest ? 0.7 : 1 }}
        disabled={Boolean(active || guest)}
        onClick={onSelect}
      >
        {active ? 'Текущий план' : guest ? 'Войти для выбора' : 'Выбрать'}
      </button>
    </div>
  );
}
