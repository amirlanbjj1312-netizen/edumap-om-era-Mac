import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildApiUrl } from '../config/apiConfig';
import { supabase } from './supabaseClient';

const STORAGE_KEY = 'EDUMAP_SCHOOLS_V2';

const loadLocalProfiles = async () => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('[schoolsApi] failed to load local profiles', error);
    return [];
  }
};

const requestJson = async (path, options = {}) => {
  try {
    const response = await fetch(buildApiUrl(path), {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = payload?.error || payload?.message || 'Request failed';
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    return payload;
  } catch (error) {
    console.warn('[schoolsApi] network error', error);
    throw error;
  }
};
const getAccessToken = async () => {
  if (!supabase) return '';
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || '';
};

export const loadSchoolsProfiles = async () => {
  try {
    const payload = await requestJson('/schools');
    const data = Array.isArray(payload?.data) ? payload.data : [];
    if (data.length) {
      return data;
    }
    const local = await loadLocalProfiles();
    if (local.length) {
      await Promise.all(local.map((profile) => upsertSchoolProfile(profile)));
      return local;
    }
    return [];
  } catch (error) {
    const local = await loadLocalProfiles();
    return local;
  }
};

export const upsertSchoolProfile = async (profile) => {
  if (!profile?.school_id) {
    throw new Error('profile.school_id is required');
  }
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Authorization token is required');
  }
  const payload = await requestJson('/schools', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(profile),
  });
  return payload?.data;
};

export const deleteSchoolProfile = async (schoolId) => {
  if (!schoolId) {
    throw new Error('schoolId is required');
  }
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Authorization token is required');
  }
  const payload = await requestJson(`/schools/${schoolId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return Array.isArray(payload?.data) ? payload.data : [];
};
