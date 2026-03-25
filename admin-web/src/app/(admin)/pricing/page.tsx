'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAdminLocale, type AdminLocale } from '@/lib/adminLocale';
import { loadSchools, updateSchoolMonetization } from '@/lib/api';
import { supabase } from '@/lib/supabaseClient';

type BillingPeriod = 'monthly' | 'yearly';
type Plan = {
  id: 'starter' | 'growth' | 'pro';
  highlighted?: boolean;
  ctaType: 'current' | 'upgrade';
  priceMonthly: number;
  priceYearly: number;
  features: {
    ru: string[];
    en: string[];
    kk: string[];
  };
};

const COPY: Record<
  AdminLocale,
  {
    title: string;
    subtitle: string;
    monthly: string;
    yearly: string;
    perMonth: string;
    perYear: string;
    recommended: string;
    currentPlan: string;
    upgradePlan: string;
    free: string;
    plans: {
      starter: string;
      growth: string;
      pro: string;
    };
  }
> = {
  ru: {
    title: 'Наши тарифные планы',
    subtitle: 'Выберите подходящий план для школы',
    monthly: 'Ежемесячно',
    yearly: 'Ежегодно',
    perMonth: '/мес',
    perYear: '/год',
    recommended: 'Рекомендуем',
    currentPlan: 'Текущий план',
    upgradePlan: 'Улучшить план',
    free: 'Бесплатно',
    plans: {
      starter: 'Starter',
      growth: 'Growth',
      pro: 'Pro',
    },
  },
  en: {
    title: 'Our Pricing Plans',
    subtitle: 'Choose the right plan for your school workflow',
    monthly: 'Monthly',
    yearly: 'Yearly',
    perMonth: '/mo',
    perYear: '/yr',
    recommended: 'Recommended',
    currentPlan: 'Current plan',
    upgradePlan: 'Upgrade plan',
    free: 'Free',
    plans: {
      starter: 'Starter',
      growth: 'Growth',
      pro: 'Pro',
    },
  },
  kk: {
    title: 'Біздің тарифтік жоспарлар',
    subtitle: 'Мектебіңізге лайық жоспарды таңдаңыз',
    monthly: 'Ай сайын',
    yearly: 'Жыл сайын',
    perMonth: '/ай',
    perYear: '/жыл',
    recommended: 'Ұсынылады',
    currentPlan: 'Ағымдағы жоспар',
    upgradePlan: 'Жоспарды көтеру',
    free: 'Тегін',
    plans: {
      starter: 'Starter',
      growth: 'Growth',
      pro: 'Pro',
    },
  },
};

const PLANS: Plan[] = [
  {
    id: 'starter',
    ctaType: 'current',
    priceMonthly: 0,
    priceYearly: 0,
    features: {
      ru: [
        'Базовая карточка школы',
        'Ограниченный контент: до 20 фото, базовые секции и преподаватели',
        'Базовое присутствие в каталоге',
        'Без приоритета в выдаче',
        'Без аналитики интереса родителей',
        'Без заявок и CRM',
      ],
      en: [
        'Basic school card',
        'Limited content: up to 20 photos, basic sections and teachers',
        'Basic presence in the catalog',
        'No search priority',
        'No parent interest analytics',
        'No leads and CRM',
      ],
      kk: [
        'Мектептің базалық карточкасы',
        'Шектеулі контент: 20 фотоға дейін, базалық секциялар мен мұғалімдер',
        'Каталогтағы базалық көріну',
        'Іздеуде басымдық жоқ',
        'Ата-ана қызығушылығы аналитикасы жоқ',
        'Өтінімдер мен CRM жоқ',
      ],
    },
  },
  {
    id: 'growth',
    highlighted: true,
    ctaType: 'upgrade',
    priceMonthly: 89000,
    priceYearly: 89000 * 10,
    features: {
      ru: [
        'Приоритет в выдаче',
        'Лиды/заявки + CRM-статусы',
        'Карточка школы с расширенными лимитами по контенту',
        'Больше фото, секций, преподавателей и медиа',
        'Базовая аналитика интереса родителей',
        'Просмотры, уникальные родители, сравнение, избранное, цена, поступление, контакты',
        'Базовая поддержка для школы',
      ],
      en: [
        'Priority in search results',
        'Leads/requests + CRM statuses',
        'School profile with extended content limits',
        'More photos, clubs, teachers and media',
        'Core parent interest analytics',
        'Views, unique parents, compare, favorites, price, admission, contacts',
        'Standard support for schools',
      ],
      kk: [
        'Іздеудегі басымдық',
        'Лидтер/өтінімдер + CRM мәртебелері',
        'Контент лимиті кеңейтілген мектеп карточкасы',
        'Көбірек фото, үйірме, мұғалім және медиа',
        'Ата-ана қызығушылығының базалық аналитикасы',
        'Қаралымдар, бірегей ата-аналар, салыстыру, таңдаулылар, баға, қабылдау, байланыстар',
        'Мектепке арналған базалық қолдау',
      ],
    },
  },
  {
    id: 'pro',
    ctaType: 'upgrade',
    priceMonthly: 169000,
    priceYearly: 169000 * 10,
    features: {
      ru: [
        'Всё из Growth',
        'Top placement выше Growth',
        'Максимальная видимость в каталоге',
        'Приоритетные лиды и расширенный CRM-сценарий',
        'Воронка интереса родителей и сравнение по периодам',
        'AI-упоминания школы и AI-инсайты',
        'С какими школами вас сравнивают чаще',
        'AI-рекомендации по улучшению карточки',
        'Приоритетная поддержка',
      ],
      en: [
        'Everything in Growth',
        'Top placement above Growth',
        'Maximum visibility in the catalog',
        'Priority leads and expanded CRM workflow',
        'Interest funnel and period-over-period comparison',
        'AI mentions and AI insights',
        'Most compared competitor schools',
        'AI card improvement tips',
        'Priority support',
      ],
      kk: [
        'Growth-тегі барлық мүмкіндік',
        'Growth-тен жоғары Top placement',
        'Каталогтағы максималды көріну',
        'Басым лидтер және кеңейтілген CRM сценарийі',
        'Ата-ана қызығушылығының воронкасы және кезеңдер бойынша салыстыру',
        'AI-аталымдар және AI-инсайттар',
        'Сізді қай мектептермен жиі салыстыратыны',
        'Карточканы жақсартуға арналған AI ұсыныстары',
        'Басым қолдау',
      ],
    },
  },
];

const formatKzt = (value: number) =>
  value.toLocaleString('ru-RU', { maximumFractionDigits: 0 });

const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();

const buildFallbackSchoolId = (email: string) =>
  `school-${String(email || '')
    .toLowerCase()
    .split('@')[0]
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'school'}`;

export default function PricingPage() {
  const { locale } = useAdminLocale();
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [currentRole, setCurrentRole] = useState('user');
  const [currentEmail, setCurrentEmail] = useState('');
  const [savingPlanId, setSavingPlanId] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const copy = COPY[locale];

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data?.session?.user;
      const role = String(user?.user_metadata?.role || user?.app_metadata?.role || 'user');
      const email = String(user?.email || '');
      if (!mounted) return;
      setCurrentRole(role);
      setCurrentEmail(email);

      try {
        const result = await loadSchools();
        const list = Array.isArray(result?.data) ? result.data : [];
        if (!mounted) return;
        setSchools(list);

        const savedSchoolId = localStorage.getItem('EDUMAP_ADMIN_SELECTED_SCHOOL_ID') || '';
        const roleIsModerator = role === 'moderator' || role === 'superadmin';
        if (roleIsModerator && savedSchoolId && list.some((item) => item.school_id === savedSchoolId)) {
          setSelectedSchoolId(savedSchoolId);
          return;
        }

        const normalized = normalizeEmail(email);
        const fallbackId = buildFallbackSchoolId(normalized);
        const own = list.find((item) => {
          const schoolEmail = normalizeEmail(item?.basic_info?.email);
          const schoolId = String(item?.school_id || '').trim().toLowerCase();
          return schoolEmail === normalized || schoolId === fallbackId;
        });
        setSelectedSchoolId(String(own?.school_id || list[0]?.school_id || ''));
      } catch {
        if (!mounted) return;
        setSchools([]);
      }
    };

    init();
    return () => {
      mounted = false;
    };
  }, []);

  const cards = useMemo(
    () =>
      PLANS.map((plan) => {
        const amount = period === 'monthly' ? plan.priceMonthly : plan.priceYearly;
        return {
          ...plan,
          amount,
        };
      }),
    [period]
  );
  const visibleSchools = useMemo(() => {
    if (currentRole !== 'admin') return schools;
    const normalized = normalizeEmail(currentEmail);
    const fallbackId = buildFallbackSchoolId(normalized);
    return schools.filter((item) => {
      const schoolEmail = normalizeEmail(item?.basic_info?.email);
      const schoolId = String(item?.school_id || '').trim().toLowerCase();
      return schoolEmail === normalized || schoolId === fallbackId;
    });
  }, [currentEmail, currentRole, schools]);
  const selectedSchool = useMemo(
    () => visibleSchools.find((item) => item.school_id === selectedSchoolId) || null,
    [selectedSchoolId, visibleSchools]
  );

  const applyPlan = async (planId: Plan['id']) => {
    setStatusMessage('');
    setErrorMessage('');
    const roleAllowed = ['admin', 'moderator', 'superadmin'].includes(currentRole);
    if (!roleAllowed) {
      setErrorMessage(
        locale === 'ru'
          ? 'Только school admin/moderator/superadmin может выбирать тариф.'
          : locale === 'kk'
            ? 'Тарифті тек school admin/moderator/superadmin таңдай алады.'
            : 'Only school admin/moderator/superadmin can apply a tariff.'
      );
      return;
    }
    if (!selectedSchool) {
      setErrorMessage(
        locale === 'ru'
          ? 'Школа не выбрана.'
          : locale === 'kk'
            ? 'Мектеп таңдалмаған.'
            : 'No school selected.'
      );
      return;
    }

    const now = new Date();
    const ends = new Date(now);
    ends.setDate(ends.getDate() + (period === 'monthly' ? 30 : 365));
    const toIso = (date: Date) => date.toISOString();

    const monetizationByPlan: Record<
      Plan['id'],
      {
        is_promoted: boolean;
        subscription_status: 'inactive' | 'active';
        plan_name: string;
        priority_weight: number;
        last_tariff_id: string;
      }
    > = {
      starter: {
        is_promoted: false,
        subscription_status: 'inactive',
        plan_name: 'Starter',
        priority_weight: 0,
        last_tariff_id: 'starter_30',
      },
      growth: {
        is_promoted: true,
        subscription_status: 'active',
        plan_name: 'Growth',
        priority_weight: 25,
        last_tariff_id: 'growth_30',
      },
      pro: {
        is_promoted: true,
        subscription_status: 'active',
        plan_name: 'Pro',
        priority_weight: 50,
        last_tariff_id: 'premium_30',
      },
    };

    setSavingPlanId(planId);
    try {
      const monetizationPayload = {
        ...monetizationByPlan[planId],
        starts_at: toIso(now),
        ends_at: toIso(ends),
      };
      const saved = await updateSchoolMonetization(
        selectedSchool.school_id,
        monetizationPayload
      );
      const savedProfile = saved?.data || {
        ...selectedSchool,
        monetization: {
          ...(selectedSchool.monetization || {}),
          ...monetizationPayload,
        },
      };
      setSchools((prev) =>
        prev.map((item) =>
          item.school_id === savedProfile.school_id ? savedProfile : item
        )
      );
      setStatusMessage(
        locale === 'ru'
          ? `Тариф ${copy.plans[planId]} сохранён для школы.`
          : locale === 'kk'
            ? `Мектеп үшін ${copy.plans[planId]} тарифі сақталды.`
            : `${copy.plans[planId]} plan was saved for the school.`
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error && error.message
          ? error.message
          : locale === 'ru'
            ? 'Не удалось сохранить тариф.'
            : locale === 'kk'
              ? 'Тарифті сақтау мүмкін болмады.'
              : 'Failed to save tariff.'
      );
    } finally {
      setSavingPlanId('');
    }
  };

  return (
    <section className="pricing-page">
      <div className="pricing-hero">
        <h1>{copy.title}</h1>
        <p>{copy.subtitle}</p>
        <button
          type="button"
          className={`pricing-switch ${period === 'yearly' ? 'yearly' : ''}`}
          onClick={() => setPeriod((prev) => (prev === 'monthly' ? 'yearly' : 'monthly'))}
          aria-label="billing period switch"
        >
          <span>{copy.monthly}</span>
          <span className="pricing-switch-track">
            <span className="pricing-switch-thumb" />
          </span>
          <span>{copy.yearly}</span>
        </button>
      </div>

      <div className="pricing-toolbar">
        <label className="field">
          <span>
            {locale === 'ru'
              ? 'Школа для применения тарифа'
              : locale === 'kk'
                ? 'Тариф қолданылатын мектеп'
                : 'School to apply tariff'}
          </span>
          <select
            value={selectedSchoolId}
            onChange={(event) => setSelectedSchoolId(event.target.value)}
          >
            {visibleSchools.length ? (
              visibleSchools.map((item) => (
                <option key={item.school_id} value={item.school_id}>
                  {String(
                    item?.basic_info?.display_name?.ru ||
                      item?.basic_info?.name?.ru ||
                      item?.school_id
                  )}
                </option>
              ))
            ) : (
              <option value="">
                {locale === 'ru'
                  ? 'Нет доступных школ'
                  : locale === 'kk'
                    ? 'Қолжетімді мектептер жоқ'
                    : 'No schools available'}
              </option>
            )}
          </select>
        </label>
        {selectedSchool ? (
          <p className="muted">
            {locale === 'ru'
              ? `Текущий тариф: ${String(selectedSchool?.monetization?.plan_name || 'Starter')}`
              : locale === 'kk'
                ? `Ағымдағы тариф: ${String(selectedSchool?.monetization?.plan_name || 'Starter')}`
                : `Current plan: ${String(selectedSchool?.monetization?.plan_name || 'Starter')}`}
            {currentEmail ? ` · ${currentEmail}` : ''}
          </p>
        ) : null}
      </div>

      <div className="pricing-grid">
        {cards.map((plan) => (
          <article
            key={plan.id}
            className={`pricing-card ${plan.highlighted ? 'highlighted' : ''}`}
          >
            <div className="pricing-plan-name-row">
              <h2>{copy.plans[plan.id]}</h2>
              {plan.highlighted ? (
                <span className="pricing-recommended">{copy.recommended}</span>
              ) : null}
            </div>

            <div className="pricing-price-row">
              {plan.amount === 0 ? (
                <strong>{copy.free}</strong>
              ) : (
                <>
                  <strong>{formatKzt(plan.amount)} ₸</strong>
                  <span>{period === 'monthly' ? copy.perMonth : copy.perYear}</span>
                </>
              )}
            </div>

            <ul>
              {plan.features[locale].map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>

            <button
              type="button"
              className="pricing-action-btn"
              onClick={() => applyPlan(plan.id)}
              disabled={Boolean(savingPlanId)}
            >
              {savingPlanId === plan.id
                ? locale === 'ru'
                  ? 'Сохраняем...'
                  : locale === 'kk'
                    ? 'Сақталуда...'
                    : 'Saving...'
                : plan.ctaType === 'current'
                  ? copy.currentPlan
                  : copy.upgradePlan}
            </button>
          </article>
        ))}
      </div>
      {statusMessage ? <p className="pricing-status-ok">{statusMessage}</p> : null}
      {errorMessage ? <p className="pricing-status-error">{errorMessage}</p> : null}
    </section>
  );
}
