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
  other: { ru: 'Другое', en: 'Other', kk: 'Басқа' },
  application_form: { ru: 'Заявление', en: 'Application form', kk: 'Өтініш' },
  transcript: { ru: 'Табель / выписка', en: 'Transcript', kk: 'Табель / көшірме' },
  recommendations: { ru: 'Рекомендации', en: 'Recommendations', kk: 'Ұсынымдар' },
  medical_certificate: { ru: 'Медсправка', en: 'Medical certificate', kk: 'Меданықтама' },
  birth_certificate: { ru: 'Свидетельство о рождении', en: 'Birth certificate', kk: 'Туу туралы куәлік' },
  parent_id: { ru: 'Документ родителя', en: 'Parent ID', kk: 'Ата-ана құжаты' },
};

const localizeStructuredOption = (value, locale) => {
  const normalized = String(value || '').trim().toLowerCase();
  const item = OPTION_I18N[normalized];
  if (item) return item[locale] || item.ru;
  return String(value || '').trim();
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
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{label}</Text>
      <Text style={styles.sectionText}>{text}</Text>
    </View>
  );
};

const TagGroup = ({ label, items }) => {
  if (!Array.isArray(items) || !items.length) return null;
  return (
    <View style={styles.section}>
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
              <DetailRow label={t('schoolDetail.field.applicationChannel')} value={admissionChannels} />
              <DetailRow label={t('schoolDetail.field.admissionDeadline')} value={getLocalizedText(admissionDetails.document_deadlines, locale)} />
              <TagGroup
                label={locale === 'en' ? 'Who is accepted' : locale === 'kk' ? 'Кім қабылданады' : 'Кого принимают'}
                items={stateFlags}
              />
              <DetailSection label={t('schoolDetail.field.documents')} value={stateDocuments} />
              <DetailSection label={t('schoolDetail.field.parentComment')} value={stateComment} />
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
              const documents = getLocalizedText(rule.documents, locale).trim();
              const evaluation = getLocalizedText(rule.evaluation, locale).trim();
              const note = getLocalizedText(rule.comment, locale).trim();

              return (
                <View key={rule.id || `rule-${index}`} style={styles.ruleCard}>
                  <Text style={styles.ruleTitle}>{title}</Text>
                  <View style={styles.ruleMeta}>
                    {format ? <Text style={styles.ruleMetaText}>{format}</Text> : null}
                    {rule.deadline ? <Text style={styles.ruleMetaText}>{rule.deadline}</Text> : null}
                  </View>
                  <TagGroup
                    label={locale === 'en' ? 'Selection types' : locale === 'kk' ? 'Іріктеу түрлері' : 'Типы отбора'}
                    items={selectionTypes}
                  />
                  <DetailSection
                    label={locale === 'en' ? 'What to complete' : locale === 'kk' ? 'Не өту керек' : 'Что нужно пройти'}
                    value={steps}
                  />
                  <DetailSection
                    label={locale === 'en' ? 'What is assessed' : locale === 'kk' ? 'Не бағаланады' : 'Что оценивают'}
                    value={requirements || evaluation}
                  />
                  <TagGroup
                    label={locale === 'en' ? 'Documents' : locale === 'kk' ? 'Құжаттар' : 'Документы'}
                    items={documentTypes}
                  />
                  <DetailSection
                    label={locale === 'en' ? 'What to submit' : locale === 'kk' ? 'Не тапсыру керек' : 'Что нужно предоставить'}
                    value={documents}
                  />
                  <DetailSection
                    label={locale === 'en' ? 'Comment' : locale === 'kk' ? 'Түсініктеме' : 'Комментарий'}
                    value={note}
                  />
                </View>
              );
            })
          )}
          {admissionLink ? (
            <Pressable style={styles.linkButton} onPress={() => Linking.openURL(admissionLink).catch(() => {})}>
              <Text style={styles.linkButtonText}>{t('schoolDetail.field.applicationLink')}</Text>
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
  schoolName: { fontFamily: 'exoSemibold', fontSize: 18, color: '#0F172A' },
  card: {
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.18)',
    padding: 14,
    gap: 10,
  },
  ruleCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.16)',
    backgroundColor: '#F8FAFF',
    padding: 12,
    gap: 10,
  },
  ruleTitle: { fontFamily: 'exoSemibold', fontSize: 16, color: '#0F172A' },
  ruleMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ruleMetaText: { fontFamily: 'exoSemibold', fontSize: 12, color: '#5B5BD6' },
  section: { gap: 6 },
  sectionTitle: { fontFamily: 'exoSemibold', fontSize: 12, color: '#64748B' },
  sectionText: { fontFamily: 'exo', fontSize: 14, lineHeight: 20, color: '#111827' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.18)',
  },
  tagText: { fontFamily: 'exoSemibold', fontSize: 12, color: '#3730A3' },
  row: { gap: 4 },
  label: { fontFamily: 'exo', fontSize: 11, color: '#6B7280' },
  value: { fontFamily: 'exoSemibold', fontSize: 15, color: '#111827' },
  linkButton: {
    marginTop: 6,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.2)',
  },
  linkButtonText: { fontFamily: 'exoSemibold', fontSize: 14, color: '#3730A3' },
  empty: { fontFamily: 'exo', fontSize: 14, color: '#64748B' },
});
