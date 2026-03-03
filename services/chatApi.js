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

const withAuth = async (options = {}) => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Authorization token is required');
  }
  return {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  };
};

export const getGeneralRoom = async () => {
  const authOptions = await withAuth();
  const payload = await requestJson('/chat/general', authOptions);
  return payload?.data || null;
};

export const getGeneralMessages = async () => {
  const authOptions = await withAuth();
  const payload = await requestJson('/chat/general/messages?limit=100', authOptions);
  return Array.isArray(payload?.data) ? payload.data : [];
};

export const sendGeneralMessage = async (body) => {
  const authOptions = await withAuth({
    method: 'POST',
    body: JSON.stringify({ body }),
  });
  const payload = await requestJson('/chat/general/messages', authOptions);
  return payload?.data || null;
};
