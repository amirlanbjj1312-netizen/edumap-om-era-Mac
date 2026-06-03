import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeftIcon, AdjustmentsHorizontalIcon, StarIcon } from 'react-native-heroicons/solid';
import { XMarkIcon } from 'react-native-heroicons/outline';
import * as Location from 'expo-location';
import { useSchools } from '../context/SchoolsContext';
import { useLocale } from '../context/LocaleContext';
import { images } from '../assets';
import { useSchoolFilters } from '../hooks/useSchoolFilters';
import { TiledMapView } from '../components/map';

export default function SchoolMapScreen() {
  const navigation = useNavigation();
  const { t, locale } = useLocale();
  const { schoolCards } = useSchools();
  const {
    filteredSchools,
    filterModalVisible,
    setFilterModalVisible,
    FiltersModal,
  } = useSchoolFilters({ schoolCards, singleCity: true });

  const [searchQuery, setSearchQuery] = useState('');
  const [focusedMarker, setFocusedMarker] = useState(null);
  const [userRegion, setUserRegion] = useState(null);
  const [locationPrompted, setLocationPrompted] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState(null);

  // Popup animation
  const popupAnim = useRef(new Animated.Value(0)).current;

  const showPopup = (school) => {
    setSelectedSchool(school);
    Animated.spring(popupAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 65,
      friction: 10,
    }).start();
  };

  const hidePopup = () => {
    Animated.timing(popupAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => setSelectedSchool(null));
  };

  const schoolsWithCoords = useMemo(() => {
    return filteredSchools
      .map((school) => {
        if (!school.coordinates || school.coordinates.latitude == null || school.coordinates.longitude == null) return null;
        const monthlyFee = Number(school.monthlyFee || school.finance?.monthly_fee || 0);
        const isPrivate = typeof school.type === 'string' && /private|частн/i.test(school.type);
        return {
          id: school.school_id || school.id || school.name,
          name: school.name,
          type: school.type,
          city: school.city,
          address: school.address,
          logo: school.logo || null,
          rating: Number.isFinite(Number(school.rating)) ? Number(school.rating) : null,
          monthlyFee: isPrivate && monthlyFee > 0 ? monthlyFee : null,
          latitude: Number(school.coordinates.latitude),
          longitude: Number(school.coordinates.longitude),
        };
      })
      .filter(Boolean);
  }, [filteredSchools]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredMarkers = useMemo(() => {
    if (!normalizedQuery) return schoolsWithCoords;
    return schoolsWithCoords.filter((s) =>
      [s.name, s.city, s.address, s.type].filter(Boolean).join(' ').toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery, schoolsWithCoords]);

  const hasQuery = normalizedQuery.length > 0;
  const suggestions = hasQuery ? filteredMarkers.slice(0, 5) : [];

  // Auto-geolocate on first open so map shows user's city
  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status !== 'granted') return;
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then((loc) => {
        setUserRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.18,
          longitudeDelta: 0.22,
        });
      }).catch(() => {});
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!filteredMarkers.length) { setFocusedMarker(null); return; }
    const first = filteredMarkers[0];
    setFocusedMarker({ latitude: first.latitude, longitude: first.longitude, id: first.id });
  }, [filteredMarkers]);

  const handleOpenDetail = (schoolId) => {
    hidePopup();
    navigation.navigate('SchoolDetail', { schoolId });
  };

  const handleSearchChange = (value) => {
    setSearchQuery(value);
    if (!value.trim()) setFocusedMarker(null);
    if (selectedSchool) hidePopup();
  };

  const handleSuggestionPress = (school) => {
    setSearchQuery(school.name);
    setFocusedMarker({ latitude: school.latitude, longitude: school.longitude, id: school.id });
    Keyboard.dismiss();
  };

  const requestUserLocation = async () => {
    if (locationLoading || locationPrompted) return;
    setLocationPrompted(true);
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocationError('Нет доступа к геолокации'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserRegion({ latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.18, longitudeDelta: 0.22 });
      setLocationError('');
    } catch {
      setLocationError('Не удалось определить местоположение');
    } finally {
      setLocationLoading(false);
    }
  };

  const popupTranslateY = popupAnim.interpolate({ inputRange: [0, 1], outputRange: [200, 0] });
  const popupOpacity = popupAnim;

  if (!schoolsWithCoords.length) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9EEF6', padding: 24 }}>
        <Text style={{ fontFamily: 'exoSemibold', fontSize: 18, color: '#111827', textAlign: 'center' }}>
          {locale === 'en' ? 'No schools on map yet' : locale === 'kk' ? 'Картада мектептер жоқ' : 'Нет школ на карте'}
        </Text>
      </View>
    );
  }

  return (
    <>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={8}
        >
          {/* Native map — instant load */}
          <TiledMapView
            style={styles.fullscreenMap}
            markers={filteredMarkers}
            highlightMarkerId={focusedMarker?.id}
            onMarkerPress={(marker) => {
              setFocusedMarker({ latitude: marker.latitude, longitude: marker.longitude, id: marker.id });
              showPopup(marker);
            }}
            onCalloutPress={(marker) => handleOpenDetail(marker.id)}
            onMapPress={requestUserLocation}
            focusPoint={focusedMarker}
            focusRegion={userRegion}
          />

          {/* Search + filter overlay */}
          <View style={styles.topOverlay}>
            <View style={styles.searchContainer}>
              <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={10}>
                <ArrowLeftIcon color="#4F46E5" size={20} />
              </Pressable>
              <TextInput
                style={styles.searchInput}
                placeholder={t('schools.search.placeholder')}
                placeholderTextColor="rgba(71,85,105,0.7)"
                value={searchQuery}
                onChangeText={handleSearchChange}
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={() => {
                  if (filteredMarkers.length) {
                    const t = filteredMarkers[0];
                    setFocusedMarker({ latitude: t.latitude, longitude: t.longitude, id: t.id });
                  }
                  Keyboard.dismiss();
                }}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => handleSearchChange('')} hitSlop={8}>
                  <XMarkIcon color="#94A3B8" size={18} />
                </Pressable>
              )}
            </View>

            <Pressable style={styles.filterBtn} onPress={() => setFilterModalVisible(true)}>
              <AdjustmentsHorizontalIcon color="#4F46E5" size={18} />
              <Text style={styles.filterBtnText}>{t('schools.filter.button')}</Text>
            </Pressable>

            {hasQuery && suggestions.length > 0 && (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                style={styles.suggestions}
                contentContainerStyle={{ paddingVertical: 4 }}
              >
                {suggestions.map((s) => (
                  <Pressable key={s.id} style={styles.suggestionRow} onPress={() => handleSuggestionPress(s)}>
                    <Text style={styles.suggestionName}>{s.name}</Text>
                    {s.address ? <Text style={styles.suggestionAddr}>{s.address}</Text> : null}
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {hasQuery && filteredMarkers.length === 0 && (
              <View style={styles.noResultsPill}>
                <Text style={styles.noResultsText}>
                  {locale === 'en' ? `No results for "${searchQuery.trim()}"` : locale === 'kk' ? `"${searchQuery.trim()}" табылмады` : `"${searchQuery.trim()}" не найдено`}
                </Text>
              </View>
            )}
          </View>

          {/* Bottom hint */}
          {!locationPrompted && !selectedSchool && (
            <View style={styles.hint} pointerEvents="none">
              <Text style={styles.hintText}>
                {locale === 'kk' ? 'Мектепті көру үшін белгіні басыңыз' : locale === 'en' ? 'Tap a marker to view school' : 'Нажмите на метку для просмотра школы'}
              </Text>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Native popup card — school card style */}
      {selectedSchool && (
        <Animated.View
          style={[styles.popup, { opacity: popupOpacity, transform: [{ translateY: popupTranslateY }] }]}
        >
          <View style={styles.popupHandle} />
          <Pressable style={styles.popupClose} onPress={hidePopup} hitSlop={10}>
            <XMarkIcon size={18} color="#9CA3AF" />
          </Pressable>

          {/* Card row: logo + info */}
          <View style={styles.popupRow}>
            <View style={styles.popupLogo}>
              {selectedSchool.logo ? (
                <Image source={{ uri: selectedSchool.logo }} style={styles.popupLogoImg} resizeMode="cover" />
              ) : (
                <Image source={images.authLogo} style={styles.popupLogoFallback} resizeMode="contain" />
              )}
            </View>
            <View style={styles.popupInfo}>
              <Text style={styles.popupName} numberOfLines={2}>{selectedSchool.name}</Text>
              {selectedSchool.city ? (
                <Text style={styles.popupCity} numberOfLines={1}>{selectedSchool.city}</Text>
              ) : null}
              {selectedSchool.address ? (
                <Text style={styles.popupAddress} numberOfLines={1}>{selectedSchool.address}</Text>
              ) : null}
              <View style={styles.popupMeta}>
                {selectedSchool.rating > 0 ? (
                  <View style={styles.popupRatingRow}>
                    <StarIcon size={12} color="#F59E0B" />
                    <Text style={styles.popupRatingText}>{selectedSchool.rating.toFixed(1)}</Text>
                  </View>
                ) : null}
                {selectedSchool.monthlyFee ? (
                  <Text style={styles.popupFee}>
                    {Math.round(selectedSchool.monthlyFee).toLocaleString('ru-RU')} ₸
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          <Pressable style={styles.popupBtn} onPress={() => handleOpenDetail(selectedSchool.id)}>
            <Text style={styles.popupBtnText}>
              {locale === 'kk' ? 'Мектепке өту →' : locale === 'en' ? 'Open profile →' : 'Перейти в школу →'}
            </Text>
          </Pressable>
        </Animated.View>
      )}

      <FiltersModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  fullscreenMap: { flex: 1, borderRadius: 0, borderWidth: 0 },

  topOverlay: { position: 'absolute', top: 6, left: 16, right: 16 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 28, borderWidth: 1, borderColor: '#4F46E5',
    backgroundColor: 'rgba(255,255,255,0.96)',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
  },
  backBtn: { padding: 6, borderRadius: 999, backgroundColor: 'rgba(79,70,229,0.08)' },
  searchInput: { flex: 1, fontFamily: 'exo', fontSize: 16, color: '#0F172A', marginHorizontal: 10 },
  filterBtn: {
    marginTop: 10, alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 22, borderWidth: 1, borderColor: '#4F46E5',
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  filterBtnText: { fontFamily: 'exoSemibold', fontSize: 15, color: '#4F46E5' },
  suggestions: { marginTop: 8, borderRadius: 22, backgroundColor: 'rgba(15,23,42,0.92)', maxHeight: 200 },
  suggestionRow: { paddingHorizontal: 16, paddingVertical: 10 },
  suggestionName: { fontFamily: 'exoSemibold', fontSize: 15, color: '#F8FAFC' },
  suggestionAddr: { marginTop: 2, fontFamily: 'exo', fontSize: 13, color: 'rgba(241,245,249,0.7)' },
  noResultsPill: {
    marginTop: 10, alignSelf: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.95)',
  },
  noResultsText: { fontFamily: 'exo', fontSize: 13, color: '#0F172A' },

  hint: {
    position: 'absolute', left: 24, right: 24, bottom: 24,
    paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: 18, backgroundColor: 'rgba(10,12,24,0.7)',
  },
  hintText: { fontFamily: 'exo', fontSize: 13, color: '#E2E8F0', textAlign: 'center' },

  // Popup
  popup: {
    position: 'absolute', bottom: 32, left: 16, right: 16,
    backgroundColor: '#fff', borderRadius: 24,
    paddingTop: 8, paddingHorizontal: 16, paddingBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 24,
    shadowOffset: { width: 0, height: -4 }, elevation: 12,
  },
  popupHandle: {
    alignSelf: 'center', width: 40, height: 4,
    borderRadius: 2, backgroundColor: '#E5E7EB', marginBottom: 12,
  },
  popupClose: { position: 'absolute', top: 16, right: 14, padding: 4, zIndex: 1 },
  popupRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14, paddingRight: 28 },
  popupLogo: {
    width: 60, height: 60, borderRadius: 14,
    backgroundColor: '#EEF2FF', overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center', marginRight: 12, flexShrink: 0,
  },
  popupLogoImg: { width: '100%', height: '100%' },
  popupLogoFallback: { width: '75%', height: '75%' },
  popupInfo: { flex: 1 },
  popupName: { fontFamily: 'exoSemibold', fontSize: 16, color: '#111827', lineHeight: 21, marginBottom: 2 },
  popupCity: { fontFamily: 'exoSemibold', fontSize: 12, color: '#2563EB', marginBottom: 2 },
  popupAddress: { fontFamily: 'exo', fontSize: 12, color: '#9CA3AF', marginBottom: 4 },
  popupMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  popupRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  popupRatingText: { fontFamily: 'exoSemibold', fontSize: 12, color: '#111827' },
  popupFee: { fontFamily: 'exoSemibold', fontSize: 12, color: '#059669' },
  popupBtn: {
    backgroundColor: '#2563EB', borderRadius: 14,
    paddingVertical: 13, alignItems: 'center',
  },
  popupBtnText: { fontFamily: 'exoSemibold', fontSize: 15, color: '#fff' },
});
