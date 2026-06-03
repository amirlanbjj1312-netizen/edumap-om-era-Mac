import React, { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSchools } from '../context/SchoolsContext';
import { useLocale } from '../context/LocaleContext';
import { getLocalizedText } from '../utils/localizedText';

const splitToList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(splitToList).filter(Boolean);
  if (typeof value === 'object') return Object.values(value).flatMap(splitToList).filter(Boolean);
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const localizeAdmissionOption = (value, locale) => {
  const normalized = String(value || '').trim().toLowerCase();
  const labels = {
    egov: { ru: 'eGov', en: 'eGov', kk: 'eGov' },
    sakura: { ru: 'Sakura', en: 'Sakura', kk: 'Sakura' },
    through_school: { ru: 'Через школу', en: 'Through school', kk: 'Мектеп арқылы' },
    school: { ru: 'Через школу', en: 'Through school', kk: 'Мектеп арқылы' },
    mixed: { ru: 'Смешанный вариант', en: 'Mixed option', kk: 'Аралас нұсқа' },
    mixed_variant: { ru: 'Смешанный вариант', en: 'Mixed option', kk: 'Аралас нұсқа' },
  };
  const item = labels[normalized];
  if (item) return item[locale] || item.ru;
  return String(value || '').trim();
};

const OPTION_I18N = {
  test: { ru: 'Тест', en: 'Test', kk: 'Тест' },
  exam: { ru: 'Экзамен', en: 'Exam', kk: 'Емтихан' },
  interview: { ru: 'Собеседование', en: 'Interview', kk: 'Сұхбат' },
  essay: { ru: 'Эссе', en: 'Essay', kk: 'Эссе' },
  portfolio: { ru: 'Портфолио', en: 'Portfolio', kk: 'Портфолио' },
  video: { ru: 'Видео-визитка', en: 'Video intro', kk: 'Бейне-визитка' },
  trial_day: { ru: 'Пробный день', en: 'Trial day', kk: 'Сынақ күні' },
  psychologist: { ru: 'Психолог', en: 'Psychologist', kk: 'Психолог' },
  competition: { ru: 'Конкурс', en: 'Competition', kk: 'Байқау' },
  'no competition': { ru: 'Без конкурса', en: 'No competition', kk: 'Конкурссыз' },
  other: { ru: 'Другое', en: 'Other', kk: 'Басқа' },
  application_form: { ru: 'Заявление о зачислении', en: 'Enrollment application', kk: 'Қабылдау туралы өтініш' },
  transcript: { ru: 'Табель / выписка оценок', en: 'Transcript / grade report', kk: 'Табель / бағалар көшірмесі' },
  recommendations: { ru: 'Рекомендации', en: 'Recommendations', kk: 'Ұсынымдар' },
  medical_certificate: { ru: 'Медицинская справка (форма № 065/у)', en: 'Medical certificate (form No. 065/u)', kk: 'Медициналық анықтама (№ 065/у нысаны)' },
  health_status_certificate: {
    ru: 'Медицинская карта ребенка (форма № 026/у-3)',
    en: 'Child medical record (form No. 026/u-3)',
    kk: 'Баланың медициналық картасы (№ 026/у-3 нысаны)',
  },
  birth_certificate: { ru: 'Свидетельство о рождении', en: 'Birth certificate', kk: 'Туу туралы куәлік' },
  health_passport: {
    ru: 'Медицинская карта ребенка (форма № 026/у-3)',
    en: 'Child medical record (form No. 026/u-3)',
    kk: 'Баланың медициналық картасы (№ 026/у-3 нысаны)',
  },
  form_063: {
    ru: 'Карта профилактических прививок (форма № 063/у)',
    en: 'Immunization record (form No. 063/u)',
    kk: 'Профилактикалық егулер картасы (№ 063/у нысаны)',
  },
  photo_3x4: { ru: 'Фото 3×4', en: '3×4 photos', kk: '3×4 фото' },
  student_file: { ru: 'Личное дело учащегося', en: 'Student record file', kk: 'Оқушының жеке ісі' },
  withdrawal_slip: {
    ru: 'Открепительный талон из предыдущей школы',
    en: 'Withdrawal slip from the previous school',
    kk: 'Алдыңғы мектептен шығу талоны',
  },
  original_identity_document: {
    ru: 'Копия документа, удостоверяющего личность учащегося',
    en: 'Copy of the student identity document',
    kk: 'Оқушының жеке басын куәландыратын құжат көшірмесі',
  },
  parent_id: { ru: 'Документ родителя', en: 'Parent ID', kk: 'Ата-ана құжаты' },
};

const OPTION_ALIASES = {
  school: 'through_school',
  mixed: 'mixed_variant',
};

const prettifyOptionValue = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  return text
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const localizeStructuredOption = (value, locale) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return getLocalizedText(value, locale).trim();
  }
  const raw = String(value || '').trim();
  const normalized = raw.toLowerCase();
  const alias = OPTION_ALIASES[normalized] || normalized;
  const item = OPTION_I18N[alias];
  if (item) return item[locale] || item.ru;
  return prettifyOptionValue(raw);
};

const normalizeRule = (rule) => {
  if (!rule || typeof rule !== 'object') return null;
  return {
    id: String(rule.id || ''),
    title: rule.title || {},
    fromGrade: String(rule.from_grade || '').trim(),
    toGrade: String(rule.to_grade || '').trim(),
    assessmentTypes: Array.isArray(rule.assessment_types) ? rule.assessment_types : [],
    assessmentOther: rule.assessment_other || {},
    requiredDocuments: Array.isArray(rule.required_documents) ? rule.required_documents : [],
    documentsOther: rule.documents_other || {},
    stages: rule.stages || {},
    requirements: rule.requirements || {},
    documents: rule.documents || {},
    evaluation: rule.evaluation || {},
    comment: rule.comment || {},
    deadline: String(rule.deadline || '').trim(),
    format: String(rule.format || '').trim(),
    formatOther: rule.format_other || {},
  };
};

const formatRuleTitle = (rule, locale, fallbackLabel) => {
  const title = getLocalizedText(rule?.title, locale).trim();
  if (title) return title;
  if (rule?.fromGrade && rule?.toGrade) {
    return locale === 'en'
      ? `Grades ${rule.fromGrade}-${rule.toGrade}`
      : locale === 'kk'
        ? `${rule.fromGrade}-${rule.toGrade} сыныптар`
        : `${rule.fromGrade}-${rule.toGrade} классы`;
  }
  if (rule?.fromGrade) {
    return locale === 'en'
      ? `From grade ${rule.fromGrade}`
      : locale === 'kk'
        ? `${rule.fromGrade} сыныптан бастап`
        : `С ${rule.fromGrade} класса`;
  }
  if (rule?.toGrade) {
    return locale === 'en'
      ? `Up to grade ${rule.toGrade}`
      : locale === 'kk'
        ? `${rule.toGrade} сыныпқа дейін`
        : `До ${rule.toGrade} класса`;
  }
  return fallbackLabel;
};

const DetailSection = ({ label, value }) => {
  const text = String(value || '').trim();
  if (!text) return null;
  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionTitle}>{label}</Text>
      <Text style={styles.sectionText}>{text}</Text>
    </View>
  );
};

const TagGroup = ({ label, items }) => {
  if (!Array.isArray(items) || !items.length) return null;
  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionTitle}>{label}</Text>
      <View style={styles.tags}>
        {items.map((item) => (
          <View key={item} style={styles.tag}>
            <Text style={styles.tagText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const splitStepItems = (value) => {
  const text = String(value || '').replace(/\r/g, '').trim();
  if (!text) return [];

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length > 1) {
    return lines
      .map((line) => line.replace(/^(?:\d+[.)]|[-•])\s*/, '').trim())
      .filter(Boolean);
  }

  return text
    .split(/(?=\d+[.)]\s+)/)
    .map((line) => line.replace(/^(?:\d+[.)]|[-•])\s*/, '').trim())
    .filter(Boolean);
};

const StepTimeline = ({ label, value }) => {
  const items = splitStepItems(value);
  if (!items.length) return <DetailSection label={label} value={value} />;

  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionTitle}>{label}</Text>
      <View style={styles.timeline}>
        {items.map((item, index) => (
          <View key={`${index}-${item}`} style={styles.timelineRow}>
            <View style={styles.timelineRail}>
              <View style={styles.timelineDot}>
                <Text style={styles.timelineDotText}>{index + 1}</Text>
              </View>
              {index < items.length - 1 ? <View style={styles.timelineLine} /> : null}
            </View>
            <Text style={styles.timelineText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const DetailRow = ({ label, value }) => {
  const normalizedValue = Array.isArray(value)
    ? value.filter(Boolean).join(', ')
    : typeof value === 'object'
      ? value?.ru || value?.en || ''
      : String(value || '').trim();
  if (!normalizedValue) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{normalizedValue}</Text>
    </View>
  );
};

export default function SchoolAdmissionScreen() {
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

  const education = profile?.education || {};
  const entranceExam = education?.entrance_exam || {};
  const admissionDetails = education?.admission_details || {};
  const schoolName =
    getLocalizedText(profile?.basic_info?.display_name, locale) ||
    getLocalizedText(profile?.basic_info?.name, locale) ||
    '';
  const schoolType = String(profile?.basic_info?.type || '').trim().toLowerCase();
  const admissionChannels = (
    Array.isArray(admissionDetails.application_channel)
      ? admissionDetails.application_channel
      : splitToList(admissionDetails.application_channel)
  ).map((item) => localizeAdmissionOption(item, locale));
  const admissionLink = getLocalizedText(admissionDetails.application_link, locale).trim();
  const stages =
    getLocalizedText(admissionDetails.admission_stages_detail, locale).trim() ||
    getLocalizedText(entranceExam.stages, locale).trim();
  const subjects = splitToList(getLocalizedText(entranceExam.subjects, locale));
  const stateDocuments = getLocalizedText(admissionDetails.documents_detail, locale).trim();
  const stateComment = getLocalizedText(admissionDetails.parent_comment, locale).trim();
  const stateFlags = [
    admissionDetails.residential_assignment
      ? locale === 'en'
        ? 'Residential assignment'
        : locale === 'kk'
          ? 'Мекенжай бойынша бекіту'
          : 'Прикрепление по адресу'
      : '',
    admissionDetails.admission_first_grade
      ? locale === 'en'
        ? 'First grade admission'
        : locale === 'kk'
          ? '1-сыныпқа қабылдау'
          : 'Прием в 1 класс'
      : '',
    admissionDetails.admission_transfer
      ? locale === 'en'
        ? 'Transfer from another school'
        : locale === 'kk'
          ? 'Басқа мектептен ауысу'
          : 'Перевод из другой школы'
      : '',
    admissionDetails.residence_required
      ? locale === 'en'
        ? 'Residence required'
        : locale === 'kk'
          ? 'Тіркеу қажет'
          : 'Нужна прописка/адрес'
      : '',
  ].filter(Boolean);
  const admissionRules = (
    Array.isArray(profile?.education?.admission_rules) ? profile.education.admission_rules : []
  )
    .map(normalizeRule)
    .filter(Boolean)
    .filter((rule) => {
      const hasContent =
        getLocalizedText(rule.title, locale).trim() ||
        rule.fromGrade ||
        rule.toGrade ||
        rule.assessmentTypes.length ||
        getLocalizedText(rule.assessmentOther, locale).trim() ||
        rule.requiredDocuments.length ||
        getLocalizedText(rule.documentsOther, locale).trim() ||
        getLocalizedText(rule.stages, locale).trim() ||
        getLocalizedText(rule.requirements, locale).trim() ||
        getLocalizedText(rule.documents, locale).trim() ||
        getLocalizedText(rule.evaluation, locale).trim() ||
        getLocalizedText(rule.comment, locale).trim() ||
        rule.deadline ||
        rule.format ||
        getLocalizedText(rule.formatOther, locale).trim();
      return Boolean(hasContent);
    });
  const isStateSchool = schoolType === 'state';
  const fallbackRuleLabel =
    locale === 'en' ? 'General admission flow' : locale === 'kk' ? 'Жалпы қабылдау тәртібі' : 'Общий порядок поступления';
  const overviewLabel =
    locale === 'en' ? 'Quick overview' : locale === 'kk' ? 'Қысқаша' : 'Кратко';
  const selectionTypesLabel =
    locale === 'en' ? 'Selection types' : locale === 'kk' ? 'Іріктеу түрлері' : 'Типы отбора';
  const stagesLabel =
    locale === 'en' ? 'What to complete' : locale === 'kk' ? 'Не өту керек' : 'Что нужно пройти';
  const evaluationLabel =
    locale === 'en' ? 'What is assessed' : locale === 'kk' ? 'Не бағаланады' : 'Что оценивают';
  const documentsLabel =
    locale === 'en' ? 'Documents' : locale === 'kk' ? 'Құжаттар' : 'Документы';
  const commentLabel =
    locale === 'en' ? 'Comment' : locale === 'kk' ? 'Түсініктеме' : 'Комментарий';
  const acceptedLabel =
    locale === 'en' ? 'Who is accepted' : locale === 'kk' ? 'Кім қабылданады' : 'Кого принимают';
  const openApplicationLabel =
    locale === 'en' ? 'Open application link' : locale === 'kk' ? 'Өтініш сілтемесін ашу' : 'Открыть ссылку для подачи';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ {t('schoolDetail.back')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('schoolDetail.section.admission')}</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.schoolName}>{schoolName}</Text>
        <View style={styles.card}>
          {isStateSchool ? (
            <>
              <Text style={styles.cardTitle}>{fallbackRuleLabel}</Text>
              <View style={styles.metaPills}>
                {admissionChannels.map((item) => (
                  <View key={item} style={styles.metaPill}>
                    <Text style={styles.metaPillText}>{item}</Text>
                  </View>
                ))}
                {getLocalizedText(admissionDetails.document_deadlines, locale).trim() ? (
                  <View style={styles.metaPillSoft}>
                    <Text style={styles.metaPillSoftText}>
                      {getLocalizedText(admissionDetails.document_deadlines, locale).trim()}
                    </Text>
                  </View>
                ) : null}
              </View>
              {stateFlags.length ? <TagGroup label={acceptedLabel} items={stateFlags} /> : null}
              <StepTimeline label={stagesLabel} value={stages} />
              {splitToList(stateDocuments).length ? (
                <TagGroup label={documentsLabel} items={splitToList(stateDocuments)} />
              ) : (
                <DetailSection label={documentsLabel} value={stateDocuments} />
              )}
              <DetailSection label={commentLabel} value={stateComment} />
            </>
          ) : (
            admissionRules.map((rule, index) => {
              const title = formatRuleTitle(rule, locale, fallbackRuleLabel);
              const selectionTypes = [
                ...rule.assessmentTypes.map((item) => localizeStructuredOption(item, locale)),
                ...splitToList(getLocalizedText(rule.assessmentOther, locale)).map((item) =>
                  localizeStructuredOption(item, locale)
                ),
              ].filter(Boolean);
              const documentTypes = [
                ...rule.requiredDocuments.map((item) => localizeStructuredOption(item, locale)),
                ...splitToList(getLocalizedText(rule.documentsOther, locale)).map((item) =>
                  localizeStructuredOption(item, locale)
                ),
              ].filter(Boolean);
              const format =
                getLocalizedText(rule.formatOther, locale).trim() ||
                localizeStructuredOption(rule.format, locale);
              const steps = getLocalizedText(rule.stages, locale).trim();
              const requirements = getLocalizedText(rule.requirements, locale).trim();
              const evaluation = getLocalizedText(rule.evaluation, locale).trim();
              const note = getLocalizedText(rule.comment, locale).trim();

              return (
                <View key={rule.id || `rule-${index}`} style={styles.ruleCard}>
                  <View style={styles.ruleHeader}>
                    <Text style={styles.ruleTitle}>{title}</Text>
                    <View style={styles.ruleMeta}>
                      {format ? <Text style={styles.ruleMetaText}>{format}</Text> : null}
                      {rule.deadline ? <Text style={styles.ruleMetaText}>{rule.deadline}</Text> : null}
                    </View>
                  </View>
                  <View style={styles.ruleBody}>
                    {format || rule.deadline ? (
                      <View style={styles.sectionShell}>
                        <TagGroup
                          label={overviewLabel}
                          items={[format, rule.deadline].filter(Boolean)}
                        />
                      </View>
                    ) : null}
                    {selectionTypes.length ? (
                      <View style={styles.sectionShell}>
                        <TagGroup label={selectionTypesLabel} items={selectionTypes} />
                      </View>
                    ) : null}
                    {steps ? (
                      <View style={styles.sectionShell}>
                        <StepTimeline label={stagesLabel} value={steps} />
                      </View>
                    ) : null}
                    {requirements || evaluation ? (
                      <View style={styles.sectionShell}>
                        <DetailSection
                          label={evaluationLabel}
                          value={requirements || evaluation}
                        />
                      </View>
                    ) : null}
                    {documentTypes.length ? (
                      <View style={styles.sectionShell}>
                        <TagGroup label={documentsLabel} items={documentTypes} />
                      </View>
                    ) : null}
                    {note ? (
                      <View style={styles.noteBox}>
                        <Text style={styles.noteTitle}>{commentLabel}</Text>
                        <Text style={styles.noteText}>{note}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
          {admissionLink ? (
            <Pressable style={styles.linkButton} onPress={() => Linking.openURL(admissionLink).catch(() => {})}>
              <Text style={styles.linkButtonText}>{openApplicationLabel}</Text>
            </Pressable>
          ) : null}
          {!admissionChannels.length &&
          !admissionLink &&
          !getLocalizedText(admissionDetails.document_deadlines, locale) &&
          !stages &&
          !stateDocuments &&
          !stateComment &&
          !admissionRules.length &&
          !subjects.length ? (
            <Text style={styles.empty}>{t('schoolDetail.admission.empty')}</Text>
          ) : null}
        </View>
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
  scroll: { flex: 1 },
  content: { padding: 14, gap: 12 },
  schoolName: { fontFamily: 'exoSemibold', fontSize: 18, color: '#0F172A', paddingHorizontal: 4 },
  card: {
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.12)',
    padding: 16,
    gap: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  cardTitle: {
    fontFamily: 'exoSemibold',
    fontSize: 19,
    lineHeight: 24,
    color: '#0F172A',
  },
  metaPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#EEF2FF',
  },
  metaPillText: {
    fontFamily: 'exoSemibold',
    fontSize: 12,
    color: '#3730A3',
  },
  metaPillSoft: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
  },
  metaPillSoftText: {
    fontFamily: 'exoSemibold',
    fontSize: 12,
    color: '#475569',
  },
  ruleCard: {
    borderRadius: 18,
    backgroundColor: '#F8FAFF',
    padding: 14,
    gap: 12,
  },
  ruleHeader: { gap: 8 },
  ruleTitle: { fontFamily: 'exoSemibold', fontSize: 17, lineHeight: 22, color: '#0F172A' },
  ruleBody: { gap: 10 },
  ruleMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ruleMetaText: { fontFamily: 'exoSemibold', fontSize: 12, color: '#5B5BD6' },
  sectionShell: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 6,
  },
  sectionBlock: { gap: 8 },
  sectionTitle: { fontFamily: 'exoSemibold', fontSize: 12, color: '#64748B', textTransform: 'uppercase' },
  sectionText: { fontFamily: 'exo', fontSize: 14, lineHeight: 20, color: '#111827' },
  timeline: { gap: 12, paddingTop: 2 },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  timelineRail: {
    width: 26,
    alignItems: 'center',
  },
  timelineDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotText: {
    fontFamily: 'exoSemibold',
    fontSize: 12,
    color: '#1D4ED8',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 24,
    marginTop: 6,
    backgroundColor: '#DBEAFE',
  },
  timelineText: {
    flex: 1,
    fontFamily: 'exo',
    fontSize: 15,
    lineHeight: 22,
    color: '#111827',
    paddingTop: 1,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.18)',
  },
  tagText: { fontFamily: 'exoSemibold', fontSize: 13, color: '#3730A3' },
  noteBox: {
    borderRadius: 16,
    backgroundColor: '#FFF7ED',
    padding: 12,
    gap: 6,
  },
  noteTitle: {
    fontFamily: 'exoSemibold',
    fontSize: 12,
    color: '#9A3412',
    textTransform: 'uppercase',
  },
  noteText: {
    fontFamily: 'exo',
    fontSize: 14,
    lineHeight: 20,
    color: '#7C2D12',
  },
  row: { gap: 4 },
  label: { fontFamily: 'exo', fontSize: 11, color: '#6B7280' },
  value: { fontFamily: 'exoSemibold', fontSize: 15, color: '#111827' },
  linkButton: {
    marginTop: 4,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  linkButtonText: { fontFamily: 'exoSemibold', fontSize: 14, color: '#FFFFFF' },
  empty: { fontFamily: 'exo', fontSize: 14, color: '#64748B' },
});
