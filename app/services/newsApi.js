import { buildApiUrl } from '../config/apiConfig';
import { supabase } from './supabaseClient';

const withJsonHeaders = (headers = {}) => ({
  'Content-Type': 'application/json',
  ...headers,
});

const getAccessToken = async () => {
  if (!supabase) return '';
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || '';
};

const requestJson = async (path, options = {}) => {
  const response = await fetch(buildApiUrl(path), {
    ...options,
    headers: withJsonHeaders(options.headers),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error || payload?.message || 'Request failed';
    throw new Error(message);
  }
  return payload;
};

export const fetchNewsFeed = async () => {
  const payload = await requestJson('/news');
  return Array.isArray(payload?.data) ? payload.data : [];
};

export const createNews = async (item) => {
  const token = await getAccessToken();
  if (!token) throw new Error('Authorization token is required');
  const payload = await requestJson('/news', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(item),
  });
  return payload?.data;
};

export const updateNews = async (id, updates) => {
  const token = await getAccessToken();
  if (!token) throw new Error('Authorization token is required');
  const payload = await requestJson(`/news/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  });
  return payload?.data;
};
