import { buildApiUrl } from '../config/apiConfig';

export const trackProgramInfoEvent = async ({
  schoolId,
  programName,
  eventType,
  locale,
  expanded = false,
}) => {
  const payload = {
    schoolId: String(schoolId || '').trim(),
    programName: String(programName || '').trim(),
    eventType: String(eventType || '').trim(),
    locale: String(locale || '').trim(),
    expanded: Boolean(expanded),
    source: 'mobile',
  };

  if (!payload.schoolId || !payload.programName || !payload.eventType) {
    return;
  }

  try {
    await fetch(buildApiUrl('/schools/analytics/program-info'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.warn('[programInfoAnalytics] failed to send event', error);
  }
};
