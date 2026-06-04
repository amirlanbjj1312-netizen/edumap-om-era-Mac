import React, { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSchools } from '../context/SchoolsContext';
import { useLocale } from '../context/LocaleContext';
import { getLocalizedText } from '../utils/localizedText';
import { PAYMENT_LABEL_KEYS, translateLabel } from '../utils/schoolLabels';

const formatMoneyValue = (amount, currency = 'KZT', locale) => {
  const raw = String(amount || '').trim();
  if (!raw) return '';
  const numeric = Number(raw.replace(/\s+/g, '').replace(',', '.'));
  const formattedAmount = Number.isFinite(numeric)
    ? Math.round(numeric).toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')
    : raw;
  const normalizedCurrency = String(currency || 'KZT').trim().toUpperCase();
  const currencyLabel =
    normalizedCurrency === 'KZT'
      ? '₸'
      : normalizedCurrency === 'USD'
        ? '$'
        : normalizedCurrency === 'EUR'
          ? '€'
          : normalizedCurrency;
  return `${formattedAmount} ${currencyLabel}`.trim();
};

const formatSchoolPrice = (amount, paymentLabel, locale) => {
  const money = formatMoneyValue(amount, 'KZT', locale);
  if (!money) return '';
  if (!paymentLabel) return money;
  return `${money} / ${paymentLabel}`;
};

const toPriceNumber = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  const raw = String(value ?? '')
    .replace(/\s+/g, '')
    .replace(',', '.')
    .trim();
  if (!raw) return 0;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : 0;
};

const normalizePricePeriod = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  if (
    raw.includes('month') ||
    raw.includes('ежемесяч') ||
    raw.includes('ай')
  ) {
    return 'month';
  }
  if (
    raw.includes('semester') ||
    raw.includes('семестр')
  ) {
    return 'semester';
  }
  if (
    raw.includes('year') ||
    raw.includes('annual') ||
    raw.includes('ежегод') ||
    raw.includes('год') ||
    raw.includes('жыл')
  ) {
    return 'year';
  }
  return '';
};

const getPricePeriodLabel = (period, t) => {
  if (period === 'month') return t('schools.payment.per_month');
  if (period === 'semester') return t('schools.payment.per_semester');
  if (period === 'year') return t('schools.payment.per_year');
  return '';
};

const formatFinanceSummary = (rules, t, locale) => {
  const validRules = Array.isArray(rules)
    ? rules.filter((rule) => rule?.rawAmount > 0)
    : [];
  if (!validRules.length) return '';

  const amounts = validRules.map((rule) => rule.rawAmount);
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  const currency = validRules.find((rule) => rule.currency)?.currency || 'KZT';
  const periods = [...new Set(validRules.map((rule) => rule.period).filter(Boolean))];
  const periodLabel = periods.length === 1 ? getPricePeriodLabel(periods[0], t) : '';
  const suffix = periodLabel ? ` / ${periodLabel}` : '';

  if (min !== max) {
    return `${formatMoneyValue(min, currency, locale)} - ${formatMoneyValue(max, currency, locale)}${suffix}`;
  }

  return `${formatMoneyValue(min, currency, locale)}${suffix}`;
};

const formatFeeRuleGrades = (fromGrade, toGrade, locale) => {
  const from = Number(fromGrade);
  const to = Number(toGrade);
  if (!Number.isFinite(from) && !Number.isFinite(to)) return '';
  const start = Number.isFinite(from) ? from : to;
  const end = Number.isFinite(to) ? to : from;
  const sameGrade = start === end;
  if (locale === 'en') return sameGrade ? `Grade ${start}` : `Grades ${start}-${end}`;
  if (locale === 'kk') return sameGrade ? `${start} сынып` : `${start}-${end} сынып`;
  return sameGrade ? `${start} класс` : `${start}-${end} классы`;
};

const normalizeDisplayValue = (value, locale) => {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeDisplayValue(item, locale))
      .filter(Boolean)
      .join(', ');
  }
  if (typeof value === 'object') {
    return getLocalizedText(value, locale).trim();
  }
  return String(value).trim();
};

const splitRichTextItems = (value) => {
  const text = String(value || '').replace(/\r/g, '').trim();
  if (!text) return [];
  return text
    .split(/\n+|(?=•)|(?=- )/)
    .map((item) => item.replace(/^[•-]\s*/, '').trim())
    .filter(Boolean);
};

const DetailRow = ({ label, value }) => {
  const text = String(value || '').trim();
  if (!text) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{text}</Text>
    </View>
  );
};

const BulletSection = ({ label, value }) => {
  const items = splitRichTextItems(value);
  if (!items.length) return null;
  return (
    <View style={styles.infoSection}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.bulletList}>
        {items.map((item, index) => (
          <View key={`${label}-${index}`} style={styles.bulletRow}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const TextSection = ({ label, value }) => {
  const text = String(value || '').trim();
  if (!text) return null;
  return (
    <View style={styles.infoSection}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <Text style={styles.sectionText}>{text}</Text>
    </View>
  );
};

export default function SchoolPricingScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { profiles } = useSchools();
  const { locale, t } = useLocale();
  const schoolId = route.params?.schoolId;

  const profile = useMemo(
    () =>
      profiles.find((item) => item?.school_id === schoolId) ||
      profiles.find((item) => getLocalizedText(item?.basic_info?.name, locale) === schoolId) ||
      null,
    [profiles, schoolId, locale]
  );

  const schoolName =
    getLocalizedText(profile?.basic_info?.display_name, locale).trim() ||
    getLocalizedText(profile?.basic_info?.name, locale).trim() ||
    '';
  const finance = profile?.finance || {};

  const paymentOptions = useMemo(
    () =>
      Array.from(
        new Set(
          (Array.isArray(finance?.payment_options) ? finance.payment_options : [])
            .map((item) => translateLabel(t, PAYMENT_LABEL_KEYS, item) || normalizeDisplayValue(item, locale))
            .filter(Boolean)
        )
      ),
    [finance?.payment_options, locale, t]
  );
  const registrationFee = formatMoneyValue(
    finance?.registration_fee,
    finance?.registration_fee_currency,
    locale
  );
  const financeDiscounts =
    getLocalizedText(finance?.discounts_info, locale).trim() ||
    normalizeDisplayValue(finance?.discounts_info, locale);
  const financeGrants =
    getLocalizedText(finance?.grants_info, locale).trim() ||
    normalizeDisplayValue(finance?.grants_info, locale);
  const includedInTuition =
    getLocalizedText(finance?.included_in_tuition, locale).trim() ||
    normalizeDisplayValue(finance?.included_in_tuition, locale);
  const extraFees =
    getLocalizedText(finance?.extra_fees, locale).trim() ||
    normalizeDisplayValue(finance?.extra_fees, locale);
  const financeComment =
    getLocalizedText(finance?.comment, locale).trim() ||
    normalizeDisplayValue(finance?.comment, locale);

  const financeRules = useMemo(() => {
    if (Array.isArray(finance?.fee_rules) && finance.fee_rules.length) {
      return finance.fee_rules
        .map((rule, index) => {
          const amount = formatMoneyValue(rule?.amount, rule?.currency, locale);
          const rawAmount = toPriceNumber(rule?.amount);
          const currency = String(rule?.currency || 'KZT').trim().toUpperCase() || 'KZT';
          const period = normalizePricePeriod(
            rule?.period || rule?.payment_period || finance?.payment_system
          );
          const grades = formatFeeRuleGrades(rule?.from_grade, rule?.to_grade, locale);
          const comment =
            getLocalizedText(rule?.comment, locale).trim() ||
            normalizeDisplayValue(rule?.comment, locale);
          if (!amount && !grades && !comment) return null;
          return { id: `rule-${index}`, grades, amount, comment, rawAmount, currency, period };
        })
        .filter(Boolean);
    }

    const gradeFees =
      finance?.monthly_fee_by_grade &&
      typeof finance.monthly_fee_by_grade === 'object' &&
      !Array.isArray(finance.monthly_fee_by_grade)
        ? finance.monthly_fee_by_grade
        : null;

    if (!gradeFees) return [];

    return Object.entries(gradeFees)
      .map(([grade, amount]) => {
        const formatted = formatMoneyValue(amount, 'KZT', locale);
        if (!formatted) return null;
        return {
          id: `grade-${grade}`,
          grades: formatFeeRuleGrades(grade, grade, locale),
          amount: formatted,
          comment: '',
          rawAmount: toPriceNumber(amount),
          currency: 'KZT',
          period: normalizePricePeriod(finance?.payment_system),
        };
      })
      .filter(Boolean);
  }, [finance?.fee_rules, finance?.monthly_fee_by_grade, locale]);

  const pricingSummary =
    formatFinanceSummary(financeRules, t, locale) ||
    formatSchoolPrice(finance?.monthly_fee, t('schools.payment.per_month'), locale);

  const financeRows = [
    !financeRules.length && pricingSummary
      ? { label: t('schoolDetail.quick.price'), value: pricingSummary }
      : null,
    registrationFee
      ? { label: t('schoolDetail.field.registrationFee'), value: registrationFee }
      : null,
    finance?.free_places
      ? { label: t('schoolDetail.field.freePlaces'), value: t('schoolDetail.value.yes') }
      : null,
  ].filter(Boolean);
  const hasNarrativeSections = Boolean(
    financeDiscounts || financeGrants || includedInTuition || extraFees || financeComment
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ {t('schoolDetail.back')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('schoolDetail.section.finance')}</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.schoolName}>{schoolName}</Text>

        {(pricingSummary || paymentOptions.length) ? (
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>{t('schoolDetail.quick.price')}</Text>
            <Text style={styles.heroValue}>{pricingSummary}</Text>
            {paymentOptions.length ? (
              <View style={styles.optionChips}>
                {paymentOptions.map((option) => (
                  <View key={option} style={styles.optionChip}>
                    <Text style={styles.optionChipText}>{option}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {financeRules.length ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('schoolDetail.pricing.byGrades')}</Text>
            <View style={styles.rulesList}>
              {financeRules.map((rule) => (
                <View key={rule.id} style={styles.ruleCard}>
                  <View style={styles.ruleHeader}>
                    <Text style={styles.ruleGrades}>{rule.grades}</Text>
                    <Text style={styles.ruleAmount}>{rule.amount}</Text>
                  </View>
                  {rule.comment ? <Text style={styles.ruleComment}>{rule.comment}</Text> : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {financeRows.length ? (
          <View style={styles.card}>
            {financeRows.map((row) => (
              <DetailRow key={row.label} label={row.label} value={row.value} />
            ))}
          </View>
        ) : null}

        {hasNarrativeSections ? (
          <View style={styles.card}>
            <BulletSection
              label={t('schoolDetail.field.discounts')}
              value={financeDiscounts}
            />
            <BulletSection
              label={t('schoolDetail.field.grants')}
              value={financeGrants}
            />
            <BulletSection
              label={t('schoolDetail.field.includedInTuition')}
              value={includedInTuition}
            />
            <BulletSection
              label={t('schoolDetail.field.extraFees')}
              value={extraFees}
            />
            <TextSection
              label={t('schoolDetail.field.financeComment')}
              value={financeComment}
            />
          </View>
        ) : null}

        {!financeRules.length &&
        !financeRows.length &&
        !hasNarrativeSections ? (
          <Text style={styles.empty}>{t('schoolDetail.value.unknown')}</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#EEF2FA' },
  header: {
    height: 54,
    backgroundColor: '#0B1220',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  back: { color: '#FFFFFF', fontFamily: 'exoSemibold', fontSize: 16 },
  title: { color: '#FFFFFF', fontFamily: 'exoSemibold', fontSize: 18 },
  headerSpacer: { width: 42 },
  scroll: { flex: 1 },
  content: { padding: 14, gap: 14 },
  schoolName: { fontFamily: 'exoSemibold', fontSize: 18, color: '#0F172A' },
  heroCard: {
    borderRadius: 22,
    backgroundColor: '#0F172A',
    padding: 18,
    gap: 10,
  },
  heroLabel: {
    fontFamily: 'exo',
    fontSize: 12,
    color: 'rgba(255,255,255,0.72)',
  },
  heroValue: {
    fontFamily: 'exoSemibold',
    fontSize: 24,
    color: '#FFFFFF',
  },
  optionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  optionChipText: {
    fontFamily: 'exoSemibold',
    fontSize: 12,
    color: '#FFFFFF',
  },
  card: {
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.18)',
    padding: 14,
    gap: 12,
  },
  cardTitle: {
    fontFamily: 'exoSemibold',
    fontSize: 16,
    color: '#0F172A',
  },
  rulesList: { gap: 10 },
  ruleCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.18)',
    backgroundColor: '#F8FAFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  ruleGrades: {
    flex: 1,
    fontFamily: 'exoSemibold',
    fontSize: 13,
    color: '#334155',
  },
  ruleAmount: {
    fontFamily: 'exoSemibold',
    fontSize: 15,
    color: '#0F172A',
    textAlign: 'right',
  },
  ruleComment: {
    fontFamily: 'exo',
    fontSize: 12,
    lineHeight: 18,
    color: '#475569',
  },
  row: { gap: 4 },
  label: { fontFamily: 'exo', fontSize: 11, color: '#6B7280' },
  value: { fontFamily: 'exoSemibold', fontSize: 15, color: '#111827' },
  infoSection: {
    gap: 8,
  },
  sectionLabel: {
    fontFamily: 'exo',
    fontSize: 11,
    color: '#6B7280',
  },
  sectionText: {
    fontFamily: 'exoSemibold',
    fontSize: 15,
    lineHeight: 23,
    color: '#111827',
  },
  bulletList: {
    gap: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563EB',
    marginTop: 8,
  },
  bulletText: {
    flex: 1,
    fontFamily: 'exoSemibold',
    fontSize: 15,
    lineHeight: 23,
    color: '#111827',
  },
  empty: { fontFamily: 'exo', fontSize: 14, color: '#64748B' },
});
