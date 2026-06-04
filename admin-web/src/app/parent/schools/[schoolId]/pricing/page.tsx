'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { loadSchoolById } from '@/lib/api';
import { useParentLocale } from '@/lib/parentLocale';
import { buildFeeRulesFromFinance, formatSchoolFee } from '@/lib/schoolFinance';
import { isGuestMode } from '@/lib/guestMode';

type Locale = 'ru' | 'en' | 'kk';

const toText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    const localized = value as Record<string, unknown>;
    const picked = localized.ru ?? localized.kk ?? localized.en;
    if (typeof picked === 'string') return picked;
    if (typeof picked === 'number') return String(picked);
  }
  return '';
};

const getIn = (source: unknown, path: string): unknown => {
  if (!source || typeof source !== 'object') return undefined;
  const parts = path.split('.');
  let cursor: unknown = source;
  for (const part of parts) {
    if (!cursor || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
};

const pickFirstText = (source: unknown, paths: string[], fallback = '') => {
  for (const path of paths) {
    const value = toText(getIn(source, path));
    if (value) return value;
  }
  return fallback;
};

const pickLocalizedText = (source: unknown, pathBase: string, locale: Locale, fallback = '') =>
  pickFirstText(source, [`${pathBase}.${locale}`, `${pathBase}.ru`, `${pathBase}.kk`, `${pathBase}.en`, pathBase], fallback);

const toList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((item) => toText(item).trim()).filter(Boolean);
  const text = toText(value);
  if (!text) return [];
  return text.split(',').map((item) => item.trim()).filter(Boolean);
};

const formatFeeRuleGrades = (fromGrade: number, toGrade: number, locale: Locale) => {
  if (fromGrade === toGrade) {
    return locale === 'en' ? `Grade ${fromGrade}` : locale === 'kk' ? `${fromGrade} сынып` : `${fromGrade} класс`;
  }
  return `${fromGrade}–${toGrade}`;
};

const formatCurrency = (amount: number, currency: string) => {
  const sym = currency === 'KZT' ? '₸' : currency === 'USD' ? '$' : currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency;
  return `${amount.toLocaleString('ru-RU')} ${sym}`;
};

function ExpandableNote({ title, text, locale }: { title: string; text: string; locale: Locale }) {
  const [expanded, setExpanded] = useState(false);
  const normalized = String(text || '').trim();
  if (!normalized) return null;
  const shouldToggle = normalized.length > 200 || normalized.includes('\n');
  const showMore = locale === 'en' ? 'Show more' : locale === 'kk' ? 'Толығырақ' : 'Показать полностью';
  const showLess = locale === 'en' ? 'Collapse' : locale === 'kk' ? 'Жасыру' : 'Свернуть';
  return (
    <div className="school-price-note">
      <p className="school-price-note-title">{title}</p>
      <div className={`school-price-note-content${expanded ? ' is-open' : ' is-collapsed'}`}>
        {normalized.split('\n').map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
      {shouldToggle ? (
        <button type="button" className="school-price-note-toggle" onClick={() => setExpanded((prev) => !prev)}>
          {expanded ? showLess : showMore}
        </button>
      ) : null}
    </div>
  );
}

export default function SchoolPricingPage() {
  const { locale } = useParentLocale();
  const [guest] = useState(() => isGuestMode());
  const params = useParams<{ schoolId: string }>();
  const schoolId = decodeURIComponent(String(params?.schoolId || ''));

  const [school, setSchool] = useState<unknown | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const result = await loadSchoolById(schoolId);
        if (!active) return;
        setSchool(result?.data || null);
      } catch {
        if (!active) return;
        setSchool(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [schoolId]);

  const ui = useMemo(() => ({
    back: locale === 'en' ? 'Back to school' : locale === 'kk' ? 'Мектепке оралу' : 'Назад к школе',
    title: locale === 'en' ? 'Tuition & Fees' : locale === 'kk' ? 'Оқу құны мен төлемдер' : 'Стоимость обучения',
    loading: locale === 'en' ? 'Loading...' : locale === 'kk' ? 'Жүктелуде...' : 'Загрузка...',
    gradesLabel: locale === 'en' ? 'Grades' : locale === 'kk' ? 'Сыныптар' : 'Классы',
    registrationFee: locale === 'en' ? 'Enrollment fee' : locale === 'kk' ? 'Тіркеу төлемі' : 'Вступительный взнос',
    paymentOptions: locale === 'en' ? 'Payment options' : locale === 'kk' ? 'Төлем мерзімі' : 'Вариант оплаты',
    includedInTuition: locale === 'en' ? 'Included in tuition' : locale === 'kk' ? 'Оқу ақысына кіреді' : 'Что включено в стоимость',
    extraFees: locale === 'en' ? 'Extra fees' : locale === 'kk' ? 'Қосымша төлемдер' : 'Дополнительные услуги',
    discounts: locale === 'en' ? 'Discounts' : locale === 'kk' ? 'Жеңілдіктер' : 'Скидки',
    grants: locale === 'en' ? 'Grants' : locale === 'kk' ? 'Гранттар' : 'Гранты',
    comment: locale === 'en' ? 'Comment' : locale === 'kk' ? 'Түсініктеме' : 'Комментарий',
    perGrade: locale === 'en' ? 'By grade' : locale === 'kk' ? 'Сыныпқа қарай' : 'По классам',
    entranceFee: locale === 'en' ? 'Enrollment fee' : locale === 'kk' ? 'Тіркеу' : 'Вступительный',
    noPrice: locale === 'en' ? 'Pricing is not specified' : locale === 'kk' ? 'Баға белгіленбеген' : 'Цена не указана',
    onRequest: locale === 'en' ? 'On request' : locale === 'kk' ? 'Сұраныс бойынша' : 'По запросу',
    guestBlur: locale === 'en' ? 'Sign in to see pricing' : locale === 'kk' ? 'Бағаны көру үшін кіріңіз' : 'Войдите, чтобы увидеть цену',
    signIn: locale === 'en' ? 'Sign in' : locale === 'kk' ? 'Кіру' : 'Войти',
    funding: locale === 'en' ? 'Funding' : locale === 'kk' ? 'Қаржыландыру' : 'Финансирование',
    freePlaces: locale === 'en' ? 'Free-of-charge places' : locale === 'kk' ? 'Тегін орындар бар' : 'Есть бесплатные места',
  }), [locale]);

  const schoolName = useMemo(() => {
    if (!school || typeof school !== 'object') return '';
    const root = school as Record<string, unknown>;
    const basicInfo = (root.basic_info && typeof root.basic_info === 'object') ? root.basic_info as Record<string, unknown> : {};
    const dn = basicInfo.display_name;
    if (dn && typeof dn === 'object') {
      const loc = dn as Partial<Record<Locale, unknown>>;
      return String(loc[locale] || loc.ru || loc.en || loc.kk || '');
    }
    return toText(basicInfo.brand_name) || toText(basicInfo.short_name) || toText(basicInfo.name) || '';
  }, [school, locale]);

  const priceLabel = useMemo(() => formatSchoolFee(
    {
      finance: {
        fee_rules: getIn(school, 'finance.fee_rules'),
        tuition_monthly: getIn(school, 'finance.tuition_monthly'),
        monthly_fee: getIn(school, 'finance.monthly_fee'),
        monthly_fee_by_grade: getIn(school, 'finance.monthly_fee_by_grade'),
        price_monthly: getIn(school, 'finance.price_monthly'),
      },
      basic_info: { price: getIn(school, 'basic_info.price') },
    },
    locale,
    ui.onRequest
  ), [school, locale, ui.onRequest]);

  const feeRules = useMemo(() => buildFeeRulesFromFinance({
    fee_rules: getIn(school, 'finance.fee_rules'),
    monthly_fee_by_grade: getIn(school, 'finance.monthly_fee_by_grade'),
    monthly_fee: getIn(school, 'finance.monthly_fee'),
    tuition_monthly: getIn(school, 'finance.tuition_monthly'),
    price_monthly: getIn(school, 'finance.price_monthly'),
  }), [school]);

  const registrationFeeModeRaw = toText(getIn(school, 'finance.registration_fee_mode')).trim();
  const registrationFeeMode = registrationFeeModeRaw === 'per_rule' ? 'per_rule'
    : registrationFeeModeRaw === 'global' ? 'global'
    : feeRules.some((r) => r.entrance_fee > 0) ? 'per_rule' : 'global';

  const registrationFeeRaw = toText(getIn(school, 'finance.registration_fee')).trim();
  const registrationFeeCurrency = toText(getIn(school, 'finance.registration_fee_currency')).trim() || 'KZT';
  const registrationFee = registrationFeeRaw
    ? formatCurrency(Number(registrationFeeRaw.replace(/\s+/g, '').replace(',', '.')) || 0, registrationFeeCurrency)
    : '';

  const paymentOptionLabels: Record<string, string> = {
    'Per month': locale === 'en' ? 'Per month' : locale === 'kk' ? 'Айына' : 'В месяц',
    'Per semester': locale === 'en' ? 'Per semester' : locale === 'kk' ? 'Семестрге' : 'В семестр',
    'Per year': locale === 'en' ? 'Per year' : locale === 'kk' ? 'Жылына' : 'В год',
    'In installments': locale === 'en' ? 'In installments' : locale === 'kk' ? 'Бірнеше траншпен' : 'Несколькими траншами',
  };
  const paymentOptions = Array.from(new Set(
    toList(getIn(school, 'finance.payment_options')).map((item) => paymentOptionLabels[item] || item)
  )).filter(Boolean);

  const includedInTuition = pickLocalizedText(school, 'finance.included_in_tuition', locale, '');
  const extraFees = pickLocalizedText(school, 'finance.extra_fees', locale, '');
  const financeComment = pickLocalizedText(school, 'finance.comment', locale, '');
  const financeDiscounts = pickLocalizedText(school, 'finance.discounts_info', locale, '');
  const financeGrants = pickLocalizedText(school, 'finance.grants_info', locale, '');
  const legacyDiscountsGrants = pickFirstText(school, ['finance.grants_discounts'], '');
  const hasFreePlaces = getIn(school, 'finance.free_places') === true;
  const fundingItems = [
    getIn(school, 'finance.funding_state') ? (locale === 'en' ? 'State funding' : locale === 'kk' ? 'Мемлекеттік қаржыландыру' : 'Государственное финансирование') : '',
    getIn(school, 'finance.funding_self') ? (locale === 'en' ? 'Self-funded' : locale === 'kk' ? 'Өзін-өзі қаржыландыру' : 'Самофинансирование') : '',
  ].filter(Boolean);

  const metaCards = [
    registrationFeeMode === 'global' && registrationFee ? { label: ui.registrationFee, value: registrationFee } : null,
    paymentOptions.length ? { label: ui.paymentOptions, value: paymentOptions.join(' • ') } : null,
    includedInTuition ? { label: ui.includedInTuition, value: includedInTuition } : null,
    extraFees ? { label: ui.extraFees, value: extraFees } : null,
    fundingItems.length ? { label: ui.funding, value: fundingItems.join(' • ') } : null,
    hasFreePlaces ? { label: ui.freePlaces, value: '✓' } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <div className="school-mobile-page">
      <div className="school-mobile-backrow">
        <Link href={`/parent/schools/${encodeURIComponent(schoolId)}`} className="school-mobile-back">
          ‹ {ui.back}
        </Link>
      </div>

      <div className={`school-pricing-page${guest ? ' guest-gated-panel' : ''}`}>
        <div className={guest ? 'guest-gated-content' : ''}>
          <div className="school-pricing-header">
            <h2 className="school-pricing-title">{ui.title}</h2>
            {schoolName ? <p className="school-pricing-school-name">{schoolName}</p> : null}
            {!loading && priceLabel ? (
              <p className={`school-pricing-summary${guest ? ' guest-price-blur' : ''}`}>{priceLabel}</p>
            ) : null}
          </div>

          {loading ? <p className="muted">{ui.loading}</p> : null}

          {!loading ? (
            <div className={`school-pricing-body${guest ? ' guest-price-blur' : ''}`}>
              {metaCards.length ? (
                <div className="school-pricing-meta-grid">
                  {metaCards.map((card) => (
                    <div key={card.label} className="school-pricing-meta-card">
                      <span>{card.label}</span>
                      <strong>{card.value}</strong>
                    </div>
                  ))}
                </div>
              ) : null}

              {feeRules.length ? (
                <div className="school-pricing-rules-section">
                  <p className="school-pricing-section-title">{ui.perGrade}</p>
                  <div className="school-pricing-rules">
                    {feeRules.map((rule, i) => (
                      <div key={i} className="school-pricing-rule-card">
                        <div className="school-pricing-rule-grade">
                          <span className="school-pricing-rule-label">{ui.gradesLabel}</span>
                          <strong className="school-pricing-rule-value">
                            {formatFeeRuleGrades(rule.from_grade, rule.to_grade, locale)}
                          </strong>
                        </div>
                        <div className="school-pricing-rule-amount">
                          {formatCurrency(rule.amount, rule.currency)}
                          <span className="school-pricing-rule-period">/ {locale === 'en' ? 'mo' : locale === 'kk' ? 'ай' : 'мес'}</span>
                        </div>
                        {registrationFeeMode === 'per_rule' && rule.entrance_fee > 0 ? (
                          <div className="school-pricing-rule-entry">
                            <span>{ui.entranceFee}:</span>
                            <span>{formatCurrency(rule.entrance_fee, rule.entrance_fee_currency || 'KZT')}</span>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : priceLabel && priceLabel !== ui.onRequest ? (
                <p className="school-price-comment">{priceLabel}</p>
              ) : null}

              {financeDiscounts || financeGrants || legacyDiscountsGrants ? (
                <div className="school-pricing-notes">
                  {financeDiscounts ? <ExpandableNote title={ui.discounts} text={financeDiscounts} locale={locale} /> : null}
                  {financeGrants ? <ExpandableNote title={ui.grants} text={financeGrants} locale={locale} /> : null}
                  {!financeDiscounts && !financeGrants && legacyDiscountsGrants ? (
                    <ExpandableNote
                      title={locale === 'en' ? 'Discounts / Grants' : locale === 'kk' ? 'Жеңілдіктер / Гранттар' : 'Скидки / гранты'}
                      text={legacyDiscountsGrants}
                      locale={locale}
                    />
                  ) : null}
                  {financeComment ? <ExpandableNote title={ui.comment} text={financeComment} locale={locale} /> : null}
                </div>
              ) : financeComment ? (
                <div className="school-pricing-notes">
                  <ExpandableNote title={ui.comment} text={financeComment} locale={locale} />
                </div>
              ) : null}

              {!feeRules.length && !priceLabel ? (
                <p className="muted">{ui.noPrice}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        {guest ? (
          <div className="guest-gated-overlay">
            <p className="guest-gated-title">{ui.guestBlur}</p>
            <Link className="button" href="/login">{ui.signIn}</Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
