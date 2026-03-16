import React, { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSchools } from '../context/SchoolsContext';
import { useLocale } from '../context/LocaleContext';
import { getLocalizedText } from '../utils/localizedText';
import { mapUnifiedToDisplay } from '../utils/clubsSchedule';

const formatClubPrice = (value, locale) => {
  const raw = String(value || '').trim();
  if (!raw) return locale === 'ru' ? 'По запросу' : locale === 'kk' ? 'Сұраныс бойынша' : 'On request';
  const numeric = Number(raw.replace(/\s+/g, '').replace(',', '.'));
  if (!Number.isFinite(numeric)) return raw;
  return `${numeric.toLocaleString('ru-RU')} ₸`;
};

export default function SchoolClubsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { profiles } = useSchools();
  const { locale } = useLocale();
  const schoolId = route.params?.schoolId;

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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ {locale === 'ru' ? 'Назад' : locale === 'kk' ? 'Артқа' : 'Back'}</Text>
        </Pressable>
        <Text style={styles.title}>
          {locale === 'ru' ? 'Кружки и секции' : locale === 'kk' ? 'Үйірмелер мен секциялар' : 'Clubs and sections'}
        </Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {!clubsCatalog.length ? (
          <Text style={styles.empty}>
            {locale === 'ru'
              ? 'Школа пока не добавила кружки.'
              : locale === 'kk'
                ? 'Мектеп әлі үйірмелерді қоспады.'
              : 'School has not added clubs yet.'}
          </Text>
        ) : null}
        {clubsCatalog.map((club) => (
          <Pressable
            key={club.id}
            style={styles.card}
            onPress={() =>
              navigation.navigate('SchoolClubDetail', {
                schoolId: profile?.school_id || schoolId,
                clubId: club.id,
              })
            }
          >
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>{club.name}</Text>
              <Text style={styles.chevron}>›</Text>
            </View>
            {club.schedule ? <Text style={styles.meta}>{club.schedule}</Text> : null}
            {club.teacherName ? <Text style={styles.meta}>{club.teacherName}</Text> : null}
            {club.grades ? <Text style={styles.meta}>{club.grades}</Text> : null}
            <Text style={styles.price}>{club.priceLabel}</Text>
          </Pressable>
        ))}
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
  content: { padding: 14, gap: 10 },
  empty: { color: '#64748B', fontFamily: 'exo', fontSize: 14 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.2)',
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 6,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontFamily: 'exoSemibold', fontSize: 16, color: '#0F172A', flex: 1, paddingRight: 8 },
  chevron: { fontFamily: 'exoSemibold', color: '#64748B', fontSize: 18 },
  meta: { fontFamily: 'exo', fontSize: 13, color: '#475569' },
  price: { fontFamily: 'exoSemibold', fontSize: 13, color: '#1D4ED8' },
});
