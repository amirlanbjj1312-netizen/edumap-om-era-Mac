export type PortalRole = 'user' | 'admin' | 'moderator' | 'superadmin';

export const resolvePortalRole = (raw: unknown): PortalRole => {
  const normalized = String(raw || 'user').trim().toLowerCase();
  if (normalized === 'admin') return 'admin';
  if (normalized === 'moderator') return 'moderator';
  if (normalized === 'superadmin') return 'superadmin';
  return 'user';
};

export const portalHomeByRole = (role: PortalRole): string => {
  if (role === 'user') return '/parent/news';
  return '/school-info';
};
