export const GUEST_MODE_KEY = 'EDUMAP_WEB_GUEST_MODE';

export const isGuestMode = () => {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(GUEST_MODE_KEY) === '1';
};

export const setGuestMode = (enabled: boolean) => {
  if (typeof window === 'undefined') return;
  if (enabled) window.localStorage.setItem(GUEST_MODE_KEY, '1');
  else window.localStorage.removeItem(GUEST_MODE_KEY);
};
