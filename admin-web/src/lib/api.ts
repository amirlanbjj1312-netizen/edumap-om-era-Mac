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
  return requestJson<{ data: any[] }>('/schools?include_inactive=1&include_hidden=1');
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

type AuthRequestOptions = RequestInit & { token: string };

async function authRequestJson<T>(path: string, options: AuthRequestOptions): Promise<T> {
  const { token, headers, ...rest } = options;
  return requestJson<T>(path, {
    ...rest,
    headers: {
      ...(headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function loadAuthUsers(token: string) {
  return authRequestJson<{ data: Array<{ id: string; email: string; role: string; createdAt: string }> }>(
    '/auth/users',
    { token }
  );
}

export async function setUserRole(token: string, email: string, role: string) {
  return authRequestJson<{ data: { id: string; email: string; role: string } }>(
    '/auth/set-role',
    {
      token,
      method: 'POST',
      body: JSON.stringify({ email, role }),
    }
  );
}

export async function setAuthUserStatus(token: string, userId: string, active: boolean) {
  return authRequestJson<{ data: { id: string; isActive: boolean } }>(
    `/auth/users/${encodeURIComponent(userId)}/status`,
    {
      token,
      method: 'POST',
      body: JSON.stringify({ active }),
    }
  );
}

export async function loadAllReviews(token: string) {
  return authRequestJson<{
    data: Array<{
      id: string;
      school_id: string;
      school_name: string;
      author: string;
      text: string;
      rating: number;
      created_at: string;
    }>;
  }>('/schools/reviews/all', { token });
}

export async function deleteReviewById(token: string, reviewId: string) {
  return authRequestJson<{ ok: true }>(
    `/schools/reviews/${encodeURIComponent(reviewId)}`,
    { token, method: 'DELETE' }
  );
}
