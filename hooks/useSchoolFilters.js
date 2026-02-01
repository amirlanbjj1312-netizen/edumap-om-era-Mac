import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View, PanResponder, StyleSheet } from 'react-native';
import { XMarkIcon } from 'react-native-heroicons/solid';
import { AdjustmentsHorizontalIcon } from 'react-native-heroicons/solid';
import { LinearGradient } from 'expo-linear-gradient';
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
    appliedFilters.minClassSize > 0 ||
    appliedFilters.minClubs > 0 ||
    appliedFilters.priceRange[0] !== PRICE_MIN ||
    appliedFilters.priceRange[1] !== PRICE_MAX ||
    appliedFilters.useNearby;

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
      minClassSize: aMinClass,
      minClubs: aMinClubs,
      priceRange: aPrice,
      useNearby: aNearby,
      radiusKm: aRadius,
      userLocation: aLocation,
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
      const avgClassSize = Number(school.education?.average_class_size || school.average_class_size);
      const matchesClassSize =
        aMinClass > 0 && Number.isFinite(avgClassSize)
          ? avgClassSize >= aMinClass
          : aMinClass === 0;
      const clubsCount = splitToList(school.services?.clubs || school.clubs || '').length;
      const matchesClubs =
        aMinClubs > 0 ? clubsCount >= aMinClubs : true;
      const priceValue = Number(school.monthlyFee);
      const matchesPrice =
        isPrivateSelectedApplied && (priceValue || priceValue === 0)
          ? priceValue >= aPrice[0] && priceValue <= aPrice[1]
          : true;
      const matchesNearby = aNearby
        ? (() => {
            if (!aLocation) return false;
            if (!school.coordinates) return false;
            const distance = calcDistanceKm(aLocation, school.coordinates);
            return Number.isFinite(distance) && distance <= aRadius;
          })()
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
        matchesClassSize &&
        matchesClubs &&
        matchesPrice &&
        matchesNearby
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
                Filters
              </Text>
              <Pressable onPress={resetFilters} className="py-2 px-2">
                <Text className="text-bgPurple font-exoSemibold">Reset</Text>
              </Pressable>
            </View>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 140 }}
              showsVerticalScrollIndicator={false}
            >
              <Text className="text-darkGrayText/70 font-exo text-sm">
                Select one or several cities
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
                        {option.name}
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

            <View className="mt-2">
              <Text className="text-darkGrayText font-exoSemibold text-base">
                Nearby
              </Text>
              <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
                Show schools within a chosen radius
              </Text>
              <Pressable
                className="mt-3 px-4 py-3 rounded-2xl border flex-row items-center justify-between"
                style={{
                  borderColor: useNearby ? '#5667FD' : 'rgba(54,67,86,0.25)',
                  backgroundColor: useNearby ? 'rgba(86,103,253,0.1)' : '#FFFFFF',
                }}
                onPress={async () => {
                  if (useNearby) {
                    setDraft((prev) => ({ ...prev, useNearby: false }));
                    return;
                  }
                  const ok = await requestLocation();
                  if (ok) {
                    setDraft((prev) => ({ ...prev, useNearby: true }));
                  }
                }}
              >
                <Text
                  className="font-exoSemibold"
                  style={{ color: useNearby ? '#364356' : 'rgba(54,67,86,0.9)' }}
                >
                  {useNearby ? 'Location enabled' : 'Use my location'}
                </Text>
                <Text style={{ color: '#5667FD', fontSize: 16 }}>
                  {useNearby ? '✓' : '→'}
                </Text>
              </Pressable>
              {locationError ? (
                <Text className="text-red-500 font-exo text-xs mt-1">{locationError}</Text>
              ) : null}
              {useNearby ? (
                <View className="flex-row items-center justify-between mt-3">
                  <Text className="font-exoSemibold text-base text-darkGrayText">
                    Radius, km
                  </Text>
                  <View className="flex-row items-center rounded-2xl border border-bgPurple/30 px-2 py-1">
                    <Pressable
                      className="px-3 py-2"
                      onPress={() => setDraft((prev) => ({ ...prev, radiusKm: Math.max(1, prev.radiusKm - 1) }))}
                    >
                      <Text style={{ fontSize: 20, color: '#4F46E5' }}>−</Text>
                    </Pressable>
                    <Text className="font-exoSemibold text-lg text-darkGrayText px-2">
                      {radiusKm}
                    </Text>
                    <Pressable
                      className="px-3 py-2"
                      onPress={() => setDraft((prev) => ({ ...prev, radiusKm: Math.min(50, prev.radiusKm + 1) }))}
                    >
                      <Text style={{ fontSize: 20, color: '#4F46E5' }}>+</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>

            <Text className="text-darkGrayText font-exoSemibold text-base mt-4">
              School type
            </Text>
            <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
              Pick one or more types
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
                    <Text
                      className="font-exo text-xs"
                      style={{
                        color: isActive ? '#364356' : 'rgba(54,67,86,0.8)',
                      }}
                    >
                      {type}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {isPrivateSelectedDraft ? (
              <>
                <Text className="text-darkGrayText font-exoSemibold text-base mt-4">
                  Monthly fee
                </Text>
                <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
                  Select a price range (₸/month)
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
              School language
            </Text>
            <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
              Pick one or more languages
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
                    <Text
                      className="font-exo text-xs"
                      style={{
                        color: isActive ? '#364356' : 'rgba(54,67,86,0.8)',
                      }}
                    >
                      {lang}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text className="text-darkGrayText font-exoSemibold text-base mt-4">
              Accreditation
            </Text>
            <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
              License or certificates
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
              Curricula
            </Text>
            <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
              Select required curricula
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
              Services
            </Text>
            <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
              Select required services
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
                    <Text
                      className="font-exo text-xs"
                      style={{
                        color: isActive ? '#364356' : 'rgba(54,67,86,0.8)',
                      }}
                    >
                      {service.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text className="text-darkGrayText font-exoSemibold text-base mt-4">
              Meals
            </Text>
            <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
              Select meal options
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
                    <Text
                      className="font-exo text-xs"
                      style={{
                        color: isActive ? '#364356' : 'rgba(54,67,86,0.8)',
                      }}
                    >
                      {meal}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text className="text-darkGrayText font-exoSemibold text-base mt-4">
              Specialists
            </Text>
            <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
              Select required specialists
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
              Entrance exam
            </Text>
            <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
              Requires exam
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
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text className="text-darkGrayText font-exoSemibold text-base mt-4">
              Advanced subjects
            </Text>
            <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
              Select required subjects
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
                      {subject}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text className="text-darkGrayText font-exoSemibold text-base mt-4">
              Rating
            </Text>
            <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
              Minimum user rating
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
            <View className="mt-6">
              <Text className="text-darkGrayText font-exoSemibold text-base">
                Average class size (min)
              </Text>
              <View className="flex-row items-center justify-between mt-2">
                <Text className="font-exoSemibold text-lg text-darkGrayText">
                  {minClassSize}
                </Text>
                <View className="flex-row items-center rounded-2xl border border-bgPurple/30 px-2 py-1">
                  <Pressable
                    className="px-3 py-2"
                    onPress={() =>
                      setDraft((prev) => ({ ...prev, minClassSize: Math.max(0, prev.minClassSize - 1) }))
                    }
                  >
                    <Text style={{ fontSize: 20, color: '#4F46E5' }}>−</Text>
                  </Pressable>
                  <Text className="font-exoSemibold text-lg text-darkGrayText px-2">
                    {minClassSize}
                  </Text>
                  <Pressable
                    className="px-3 py-2"
                    onPress={() =>
                      setDraft((prev) => ({ ...prev, minClassSize: Math.min(60, prev.minClassSize + 1) }))
                    }
                  >
                    <Text style={{ fontSize: 20, color: '#4F46E5' }}>+</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            <View className="mt-4">
              <Text className="text-darkGrayText font-exoSemibold text-base">
                Clubs count (min)
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
                Show results
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
