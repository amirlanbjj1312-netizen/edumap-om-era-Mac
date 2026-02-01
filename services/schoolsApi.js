import AsyncStorage from '@react-native-async-storage/async-storage';
import rawSchools from '../assets/data/schools.json';
import {
  integralDemoProfile,
  internationalSchoolAlmatyProfile,
  almatyLyceum134Profile,
  astanaFutureSchoolProfile,
  astanaDigitalLyceumProfile,
  astanaScienceGymnasiumProfile,
  karagandaSmartSchoolProfile,
  karagandaTechLyceumProfile,
  karagandaMinedSchoolProfile,
} from '../data/integralDemoProfile';
import { createEmptySchoolProfile } from '../utils/schoolProfileTemplate';

const STORAGE_KEY = 'EDUMAP_SCHOOLS_V1';

const deriveCityFromLegacy = (legacy) => {
  if (legacy.city) return legacy.city;
  if (legacy.region?.includes('г.')) {
    return legacy.region.replace('г.', '').trim();
  }
  return '';
};

const legacyToProfile = (legacy) =>
  createEmptySchoolProfile({
    school_id: String(legacy.id),
    basic_info: {
      name: legacy.name || '',
      display_name: '',
      type: legacy.type || '',
      city: deriveCityFromLegacy(legacy),
      address: legacy.address || '',
    },
    location: {
      service_area: legacy.region || '',
    },
  });

const demoProfiles = [
  integralDemoProfile,
  internationalSchoolAlmatyProfile,
  almatyLyceum134Profile,
  astanaFutureSchoolProfile,
  astanaDigitalLyceumProfile,
  astanaScienceGymnasiumProfile,
  karagandaSmartSchoolProfile,
  karagandaTechLyceumProfile,
  karagandaMinedSchoolProfile,
];

const parseStoredProfiles = (value) => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return null;
  } catch (error) {
    console.warn('Failed to parse stored schools', error);
    return null;
  }
};

export const loadSchoolsProfiles = async () => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = parseStoredProfiles(stored);
    if (parsed) {
      return parsed;
    }
    const legacySeed = rawSchools
      .slice(0, 40)
      .map((item) => legacyToProfile(item));
    const legacyIds = new Set(legacySeed.map((item) => item.school_id));
    const demoSeed = demoProfiles
      .filter((profile) => !legacyIds.has(profile.school_id))
      .map((profile) => createEmptySchoolProfile(profile));
    const seed = [...demoSeed, ...legacySeed];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  } catch (error) {
    console.warn('loadSchoolsProfiles error', error);
    return [];
  }
};

export const upsertSchoolProfile = async (profile) => {
  if (!profile?.school_id) {
    throw new Error('profile.school_id is required');
  }

  const current = await loadSchoolsProfiles();
  const next = [...current];
  const index = next.findIndex((item) => item.school_id === profile.school_id);

  if (index === -1) {
    next.push(profile);
  } else {
    next[index] = profile;
  }

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return profile;
};

export const deleteSchoolProfile = async (schoolId) => {
  if (!schoolId) {
    throw new Error('schoolId is required');
  }

  const current = await loadSchoolsProfiles();
  const next = current.filter((item) => item.school_id !== schoolId);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
};
