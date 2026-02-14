const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://edumap-backend-nkr6.onrender.com/api';

export const buildApiUrl = (path: string) => `${API_BASE_URL}${path}`;

export async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (payload as any)?.error || (payload as any)?.message || 'Request failed';
    throw new Error(message);
  }
  return payload as T;
}

const safeStringify = (value: any) => {
  const seen = new WeakSet();
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === 'object') {
      if (seen.has(val)) return undefined;
      seen.add(val);
    }
    return val;
  });
};

export async function loadSchools() {
  return requestJson<{ data: any[] }>('/schools');
}

export async function upsertSchool(profile: any) {
  return requestJson<{ data: any }>('/schools', {
    method: 'POST',
    body: safeStringify(profile),
  });
}

export async function deleteSchool(schoolId: string) {
  return requestJson<{ data: any[] }>(`/schools/${encodeURIComponent(schoolId)}`, {
    method: 'DELETE',
  });
}
