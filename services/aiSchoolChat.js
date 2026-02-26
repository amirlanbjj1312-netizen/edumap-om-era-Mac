import { buildApiUrl } from '../config/apiConfig';

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

export const askSchoolChat = async (message, schoolIds = []) => {
  const payload = await requestJson('/ai/school-chat', {
    method: 'POST',
    body: JSON.stringify({ message, schoolIds }),
  });
  return payload?.data || null;
};
