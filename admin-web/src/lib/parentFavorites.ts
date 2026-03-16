const FAVORITES_KEY = 'EDUMAP_PARENT_FAVORITE_IDS_V1';
const FAVORITES_EVENT = 'edumap-parent-favorite-change';

export const getFavoriteIds = (): string[] => {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(FAVORITES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item)).filter(Boolean);
  } catch {
    return [];
  }
};

const saveFavoriteIds = (ids: string[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent(FAVORITES_EVENT, { detail: ids }));
};

export const toggleFavoriteId = (schoolId: string) => {
  const current = getFavoriteIds();
  if (!schoolId) return { ids: current, added: false };
  if (current.includes(schoolId)) {
    const next = current.filter((id) => id !== schoolId);
    saveFavoriteIds(next);
    return { ids: next, added: false };
  }
  const next = [...current, schoolId];
  saveFavoriteIds(next);
  return { ids: next, added: true };
};

export const clearFavoriteIds = () => saveFavoriteIds([]);

export const subscribeFavoriteIds = (cb: (ids: string[]) => void) => {
  if (typeof window === 'undefined') return () => {};
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<string[]>).detail;
    cb(Array.isArray(detail) ? detail : getFavoriteIds());
  };
  const storageHandler = (event: StorageEvent) => {
    if (event.key === FAVORITES_KEY) cb(getFavoriteIds());
  };
  window.addEventListener(FAVORITES_EVENT, handler as EventListener);
  window.addEventListener('storage', storageHandler);
  return () => {
    window.removeEventListener(FAVORITES_EVENT, handler as EventListener);
    window.removeEventListener('storage', storageHandler);
  };
};
