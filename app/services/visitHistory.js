import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = 'EDUMAP_VISITED_SCHOOLS_V1';

const buildKey = (userKey) => `${STORAGE_PREFIX}:${userKey || 'guest'}`;

const safeParse = (raw) => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.warn('[visitHistory] Failed to parse storage payload', error);
    return {};
  }
};

const loadHistory = async (userKey) => {
  try {
    const raw = await AsyncStorage.getItem(buildKey(userKey));
    return safeParse(raw);
  } catch (error) {
    console.warn('[visitHistory] Failed to load history', error);
    return {};
  }
};

const persistHistory = async (userKey, map) => {
  try {
    await AsyncStorage.setItem(buildKey(userKey), JSON.stringify(map));
  } catch (error) {
    console.warn('[visitHistory] Failed to persist history', error);
  }
};

export const recordVisit = async ({
  userKey,
  schoolId,
  schoolName,
  schoolCity,
}) => {
  if (!schoolId) return null;
  const map = await loadHistory(userKey);
  const prev = map[schoolId] || {};
  const entry = {
    schoolId,
    schoolName: schoolName || prev.schoolName || 'Неизвестная школа',
    schoolCity: schoolCity || prev.schoolCity || '',
    count: (prev.count || 0) + 1,
    lastVisited: Date.now(),
  };
  const next = { ...map, [schoolId]: entry };
  await persistHistory(userKey, next);
  return entry;
};

export const getTopVisitedSchool = async (userKey) => {
  const map = await loadHistory(userKey);
  const entries = Object.values(map);
  if (!entries.length) return null;

  const sorted = entries.sort((a, b) => {
    const countDiff = (b.count || 0) - (a.count || 0);
    if (countDiff !== 0) return countDiff;
    return (b.lastVisited || 0) - (a.lastVisited || 0);
  });

  return sorted[0] || null;
};

export const getVisitHistory = async (userKey) => loadHistory(userKey);
