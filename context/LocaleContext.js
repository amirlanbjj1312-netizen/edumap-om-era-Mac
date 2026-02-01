import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, translate } from '../utils/i18n';

const STORAGE_KEY = 'EDUMAP_LOCALE';

const LocaleContext = createContext({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key) => key,
});

const normalizeLocale = (value) =>
  SUPPORTED_LOCALES.includes(value) ? value : DEFAULT_LOCALE;

export const LocaleProvider = ({ children }) => {
  const [locale, setLocaleState] = useState(DEFAULT_LOCALE);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (isMounted && stored) {
          setLocaleState(normalizeLocale(stored));
        }
      } catch (error) {
        console.warn('[LocaleProvider] Failed to load locale', error);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const setLocale = async (nextLocale) => {
    const normalized = normalizeLocale(nextLocale);
    setLocaleState(normalized);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, normalized);
    } catch (error) {
      console.warn('[LocaleProvider] Failed to persist locale', error);
    }
  };

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: (key) => translate(locale, key),
    }),
    [locale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

export const useLocale = () => useContext(LocaleContext);
