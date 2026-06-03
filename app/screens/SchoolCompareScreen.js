import React, { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeftIcon } from 'react-native-heroicons/solid';

const toText = (value) => {
  if (!value) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') return value.ru || value.en || '—';
  return String(value);
};

const splitCsv = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .join(', ') || '—';

const boolLabel = (value) => (value ? 'Да' : 'Нет');

export default function SchoolCompareScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const compareLimit = Number(route.params?.compareLimit) || 5;
  const schools = useMemo(
    () =>
      Array.isArray(route.params?.schools)
        ? route.params.schools.slice(0, compareLimit)
        : [],
    [route.params?.schools, compareLimit]
  );

  const rows = [
    { key: 'type', label: 'Тип', getValue: (s) => toText(s.type) },
    { key: 'city', label: 'Город', getValue: (s) => toText(s.city || s.region) },
    { key: 'district', label: 'Район', getValue: (s) => toText(s.district) },
    { key: 'address', label: 'Адрес', getValue: (s) => toText(s.address) },
    {
      key: 'price',
      label: 'Цена / мес',
      getValue: (s) => {
        const fee = Number(s.monthlyFee);
        return Number.isFinite(fee) && fee > 0
          ? `${Math.round(fee).toLocaleString('ru-RU')} ₸`
          : '—';
      },
    },
    { key: 'languages', label: 'Языки', getValue: (s) => splitCsv(s.languages) },
    { key: 'curricula', label: 'Программы', getValue: (s) => splitCsv(s.curricula) },
    {
      key: 'subjects',
      label: 'Углубл. предметы',
      getValue: (s) => splitCsv(s.advanced_subjects || s.education?.advanced_subjects),
    },
    {
      key: 'rating',
      label: 'Рейтинг',
      getValue: (s) => {
        const rating = Number(s.rating);
        return Number.isFinite(rating) ? rating.toFixed(1) : '—';
      },
    },
    {
      key: 'reviews',
      label: 'Отзывы',
      getValue: (s) => {
        const count = Number(s.reviewsCount);
        return Number.isFinite(count) ? String(count) : '—';
      },
    },
    {
      key: 'transport',
      label: 'Транспорт',
      getValue: (s) => boolLabel(Boolean(s.servicesFlags?.transport)),
    },
    {
      key: 'inclusive',
      label: 'Инклюзивность',
      getValue: (s) => boolLabel(Boolean(s.servicesFlags?.inclusive_education)),
    },
    {
      key: 'meals',
      label: 'Питание',
      getValue: (s) => toText(s.meals),
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#E9EEF6' }}>
      <LinearGradient
        colors={['#E9EEF6', '#E9EEF6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ flex: 1 }}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10 }}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={{
              width: 38,
              height: 38,
              borderRadius: 999,
              backgroundColor: '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: 'rgba(17,24,39,0.12)',
            }}
          >
            <ArrowLeftIcon color="#111827" size={18} />
          </Pressable>
          <Text
            style={{
              marginTop: 10,
              fontFamily: 'exoSemibold',
              fontSize: 28,
              color: '#111827',
            }}
          >
            Сравнение школ
          </Text>
        </View>

        {schools.length < 2 ? (
          <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
            <Text style={{ fontFamily: 'exo', color: '#475569', fontSize: 15 }}>
              Для сравнения выберите минимум 2 школы.
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
            showsHorizontalScrollIndicator={false}
          >
            <View style={{ minWidth: 880 }}>
              <View style={{ flexDirection: 'row', marginBottom: 10 }}>
                <View
                  style={{
                    width: 170,
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    borderTopLeftRadius: 16,
                    borderBottomLeftRadius: 16,
                    backgroundColor: '#E2E8F0',
                  }}
                >
                  <Text style={{ fontFamily: 'exoSemibold', color: '#334155' }}>Критерий</Text>
                </View>
                {schools.map((school, idx) => (
                  <View
                    key={`${school.school_id || school.id || idx}-head`}
                    style={{
                      width: 235,
                      paddingHorizontal: 12,
                      paddingVertical: 12,
                      borderRadius: 16,
                      marginLeft: 8,
                      backgroundColor: '#FFFFFF',
                      borderWidth: 1,
                      borderColor: 'rgba(37,99,235,0.22)',
                    }}
                  >
                    <Text
                      numberOfLines={2}
                      style={{ fontFamily: 'exoSemibold', color: '#0F172A', fontSize: 14 }}
                    >
                      {toText(school.name)}
                    </Text>
                  </View>
                ))}
              </View>

              {rows.map((row, rowIndex) => (
                <View key={row.key} style={{ flexDirection: 'row', marginBottom: 8 }}>
                  <View
                    style={{
                      width: 170,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderRadius: 12,
                      backgroundColor: rowIndex % 2 ? '#F8FAFC' : '#FFFFFF',
                      borderWidth: 1,
                      borderColor: 'rgba(148,163,184,0.2)',
                    }}
                  >
                    <Text style={{ fontFamily: 'exoSemibold', color: '#475569', fontSize: 12 }}>
                      {row.label}
                    </Text>
                  </View>
                  {schools.map((school, idx) => (
                    <View
                      key={`${school.school_id || school.id || idx}-${row.key}`}
                      style={{
                        width: 235,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: 12,
                        marginLeft: 8,
                        backgroundColor: rowIndex % 2 ? '#F8FAFC' : '#FFFFFF',
                        borderWidth: 1,
                        borderColor: 'rgba(148,163,184,0.2)',
                      }}
                    >
                      <Text style={{ fontFamily: 'exo', color: '#0F172A', fontSize: 13 }}>
                        {row.getValue(school)}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}
