export type ParentPlanId = 'trial' | 'standard' | 'pro';

export type ParentPlanState = {
  planId: ParentPlanId;
  startedAt: string;
  expiresAt: string;
  updatedAt: string;
};

export const PLAN_LIMITS: Record<
  ParentPlanId,
  { compare: number; aiChat: number; aiMatch: number | null; periodDays: number }
> = {
  trial: { compare: 2, aiChat: 1, aiMatch: 3, periodDays: 3 },
  standard: { compare: 3, aiChat: 3, aiMatch: 5, periodDays: 30 },
  pro: { compare: 5, aiChat: 10, aiMatch: null, periodDays: 90 },
};

const STORAGE_KEY = 'EDUMAP_PARENT_PLAN_WEB_V1';

const toIso = (value: Date) => value.toISOString();

const buildPlan = (planId: ParentPlanId): ParentPlanState => {
  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime());
  expiresAt.setDate(expiresAt.getDate() + PLAN_LIMITS[planId].periodDays);
  return {
    planId,
    startedAt: toIso(startedAt),
    expiresAt: toIso(expiresAt),
    updatedAt: toIso(new Date()),
  };
};

export const getParentPlan = (): ParentPlanState => {
  if (typeof window === 'undefined') return buildPlan('trial');
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return buildPlan('trial');
  try {
    const parsed = JSON.parse(raw) as Partial<ParentPlanState>;
    const planId = parsed?.planId;
    if (planId !== 'trial' && planId !== 'standard' && planId !== 'pro') {
      return buildPlan('trial');
    }
    const expiresAtTs = new Date(parsed.expiresAt || '').getTime();
    if (!Number.isFinite(expiresAtTs) || expiresAtTs < Date.now()) {
      return buildPlan('trial');
    }
    return {
      planId,
      startedAt: String(parsed.startedAt || new Date().toISOString()),
      expiresAt: String(parsed.expiresAt || new Date().toISOString()),
      updatedAt: String(parsed.updatedAt || new Date().toISOString()),
    };
  } catch {
    return buildPlan('trial');
  }
};

export const setParentPlan = (planId: ParentPlanId): ParentPlanState => {
  const next = buildPlan(planId);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
};
