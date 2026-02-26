import { buildApiUrl } from '../config/apiConfig';
import { supabase } from './supabaseClient';

const requestJson = async (path, options = {}) => {
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
};
const getAccessToken = async () => {
  if (!supabase) return '';
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || '';
};

export const parseSchoolQuery = async (query) => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Authorization token is required');
  }
  const payload = await requestJson('/ai/school-query', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query }),
  });
  return payload?.data || null;
};
