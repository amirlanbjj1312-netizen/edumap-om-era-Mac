import { PLAN_LIMITS, type ParentPlanState } from '@/lib/parentSubscription';

const USAGE_KEY = 'EDUMAP_PARENT_USAGE_WEB_V1';

type UsageState = {
  planUpdatedAt: string;
  dayKey: string;
  aiChatUsed: number;
  aiMatchDailyUsed: number;
  aiMatchPeriodUsed: number;
};

const getDayKey = () => {
  const date = new Date();
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const defaultState = (plan: ParentPlanState): UsageState => ({
  planUpdatedAt: plan.updatedAt,
  dayKey: getDayKey(),
  aiChatUsed: 0,
  aiMatchDailyUsed: 0,
  aiMatchPeriodUsed: 0,
});

export const getUsage = (plan: ParentPlanState): UsageState => {
  if (typeof window === 'undefined') return defaultState(plan);
  const raw = window.localStorage.getItem(USAGE_KEY);
  if (!raw) return defaultState(plan);
  try {
    const parsed = JSON.parse(raw) as Partial<UsageState>;
    const base = defaultState(plan);
    let next: UsageState = {
      ...base,
      ...parsed,
      planUpdatedAt: String(parsed.planUpdatedAt || base.planUpdatedAt),
      dayKey: String(parsed.dayKey || base.dayKey),
      aiChatUsed: Number(parsed.aiChatUsed || 0),
      aiMatchDailyUsed: Number(parsed.aiMatchDailyUsed || 0),
      aiMatchPeriodUsed: Number(parsed.aiMatchPeriodUsed || 0),
    };
    if (next.planUpdatedAt !== plan.updatedAt) {
      next = defaultState(plan);
    }
    if (next.dayKey !== getDayKey()) {
      next.dayKey = getDayKey();
      next.aiChatUsed = 0;
      next.aiMatchDailyUsed = 0;
    }
    return next;
  } catch {
    return defaultState(plan);
  }
};

const saveUsage = (state: UsageState) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(USAGE_KEY, JSON.stringify(state));
};

export const getAiChatLeft = (plan: ParentPlanState): number => {
  const limits = PLAN_LIMITS[plan.planId];
  const usage = getUsage(plan);
  return Math.max(0, limits.aiChat - usage.aiChatUsed);
};

export const consumeAiChat = (plan: ParentPlanState): { ok: boolean; left: number } => {
  const limits = PLAN_LIMITS[plan.planId];
  const usage = getUsage(plan);
  if (usage.aiChatUsed >= limits.aiChat) {
    return { ok: false, left: 0 };
  }
  usage.aiChatUsed += 1;
  saveUsage(usage);
  return { ok: true, left: Math.max(0, limits.aiChat - usage.aiChatUsed) };
};

export const getAiMatchLeft = (plan: ParentPlanState): number | null => {
  const limits = PLAN_LIMITS[plan.planId];
  if (limits.aiMatch == null) return null;
  const usage = getUsage(plan);
  if (plan.planId === 'trial') {
    return Math.max(0, limits.aiMatch - usage.aiMatchPeriodUsed);
  }
  return Math.max(0, limits.aiMatch - usage.aiMatchDailyUsed);
};

export const consumeAiMatch = (plan: ParentPlanState): { ok: boolean; left: number | null } => {
  const limits = PLAN_LIMITS[plan.planId];
  if (limits.aiMatch == null) return { ok: true, left: null };
  const usage = getUsage(plan);
  if (plan.planId === 'trial') {
    if (usage.aiMatchPeriodUsed >= limits.aiMatch) return { ok: false, left: 0 };
    usage.aiMatchPeriodUsed += 1;
  } else {
    if (usage.aiMatchDailyUsed >= limits.aiMatch) return { ok: false, left: 0 };
    usage.aiMatchDailyUsed += 1;
  }
  saveUsage(usage);
  return { ok: true, left: getAiMatchLeft(plan) };
};

