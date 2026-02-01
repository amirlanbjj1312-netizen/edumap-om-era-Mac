import { buildApiUrl } from '../config/apiConfig';

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

export const loadConsultationRequests = async () => {
  const payload = await requestJson('/consultations');
  return Array.isArray(payload?.data) ? payload.data : [];
};

export const addConsultationRequest = async (request) => {
  const payload = await requestJson('/consultations', {
    method: 'POST',
    body: JSON.stringify(request),
  });
  return payload?.data;
};
