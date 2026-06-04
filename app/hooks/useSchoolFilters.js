import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View, PanResponder, StyleSheet } from 'react-native';
import { XMarkIcon } from 'react-native-heroicons/solid';
import { AdjustmentsHorizontalIcon } from 'react-native-heroicons/solid';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocale } from '../context/LocaleContext';
import { useRole } from '../context/RoleContext';

const CITY_L = { Almaty: 'schools.city.almaty', Astana: 'schools.city.astana', Karaganda: 'schools.city.karaganda' };
const TYPE_L = { State: 'schools.type.state', Private: 'schools.type.private', International: 'schools.type.international' };
const LANG_L = { English: 'schools.language.english', Russian: 'schools.language.russian', Kazakh: 'schools.language.kazakh' };
const SVC_L = { after_school: 'schools.service.after_school', transport: 'schools.service.transport', inclusive_education: 'schools.service.inclusive_education', security: 'schools.service.security', cameras: 'schools.service.cameras', access_control: 'schools.service.access_control', medical_office: 'schools.service.medical_office' };
const MEAL_L = { Free: 'schools.meals.free', Paid: 'schools.meals.paid', 'No meals': 'schools.meals.none' };
const SPEC_L = { Psychologist: 'schools.specialist.psychologist', 'Speech therapist': 'schools.specialist.speech_therapist', 'Social worker': 'schools.specialist.social_worker', Tutor: 'schools.specialist.tutor', 'Special education teacher': 'schools.specialist.special_education_teacher', Nurse: 'schools.specialist.nurse', Defectologist: 'schools.specialist.defectologist' };
const SUBJ_L = { Mathematics: 'schools.subject.mathematics', Physics: 'schools.subject.physics', Chemistry: 'schools.subject.chemistry', Biology: 'schools.subject.biology', 'Computer Science': 'schools.subject.computer_science', Robotics: 'schools.subject.robotics', Engineering: 'schools.subject.engineering', 'Artificial Intelligence': 'schools.subject.artificial_intelligence', 'Data Science': 'schools.subject.data_science', Economics: 'schools.subject.economics', Business: 'schools.subject.business', Entrepreneurship: 'schools.subject.entrepreneurship', 'English Language': 'schools.subject.english_language', 'World History': 'schools.subject.world_history', Geography: 'schools.subject.geography', 'Design & Technology': 'schools.subject.design_technology', 'Art & Design': 'schools.subject.art_design', Music: 'schools.subject.music', 'Media Studies': 'schools.subject.media_studies', Psychology: 'schools.subject.psychology' };
import { splitToList } from '../utils/coordinates';
import * as Location from 'expo-location';

export const CITY_OPTIONS = [
  {
    name: 'Almaty',
    areas: ['Almaly', 'Auezov', 'Bostandyk', 'Zhetysu', 'Medeu', 'Nauryzbay'],
  },
  {
    name: 'Astana',
    areas: ['Almaty district', 'Baikonur', 'Yesil', 'Saryarka', 'Nura'],
  },
  {
    name: 'Karaganda',
    areas: ['City', 'Maikudyk', 'South-East', 'Prishakhtinsk', 'Sortirovka'],
  },
];
const CITY_KEYWORDS = {
  Almaty: ['almaty', 'алматы', 'алмата'],
  Astana: ['astana', 'астана', 'nursultan', 'nur-sultan', 'нурсултан', 'нур султан'],
  Karaganda: ['karaganda', 'караг', 'караганда'],
};
export const TYPE_OPTIONS = ['State', 'Private', 'International'];
export const TYPE_KEYWORDS = {
  state: ['state', 'public', 'государ', 'гос'],
  private: ['private', 'частн'],
  international: ['international', 'междунар'],
};
export const LANGUAGE_OPTIONS = ['English', 'Russian', 'Kazakh'];
export const LANGUAGE_KEYWORDS = {
  english: ['english', 'англ'],
  russian: ['russian', 'рус'],
  kazakh: ['kazakh', 'қаз', 'каз'],
};
export const SERVICE_FLAGS = [
  { key: 'after_school', label: 'After-school' },
  { key: 'transport', label: 'Transport' },
  { key: 'inclusive_education', label: 'Inclusive education' },
  { key: 'security', label: 'Security' },
  { key: 'cameras', label: 'CCTV' },
  { key: 'access_control', label: 'Access control' },
  { key: 'medical_office', label: 'Medical office' },
];
export const MEAL_OPTIONS = ['Free', 'Paid', 'No meals'];
export const CURRICULA_OPTIONS = [
  'State program (Kazakhstan)',
  'Updated content',
  'NIS Integrated Program',
  'Cambridge Primary',
  'Cambridge Lower Secondary',
  'Cambridge IGCSE',
  'Cambridge A-Level',
  'IB PYP',
  'STEAM',
  'STEM',
  'Montessori',
  'Waldorf',
  'American Curriculum',
  'British National Curriculum',
  'Bilingual Program',
  'Author program',
];
export const SUBJECT_OPTIONS = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'Computer Science',
  'Robotics',
  'Engineering',
  'Artificial Intelligence',
  'Data Science',
  'Economics',
  'Business',
  'Entrepreneurship',
  'English Language',
  'World History',
  'Geography',
  'Design & Technology',
  'Art & Design',
  'Music',
  'Media Studies',
  'Psychology',
];
export const SPECIALISTS_OPTIONS = [
  'Psychologist',
  'Speech therapist',
  'Social worker',
  'Tutor',
  'Special education teacher',
  'Nurse',
  'Defectologist',
];
export const ACCREDITATION_OPTIONS = ['License', 'Certificates'];
export const RATING_OPTIONS = [4.5, 4, 3];
export const PRICE_MIN = 0;
export const PRICE_MAX = 400000;
export const PRICE_HISTOGRAM = [12, 28, 35, 30, 22, 18, 10, 8, 14, 20, 16, 12, 9, 6, 4, 3, 2];

const earthRadiusKm = 6371;
const toRad = (deg) => (deg * Math.PI) / 180;
const calcDistanceKm = (a, b) => {
  if (!a || !b) return Infinity;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return earthRadiusKm * c;
};

const createDefaultFilters = () => ({
  selectedCities: [],
  selectedCityAreas: {},
  selectedTypes: [],
  selectedLanguages: [],
  selectedCurricula: [],
  selectedSpecialists: [],
  selectedServices: [],
  selectedMeals: [],
  selectedMinRating: null,
  selectedLicenses: [],
  selectedExam: null, // 'Yes' | 'No' | null
  selectedSubjects: [],
  minClassSize: 0,
  minClubs: 0,
  priceRange: [PRICE_MIN, PRICE_MAX],
  useNearby: false,
  radiusKm: 5,
  userLocation: null,
});

export const useSchoolFilters = ({ schoolCards, singleCity = false }) => {
  const { isGuest } = useRole();
  const [draft, setDraft] = useState(createDefaultFilters());
  const [applied, setApplied] = useState(createDefaultFilters());
  const [sliderWidth, setSliderWidth] = useState(0);
  const startMinRef = useRef(PRICE_MIN);
  const startMaxRef = useRef(PRICE_MAX);
  const [locationError, setLocationError] = useState(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const {
    selectedCities,
    selectedCityAreas,
    selectedTypes,
    selectedLanguages,
    selectedCurricula,
    selectedSpecialists,
    selectedServices,
    selectedMeals,
    selectedMinRating,
    selectedLicenses,
    selectedExam,
    selectedSubjects,
    minClassSize,
    minClubs,
    priceRange,
    useNearby,
    radiusKm,
    userLocation,
  } = draft;

  const appliedFilters = applied;

  const activeAreasDraft = useMemo(
    () =>
      selectedCities.flatMap((city) => selectedCityAreas[city] ?? []),
    [selectedCities, selectedCityAreas]
  );
  const activeAreasApplied = useMemo(
    () =>
      appliedFilters.selectedCities.flatMap((city) => appliedFilters.selectedCityAreas[city] ?? []),
    [appliedFilters.selectedCities, appliedFilters.selectedCityAreas]
  );

  const isFilterActive =
    appliedFilters.selectedCities.length > 0 ||
    activeAreasApplied.length > 0 ||
    appliedFilters.selectedTypes.length > 0 ||
    appliedFilters.selectedLanguages.length > 0 ||
    appliedFilters.selectedCurricula.length > 0 ||
    appliedFilters.selectedSubjects.length > 0 ||
    appliedFilters.selectedSpecialists.length > 0 ||
    appliedFilters.selectedServices.length > 0 ||
    appliedFilters.selectedMeals.length > 0 ||
    appliedFilters.selectedMinRating !== null ||
    appliedFilters.selectedLicenses.length > 0 ||
    appliedFilters.selectedExam !== null ||
    appliedFilters.minClubs > 0 ||
    appliedFilters.priceRange[0] !== PRICE_MIN ||
    appliedFilters.priceRange[1] !== PRICE_MAX;

  const isPrivateSelectedDraft = selectedTypes.includes('Private');
  const isPrivateSelectedApplied = appliedFilters.selectedTypes.includes('Private');

  const handleCityToggle = (city) => {
    setDraft((prev) => {
      let selectedCities;
      if (singleCity) {
        selectedCities = prev.selectedCities.includes(city) ? [] : [city];
      } else {
        selectedCities = prev.selectedCities.includes(city)
          ? prev.selectedCities.filter((item) => item !== city)
          : [...prev.selectedCities, city];
      }
      const selectedCityAreas = { ...prev.selectedCityAreas };
      Object.keys(selectedCityAreas).forEach((key) => {
        if (!selectedCities.includes(key)) {
          delete selectedCityAreas[key];
        }
      });
      return { ...prev, selectedCities, selectedCityAreas };
    });
  };

  const handleAreaToggle = (city, area) => {
    setDraft((prev) => {
      const current = prev.selectedCityAreas[city] ?? [];
      const nextAreas = current.includes(area)
        ? current.filter((item) => item !== area)
        : [...current, area];
      const selectedCityAreas = { ...prev.selectedCityAreas };
      if (nextAreas.length) {
        selectedCityAreas[city] = nextAreas;
      } else {
        delete selectedCityAreas[city];
      }
      return { ...prev, selectedCityAreas };
    });
  };

  const handleTypeToggle = (type) => {
    setDraft((prev) => ({
      ...prev,
      selectedTypes: prev.selectedTypes.includes(type)
        ? prev.selectedTypes.filter((item) => item !== type)
        : [...prev.selectedTypes, type],
    }));
  };

  const handleLanguageToggle = (language) => {
    setDraft((prev) => ({
      ...prev,
      selectedLanguages: prev.selectedLanguages.includes(language)
        ? prev.selectedLanguages.filter((item) => item !== language)
        : [...prev.selectedLanguages, language],
    }));
  };

  const handleRatingSelect = (value) => {
    setDraft((prev) => ({
      ...prev,
      selectedMinRating: prev.selectedMinRating === value ? null : value,
    }));
  };

  const handleLicenseToggle = (value) => {
    setDraft((prev) => ({
      ...prev,
      selectedLicenses: prev.selectedLicenses.includes(value)
        ? prev.selectedLicenses.filter((item) => item !== value)
        : [...prev.selectedLicenses, value],
    }));
  };

  const clampPrice = (value) => Math.min(PRICE_MAX, Math.max(PRICE_MIN, value));
  const effectiveSliderWidth = Math.max(sliderWidth, 1);

  const panResponderMin = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        startMinRef.current = priceRange[0];
      },
      onPanResponderMove: (_, gesture) => {
        if (!sliderWidth) return;
        const ratio = gesture.dx / sliderWidth;
        const delta = ratio * (PRICE_MAX - PRICE_MIN);
    setDraft((prev) => {
      const nextMin = clampPrice(startMinRef.current + delta);
      const boundedMin = Math.min(nextMin, prev.priceRange[1]);
      return { ...prev, priceRange: [boundedMin, prev.priceRange[1]] };
    });
  },
  onPanResponderRelease: () => {
    startMinRef.current = priceRange[0];
  },
})
).current;

  const panResponderMax = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        startMaxRef.current = priceRange[1];
      },
      onPanResponderMove: (_, gesture) => {
        if (!sliderWidth) return;
        const ratio = gesture.dx / sliderWidth;
        const delta = ratio * (PRICE_MAX - PRICE_MIN);
    setDraft((prev) => {
      const nextMax = clampPrice(startMaxRef.current + delta);
      const boundedMax = Math.max(nextMax, prev.priceRange[0]);
      return { ...prev, priceRange: [prev.priceRange[0], boundedMax] };
    });
  },
  onPanResponderRelease: () => {
    startMaxRef.current = priceRange[1];
  },
})
).current;

  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location access was not granted');
        setDraft((prev) => ({ ...prev, useNearby: false }));
        return false;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setDraft((prev) => ({
        ...prev,
        userLocation: {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        },
      }));
      setLocationError(null);
      return true;
    } catch (error) {
      setLocationError('Unable to get location');
      setDraft((prev) => ({ ...prev, useNearby: false }));
      return false;
    }
  };

  const filteredSchools = useMemo(() => {
    const {
      selectedCities: aCities,
      selectedCityAreas: aAreas,
      selectedTypes: aTypes,
      selectedLanguages: aLangs,
      selectedCurricula: aCurricula,
      selectedSubjects: aSubjects,
      selectedSpecialists: aSpecialists,
      selectedServices: aServices,
      selectedMeals: aMeals,
      selectedMinRating: aMinRating,
      selectedLicenses: aLicenses,
      selectedExam: aExam,
      minClubs: aMinClubs,
      priceRange: aPrice,
    } = appliedFilters;
    const activeAreas = aCities.flatMap((city) => aAreas[city] ?? []);

    return schoolCards.filter((school) => {
      const matchesQuery = true; // query handled at parent level if needed
      const matchesCity = aCities.length
        ? aCities.some((city) => {
            const loweredKeywords = (CITY_KEYWORDS[city] || [city]).map((c) =>
              c.toLowerCase()
            );
            const fields = [school.city, school.address].filter(Boolean);
            return fields.some((value) => {
              const hay = value.toLowerCase();
              return loweredKeywords.some((kw) => hay.includes(kw));
            });
          })
        : true;
      const matchesArea = activeAreas.length
        ? activeAreas.some((area) => {
            const lowered = area.toLowerCase();
            return [school.address, school.region]
              .filter(Boolean)
              .some((value) => value.toLowerCase().includes(lowered));
          })
        : true;
      const typeValue = (school.type || '').toLowerCase();
      const matchesType = aTypes.length
        ? aTypes.some((type) => {
            const key = type.toLowerCase();
            const keywords = TYPE_KEYWORDS[key] || [key];
            return keywords.some((kw) => typeValue.includes(kw));
          })
        : true;
      const languageValue = (school.languages || '').toLowerCase();
      const matchesLanguage = aLangs.length
        ? aLangs.some((lang) => {
            const key = lang.toLowerCase();
            const keywords = LANGUAGE_KEYWORDS[key] || [key];
            return keywords.some((kw) => languageValue.includes(kw));
          })
        : true;
      const curriculaValue = splitToList(school.curricula || '').map((c) =>
        c.toLowerCase()
      );
      const matchesCurricula = aCurricula.length
        ? aCurricula.every((item) =>
            curriculaValue.includes(item.toLowerCase())
          )
        : true;
      const subjectsValue = splitToList(school.education?.advanced_subjects || school.advanced_subjects || '').map((s) =>
        s.toLowerCase()
      );
      const matchesSubjects = aSubjects.length
        ? aSubjects.every((subject) =>
            subjectsValue.includes(subject.toLowerCase())
          )
        : true;
      const specialistsValue = splitToList(school.specialists || '').map((s) =>
        s.toLowerCase()
      );
      const matchesSpecialists = aSpecialists.length
        ? aSpecialists.every((item) =>
            specialistsValue.includes(item.toLowerCase())
          )
        : true;
      const servicesFlags = school.servicesFlags || {};
      const matchesServices = aServices.length
        ? aServices.every((key) => servicesFlags[key])
        : true;
      const mealsValue = (school.meals || '').toLowerCase();
      const matchesMeals = aMeals.length
        ? aMeals.some((meal) => mealsValue.includes(meal.toLowerCase()))
        : true;
      const ratingValue = Number(school.rating) || 0;
      const matchesRating =
        aMinRating !== null ? ratingValue >= aMinRating : true;
      const matchesAccreditation = aLicenses.length
        ? aLicenses.every((item) => {
            if (item === 'License') return Boolean(school.hasLicense);
            if (item === 'Certificates') return Boolean(school.hasCertificates);
            return true;
          })
        : true;
      const matchesExam =
        aExam === null
          ? true
          : aExam === 'Yes'
          ? Boolean(school.entranceExamRequired)
          : !school.entranceExamRequired;
      const clubsCount = splitToList(school.services?.clubs || school.clubs || '').length;
      const matchesClubs =
        aMinClubs > 0 ? clubsCount >= aMinClubs : true;
      const priceValue = Number(school.monthlyFee);
      const matchesPrice =
        isPrivateSelectedApplied && (priceValue || priceValue === 0)
          ? priceValue >= aPrice[0] && priceValue <= aPrice[1]
          : true;
      return (
        matchesQuery &&
        matchesCity &&
        matchesArea &&
        matchesType &&
        matchesLanguage &&
        matchesCurricula &&
        matchesSubjects &&
        matchesSpecialists &&
        matchesServices &&
        matchesMeals &&
        matchesRating &&
        matchesAccreditation &&
        matchesExam &&
        matchesClubs &&
        matchesPrice
      );
    });
  }, [
    schoolCards,
    appliedFilters,
    isPrivateSelectedApplied,
  ]);

  const resetFilters = () => {
    setDraft(createDefaultFilters());
    setLocationError(null);
  };

  const FiltersModal = ({ visible, onClose }) => {
    const { t, locale } = useLocale();
    const guestAdvancedFiltersHint =
      locale === 'kk'
        ? 'Кеңейтілген сүзгілер тіркелген қолданушыларға қолжетімді.'
        : locale === 'en'
          ? 'Advanced filters are available for registered users.'
          : 'Расширенные фильтры доступны зарегистрированным пользователям.';
    if (!visible) return null;
    return (
      <View style={styles.overlay}>
        <LinearGradient
          colors={['#44C5F5', '#7E73F4', '#44C5F5']}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ flex: 1, backgroundColor: '#44C5F5' }}
        >
          <View className="flex-1 bg-white">
            <View
              className="flex-row items-center justify-between"
              style={{ paddingTop: 46, paddingHorizontal: 24, paddingBottom: 12 }}
            >
              <Pressable
                className="w-10 h-10 rounded-full bg-darkGrayText/10 items-center justify-center"
                onPress={onClose}
              >
                <XMarkIcon color="#364356" size={20} />
              </Pressable>
              <Text className="text-darkGrayText font-exoSemibold text-xl">
                {t('schools.filters.title')}
              </Text>
              <Pressable onPress={resetFilters} className="py-2 px-2">
                <Text className="text-bgPurple font-exoSemibold">{t('schools.filters.reset')}</Text>
              </Pressable>
            </View>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 140 }}
              showsVerticalScrollIndicator={false}
            >
              <Text className="text-darkGrayText/70 font-exo text-sm">
                {t('schools.filters.cityHint')}
              </Text>
              <View className="mt-6">
                {CITY_OPTIONS.map((option) => {
                  const isActive = selectedCities.includes(option.name);
                  return (
                    <View key={option.name} className="mb-4">
                      <Pressable
                      className="flex-row items-center justify-between rounded-2xl px-4 py-3"
                      style={{
                        borderWidth: 1,
                        borderColor: isActive ? '#5667FD' : 'rgba(54,67,86,0.2)',
                        backgroundColor: isActive ? 'rgba(86,103,253,0.08)' : '#FFFFFF',
                      }}
                      onPress={() => handleCityToggle(option.name)}
                    >
                      <Text className="font-exoSemibold text-darkGrayText">
                        {t(CITY_L[option.name]) || option.name}
                      </Text>
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: isActive ? '#5667FD' : 'rgba(86,103,253,0.4)',
                          backgroundColor: isActive ? '#5667FD' : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isActive ? (
                          <Text style={{ color: '#FFFFFF', fontSize: 14 }}>✓</Text>
                        ) : null}
                      </View>
                    </Pressable>

                    {isActive && option.areas?.length ? (
                      <View className="flex-row flex-wrap gap-2 mt-3">
                        {option.areas.map((area) => {
                          const cityAreas = selectedCityAreas[option.name] ?? [];
                          const areaActive = cityAreas.includes(area);
                          return (
                            <Pressable
                              key={`${option.name}-${area}`}
                              className="px-4 py-2 rounded-full border"
                              style={{
                                borderColor: areaActive ? '#5667FD' : 'rgba(54,67,86,0.25)',
                                backgroundColor: areaActive ? 'rgba(86,103,253,0.12)' : '#FFFFFF',
                              }}
                              onPress={() => handleAreaToggle(option.name, area)}
                            >
                              <Text
                                className="font-exo text-xs"
                                style={{
                                  color: areaActive ? '#364356' : 'rgba(54,67,86,0.8)',
                                }}
                              >
                                {area}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>

            <Text className="text-darkGrayText font-exoSemibold text-base mt-4">
              {t('schools.filters.typeTitle')}
            </Text>
            <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
              {t('schools.filters.typeDesc')}
            </Text>
            <View className="flex-row flex-wrap gap-2 mt-3">
              {TYPE_OPTIONS.map((type) => {
                const isActive = selectedTypes.includes(type);
                return (
                  <Pressable
                    key={type}
                    className="px-4 py-2 rounded-full border"
                    style={{
                      borderColor: isActive ? '#5667FD' : 'rgba(54,67,86,0.25)',
                      backgroundColor: isActive ? 'rgba(86,103,253,0.12)' : '#FFFFFF',
                    }}
                    onPress={() => handleTypeToggle(type)}
                  >
                    <Text className="font-exo text-xs" style={{ color: isActive ? '#364356' : 'rgba(54,67,86,0.8)' }}>
                      {t(TYPE_L[type]) || type}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {isPrivateSelectedDraft ? (
              <>
                <Text className="text-darkGrayText font-exoSemibold text-base mt-4">
                  {t('schools.filters.monthlyFeeTitle')}
                </Text>
                <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
                  {t('schools.filters.priceRangeDesc')}
                </Text>
                <Text className="text-darkGrayText/70 font-exo text-sm mt-3">
                  {`${Math.round(priceRange[0]).toLocaleString('ru-RU')} ₸ — ${Math.round(priceRange[1]).toLocaleString('ru-RU')} ₸`}
                </Text>
                <View
                  className="mt-2"
                  onLayout={(event) => setSliderWidth(event.nativeEvent.layout.width)}
                  style={{ paddingVertical: 12, width: '100%' }}
                >
                  <View style={{ height: 80, position: 'relative', justifyContent: 'flex-end', width: '100%' }}>
                    <View
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 16,
                        height: 8,
                        borderRadius: 999,
                        backgroundColor: 'rgba(86,103,253,0.15)',
                      }}
                    />
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: '100%' }}>
                      {PRICE_HISTOGRAM.map((value, idx) => {
                        const max = Math.max(...PRICE_HISTOGRAM);
                        const height = max ? (value / max) * 40 + 8 : 10;
                        const barWidth = `${100 / PRICE_HISTOGRAM.length}%`;
                        return (
                          <View
                            key={`hist-${idx}`}
                            style={{
                              width: barWidth,
                              height,
                              backgroundColor: 'rgba(54,67,86,0.12)',
                              marginHorizontal: 1,
                              borderRadius: 4,
                              marginBottom: 16,
                            }}
                          />
                        );
                      })}
                    </View>
                    <View
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 16,
                        height: 8,
                        borderRadius: 999,
                        backgroundColor: 'rgba(86,103,253,0.3)',
                      }}
                    />
                    {(() => {
                      const minRatio = (priceRange[0] - PRICE_MIN) / (PRICE_MAX - PRICE_MIN);
                      const maxRatio = (priceRange[1] - PRICE_MIN) / (PRICE_MAX - PRICE_MIN);
                      const minLeft = minRatio * effectiveSliderWidth;
                      const maxLeft = maxRatio * effectiveSliderWidth;
                      return (
                        <>
                          <View
                            style={{
                              position: 'absolute',
                              left: Math.min(minLeft, maxLeft),
                              width: Math.abs(maxLeft - minLeft),
                              bottom: 16,
                              height: 8,
                              backgroundColor: '#5667FD',
                              borderRadius: 999,
                            }}
                          />
                          <Pressable
                            {...panResponderMin.panHandlers}
                            hitSlop={10}
                            style={{
                              position: 'absolute',
                              left: minLeft - 14,
                              bottom: 10,
                              width: 28,
                              height: 28,
                              borderRadius: 999,
                              backgroundColor: '#2563EB',
                              borderWidth: 2,
                              borderColor: 'white',
                            }}
                          />
                          <Pressable
                            {...panResponderMax.panHandlers}
                            hitSlop={10}
                            style={{
                              position: 'absolute',
                              left: maxLeft - 14,
                              bottom: 10,
                              width: 28,
                              height: 28,
                              borderRadius: 999,
                              backgroundColor: '#2563EB',
                              borderWidth: 2,
                              borderColor: 'white',
                            }}
                          />
                        </>
                      );
                    })()}
                  </View>
                </View>
              </>
            ) : null}
            <Text className="text-darkGrayText font-exoSemibold text-base mt-4">
              {t('schools.filters.languageTitle')}
            </Text>
            <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
              {t('schools.filters.languageDesc')}
            </Text>
            <View className="flex-row flex-wrap gap-2 mt-3">
              {LANGUAGE_OPTIONS.map((lang) => {
                const isActive = selectedLanguages.includes(lang);
                return (
                  <Pressable
                    key={lang}
                    className="px-4 py-2 rounded-full border"
                    style={{
                      borderColor: isActive ? '#5667FD' : 'rgba(54,67,86,0.25)',
                      backgroundColor: isActive ? 'rgba(86,103,253,0.12)' : '#FFFFFF',
                    }}
                    onPress={() => handleLanguageToggle(lang)}
                  >
                    <Text className="font-exo text-xs" style={{ color: isActive ? '#364356' : 'rgba(54,67,86,0.8)' }}>
                      {t(LANG_L[lang]) || lang}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ opacity: isGuest ? 0.35 : 1 }} pointerEvents={isGuest ? 'none' : 'auto'}>
            <Text className="text-darkGrayText font-exoSemibold text-base mt-4">
              {t('schools.filters.accreditationTitle')}
            </Text>
            <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
              {t('schools.filters.accreditationDesc')}
            </Text>
            <View className="flex-row flex-wrap gap-2 mt-3">
              {ACCREDITATION_OPTIONS.map((option) => {
                const isActive = selectedLicenses.includes(option);
                return (
                  <Pressable
                    key={option}
                    className="px-4 py-2 rounded-full border"
                    style={{
                      borderColor: isActive ? '#5667FD' : 'rgba(54,67,86,0.25)',
                      backgroundColor: isActive ? 'rgba(86,103,253,0.12)' : '#FFFFFF',
                    }}
                    onPress={() => handleLicenseToggle(option)}
                  >
                    <Text
                      className="font-exo text-xs"
                      style={{
                        color: isActive ? '#364356' : 'rgba(54,67,86,0.8)',
                      }}
                    >
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text className="text-darkGrayText font-exoSemibold text-base mt-4">
              {t('schools.filters.curriculaTitle')}
            </Text>
            <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
              {t('schools.filters.curriculaDesc')}
            </Text>
            <View className="flex-row flex-wrap gap-2 mt-3">
              {CURRICULA_OPTIONS.map((item) => {
                const isActive = selectedCurricula.includes(item);
                return (
                  <Pressable
                    key={item}
                    className="px-4 py-2 rounded-full border"
                    style={{
                      borderColor: isActive ? '#5667FD' : 'rgba(54,67,86,0.25)',
                      backgroundColor: isActive ? 'rgba(86,103,253,0.12)' : '#FFFFFF',
                    }}
                    onPress={() =>
                      setDraft((prev) => ({
                        ...prev,
                        selectedCurricula: prev.selectedCurricula.includes(item)
                          ? prev.selectedCurricula.filter((v) => v !== item)
                          : [...prev.selectedCurricula, item],
                      }))
                    }
                  >
                    <Text
                      className="font-exo text-xs"
                      style={{
                        color: isActive ? '#364356' : 'rgba(54,67,86,0.8)',
                      }}
                    >
                      {item}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text className="text-darkGrayText font-exoSemibold text-base mt-4">
              {t('schools.filters.servicesTitle')}
            </Text>
            <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
              {t('schools.filters.servicesDesc')}
            </Text>
            <View className="flex-row flex-wrap gap-2 mt-3">
              {SERVICE_FLAGS.map((service) => {
                const isActive = selectedServices.includes(service.key);
                return (
                  <Pressable
                    key={service.key}
                    className="px-4 py-2 rounded-full border"
                    style={{
                      borderColor: isActive ? '#5667FD' : 'rgba(54,67,86,0.25)',
                      backgroundColor: isActive ? 'rgba(86,103,253,0.12)' : '#FFFFFF',
                    }}
                    onPress={() =>
                      setDraft((prev) => ({
                        ...prev,
                        selectedServices: prev.selectedServices.includes(service.key)
                          ? prev.selectedServices.filter((item) => item !== service.key)
                          : [...prev.selectedServices, service.key],
                      }))
                    }
                  >
                    <Text className="font-exo text-xs" style={{ color: isActive ? '#364356' : 'rgba(54,67,86,0.8)' }}>
                      {t(SVC_L[service.key]) || service.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text className="text-darkGrayText font-exoSemibold text-base mt-4">
              {t('schools.filters.mealsTitle')}
            </Text>
            <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
              {t('schools.filters.mealsDesc')}
            </Text>
            <View className="flex-row flex-wrap gap-2 mt-3">
              {MEAL_OPTIONS.map((meal) => {
                const isActive = selectedMeals.includes(meal);
                return (
                  <Pressable
                    key={meal}
                    className="px-4 py-2 rounded-full border"
                    style={{
                      borderColor: isActive ? '#5667FD' : 'rgba(54,67,86,0.25)',
                      backgroundColor: isActive ? 'rgba(86,103,253,0.12)' : '#FFFFFF',
                    }}
                    onPress={() =>
                      setDraft((prev) => ({
                        ...prev,
                        selectedMeals: prev.selectedMeals.includes(meal)
                          ? prev.selectedMeals.filter((item) => item !== meal)
                          : [...prev.selectedMeals, meal],
                      }))
                    }
                  >
                    <Text className="font-exo text-xs" style={{ color: isActive ? '#364356' : 'rgba(54,67,86,0.8)' }}>
                      {t(MEAL_L[meal]) || meal}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text className="text-darkGrayText font-exoSemibold text-base mt-4">
              {t('schools.filters.specialistsTitle')}
            </Text>
            <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
              {t('schools.filters.specialistsDesc')}
            </Text>
            <View className="flex-row flex-wrap gap-2 mt-3">
              {SPECIALISTS_OPTIONS.map((item) => {
                const isActive = selectedSpecialists.includes(item);
                return (
                  <Pressable
                    key={item}
                    className="px-4 py-2 rounded-full border"
                    style={{
                      borderColor: isActive ? '#5667FD' : 'rgba(54,67,86,0.25)',
                      backgroundColor: isActive ? 'rgba(86,103,253,0.12)' : '#FFFFFF',
                    }}
                    onPress={() =>
                      setDraft((prev) => ({
                        ...prev,
                        selectedSpecialists: prev.selectedSpecialists.includes(item)
                          ? prev.selectedSpecialists.filter((v) => v !== item)
                          : [...prev.selectedSpecialists, item],
                      }))
                    }
                  >
                    <Text className="font-exo text-xs" style={{ color: isActive ? '#364356' : 'rgba(54,67,86,0.8)' }}>
                      {t(SPEC_L[item]) || item}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text className="text-darkGrayText font-exoSemibold text-base mt-4">
              {t('schools.filters.examTitle')}
            </Text>
            <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
              {t('schools.filters.examDesc')}
            </Text>
            <View className="flex-row flex-wrap gap-2 mt-3">
              {['Yes', 'No'].map((option) => {
                const isActive = selectedExam === option;
                return (
                  <Pressable
                    key={option}
                    className="px-4 py-2 rounded-full border"
                    style={{
                      borderColor: isActive ? '#5667FD' : 'rgba(54,67,86,0.25)',
                      backgroundColor: isActive ? 'rgba(86,103,253,0.12)' : '#FFFFFF',
                    }}
                    onPress={() =>
                      setDraft((prev) => ({
                        ...prev,
                        selectedExam: prev.selectedExam === option ? null : option,
                      }))
                    }
                  >
                    <Text
                      className="font-exo text-xs"
                      style={{
                        color: isActive ? '#364356' : 'rgba(54,67,86,0.8)',
                      }}
                    >
                      {option === 'Yes' ? t('schools.exam.yes') : t('schools.exam.no')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text className="text-darkGrayText font-exoSemibold text-base mt-4">
              {t('schools.filters.subjectsTitle')}
            </Text>
            <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
              {t('schools.filters.subjectsDesc')}
            </Text>
            <View className="flex-row flex-wrap gap-2 mt-3">
              {SUBJECT_OPTIONS.map((subject) => {
                const isActive = selectedSubjects.includes(subject);
                return (
                  <Pressable
                    key={subject}
                    className="px-4 py-2 rounded-full border"
                    style={{
                      borderColor: isActive ? '#5667FD' : 'rgba(54,67,86,0.25)',
                      backgroundColor: isActive ? 'rgba(86,103,253,0.12)' : '#FFFFFF',
                    }}
                    onPress={() =>
                      setDraft((prev) => ({
                        ...prev,
                        selectedSubjects: prev.selectedSubjects.includes(subject)
                          ? prev.selectedSubjects.filter((item) => item !== subject)
                          : [...prev.selectedSubjects, subject],
                      }))
                    }
                  >
                    <Text
                      className="font-exo text-xs"
                      style={{
                        color: isActive ? '#364356' : 'rgba(54,67,86,0.8)',
                      }}
                    >
                      {t(SUBJ_L[subject]) || subject}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            </View>
            {isGuest ? (
              <Text className="text-darkGrayText/60 font-exo text-xs mt-3">
                {guestAdvancedFiltersHint}
              </Text>
            ) : null}
            <Text className="text-darkGrayText font-exoSemibold text-base mt-4">
              {t('schools.filters.ratingTitle')}
            </Text>
            <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
              {t('schools.filters.ratingDesc')}
            </Text>
            <View className="flex-row flex-wrap gap-2 mt-3">
              {RATING_OPTIONS.map((value) => {
                const isActive = selectedMinRating === value;
                return (
                  <Pressable
                    key={value}
                    className="px-4 py-2 rounded-full border"
                    style={{
                      borderColor: isActive ? '#5667FD' : 'rgba(54,67,86,0.25)',
                      backgroundColor: isActive ? 'rgba(86,103,253,0.12)' : '#FFFFFF',
                    }}
                    onPress={() => handleRatingSelect(value)}
                  >
                    <Text
                      className="font-exo text-xs"
                      style={{
                        color: isActive ? '#364356' : 'rgba(54,67,86,0.8)',
                      }}
                    >
                      {value.toFixed(1)}+
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View className="mt-4" style={{ opacity: isGuest ? 0.35 : 1 }} pointerEvents={isGuest ? 'none' : 'auto'}>
              <Text className="text-darkGrayText font-exoSemibold text-base">
                {t('schools.filters.clubsTitle')}
              </Text>
              <View className="flex-row items-center justify-between mt-2">
                <Text className="font-exoSemibold text-lg text-darkGrayText">
                  {minClubs}
                </Text>
                <View className="flex-row items-center rounded-2xl border border-bgPurple/30 px-2 py-1">
                  <Pressable
                    className="px-3 py-2"
                  onPress={() => setDraft((prev) => ({ ...prev, minClubs: Math.max(0, prev.minClubs - 1) }))}
                  >
                    <Text style={{ fontSize: 20, color: '#4F46E5' }}>−</Text>
                  </Pressable>
                  <Text className="font-exoSemibold text-lg text-darkGrayText px-2">
                    {minClubs}
                  </Text>
                  <Pressable
                    className="px-3 py-2"
                  onPress={() => setDraft((prev) => ({ ...prev, minClubs: Math.min(50, prev.minClubs + 1) }))}
                  >
                    <Text style={{ fontSize: 20, color: '#4F46E5' }}>+</Text>
                  </Pressable>
                </View>
              </View>
            </View>
            {isGuest ? (
              <Text className="text-darkGrayText/60 font-exo text-xs mt-3">
                {guestAdvancedFiltersHint}
              </Text>
            ) : null}
          </ScrollView>
          <View
            className="px-6 pb-6 pt-3"
            style={{
              borderTopWidth: 1,
              borderTopColor: 'rgba(54,67,86,0.06)',
              backgroundColor: 'white',
            }}
          >
            <Pressable
              className="rounded-2xl bg-bgPurple px-4 py-4 items-center"
              onPress={() => {
                setApplied(draft);
                onClose();
              }}
            >
              <Text className="text-white font-exoSemibold text-base">
                {t('schools.filters.showResults')}
              </Text>
            </Pressable>
          </View>
        </View>
      </LinearGradient>
      </View>
    );
  };

  return {
    filteredSchools,
    isFilterActive,
    filterModalVisible,
    setFilterModalVisible,
    FiltersModal,
  };
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
  },
});
