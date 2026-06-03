import Constants from 'expo-constants';

const resolveExtraValue = (value) => {
  if (!value) {
    return undefined;
  }

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

export const SUPABASE_URL = resolveExtraValue(extra.supabaseUrl);
export const SUPABASE_ANON_KEY = resolveExtraValue(extra.supabaseAnonKey);
