import React, { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSchools } from '../context/SchoolsContext';
import { useLocale } from '../context/LocaleContext';
import { getLocalizedText } from '../utils/localizedText';
import { mapUnifiedToDisplay } from '../utils/clubsSchedule';

const teacherIdFromName = (name, fallback = '') =>
  String(name || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const formatClubPrice = (value, locale) => {
  const raw = String(value || '').trim();
  if (!raw) return locale === 'ru' ? 'По запросу' : 'On request';
  const numeric = Number(raw.replace(/\s+/g, '').replace(',', '.'));
  if (!Number.isFinite(numeric)) return raw;
  return `${numeric.toLocaleString('ru-RU')} ₸`;
};

export default function SchoolClubDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { profiles } = useSchools();
  const { locale } = useLocale();

  const schoolId = route.params?.schoolId;
  const clubId = route.params?.clubId;
  const profile = useMemo(
    () =>
      profiles.find((item) => item?.school_id === schoolId) ||
      profiles.find((item) => getLocalizedText(item?.basic_info?.name, locale) === schoolId) ||
      null,
    [profiles, schoolId, locale]
  );

  const clubsCatalog = useMemo(() => {
    const raw = mapUnifiedToDisplay(profile?.services, locale);
    return raw.map((club, index) => ({
      id: club.id || `club-${index}`,
      name: club.name || (locale === 'ru' ? 'Кружок' : 'Club'),
      description: club.description,
      schedule: club.schedule,
      teacherName: club.teacherName,
      grades: club.grades,
      priceLabel: formatClubPrice(club.priceMonthly, locale),
    }));
  }, [profile, locale]);

  const club = clubsCatalog.find((item) => item.id === clubId) || null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ {locale === 'ru' ? 'Назад' : locale === 'kk' ? 'Артқа' : 'Back'}</Text>
        </Pressable>
        <Text style={styles.title}>{club?.name || (locale === 'ru' ? 'Кружок' : 'Club')}</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {!club ? (
          <Text style={styles.empty}>
            {locale === 'ru' ? 'Кружок не найден.' : 'Club not found.'}
          </Text>
        ) : (
          <View style={styles.card}>
            {club.schedule ? <Text style={styles.meta}>{club.schedule}</Text> : null}
            {club.grades ? (
              <Text style={styles.meta}>
                {locale === 'ru' ? 'Классы' : 'Classes'}: {club.grades}
              </Text>
            ) : null}
            <Text style={styles.meta}>
              {locale === 'ru' ? 'Цена' : 'Price'}: {club.priceLabel}
            </Text>
            {club.description ? (
              <View style={styles.about}>
                <Text style={styles.aboutTitle}>{locale === 'ru' ? 'Описание' : 'Description'}</Text>
                <Text style={styles.aboutText}>{club.description}</Text>
              </View>
            ) : null}
            {club.teacherName ? (
              <Pressable
                style={styles.teacherButton}
                onPress={() =>
                  navigation.navigate('ClubTeacherProfile', {
                    schoolId: profile?.school_id || schoolId,
                    teacherId: teacherIdFromName(club.teacherName, clubId),
                    teacherName: club.teacherName,
                  })
                }
              >
                <Text style={styles.teacherButtonText}>
                  {locale === 'ru'
                    ? `Преподаватель: ${club.teacherName}`
                    : `Teacher: ${club.teacherName}`}
                </Text>
              </Pressable>
            ) : null}
          </View>
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
  title: { color: '#FFFFFF', fontFamily: 'exoSemibold', fontSize: 18, flex: 1, textAlign: 'center' },
  scroll: { flex: 1 },
  content: { padding: 14 },
  empty: { color: '#64748B', fontFamily: 'exo', fontSize: 14 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.2)',
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 8,
  },
  meta: { fontFamily: 'exo', fontSize: 14, color: '#334155' },
  about: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  aboutTitle: { fontFamily: 'exoSemibold', fontSize: 14, color: '#0F172A' },
  aboutText: { marginTop: 6, fontFamily: 'exo', fontSize: 14, color: '#1E293B', lineHeight: 20 },
  teacherButton: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8FAFF',
  },
  teacherButtonText: { fontFamily: 'exoSemibold', fontSize: 14, color: '#1D4ED8' },
});
