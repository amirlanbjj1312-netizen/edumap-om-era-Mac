import { supabase } from '@/lib/supabaseClient';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://edumap-backend-nkr6.onrender.com/api';

export const buildApiUrl = (path: string) => `${API_BASE_URL}${path}`;

export async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { headers, ...restOptions } = options;
  const response = await fetch(buildApiUrl(path), {
    ...restOptions,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
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

export async function loadSchoolById(schoolId: string) {
  return requestJson<{ data: any }>(
    `/schools/${encodeURIComponent(schoolId)}?include_inactive=1&include_hidden=1`
  );
}

export async function upsertSchool(profile: any) {
  const token = await getAccessToken();
  if (!token) throw new Error('Authorization token is required');
  return authRequestJson<{ data: any }>('/schools', {
    token,
    method: 'POST',
    body: safeStringify(profile),
  });
}

export async function autofillSchoolLocales(profile: any) {
  const token = await getAccessToken();
  if (!token) throw new Error('Authorization token is required');
  return authRequestJson<{ data: any }>('/schools/translate-locales', {
    token,
    method: 'POST',
    body: safeStringify(profile),
  });
}

export async function deleteSchool(schoolId: string) {
  const token = await getAccessToken();
  if (!token) throw new Error('Authorization token is required');
  return authRequestJson<{ data: any[] }>(`/schools/${encodeURIComponent(schoolId)}`, {
    token,
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
export async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || '';
}

export async function getChatRoom(token: string, roomKey: string) {
  return authRequestJson<{ data?: { roomId: string; title?: string } }>(
    `/chat/${encodeURIComponent(roomKey)}`,
    { token }
  );
}

export async function getChatMessages(token: string, roomKey: string) {
  return authRequestJson<{ data?: Array<any> }>(
    `/chat/${encodeURIComponent(roomKey)}/messages?limit=100`,
    { token }
  );
}

export async function sendChatMessage(token: string, roomKey: string, body: string) {
  return authRequestJson<{ data?: any }>(
    `/chat/${encodeURIComponent(roomKey)}/messages`,
    {
      token,
      method: 'POST',
      body: JSON.stringify({ body }),
    }
  );
}

export async function loadAuthUsers(token: string) {
  return authRequestJson<{
    data: Array<{
      id: string;
      email: string;
      role: string;
      createdAt: string;
      firstName?: string;
      lastName?: string;
      bannedUntil?: string | null;
      isActive?: boolean;
    }>;
  }>(
    '/auth/users',
    { token }
  );
}

export async function loadAuthUserDetails(token: string, userId: string) {
  return authRequestJson<{
    data: {
      user: {
        id: string;
        email: string;
        role: string;
        firstName?: string;
        lastName?: string;
        createdAt?: string;
        lastSignInAt?: string;
        bannedUntil?: string | null;
        isActive?: boolean;
      };
      settings: {
        user_id: string;
        email: string;
        first_name?: string;
        last_name?: string;
        subscription?: {
          plan?: string;
          status?: string;
          starts_at?: string;
          ends_at?: string;
          auto_renew?: boolean;
        };
        ai_limits?: {
          chat_bonus?: number;
          selector_bonus?: number;
          bonus_expires_at?: string;
        };
        notes?: string;
        updated_at?: string;
        updated_by?: string;
      };
      analytics: {
        surveyResponsesCount: number;
        consultationRequestsCount: number;
        aiChatRequestsCount: number;
        aiMatchRequestsCount: number;
        mostVisitedSections: string[];
        lastActivityAt?: string;
      };
    };
  }>(`/auth/users/${encodeURIComponent(userId)}/details`, { token });
}

export async function updateAuthUserSettings(
  token: string,
  userId: string,
  payload: {
    first_name?: string;
    last_name?: string;
    subscription?: {
      plan?: string;
      status?: string;
      starts_at?: string;
      ends_at?: string;
      auto_renew?: boolean;
    };
    ai_limits?: {
      chat_bonus?: number;
      selector_bonus?: number;
      bonus_expires_at?: string;
    };
    notes?: string;
  }
) {
  return authRequestJson<{ data: any }>(
    `/auth/users/${encodeURIComponent(userId)}/settings`,
    {
      token,
      method: 'POST',
      body: JSON.stringify(payload),
    }
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

export async function createSchoolAccount(
  token: string,
  payload: { email: string; password: string; schoolId?: string; schoolName?: string }
) {
  return authRequestJson<{
    data: { id: string; email: string; role: string; schoolId: string };
  }>('/auth/create-school-account', {
    token,
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function loadSchoolAccessLog(token: string) {
  return authRequestJson<{
    data: Array<{
      id: string;
      email: string;
      password: string;
      schoolId: string;
      createdAt: string;
      actor?: string;
      status?: string;
    }>;
  }>('/auth/school-access-log', { token });
}

export async function loadParentFooterSettings() {
  return requestJson<{
    data: {
      socials?: {
        instagram_url?: string;
        telegram_url?: string;
        whatsapp_url?: string;
      };
      contacts?: {
        phone_primary?: string;
        phone_secondary?: string;
        email?: string;
      };
      legal?: {
        privacy_url?: string;
        privacy_name?: string;
        terms_url?: string;
        terms_name?: string;
        faq_url?: string;
      };
      updated_at?: string;
      updated_by?: string;
    };
  }>('/site-settings/parent-footer');
}

export async function updateParentFooterSettings(token: string, payload: any) {
  return authRequestJson<{ data: any }>('/site-settings/parent-footer', {
    token,
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function clearSchoolAccessLog(token: string) {
  return authRequestJson<{ data: Array<any> }>('/auth/school-access-log', {
    token,
    method: 'DELETE',
  });
}

export async function deleteSchoolAccessLogEntry(token: string, id: string) {
  return authRequestJson<{ ok: true }>(
    `/auth/school-access-log/${encodeURIComponent(id)}`,
    {
      token,
      method: 'DELETE',
    }
  );
}

export async function deleteSchoolAccessLogEntryFull(
  token: string,
  payload: { id: string; email?: string; schoolId?: string }
) {
  const params = new URLSearchParams();
  if (payload.email) params.set('email', payload.email);
  if (payload.schoolId) params.set('schoolId', payload.schoolId);
  const query = params.toString();
  return authRequestJson<{ ok: true; data: { logDeleted: boolean; userDeleted: boolean; schoolDeleted: boolean } }>(
    `/auth/school-access-log/${encodeURIComponent(payload.id)}/full${query ? `?${query}` : ''}`,
    {
      token,
      method: 'DELETE',
    }
  );
}

export async function updateSchoolAccessLogStatus(
  token: string,
  id: string,
  status: 'создан' | 'выдан' | 'заполнен'
) {
  return authRequestJson<{
    data: {
      id: string;
      email: string;
      password: string;
      schoolId: string;
      createdAt: string;
      actor?: string;
      status: string;
    };
  }>(`/auth/school-access-log/${encodeURIComponent(id)}`, {
    token,
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function upsertSchoolAccessLogEntry(
  token: string,
  payload: {
    id: string;
    email: string;
    password?: string;
    schoolId?: string;
    createdAt?: string;
    status?: 'создан' | 'выдан' | 'заполнен';
  }
) {
  return authRequestJson<{
    data: {
      id: string;
      email: string;
      password: string;
      schoolId: string;
      createdAt: string;
      actor?: string;
      status: string;
    };
  }>('/auth/school-access-log', {
    token,
    method: 'POST',
    body: JSON.stringify(payload),
  });
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

export async function resetSchoolRating(token: string, schoolId: string) {
  return authRequestJson<{ ok: true }>(
    `/schools/reviews/reset-school/${encodeURIComponent(schoolId)}`,
    { token, method: 'POST' }
  );
}

export async function loadNewsFeed() {
  return requestJson<{ data: Array<any> }>('/news');
}

export async function createNewsItem(token: string, payload: any) {
  return authRequestJson<{ data: any }>('/news', {
    token,
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateNewsItem(token: string, id: string, payload: any) {
  return authRequestJson<{ data: any }>(`/news/${encodeURIComponent(id)}`, {
    token,
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteNewsItem(token: string, id: string) {
  return authRequestJson<{ data: Array<any> }>(`/news/${encodeURIComponent(id)}`, {
    token,
    method: 'DELETE',
  });
}

export async function loadCourseTests() {
  return requestJson<{ data: Record<string, any[]> }>('/courses/tests');
}

export async function upsertCourseTest(token: string, payload: { subjectId: string; test: any }) {
  return authRequestJson<{ data: any }>('/courses/tests', {
    token,
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function upsertCourseQuestion(
  token: string,
  payload: { subjectId: string; testId: string; question: any }
) {
  return authRequestJson<{ data: any }>('/courses/questions', {
    token,
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteCourseTest(token: string, subjectId: string, testId: string) {
  return authRequestJson<{ data: Record<string, any[]> }>(
    `/courses/tests/${encodeURIComponent(subjectId)}/${encodeURIComponent(testId)}`,
    { token, method: 'DELETE' }
  );
}

export async function loadProgramInfoAnalytics(
  token: string,
  options: { days?: number; limit?: number } = {}
) {
  const days = Number.isFinite(options.days) ? Math.max(1, Math.floor(options.days as number)) : 30;
  const limit = Number.isFinite(options.limit) ? Math.max(1, Math.floor(options.limit as number)) : 10;
  const query = `days=${encodeURIComponent(String(days))}&limit=${encodeURIComponent(String(limit))}`;
  return authRequestJson<{
    data: {
      days: number;
      totals: { open: number; read_more: number; close: number };
      topPrograms: Array<{ program_name: string; open: number; read_more: number; close: number }>;
      topSchools: Array<{
        school_id: string;
        school_name: string;
        open: number;
        read_more: number;
        close: number;
      }>;
      sampled_events: number;
    };
  }>(`/schools/analytics/program-info?${query}`, { token });
}

export async function recordEngagementEvent(payload: {
  eventType: 'school_card_view' | 'compare_add' | 'ai_match_run' | 'ai_chat_open' | 'ai_chat_message' | 'guest_gate_click';
  schoolId?: string;
  locale?: 'ru' | 'kk' | 'en';
  source?: string;
  metadata?: Record<string, unknown>;
}) {
  const token = await getAccessToken();
  return requestJson<{ ok: boolean }>('/schools/analytics/engagement', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: JSON.stringify(payload),
  });
}

export async function loadEngagementAnalytics(
  token: string,
  options: { days?: number; limit?: number } = {}
) {
  const days = Number.isFinite(options.days) ? Math.max(1, Math.floor(options.days as number)) : 30;
  const limit = Number.isFinite(options.limit) ? Math.max(1, Math.floor(options.limit as number)) : 10;
  const query = `days=${encodeURIComponent(String(days))}&limit=${encodeURIComponent(String(limit))}`;
  return authRequestJson<{
    data: {
      days: number;
      reset_at?: string | null;
      sampled_events: number;
      topEvents: Array<{
        event_type: string;
        all: number;
        guest: number;
        auth: number;
      }>;
      timeline: Array<{
        date: string;
        school_card_view: number;
        compare_add: number;
        ai_match_run: number;
        ai_chat_open: number;
        ai_chat_message: number;
        guest_gate_click: number;
      }>;
      topSchools: Array<{
        school_id: string;
        school_name: string;
        views: number;
        compare_adds: number;
        guest_views: number;
        auth_views: number;
      }>;
    };
  }>(`/schools/analytics/engagement?${query}`, { token });
}

export async function resetEngagementAnalytics(token: string) {
  return authRequestJson<{
    data: {
      ok: boolean;
      resetAt: string;
    };
  }>('/schools/analytics/engagement/reset', {
    token,
    method: 'POST',
  });
}

export async function requestAiSchoolChat(
  token: string,
  payload: { message: string; schoolIds: string[] }
) {
  return authRequestJson<{
    data: {
      reply: string;
      recommendedSchoolIds: string[];
    };
  }>('/ai/school-chat', {
    token,
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function loadTestBillingTariffs() {
  return requestJson<{
    data: Array<{
      id: string;
      name: string;
      price_kzt: number;
      duration_days: number;
      priority_weight: number;
      description?: string;
    }>;
  }>('/schools/billing/tariffs');
}

export async function runSchoolTestPayment(
  token: string,
  schoolId: string,
  payload: { tariffId: string }
) {
  return authRequestJson<{
    data: {
      school_id: string;
      payment: {
        id: string;
        status: 'paid';
        tariff_id: string;
        amount_kzt: number;
        paid_at: string;
      };
      monetization: any;
      profile: any;
    };
  }>(`/schools/${encodeURIComponent(schoolId)}/payments/test`, {
    token,
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateSchoolMonetization(
  schoolId: string,
  monetization: {
    is_promoted: boolean;
    subscription_status: 'inactive' | 'active' | 'paused' | 'expired';
    plan_name: string;
    priority_weight: number;
    starts_at: string;
    ends_at: string;
    last_tariff_id: string;
  }
) {
  const token = await getAccessToken();
  if (!token) throw new Error('Authorization token is required');
  return authRequestJson<{ data: any }>(
    `/schools/${encodeURIComponent(schoolId)}/monetization`,
    {
      token,
      method: 'POST',
      body: JSON.stringify({ monetization }),
    }
  );
}

export async function loadRatingSurveyConfig(token: string) {
  return authRequestJson<{
    data: {
      cycle_days: number;
      updated_at: string;
      updated_by: string;
      questions: Array<{
        id: string;
        text: string;
        description?: string;
        type?: 'rating' | 'single_choice' | 'text';
        options?: Array<{ id?: string; label: string; score?: number }>;
        required?: boolean;
        order?: number;
        enabled: boolean;
      }>;
    };
  }>('/schools/rating-surveys/config', { token });
}

export async function updateRatingSurveyConfig(
  token: string,
  payload: {
    cycleDays: number;
    questions: Array<{
      id?: string;
      text: string;
      description?: string;
      type?: 'rating' | 'single_choice' | 'text';
      options?: Array<{ id?: string; label: string; score?: number }>;
      required?: boolean;
      order?: number;
      enabled?: boolean;
    }>;
  }
) {
  return authRequestJson<{ data: any }>('/schools/rating-surveys/config', {
    token,
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function loadRatingSurveyCampaigns(token: string) {
  return authRequestJson<{
    data: Array<{
      id: string;
      title: string;
      description?: string;
      send_at: string;
      status: 'draft' | 'scheduled' | 'active' | 'closed';
      school_ids: string[];
      target_type?: 'school' | 'all_parents' | 'specific_parents';
      parent_emails?: string[];
      school_names?: string[];
      target_label?: string;
      responses_count?: number;
      unique_users_count?: number;
    }>;
  }>('/schools/rating-surveys/campaigns', { token });
}

export async function createRatingSurveyCampaign(
  token: string,
  payload: {
    title: string;
    description?: string;
    schoolIds?: string[];
    targetType?: 'school' | 'all_parents' | 'specific_parents';
    parentEmails?: string[];
    sendAt?: string;
  }
) {
  return authRequestJson<{ data: any }>('/schools/rating-surveys/campaigns', {
    token,
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function closeRatingSurveyCampaign(token: string, campaignId: string) {
  return authRequestJson<{ data: any }>(
    `/schools/rating-surveys/campaigns/${encodeURIComponent(campaignId)}/close`,
    {
      token,
      method: 'POST',
    }
  );
}

export async function loadRatingSurveyAnalytics(token: string) {
  return authRequestJson<{
    data: {
      config: any;
      campaigns_count: number;
      responses_count: number;
      schools: Array<{
        school_id: string;
        school_name: string;
        responses_count: number;
        survey_average: number;
        consultations_count: number;
        popularity_count: number;
        current_rating: number;
        calculated_rating: number;
        formula: {
          rating: number;
          survey: number;
          consultations: number;
          popularity: number;
        };
      }>;
    };
  }>('/schools/rating-surveys/analytics', { token });
}

export async function loadActiveRatingSurveys(token: string) {
  return authRequestJson<{
    data: Array<{
      id: string;
      title: string;
      description?: string;
      school_ids: string[];
      school_options: Array<{ id: string; name: string; answered: boolean }>;
      send_at: string;
      questions: Array<{
        id: string;
        text: string;
        description?: string;
        type?: 'rating' | 'single_choice' | 'text';
        options?: Array<{ id?: string; label: string; score?: number }>;
        required?: boolean;
        order?: number;
        enabled: boolean;
      }>;
    }>;
  }>('/schools/rating-surveys/active', { token });
}

export async function submitRatingSurveyResponse(
  token: string,
  payload: {
    campaignId: string;
    schoolId: string;
    comment?: string;
    answers: Array<{
      questionId: string;
      questionType?: 'rating' | 'single_choice' | 'text';
      score?: number;
      optionId?: string;
      optionLabel?: string;
      text?: string;
    }>;
  }
) {
  return authRequestJson<{ data: any }>('/schools/rating-surveys/responses', {
    token,
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
