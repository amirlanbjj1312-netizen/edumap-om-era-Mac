import AsyncStorage from '@react-native-async-storage/async-storage';

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

export const getActivePlan = async (userKey) => {
  try {
    const raw = await AsyncStorage.getItem(getPlanStorageKey(userKey));
    const parsed = safeParse(raw, null);
    if (!parsed?.planId) return buildNewPlanPayload('trial');
    if (hasPlanExpired(parsed)) return buildNewPlanPayload('trial');
    return parsed;
  } catch (_error) {
    return buildNewPlanPayload('trial');
  }
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

const getFeaturePolicy = (planId, feature) => {
  const config = getPlanConfig(planId);
  const raw = config?.limits?.[feature];
  if (raw == null) return { limit: null, window: 'plan' };
  if (typeof raw === 'number') return { limit: raw, window: 'plan' };
  return {
    limit: raw?.limit ?? null,
    window: raw?.window === 'day' ? 'day' : 'plan',
  };
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

export const getUsageStatus = async (userKey, feature) => {
  const plan = await getActivePlan(userKey);
  const policy = getFeaturePolicy(plan.planId, feature);
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

  const plan = await getActivePlan(userKey);
  const policy = getFeaturePolicy(plan.planId, feature);
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
