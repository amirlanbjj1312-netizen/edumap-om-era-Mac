import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
  Keyboard,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeftIcon, AdjustmentsHorizontalIcon } from 'react-native-heroicons/solid';
import { XMarkIcon } from 'react-native-heroicons/outline';
import { useSchools } from '../context/SchoolsContext';
import { TiledMapView } from '../components/map';
import { useSchoolFilters } from '../hooks/useSchoolFilters';

export default function SchoolMapScreen() {
  const navigation = useNavigation();
  const { schoolCards } = useSchools();
  const {
    filteredSchools,
    filterModalVisible,
    setFilterModalVisible,
    FiltersModal,
  } = useSchoolFilters({ schoolCards, singleCity: true });
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedMarker, setFocusedMarker] = useState(null);

  const schoolsWithCoords = useMemo(() => {
    return filteredSchools
      .map((school) => {
        if (!school.coordinates || school.coordinates.latitude == null || school.coordinates.longitude == null) {
          return null;
        }
        return {
          id: school.school_id || school.id || school.name,
          name: school.name,
          type: school.type,
          city: school.city,
          address: school.address,
          latitude: Number(school.coordinates.latitude),
          longitude: Number(school.coordinates.longitude),
          logo: school.logo,
        };
      })
      .filter(Boolean);
  }, [filteredSchools]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredMarkers = useMemo(() => {
    if (!normalizedQuery) {
      return schoolsWithCoords;
    }

    return schoolsWithCoords.filter((school) => {
      const searchableText = [
        school.name,
        school.city,
        school.address,
        school.type,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [normalizedQuery, schoolsWithCoords]);

  const hasQuery = normalizedQuery.length > 0;
  const suggestions = hasQuery ? filteredMarkers.slice(0, 5) : [];
  const noMatches = hasQuery && filteredMarkers.length === 0;

  useEffect(() => {
    if (noMatches) {
      setFocusedMarker(null);
    }
  }, [noMatches]);

  useEffect(() => {
    if (filteredMarkers.length) {
      const first = filteredMarkers[0];
      setFocusedMarker({
        latitude: first.latitude,
        longitude: first.longitude,
        id: first.id,
      });
    } else {
      setFocusedMarker(null);
    }
  }, [filteredMarkers]);

  const handleOpenDetail = (schoolId) => {
    navigation.navigate('SchoolDetail', { schoolId });
  };

  const handleSearchChange = (value) => {
    setSearchQuery(value);
    if (!value.trim()) {
      setFocusedMarker(null);
    }
  };

  const handleSuggestionPress = (school) => {
    setSearchQuery(school.name);
    setFocusedMarker({
      latitude: school.latitude,
      longitude: school.longitude,
      id: school.id,
    });
    Keyboard.dismiss();
  };

  const handleSubmitSearch = () => {
    if (!filteredMarkers.length) {
      Keyboard.dismiss();
      return;
    }

    const target = filteredMarkers[0];
    setFocusedMarker({
      latitude: target.latitude,
      longitude: target.longitude,
      id: target.id,
    });
    Keyboard.dismiss();
  };

  const renderFallback = (message, description) => (
    <View className="flex-1 items-center justify-center px-6">
      <Text className="font-exoSemibold text-lg text-darkGrayText mb-2">
        {message}
      </Text>
      <Text className="font-exo text-darkGrayText/70 px-6 text-center">
        {description}
      </Text>
    </View>
  );

  if (!schoolsWithCoords.length) {
    return renderFallback(
      'No schools with coordinates yet',
      'Please add latitude and longitude in the school profile — markers will appear automatically.'
    );
  }

  return (
    <>
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.fullscreenContainer}>
        <TiledMapView
          style={styles.fullscreenMap}
          markers={filteredMarkers}
          onCalloutPress={(marker) => handleOpenDetail(marker.id)}
          renderCallout={(marker) => (
            <View style={styles.calloutCard}>
              <Text style={styles.calloutTitle}>{marker.name}</Text>
              {marker.address ? (
                <Text style={styles.calloutSubtitle}>{marker.address}</Text>
              ) : null}
              <Text style={styles.calloutLink}>Open profile -></Text>
            </View>
          )}
          focusPoint={focusedMarker}
        />

        <View style={styles.topOverlay}>
          <View style={styles.searchContainer}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.searchBackButton}
              hitSlop={10}
            >
              <ArrowLeftIcon color="#4F46E5" size={20} />
            </Pressable>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, city or address"
              placeholderTextColor="rgba(71,85,105,0.8)"
              value={searchQuery}
              onChangeText={handleSearchChange}
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={handleSubmitSearch}
            />
            {searchQuery.length ? (
              <Pressable
                style={styles.clearButton}
                onPress={() => handleSearchChange('')}
                hitSlop={8}
              >
                <XMarkIcon color="#94A3B8" size={18} />
              </Pressable>
            ) : null}
          </View>

          <Pressable
            style={styles.filterButton}
            onPress={() => setFilterModalVisible(true)}
          >
            <AdjustmentsHorizontalIcon color="#4F46E5" size={18} />
            <Text style={styles.filterButtonText}>Filter</Text>
          </Pressable>

          {hasQuery && suggestions.length ? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={styles.suggestionsPanel}
              contentContainerStyle={styles.suggestionsContent}
            >
              {suggestions.map((school) => (
                <Pressable
                  key={school.id}
                  style={styles.suggestionRow}
                  onPress={() => handleSuggestionPress(school)}
                >
                  <Text style={styles.suggestionTitle}>{school.name}</Text>
                  {school.address ? (
                    <Text style={styles.suggestionSubtitle}>{school.address}</Text>
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          {noMatches ? (
            <View style={styles.noResultsPill}>
              <Text style={styles.noResultsText}>
                {`No schools found for "${searchQuery.trim()}"`}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.hintOverlay}>
          <Text style={styles.mapHintText}>
            Markers represent approximate positions based on the saved coordinates.
          </Text>
        </View>
      </View>
    </SafeAreaView>
    <FiltersModal
      visible={filterModalVisible}
      onClose={() => setFilterModalVisible(false)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  fullscreenContainer: {
    flex: 1,
  },
  fullscreenMap: {
    flex: 1,
    borderRadius: 0,
    borderWidth: 0,
  },
  topOverlay: {
    position: 'absolute',
    top: 6,
    left: 16,
    right: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#4F46E5',
    backgroundColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  searchBackButton: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(79,70,229,0.08)',
  },
  searchInput: {
    flex: 1,
    fontFamily: 'exo',
    fontSize: 16,
    color: '#0F172A',
    marginHorizontal: 10,
  },
  clearButton: {
    padding: 4,
    borderRadius: 999,
  },
  filterButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#4F46E5',
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  filterButtonText: {
    fontFamily: 'exoSemibold',
    fontSize: 15,
    color: '#4F46E5',
  },
  suggestionsPanel: {
    marginTop: 8,
    borderRadius: 22,
    backgroundColor: 'rgba(15,23,42,0.92)',
    maxHeight: 220,
  },
  suggestionsContent: {
    paddingVertical: 4,
  },
  suggestionRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  suggestionTitle: {
    fontFamily: 'exoSemibold',
    fontSize: 15,
    color: '#F8FAFC',
  },
  suggestionSubtitle: {
    marginTop: 2,
    fontFamily: 'exo',
    fontSize: 13,
    color: 'rgba(241,245,249,0.72)',
  },
  noResultsPill: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  noResultsText: {
    fontFamily: 'exo',
    fontSize: 13,
    color: '#0F172A',
  },
  hintOverlay: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(10,12,24,0.72)',
  },
  mapHintText: {
    fontFamily: 'exo',
    fontSize: 13,
    color: '#E2E8F0',
    textAlign: 'center',
  },
  calloutCard: {
    minWidth: 160,
    maxWidth: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  calloutTitle: {
    fontFamily: 'exoSemibold',
    fontSize: 16,
    color: '#0F172A',
  },
  calloutSubtitle: {
    marginTop: 4,
    fontFamily: 'exo',
    fontSize: 13,
    color: '#475569',
  },
  calloutLink: {
    marginTop: 8,
    fontFamily: 'exoSemibold',
    fontSize: 13,
    color: '#2563EB',
  },
});
