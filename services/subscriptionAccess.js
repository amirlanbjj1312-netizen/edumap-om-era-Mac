import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildApiUrl } from '../config/apiConfig';
import { supabase } from './supabaseClient';

const PLAN_KEY_PREFIX = 'EDUMAP_PARENT_PLAN_V1';
const USAGE_KEY_PREFIX = 'EDUMAP_PARENT_USAGE_V1';

const PLAN_CONFIG = {
  trial: {
    periodDays: 3,
    limits: {
      ai_chat: { limit: 1, window: 'day' },
      ai_match: { limit: 3, window: 'plan' },
      compare_table: { limit: 1, window: 'day' },
    },
  },
  standard: {
    periodDays: 30,
    limits: {
      ai_chat: { limit: 3, window: 'day' },
      ai_match: { limit: 5, window: 'day' },
      compare_table: { limit: null, window: 'plan' },
    },
  },
  pro: {
    periodDays: 90,
    limits: {
      ai_chat: { limit: 10, window: 'day' },
      ai_match: { limit: null, window: 'plan' },
      compare_table: { limit: null, window: 'plan' },
    },
  },
};

const REMOTE_CACHE_TTL_MS = 60 * 1000;

const buildUserKey = (value) => String(value || 'guest').trim().toLowerCase() || 'guest';
const nowIso = () => new Date().toISOString();
const toTs = (value) => {
  const ts = new Date(value || '').getTime();
  return Number.isFinite(ts) ? ts : null;
};

const getPlanStorageKey = (userKey) => `${PLAN_KEY_PREFIX}:${buildUserKey(userKey)}`;
const getUsageStorageKey = (userKey) => `${USAGE_KEY_PREFIX}:${buildUserKey(userKey)}`;

const safeParse = (raw, fallback) => {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch (_error) {
    return fallback;
  }
};

const normalizePlanId = (value) => {
  const key = String(value || '').trim().toLowerCase();
  if (key === 'standard' || key === 'pro' || key === 'trial') return key;
  return 'trial';
};

const getPlanConfig = (planId) => PLAN_CONFIG[planId] || PLAN_CONFIG.trial;

const hasPlanExpired = (plan) => {
  const expiresAtTs = toTs(plan?.expiresAt);
  if (!expiresAtTs) return false;
  return Date.now() > expiresAtTs;
};

const buildNewPlanPayload = (planId) => {
  const config = getPlanConfig(planId);
  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime());
  expiresAt.setDate(expiresAt.getDate() + config.periodDays);
  return {
    planId,
    startedAt: startedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    updatedAt: nowIso(),
  };
};

const withRemotePlan = (localPlan, remotePlanId) => {
  if (!remotePlanId || remotePlanId === localPlan.planId) return localPlan;
  const next = buildNewPlanPayload(remotePlanId);
  return {
    ...next,
    updatedAt: localPlan.updatedAt || next.updatedAt,
  };
};

let remoteEntitlementsCache = {
  fetchedAt: 0,
  token: '',
  data: null,
};

const getAccessToken = async () => {
  if (!supabase) return '';
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || '';
};

const requestRemoteEntitlements = async () => {
  const token = await getAccessToken();
  if (!token) return null;

  const now = Date.now();
  if (
    remoteEntitlementsCache.data &&
    remoteEntitlementsCache.token === token &&
    now - remoteEntitlementsCache.fetchedAt < REMOTE_CACHE_TTL_MS
  ) {
    return remoteEntitlementsCache.data;
  }

  try {
    const response = await fetch(buildApiUrl('/auth/me/settings'), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || payload?.message || 'Request failed');
    }
    const settings = payload?.data?.settings || {};
    const expiresAt = String(settings?.ai_limits?.bonus_expires_at || '').trim();
    const notExpired = !expiresAt || (toTs(expiresAt) || 0) > Date.now();
    const next = {
      planId: normalizePlanId(settings?.subscription?.plan),
      aiLimits: {
        chatBonus: notExpired ? Math.max(0, Number(settings?.ai_limits?.chat_bonus) || 0) : 0,
        selectorBonus: notExpired
          ? Math.max(0, Number(settings?.ai_limits?.selector_bonus) || 0)
          : 0,
        bonusExpiresAt: expiresAt,
      },
    };
    remoteEntitlementsCache = {
      fetchedAt: now,
      token,
      data: next,
    };
    return next;
  } catch (_error) {
    return null;
  }
};

const getFeaturePolicy = (planId, feature, entitlements = null) => {
  const config = getPlanConfig(planId);
  const raw = config?.limits?.[feature];
  if (raw == null) return { limit: null, window: 'plan' };
  if (typeof raw === 'number') return { limit: raw, window: 'plan' };
  let limit = raw?.limit ?? null;
  const window = raw?.window === 'day' ? 'day' : 'plan';

  if (limit != null && entitlements?.aiLimits) {
    if (feature === 'ai_chat') {
      limit += entitlements.aiLimits.chatBonus || 0;
    }
    if (feature === 'ai_match') {
      limit += entitlements.aiLimits.selectorBonus || 0;
    }
  }

  return { limit, window };
};

const readUsage = async (userKey) => {
  try {
    const raw = await AsyncStorage.getItem(getUsageStorageKey(userKey));
    const parsed = safeParse(raw, {});
    return parsed;
  } catch (_error) {
    return {};
  }
};

const writeUsage = async (userKey, usage) => {
  try {
    await AsyncStorage.setItem(getUsageStorageKey(userKey), JSON.stringify(usage || {}));
  } catch (_error) {
    // ignore storage failures
  }
};

const getWindowKey = (plan, windowType) =>
  windowType === 'day'
    ? new Date().toISOString().slice(0, 10)
    : String(plan?.startedAt || '');

const isWithinWindow = (entry, plan, windowType) =>
  String(entry?.windowKey || '') === getWindowKey(plan, windowType);

export const getActivePlan = async (userKey) => {
  let localPlan;
  try {
    const raw = await AsyncStorage.getItem(getPlanStorageKey(userKey));
    const parsed = safeParse(raw, null);
    if (!parsed?.planId) {
      localPlan = buildNewPlanPayload('trial');
    } else if (hasPlanExpired(parsed)) {
      localPlan = buildNewPlanPayload('trial');
    } else {
      localPlan = parsed;
    }
  } catch (_error) {
    localPlan = buildNewPlanPayload('trial');
  }

  const entitlements = await requestRemoteEntitlements();
  return withRemotePlan(localPlan, entitlements?.planId);
};

export const setActivePlan = async (userKey, planId) => {
  const normalizedPlan = PLAN_CONFIG[planId] ? planId : 'trial';
  const payload = buildNewPlanPayload(normalizedPlan);
  try {
    await AsyncStorage.setItem(getPlanStorageKey(userKey), JSON.stringify(payload));
    await AsyncStorage.removeItem(getUsageStorageKey(userKey));
  } catch (_error) {
    // ignore storage failures; UI still continues
  }
  return payload;
};

export const getUsageStatus = async (userKey, feature) => {
  const [plan, entitlements] = await Promise.all([
    getActivePlan(userKey),
    requestRemoteEntitlements(),
  ]);
  const policy = getFeaturePolicy(plan.planId, feature, entitlements);
  const limit = policy.limit;
  if (limit == null) {
    return {
      ok: true,
      planId: plan.planId,
      used: 0,
      limit: null,
      remaining: null,
      window: policy.window,
      expiresAt: plan.expiresAt,
    };
  }
  const usage = await readUsage(userKey);
  const currentEntry = usage?.[feature];
  const used = isWithinWindow(currentEntry, plan, policy.window)
    ? Math.max(0, Number(currentEntry?.count) || 0)
    : 0;
  return {
    ok: used < limit,
    planId: plan.planId,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    window: policy.window,
    expiresAt: plan.expiresAt,
  };
};

export const consumeFeatureUsage = async ({ userKey, feature }) => {
  const status = await getUsageStatus(userKey, feature);
  if (!status.ok) return status;
  if (status.limit == null) return status;

  const [plan, entitlements] = await Promise.all([
    getActivePlan(userKey),
    requestRemoteEntitlements(),
  ]);
  const policy = getFeaturePolicy(plan.planId, feature, entitlements);
  const usage = await readUsage(userKey);
  const currentEntry = usage?.[feature];
  const used = isWithinWindow(currentEntry, plan, policy.window)
    ? Math.max(0, Number(currentEntry?.count) || 0)
    : 0;
  const nextUsed = used + 1;
  const nextUsage = {
    ...(usage || {}),
    [feature]: {
      count: nextUsed,
      windowKey: getWindowKey(plan, policy.window),
      updatedAt: nowIso(),
    },
  };
  await writeUsage(userKey, nextUsage);
  return {
    ...status,
    used: nextUsed,
    remaining: Math.max(0, (status.limit || 0) - nextUsed),
    ok: nextUsed <= (status.limit || 0),
  };
};
