import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSchools } from '../context/SchoolsContext';
import { useLocale } from '../context/LocaleContext';
import { getLocalizedText } from '../utils/localizedText';
import { mapUnifiedToDisplay, WEEKDAY_ORDER, getWeekdayLabel } from '../utils/clubsSchedule';

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
  const [selectedDay, setSelectedDay] = useState('Monday');

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
      scheduleSlots: Array.isArray(club.scheduleSlots) ? club.scheduleSlots : [],
      teacherName: club.teacherName,
      grades: club.grades,
      priceLabel: formatClubPrice(club.priceMonthly, locale),
      durationMinutes: club.durationMinutes,
      location: club.location,
    }));
  }, [profile, locale]);

  const availableDays = useMemo(() => {
    const used = new Set();
    clubsCatalog.forEach((club) => {
      club.scheduleSlots.forEach((slot) => {
        (slot.days || []).forEach((day) => used.add(day));
      });
    });
    return WEEKDAY_ORDER.filter((day) => used.has(day));
  }, [clubsCatalog]);

  useEffect(() => {
    if (!availableDays.length) {
      setSelectedDay('Monday');
      return;
    }
    if (!availableDays.includes(selectedDay)) {
      setSelectedDay(availableDays[0]);
    }
  }, [availableDays, selectedDay]);

  const daySchedule = useMemo(() => {
    return clubsCatalog
      .flatMap((club) =>
        club.scheduleSlots
          .filter((slot) => (slot.days || []).includes(selectedDay))
          .map((slot) => ({
            id: `${club.id}-${selectedDay}-${slot.start || 'na'}-${slot.end || 'na'}`,
            club,
            start: slot.start || '',
            end: slot.end || '',
          }))
      )
      .sort((a, b) => (a.start || '99:99').localeCompare(b.start || '99:99'));
  }, [clubsCatalog, selectedDay]);

  const unscheduledClubs = useMemo(
    () => clubsCatalog.filter((club) => !club.scheduleSlots.length),
    [clubsCatalog]
  );

  const dayEmptyText =
    locale === 'ru'
      ? 'На этот день занятий нет.'
      : locale === 'kk'
        ? 'Бұл күнге үйірмелер жоқ.'
        : 'No classes scheduled for this day.';
  const scheduleTitle =
    locale === 'ru'
      ? 'Расписание по дням'
      : locale === 'kk'
        ? 'Күндер бойынша кесте'
        : 'Weekly schedule';
  const unscheduledTitle =
    locale === 'ru'
      ? 'Другие кружки'
      : locale === 'kk'
        ? 'Басқа үйірмелер'
        : 'Other clubs';
  const durationLabel = (value) => {
    if (!value) return '';
    return locale === 'ru'
      ? `${value} мин`
      : locale === 'kk'
        ? `${value} мин`
        : `${value} min`;
  };

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
        {clubsCatalog.length ? (
          <View style={styles.scheduleCard}>
            <Text style={styles.sectionTitle}>{scheduleTitle}</Text>
            {availableDays.length ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.daysRow}
              >
                {availableDays.map((day) => {
                  const active = day === selectedDay;
                  return (
                    <Pressable
                      key={day}
                      style={[styles.dayChip, active && styles.dayChipActive]}
                      onPress={() => setSelectedDay(day)}
                    >
                      <Text style={[styles.dayChipShort, active && styles.dayChipTextActive]}>
                        {getWeekdayLabel(day, locale, 'short')}
                      </Text>
                      <Text style={[styles.dayChipLong, active && styles.dayChipTextActive]}>
                        {getWeekdayLabel(day, locale, 'long')}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

            {daySchedule.length ? (
              daySchedule.map(({ id, club, start, end }) => (
                <Pressable
                  key={id}
                  style={styles.timelineCard}
                  onPress={() =>
                    navigation.navigate('SchoolClubDetail', {
                      schoolId: profile?.school_id || schoolId,
                      clubId: club.id,
                    })
                  }
                >
                  <View style={styles.timeCol}>
                    <Text style={styles.timeStart}>{start || '—'}</Text>
                    <Text style={styles.timeMeta}>
                      {durationLabel(club.durationMinutes) || (end ? `${start}-${end}` : '')}
                    </Text>
                  </View>
                  <View style={styles.timelineDivider} />
                  <View style={styles.timelineBody}>
                    <View style={styles.cardHead}>
                      <Text style={styles.cardTitle}>{club.name}</Text>
                      <Text style={styles.chevron}>›</Text>
                    </View>
                    {club.location ? <Text style={styles.meta}>{club.location}</Text> : null}
                    {club.teacherName ? <Text style={styles.meta}>{club.teacherName}</Text> : null}
                    {club.grades ? <Text style={styles.meta}>{club.grades}</Text> : null}
                    <Text style={styles.price}>{club.priceLabel}</Text>
                  </View>
                </Pressable>
              ))
            ) : (
              <Text style={styles.empty}>{dayEmptyText}</Text>
            )}
          </View>
        ) : null}

        {unscheduledClubs.length ? (
          <View style={styles.unscheduledBlock}>
            <Text style={styles.sectionTitle}>{unscheduledTitle}</Text>
            {unscheduledClubs.map((club) => (
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
          </View>
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
  scroll: { flex: 1 },
  content: { padding: 14, gap: 10 },
  empty: { color: '#64748B', fontFamily: 'exo', fontSize: 14 },
  sectionTitle: { fontFamily: 'exoSemibold', fontSize: 18, color: '#0F172A' },
  scheduleCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.18)',
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 14,
  },
  daysRow: { gap: 10, paddingRight: 8 },
  dayChip: {
    minWidth: 86,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    alignItems: 'center',
    gap: 2,
  },
  dayChipActive: {
    backgroundColor: '#DBEAFE',
    borderColor: '#93C5FD',
  },
  dayChipShort: { fontFamily: 'exoSemibold', fontSize: 12, color: '#1E293B' },
  dayChipLong: { fontFamily: 'exo', fontSize: 11, color: '#64748B' },
  dayChipTextActive: { color: '#1D4ED8' },
  timelineCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 18,
    backgroundColor: '#F8FAFF',
    padding: 12,
    gap: 12,
  },
  timeCol: {
    width: 58,
    alignItems: 'flex-start',
    paddingTop: 2,
  },
  timeStart: { fontFamily: 'exoSemibold', fontSize: 17, color: '#0F172A' },
  timeMeta: { marginTop: 4, fontFamily: 'exo', fontSize: 12, color: '#64748B' },
  timelineDivider: {
    width: 3,
    borderRadius: 999,
    backgroundColor: '#93C5FD',
  },
  timelineBody: {
    flex: 1,
    gap: 4,
  },
  unscheduledBlock: { marginTop: 8, gap: 10 },
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
