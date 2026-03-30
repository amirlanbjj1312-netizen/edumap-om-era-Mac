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
          <DetailRow label={t('schoolDetail.field.applicationChannel')} value={admissionChannels} />
          <DetailRow label={t('schoolDetail.field.admissionDeadline')} value={getLocalizedText(admissionDetails.document_deadlines, locale)} />
          <DetailRow label={t('schoolDetail.field.admissionStages')} value={stages} />
          <DetailRow label={t('schoolDetail.field.documents')} value={getLocalizedText(admissionDetails.documents_detail, locale)} />
          <DetailRow label={t('schoolDetail.field.parentComment')} value={getLocalizedText(admissionDetails.parent_comment, locale)} />
          <DetailRow
            label={t('schoolDetail.field.entranceExam')}
            value={
              entranceExam.required
                ? getLocalizedText(entranceExam.format, locale) ||
                  getLocalizedText(entranceExam.format_other, locale) ||
                  t('schoolDetail.value.yes')
                : ''
            }
          />
          <DetailRow label={t('schoolDetail.field.admissionSubjects')} value={subjects} />
          {admissionLink ? (
            <Pressable style={styles.linkButton} onPress={() => Linking.openURL(admissionLink).catch(() => {})}>
              <Text style={styles.linkButtonText}>{t('schoolDetail.field.applicationLink')}</Text>
            </Pressable>
          ) : null}
          {!admissionChannels.length &&
          !admissionLink &&
          !getLocalizedText(admissionDetails.document_deadlines, locale) &&
          !stages &&
          !getLocalizedText(admissionDetails.documents_detail, locale) &&
          !getLocalizedText(admissionDetails.parent_comment, locale) ? (
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
