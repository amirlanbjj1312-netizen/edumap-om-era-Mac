"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "EDUMAP_WEB_LOCALE";
const DEFAULT_LOCALE = "ru";
const SUPPORTED = ["ru", "en"];

const messages = {
  ru: {
    "language.ru": "Русский",
    "language.en": "English",
    "home.badge": "EDUMAP Desk",
    "home.title": "Завершите регистрацию школы на компьютере.",
    "home.lede":
      "Почта подтверждена в приложении. Теперь заполните полный профиль школы на ноутбуке, чтобы открыть публикацию и проверку.",
    "home.primary": "Начать регистрацию школы",
    "home.secondary": "Как это работает",
    "home.step1.title": "Войдите с той же почтой",
    "home.step1.text":
      "Используйте аккаунт, который подтвердил регистрацию на телефоне.",
    "home.step2.title": "Заполните профиль школы",
    "home.step2.text": "Добавьте лицензию, контакты, программы и описание.",
    "home.step3.title": "Сохраните и отправьте на проверку",
    "home.step3.text": "Мы проверим и опубликуем данные для родителей.",
    "school.tag": "Шаг на компьютере",
    "school.title": "Заполните профиль школы.",
    "school.lede":
      "Используйте ту же почту, которую подтвердили на телефоне. На этом шаге мы собираем ЭЦП для проверки школы.",
    "school.bullet1": "Подтвержденная почта открывает форму.",
    "school.bullet2": "Загрузите ЭЦП школы на компьютере.",
    "school.bullet3": "Профиль в приложении остается основным.",
    "school.note":
      "Нужна помощь? Пишите на support@edumap.kz или свяжитесь с модератором.",
    "school.account": "Аккаунт",
    "school.accountHint": "Войдите, чтобы продолжить регистрацию.",
    "school.signedIn": "Вы вошли",
    "school.signOut": "Выйти",
    "school.email": "Email",
    "school.password": "Пароль",
    "school.signIn": "Войти",
    "school.loginMissing": "Введите почту и пароль.",
    "school.supabaseMissing": "Supabase еще не настроен.",
    "school.loginSuccess": "Вы успешно вошли.",
    "school.ecpTitle": "ЭЦП (ECP)",
    "school.ecpHint":
      "Загрузите сертификат школы и введите пароль для отправки на проверку.",
    "school.ecpFile": "Файл сертификата (.p12 / .pfx)",
    "school.ecpPassword": "Пароль",
    "school.ecpButton": "Загрузить ЭЦП",
    "school.ecpUploading": "Загрузка...",
    "school.needHelp": "Нужна помощь?",
    "school.ecpMissing": "Прикрепите файл .p12 или .pfx.",
    "school.ecpPassShort": "Пароль должен быть не короче 6 символов.",
    "school.ecpSigninRequired": "Войдите, чтобы загрузить ЭЦП.",
    "school.ecpUploaded":
      "ЭЦП загружена. Теперь можно войти в приложение.",
    "school.ecpFailed": "Не удалось загрузить. Попробуйте еще раз.",
    "school.nextStepsTitle": "Как продолжить",
    "school.nextStepsHint":
      "Выберите, где удобно закончить заполнение данных: в приложении или на сайте.",
    "school.continueApp": "Продолжить в приложении",
    "school.continueWeb": "Продолжить на сайте",
  },
  en: {
    "language.ru": "Russian",
    "language.en": "English",
    "home.badge": "EDUMAP Desk",
    "home.title": "Finish school registration on desktop.",
    "home.lede":
      "Your email is confirmed in the app. Now complete the full school profile on a laptop to unlock publishing and verification.",
    "home.primary": "Start school registration",
    "home.secondary": "See how it works",
    "home.step1.title": "Sign in with the same email",
    "home.step1.text":
      "Use the account that confirmed the signup on your phone.",
    "home.step2.title": "Fill in the school profile",
    "home.step2.text": "Add license, contacts, programs, and public info.",
    "home.step3.title": "Save and send for review",
    "home.step3.text": "We will verify and publish the data for parents.",
    "school.tag": "Desktop step",
    "school.title": "Complete your school profile.",
    "school.lede":
      "Use the same email you confirmed on your phone. This step collects the E-signature so we can verify the school.",
    "school.bullet1": "Verified email unlocks the form.",
    "school.bullet2": "Upload the school ECP on desktop.",
    "school.bullet3": "The mobile profile stays the main source of data.",
    "school.note":
      "Need help? Email support@edumap.kz or contact your moderator.",
    "school.account": "Account",
    "school.accountHint": "Sign in to continue the registration.",
    "school.signedIn": "Signed in",
    "school.signOut": "Sign out",
    "school.email": "Email",
    "school.password": "Password",
    "school.signIn": "Sign in",
    "school.loginMissing": "Enter email and password.",
    "school.supabaseMissing": "Supabase is not configured yet.",
    "school.loginSuccess": "Signed in successfully.",
    "school.ecpTitle": "E-signature (ECP)",
    "school.ecpHint":
      "Upload the school certificate file and enter the password to submit for verification.",
    "school.ecpFile": "Certificate file (.p12 / .pfx)",
    "school.ecpPassword": "Password",
    "school.ecpButton": "Upload ECP",
    "school.ecpUploading": "Uploading...",
    "school.needHelp": "Need help?",
    "school.ecpMissing": "Please attach your .p12 or .pfx file.",
    "school.ecpPassShort": "Password must be at least 6 characters.",
    "school.ecpSigninRequired": "Sign in to upload the ECP.",
    "school.ecpUploaded":
      "E-signature uploaded. You can now log in on the phone to continue.",
    "school.ecpFailed": "Upload failed. Please try again.",
    "school.nextStepsTitle": "Next steps",
    "school.nextStepsHint":
      "Choose where you want to complete the school profile: in the app or on the website.",
    "school.continueApp": "Continue in the app",
    "school.continueWeb": "Continue on the website",
  },
};

const normalizeLocale = (value) =>
  SUPPORTED.includes(value) ? value : DEFAULT_LOCALE;

export const useLocale = () => {
  const [locale, setLocaleState] = useState(DEFAULT_LOCALE);

  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored) {
      setLocaleState(normalizeLocale(stored));
    }
  }, []);

  const setLocale = useCallback((next) => {
    const normalized = normalizeLocale(next);
    setLocaleState(normalized);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, normalized);
    }
  }, []);

  const t = useMemo(
    () => (key) =>
      messages[locale]?.[key] ||
      messages[DEFAULT_LOCALE]?.[key] ||
      key,
    [locale]
  );

  return { locale, setLocale, t };
};
