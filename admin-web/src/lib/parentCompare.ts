const COMPARE_KEY = 'EDUMAP_PARENT_COMPARE_IDS_V1';
const COMPARE_EVENT = 'edumap-parent-compare-change';

export const getCompareIds = (): string[] => {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(COMPARE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((v) => String(v)).filter(Boolean);
  } catch {
    return [];
  }
};

const saveCompareIds = (ids: string[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(COMPARE_KEY, JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent(COMPARE_EVENT, { detail: ids }));
};

export const toggleCompareId = (
  schoolId: string,
  maxCount: number
): { ids: string[]; added: boolean; limitReached: boolean } => {
  const current = getCompareIds();
  if (!schoolId) return { ids: current, added: false, limitReached: false };
  if (current.includes(schoolId)) {
    const next = current.filter((id) => id !== schoolId);
    saveCompareIds(next);
    return { ids: next, added: false, limitReached: false };
  }
  if (current.length >= maxCount) {
    return { ids: current, added: false, limitReached: true };
  }
  const next = [...current, schoolId];
  saveCompareIds(next);
  return { ids: next, added: true, limitReached: false };
};

export const clearCompareIds = () => saveCompareIds([]);

export const subscribeCompareIds = (cb: (ids: string[]) => void) => {
  if (typeof window === 'undefined') return () => {};
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<string[]>).detail;
    cb(Array.isArray(detail) ? detail : getCompareIds());
  };
  const storageHandler = (event: StorageEvent) => {
    if (event.key === COMPARE_KEY) cb(getCompareIds());
  };
  window.addEventListener(COMPARE_EVENT, handler as EventListener);
  window.addEventListener('storage', storageHandler);
  return () => {
    window.removeEventListener(COMPARE_EVENT, handler as EventListener);
    window.removeEventListener('storage', storageHandler);
  };
};

