export const buildFallbackSchoolId = (value?: string) => {
  const localPart = String(value || 'school')
    .trim()
    .toLowerCase()
    .split('@')[0];
  const base = localPart
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `school-${base || 'school'}`;
};
