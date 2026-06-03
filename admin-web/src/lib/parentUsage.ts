import type { ParentPlanState } from '@/lib/parentSubscription';

export const getAiChatLeft = (_plan: ParentPlanState): number => 0;

export const consumeAiChat = (
  _plan: ParentPlanState
): { ok: boolean; left: number | null } => ({ ok: true, left: null });

export const getAiMatchLeft = (_plan: ParentPlanState): number | null => null;

export const consumeAiMatch = (
  _plan: ParentPlanState
): { ok: boolean; left: number | null } => ({ ok: true, left: null });
