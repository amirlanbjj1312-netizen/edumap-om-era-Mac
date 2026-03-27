type Locale = 'ru' | 'en' | 'kk';
type FeeCurrency = 'KZT' | 'USD' | 'EUR' | 'GBP';
export type SchoolFeePeriod = 'monthly' | 'yearly';

export type SchoolFeeRule = {
  from_grade: number;
  to_grade: number;
  amount: number;
  currency: FeeCurrency;
  period: SchoolFeePeriod;
  comment: string;
};

type FeeSummary = {
  min: number;
  max: number;
  currency: FeeCurrency | '';
  period: SchoolFeePeriod | '';
  hasFeeRules: boolean;
  hasAnyFee: boolean;
};

const DEFAULT_CURRENCY: FeeCurrency = 'KZT';
const FALLBACK_PRICE_CURRENCY: FeeCurrency = 'KZT';
const CURRENCY_SYMBOLS: Record<FeeCurrency, string> = {
  KZT: '₸',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

const KZT_PER_CURRENCY: Record<FeeCurrency, number> = {
  KZT: 1,
  USD: 500,
  EUR: 540,
  GBP: 630,
};

export const SCHOOL_FEE_CURRENCIES: FeeCurrency[] = ['KZT', 'USD', 'EUR', 'GBP'];
export const SCHOOL_FEE_PERIODS: SchoolFeePeriod[] = ['monthly', 'yearly'];
export const SCHOOL_GRADE_OPTIONS = Array.from({ length: 14 }, (_, index) => index);

const toText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
};

const toPriceNumber = (value: unknown): number => {
  const raw = toText(value).trim();
  if (!raw) return 0;
  const digits = raw.replace(/\s+/g, '').match(/\d+(?:[.,]\d+)?/);
  if (!digits) return 0;
  const parsed = Number(digits[0].replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

const toGradeNumber = (value: unknown): number => {
  const raw = toText(value).trim();
  if (!raw) return 0;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) return 0;
  if (parsed < 0 || parsed > 13) return 0;
  return parsed;
};

const toCurrency = (value: unknown): FeeCurrency => {
  const raw = toText(value).trim().toUpperCase();
  if (raw === 'USD' || raw === 'EUR' || raw === 'KZT' || raw === 'GBP') return raw;
  return DEFAULT_CURRENCY;
};

const toPeriod = (value: unknown): SchoolFeePeriod => {
  const raw = toText(value).trim().toLowerCase();
  return raw === 'yearly' ? 'yearly' : 'monthly';
};

const normalizeRule = (value: unknown): SchoolFeeRule | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const rule = value as Record<string, unknown>;
  const fromGrade = toGradeNumber(rule.from_grade);
  const toGrade = toGradeNumber(rule.to_grade);
  const amount = toPriceNumber(rule.amount);
  if (!fromGrade || !toGrade || fromGrade > toGrade || amount <= 0) return null;
  return {
    from_grade: fromGrade,
    to_grade: toGrade,
    amount,
    currency: toCurrency(rule.currency),
    period: toPeriod(rule.period),
    comment: toText(rule.comment).trim(),
  };
};

export const normalizeSchoolFeeRules = (value: unknown): SchoolFeeRule[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeRule(item))
    .filter((item): item is SchoolFeeRule => Boolean(item))
    .sort((a, b) => a.from_grade - b.from_grade || a.to_grade - b.to_grade);
};

export const buildGradeFeeMapFromRules = (rules: unknown): Record<string, string> => {
  const normalizedRules = normalizeSchoolFeeRules(rules);
  return normalizedRules.reduce<Record<string, string>>((acc, rule) => {
    for (let grade = rule.from_grade; grade <= rule.to_grade; grade += 1) {
      acc[String(grade)] = String(rule.amount);
    }
    return acc;
  }, {});
};

export const buildFeeRulesFromGradeMap = (value: unknown): SchoolFeeRule[] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];

  const grades = Object.entries(value as Record<string, unknown>)
    .map(([grade, amount]) => ({
      grade: toGradeNumber(grade),
      amount: toPriceNumber(amount),
    }))
    .filter((item) => item.grade && item.amount > 0)
    .sort((a, b) => a.grade - b.grade);

  if (!grades.length) return [];

  const rules: SchoolFeeRule[] = [];
  let current = {
    from_grade: grades[0].grade,
    to_grade: grades[0].grade,
    amount: grades[0].amount,
    currency: DEFAULT_CURRENCY,
    period: 'monthly',
    comment: '',
  } as SchoolFeeRule;

  for (let index = 1; index < grades.length; index += 1) {
    const item = grades[index];
    const isSameBand =
      item.grade === current.to_grade + 1 && item.amount === current.amount;
    if (isSameBand) {
      current.to_grade = item.grade;
      continue;
    }
    rules.push(current);
      current = {
        from_grade: item.grade,
        to_grade: item.grade,
        amount: item.amount,
        currency: DEFAULT_CURRENCY,
        period: 'monthly',
        comment: '',
      };
  }

  rules.push(current);
  return rules;
};

export const buildFeeRulesFromFinance = (finance: {
  fee_rules?: unknown;
  monthly_fee_by_grade?: unknown;
  monthly_fee?: unknown;
  tuition_monthly?: unknown;
  price_monthly?: unknown;
} | null | undefined): SchoolFeeRule[] => {
  const ruleList = normalizeSchoolFeeRules(finance?.fee_rules);
  if (ruleList.length) return ruleList;

  const fromGradeMap = buildFeeRulesFromGradeMap(finance?.monthly_fee_by_grade);
  if (fromGradeMap.length) return fromGradeMap;

  const fallbackAmount = toPriceNumber(
    finance?.monthly_fee || finance?.tuition_monthly || finance?.price_monthly
  );
  if (fallbackAmount <= 0) return [];

  return [
    {
      from_grade: 0,
      to_grade: 13,
      amount: fallbackAmount,
      currency: DEFAULT_CURRENCY,
      period: 'monthly',
      comment: '',
    },
  ];
};

const getRuleSummary = (rules: SchoolFeeRule[]): FeeSummary => {
  if (!rules.length) {
    return {
      min: 0,
      max: 0,
      currency: '',
      period: '',
      hasFeeRules: false,
      hasAnyFee: false,
    };
  }

  const currencies = [...new Set(rules.map((rule) => rule.currency))];
  const periods = [...new Set(rules.map((rule) => rule.period))];
  if (currencies.length !== 1 || periods.length !== 1) {
    return {
      min: 0,
      max: 0,
      currency: '',
      period: '',
      hasFeeRules: true,
      hasAnyFee: true,
    };
  }

  return {
    min: Math.min(...rules.map((rule) => rule.amount)),
    max: Math.max(...rules.map((rule) => rule.amount)),
    currency: currencies[0],
    period: periods[0],
    hasFeeRules: true,
    hasAnyFee: true,
  };
};

export const getSchoolFeeSummary = (row: {
  finance?: {
    fee_rules?: unknown;
    monthly_fee_by_grade?: unknown;
    tuition_monthly?: unknown;
    monthly_fee?: unknown;
    price_monthly?: unknown;
  };
  basic_info?: {
    price?: unknown;
  };
}): FeeSummary => {
  const feeRuleSummary = getRuleSummary(buildFeeRulesFromFinance(row.finance));
  if (feeRuleSummary.hasAnyFee) return feeRuleSummary;

  const fallback = toPriceNumber(
    row.finance?.tuition_monthly ||
      row.finance?.monthly_fee ||
      row.finance?.price_monthly ||
      row.basic_info?.price
  );

  return {
    min: fallback,
    max: fallback,
    currency: fallback > 0 ? FALLBACK_PRICE_CURRENCY : '',
    period: fallback > 0 ? 'monthly' : '',
    hasFeeRules: false,
    hasAnyFee: fallback > 0,
  };
};

export const getComparableFeeInKzt = (
  row: Parameters<typeof getSchoolFeeSummary>[0],
  targetPeriod: SchoolFeePeriod = 'monthly'
): number => {
  const summary = getSchoolFeeSummary(row);
  if (!summary.hasAnyFee) return 0;
  const rate = summary.currency ? KZT_PER_CURRENCY[summary.currency] : 0;
  if (!rate) return 0;
  const normalized = summary.min * rate;
  if (summary.period === targetPeriod) {
    return Math.round(normalized);
  }
  if (summary.period === 'yearly' && targetPeriod === 'monthly') {
    return Math.round(normalized / 12);
  }
  if (summary.period === 'monthly' && targetPeriod === 'yearly') {
    return Math.round(normalized * 12);
  }
  return Math.round(normalized);
};

export const getComparableMonthlyFee = (row: Parameters<typeof getSchoolFeeSummary>[0]): number =>
  getComparableFeeInKzt(row, 'monthly');

export const getFeeCurrencySymbol = (currency: FeeCurrency) => CURRENCY_SYMBOLS[currency] || currency;

const formatCurrency = (value: number, currency: FeeCurrency) =>
  `${value.toLocaleString('ru-RU')} ${CURRENCY_SYMBOLS[currency]}`;

const formatPeriodSuffix = (period: SchoolFeePeriod, locale: Locale) => {
  if (locale === 'en') return period === 'yearly' ? '/ year' : '/ month';
  if (locale === 'kk') return period === 'yearly' ? '/ жыл' : '/ ай';
  return period === 'yearly' ? '/ год' : '/ мес';
};

export const formatSchoolFee = (
  row: Parameters<typeof getSchoolFeeSummary>[0],
  _locale: Locale,
  fallbackText: string
): string => {
  const locale = _locale;
  const summary = getSchoolFeeSummary(row);
  if (!summary.hasAnyFee || !summary.currency) return fallbackText;

  if (summary.hasFeeRules && summary.min !== summary.max) {
    return `${formatCurrency(summary.min, summary.currency)} - ${formatCurrency(summary.max, summary.currency)}${summary.period ? ` ${formatPeriodSuffix(summary.period, locale)}` : ''}`;
  }

  return `${formatCurrency(summary.min, summary.currency)}${summary.period ? ` ${formatPeriodSuffix(summary.period, locale)}` : ''}`;
};
