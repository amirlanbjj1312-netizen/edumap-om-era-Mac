import React, { useMemo, useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSchools } from '../context/SchoolsContext';
import { useLocale } from '../context/LocaleContext';
import { getLocalizedText } from '../utils/localizedText';

const DetailRow = ({ label, value }) => {
  const normalizedValue = typeof value === 'object' ? value?.ru || value?.en || '' : String(value || '').trim();
  if (!normalizedValue) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{normalizedValue}</Text>
    </View>
  );
};

export default function SchoolPrideScreen() {
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

  const stories = Array.isArray(profile?.education?.results?.student_success_stories)
    ? profile.education.results.student_success_stories.filter(Boolean)
    : [];
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [schoolId]);

  const activeStory = stories[activeIndex] || null;
  const schoolName =
    getLocalizedText(profile?.basic_info?.display_name, locale) ||
    getLocalizedText(profile?.basic_info?.name, locale) ||
    '';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ {t('schoolDetail.back')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('schoolDetail.section.pride')}</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.schoolName}>{schoolName}</Text>
        {!stories.length ? (
          <Text style={styles.empty}>{t('schoolDetail.pride.empty')}</Text>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {stories.map((story, index) => {
                  const name =
                    getLocalizedText(story.student_name, locale) ||
                    `${t('schoolDetail.pride.graduate')} ${index + 1}`;
                  const active = index === activeIndex;
                  return (
                    <Pressable
                      key={`${name}-${index}`}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setActiveIndex(index)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
            {activeStory ? (
              <View style={styles.card}>
                <Text style={styles.personName}>
                  {getLocalizedText(activeStory.student_name, locale) || t('schoolDetail.pride.graduate')}
                </Text>
                <DetailRow label={t('schoolDetail.field.admittedTo')} value={getLocalizedText(activeStory.admitted_to, locale)} />
                <DetailRow label={t('schoolDetail.field.schoolGpa')} value={getLocalizedText(activeStory.school_average_score, locale)} />
                <DetailRow
                  label={t('schoolDetail.field.scores')}
                  value={[
                    activeStory.ent_score ? `ENT: ${activeStory.ent_score}` : '',
                    activeStory.ielts_score ? `IELTS: ${activeStory.ielts_score}` : '',
                    activeStory.sat_score ? `SAT: ${activeStory.sat_score}` : '',
                  ]
                    .filter(Boolean)
                    .join(' • ')}
                />
                <DetailRow label={t('schoolDetail.field.achievements')} value={getLocalizedText(activeStory.achievements, locale)} />
                <DetailRow label={t('schoolDetail.field.admissionDeadline')} value={getLocalizedText(activeStory.application_deadline, locale)} />
              </View>
            ) : null}
          </>
        )}
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
  empty: { fontFamily: 'exo', fontSize: 14, color: '#64748B' },
  chipRow: { flexDirection: 'row', gap: 8, paddingBottom: 2 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.2)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: '#EEF2FF', borderColor: '#4F46E5' },
  chipText: { fontFamily: 'exo', fontSize: 12, color: '#334155' },
  chipTextActive: { fontFamily: 'exoSemibold', color: '#3730A3' },
  card: {
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.18)',
    padding: 14,
    gap: 10,
  },
  personName: { fontFamily: 'exoSemibold', fontSize: 16, color: '#0F172A' },
  row: { gap: 4 },
  label: { fontFamily: 'exo', fontSize: 11, color: '#6B7280' },
  value: { fontFamily: 'exoSemibold', fontSize: 15, color: '#111827' },
});
