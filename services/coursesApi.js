import { buildApiUrl } from '../config/apiConfig';
import { supabase } from './supabaseClient';

const withJsonHeaders = (headers = {}) => ({
  'Content-Type': 'application/json',
  ...headers,
});

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

const getAccessToken = async () => {
  if (!supabase) return '';
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || '';
};

export const loadCourseTests = async () => {
  const payload = await requestJson('/courses/tests');
  return payload?.data && typeof payload.data === 'object' ? payload.data : {};
};

export const upsertCourseTestApi = async ({ subjectId, test }) => {
  const token = await getAccessToken();
  if (!token) throw new Error('Authorization token is required');
  const payload = await requestJson('/courses/tests', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ subjectId, test }),
  });
  return payload?.data;
};

export const upsertCourseQuestionApi = async ({ subjectId, testId, question }) => {
  const token = await getAccessToken();
  if (!token) throw new Error('Authorization token is required');
  const payload = await requestJson('/courses/questions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ subjectId, testId, question }),
  });
  return payload?.data;
};

export const deleteCourseTestApi = async ({ subjectId, testId }) => {
  const token = await getAccessToken();
  if (!token) throw new Error('Authorization token is required');
  const payload = await requestJson(
    `/courses/tests/${encodeURIComponent(subjectId)}/${encodeURIComponent(testId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return payload?.data;
};
