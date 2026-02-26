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
    console.warn('[consultationRequests] network error', error);
    throw error;
  }
};
const getAccessToken = async () => {
  if (!supabase) return '';
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || '';
};

export const loadConsultationRequests = async () => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Authorization token is required');
  }
  const payload = await requestJson('/consultations', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return Array.isArray(payload?.data) ? payload.data : [];
};

export const addConsultationRequest = async (request) => {
  const payload = await requestJson('/consultations', {
    method: 'POST',
    body: JSON.stringify(request),
  });
  return payload?.data;
};
