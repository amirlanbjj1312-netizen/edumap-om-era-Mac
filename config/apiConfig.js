import Constants from 'expo-constants';

const DEFAULT_API_BASE_URL = 'https://edumap-backend-nkr6.onrender.com/api';

const resolveExtraValue = (value) => {
  if (!value) return undefined;
  if (value.startsWith('${') && value.endsWith('}')) {
    return undefined;
  }
  return value;
};

const extra =
  Constants?.expoConfig?.extra ??
  Constants?.manifest?.extra ??
  Constants?.manifest2?.extraParameters?.expoClient?.extra ??
  {};

export const API_BASE_URL =
  resolveExtraValue(extra.apiBaseUrl) ||
  process.env?.EXPO_PUBLIC_API_URL ||
  DEFAULT_API_BASE_URL;

export const buildApiUrl = (path = '') => {
  const normalizedBase = API_BASE_URL.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
};
