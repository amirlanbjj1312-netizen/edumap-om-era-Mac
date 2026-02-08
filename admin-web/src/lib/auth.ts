export const buildFallbackSchoolId = (value?: string) => {
  const base = (value || 'school')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `local-${base || 'school'}`;
};
