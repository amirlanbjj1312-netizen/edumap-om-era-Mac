import { buildApiUrl } from '../config/apiConfig';
import { supabase } from './supabaseClient';

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
  const payload = await requestJson('/schools');
  return Array.isArray(payload?.data) ? payload.data : [];
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
