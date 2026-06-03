export type LocaleKey = 'ru' | 'en' | 'kk';

export type LocalizedText = {
  ru: string;
  en: string;
  kk: string;
};

export type AdmissionRule = {
  id: string;
  title: LocalizedText;
  from_grade: string;
  to_grade: string;
  assessment_types: string[];
  assessment_other: LocalizedText;
  required_documents: string[];
  documents_other: LocalizedText;
  format: string;
  format_other: LocalizedText;
  stages: LocalizedText;
  requirements: LocalizedText;
  documents: LocalizedText;
  evaluation: LocalizedText;
  comment: LocalizedText;
  deadline: string;
};

const GRADE_LABELS: Record<LocaleKey, Record<string, string>> = {
  ru: {
    all: 'Все классы',
    from: 'С {from} класса',
    to: 'До {to} класса',
    range: '{from}-{to} классы',
  },
  en: {
    all: 'All grades',
    from: 'From grade {from}',
    to: 'Up to grade {to}',
    range: 'Grades {from}-{to}',
  },
  kk: {
    all: 'Барлық сыныптар',
    from: '{from} сыныптан бастап',
    to: '{to} сыныпқа дейін',
    range: '{from}-{to} сыныптар',
  },
};

const OVERVIEW_LABELS: Record<LocaleKey, string> = {
  ru: 'Общий порядок поступления',
  en: 'General admission flow',
  kk: 'Жалпы қабылдау тәртібі',
};

export const ADMISSION_ASSESSMENT_OPTIONS = [
  'test',
  'exam',
  'interview',
  'essay',
  'portfolio',
  'video',
  'trial_day',
  'psychologist',
  'competition',
  'other',
];

export const ADMISSION_DOCUMENT_OPTIONS = [
  'application_form',
  'transcript',
  'portfolio',
  'video',
  'essay',
  'recommendations',
  'medical_certificate',
  'birth_certificate',
  'parent_id',
  'other',
];

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const createLocalizedText = (seed = ''): LocalizedText => ({
  ru: seed,
  en: seed,
  kk: seed,
});

export const normalizeLocalizedText = (value: unknown): LocalizedText => {
  if (isObject(value)) {
    return {
      ru: text(value.ru),
      en: text(value.en),
      kk: text(value.kk),
    };
  }
  return createLocalizedText(text(value));
};

export const pickLocalizedText = (
  value: unknown,
  locale: LocaleKey,
  fallbackLocaleOrder: LocaleKey[] = ['ru', 'kk', 'en']
) => {
  const normalized = normalizeLocalizedText(value);
  return (
    normalized[locale] ||
    fallbackLocaleOrder.map((key) => normalized[key]).find(Boolean) ||
    ''
  );
};

export const createAdmissionRuleEntry = (
  overrides: Partial<AdmissionRule> = {}
): AdmissionRule => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title: createLocalizedText(''),
  from_grade: '',
  to_grade: '',
  assessment_types: [],
  assessment_other: createLocalizedText(''),
  required_documents: [],
  documents_other: createLocalizedText(''),
  format: '',
  format_other: createLocalizedText(''),
  stages: createLocalizedText(''),
  requirements: createLocalizedText(''),
  documents: createLocalizedText(''),
  evaluation: createLocalizedText(''),
  comment: createLocalizedText(''),
  deadline: '',
  ...overrides,
});

export const normalizeAdmissionRule = (value: unknown): AdmissionRule => {
  const raw = isObject(value) ? value : {};
  return createAdmissionRuleEntry({
    ...(text(raw.id) ? { id: text(raw.id) } : {}),
    title: normalizeLocalizedText(raw.title),
    from_grade: text(raw.from_grade),
    to_grade: text(raw.to_grade),
    assessment_types: Array.isArray(raw.assessment_types)
      ? raw.assessment_types.map((item) => text(item)).filter(Boolean)
      : [],
    assessment_other: normalizeLocalizedText(raw.assessment_other),
    required_documents: Array.isArray(raw.required_documents)
      ? raw.required_documents.map((item) => text(item)).filter(Boolean)
      : [],
    documents_other: normalizeLocalizedText(raw.documents_other),
    format: text(raw.format),
    format_other: normalizeLocalizedText(raw.format_other),
    stages: normalizeLocalizedText(raw.stages),
    requirements: normalizeLocalizedText(raw.requirements),
    documents: normalizeLocalizedText(raw.documents),
    evaluation: normalizeLocalizedText(raw.evaluation),
    comment: normalizeLocalizedText(raw.comment),
    deadline: text(raw.deadline),
  });
};

export const admissionRuleHasContent = (rule: AdmissionRule) =>
  Boolean(
    pickLocalizedText(rule.title, 'ru') ||
      rule.from_grade ||
      rule.to_grade ||
      rule.assessment_types.length ||
      pickLocalizedText(rule.assessment_other, 'ru') ||
      rule.required_documents.length ||
      pickLocalizedText(rule.documents_other, 'ru') ||
      rule.format ||
      pickLocalizedText(rule.format_other, 'ru') ||
      pickLocalizedText(rule.stages, 'ru') ||
      pickLocalizedText(rule.requirements, 'ru') ||
      pickLocalizedText(rule.documents, 'ru') ||
      pickLocalizedText(rule.evaluation, 'ru') ||
      pickLocalizedText(rule.comment, 'ru') ||
      rule.deadline
  );

const getIn = (source: unknown, path: string): unknown => {
  if (!isObject(source)) return undefined;
  return path.split('.').reduce<unknown>((cursor, part) => {
    if (!isObject(cursor)) return undefined;
    return cursor[part];
  }, source);
};

const pickFirstRaw = (source: unknown, paths: string[]) => {
  for (const path of paths) {
    const value = getIn(source, path);
    if (isObject(value)) {
      const localized = normalizeLocalizedText(value);
      if (localized.ru || localized.en || localized.kk) return localized;
      continue;
    }
    if (text(value)) return value;
  }
  return '';
};

const buildLegacyAdmissionRule = (source: unknown): AdmissionRule | null => {
  const format = text(getIn(source, 'education.entrance_exam.format'));
  const formatOther = normalizeLocalizedText(
    getIn(source, 'education.entrance_exam.format_other')
  );
  const stages = normalizeLocalizedText(
    pickFirstRaw(source, [
      'education.admission_details.admission_stages_detail',
      'education.entrance_exam.stages',
    ])
  );
  const requirements = normalizeLocalizedText(
    pickFirstRaw(source, [
      'education.entrance_exam.subjects_other',
      'education.entrance_exam.subjects',
    ])
  );
  const deadline = text(getIn(source, 'education.admission_details.document_deadlines'));
  const title = createLocalizedText(OVERVIEW_LABELS.ru);
  title.en = OVERVIEW_LABELS.en;
  title.kk = OVERVIEW_LABELS.kk;

  const rule = createAdmissionRuleEntry({
    title,
    assessment_types: format ? [format] : [],
    format,
    format_other: formatOther,
    stages,
    requirements,
    deadline,
  });

  return admissionRuleHasContent(rule) ? rule : null;
};

export const normalizeAdmissionRules = (source: unknown): AdmissionRule[] => {
  const rawRules = getIn(source, 'education.admission_rules');
  if (Array.isArray(rawRules) && rawRules.length) {
    return rawRules
      .map((item) => normalizeAdmissionRule(item))
      .filter((item) => admissionRuleHasContent(item));
  }
  const legacyRule = buildLegacyAdmissionRule(source);
  return legacyRule ? [legacyRule] : [];
};

export const formatAdmissionGradeLabel = (
  rule: Pick<AdmissionRule, 'title' | 'from_grade' | 'to_grade'>,
  locale: LocaleKey
) => {
  const title = pickLocalizedText(rule.title, locale);
  if (title) return title;
  const labels = GRADE_LABELS[locale];
  if (rule.from_grade && rule.to_grade) {
    return labels.range
      .replace('{from}', rule.from_grade)
      .replace('{to}', rule.to_grade);
  }
  if (rule.from_grade) {
    return labels.from.replace('{from}', rule.from_grade);
  }
  if (rule.to_grade) {
    return labels.to.replace('{to}', rule.to_grade);
  }
  return labels.all;
};
