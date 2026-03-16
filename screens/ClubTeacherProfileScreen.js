import React, { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, View, Text, Pressable, StyleSheet, Image } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSchools } from '../context/SchoolsContext';
import { useLocale } from '../context/LocaleContext';
import { getLocalizedText } from '../utils/localizedText';

const teacherIdFromName = (name, fallback = '') =>
  String(name || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

export default function ClubTeacherProfileScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { profiles } = useSchools();
  const { locale } = useLocale();
  const schoolId = route.params?.schoolId;
  const teacherId = route.params?.teacherId;
  const teacherNameParam = route.params?.teacherName;

  const profile = useMemo(
    () =>
      profiles.find((item) => item?.school_id === schoolId) ||
      profiles.find((item) => getLocalizedText(item?.basic_info?.name, locale) === schoolId) ||
      null,
    [profiles, schoolId, locale]
  );
  const members = Array.isArray(profile?.services?.teaching_staff?.members)
    ? profile.services.teaching_staff.members
    : [];
  const teacher = useMemo(() => {
    const byId = members.find(
      (item) => teacherIdFromName(item?.id || item?.full_name, '') === teacherId
    );
    if (byId) return byId;
    return members.find((item) => item?.full_name === teacherNameParam) || null;
  }, [members, teacherId, teacherNameParam]);

  const fullName =
    String(teacher?.full_name || teacherNameParam || '').trim() ||
    (locale === 'ru' ? 'Преподаватель' : locale === 'kk' ? 'Оқытушы' : 'Teacher');
  const bio = getLocalizedText(teacher?.bio, locale);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ {locale === 'ru' ? 'Назад' : locale === 'kk' ? 'Артқа' : 'Back'}</Text>
        </Pressable>
        <Text style={styles.title}>{fullName}</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          {teacher?.photo_url ? (
            <Image source={{ uri: teacher.photo_url }} style={styles.photo} />
          ) : (
            <View style={[styles.photo, styles.photoFallback]}>
              <Text style={styles.photoFallbackText}>{fullName.slice(0, 1)}</Text>
            </View>
          )}
          <Text style={styles.name}>{fullName}</Text>
          {teacher?.position ? <Text style={styles.role}>{teacher.position}</Text> : null}
          {teacher?.subjects ? (
            <Text style={styles.line}>
              {locale === 'ru' ? 'Предметы' : 'Subjects'}: {teacher.subjects}
            </Text>
          ) : null}
          {teacher?.experience_years ? (
            <Text style={styles.line}>
              {locale === 'ru' ? 'Стаж' : locale === 'kk' ? 'Тәжірибе' : 'Experience'}: {teacher.experience_years}{' '}
              {locale === 'ru' ? 'лет' : locale === 'kk' ? 'жыл' : 'years'}
            </Text>
          ) : null}
          {teacher?.teaching_languages ? (
            <Text style={styles.line}>
              {locale === 'ru' ? 'Языки' : locale === 'kk' ? 'Тілдер' : 'Languages'}: {teacher.teaching_languages}
            </Text>
          ) : null}
          {teacher?.category ? (
            <Text style={styles.line}>
              {locale === 'ru' ? 'Категория' : locale === 'kk' ? 'Санат' : 'Category'}: {teacher.category}
            </Text>
          ) : null}
          {bio ? (
            <View style={styles.about}>
              <Text style={styles.aboutTitle}>
                {locale === 'ru' ? 'О преподавателе' : locale === 'kk' ? 'Оқытушы туралы' : 'About teacher'}
              </Text>
              <Text style={styles.aboutText}>{bio}</Text>
            </View>
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
  title: { color: '#FFFFFF', fontFamily: 'exoSemibold', fontSize: 18, flex: 1, textAlign: 'center' },
  scroll: { flex: 1 },
  content: { padding: 14 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.2)',
    backgroundColor: '#FFFFFF',
    padding: 14,
    alignItems: 'center',
  },
  photo: { width: 180, height: 180, borderRadius: 90, backgroundColor: '#E2E8F0' },
  photoFallback: { alignItems: 'center', justifyContent: 'center' },
  photoFallbackText: { fontFamily: 'exoSemibold', fontSize: 64, color: '#1D4ED8' },
  name: { marginTop: 14, fontFamily: 'exoSemibold', fontSize: 28, color: '#0F172A', textAlign: 'center' },
  role: { marginTop: 4, fontFamily: 'exo', fontSize: 15, color: '#64748B', textAlign: 'center' },
  line: { marginTop: 8, width: '100%', fontFamily: 'exo', fontSize: 14, color: '#334155' },
  about: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E2E8F0', width: '100%' },
  aboutTitle: { fontFamily: 'exoSemibold', fontSize: 14, color: '#0F172A' },
  aboutText: { marginTop: 6, fontFamily: 'exo', fontSize: 14, color: '#1E293B', lineHeight: 20 },
});
