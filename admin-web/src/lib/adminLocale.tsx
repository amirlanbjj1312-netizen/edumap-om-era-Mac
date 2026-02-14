'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type AdminLocale = 'ru' | 'en' | 'kk';

type LocaleContextValue = {
  locale: AdminLocale;
  setLocale: (value: AdminLocale) => void;
  t: (key: string) => string;
};

const STORAGE_KEY = 'EDUMAP_ADMIN_LOCALE';

const LABELS: Record<string, Record<AdminLocale, string>> = {
  navSchoolInfo: {
    ru: 'Информация о школе',
    en: 'School info',
    kk: 'Мектеп туралы',
  },
  navRequests: {
    ru: 'Заявки',
    en: 'Requests',
    kk: 'Өтінімдер',
  },
  navStatistics: {
    ru: 'Статистика',
    en: 'Statistics',
    kk: 'Статистика',
  },
  navProfile: {
    ru: 'Профиль',
    en: 'Profile',
    kk: 'Профиль',
  },
  logout: {
    ru: 'Выйти',
    en: 'Sign out',
    kk: 'Шығу',
  },
  profileTitle: {
    ru: 'Профиль школы',
    en: 'School profile',
    kk: 'Мектеп профилі',
  },
  profileHint: {
    ru: 'Данные берутся из регистрации и могут быть отредактированы.',
    en: 'Data comes from registration and can be edited.',
    kk: 'Деректер тіркеуден алынады және өңдеуге болады.',
  },
  loadingProfile: {
    ru: 'Загрузка профиля...',
    en: 'Loading profile...',
    kk: 'Профиль жүктелуде...',
  },
  profileUnavailable: {
    ru: 'Профиль недоступен.',
    en: 'Profile is unavailable.',
    kk: 'Профиль қолжетімсіз.',
  },
  save: {
    ru: 'Сохранить',
    en: 'Save',
    kk: 'Сақтау',
  },
  saving: {
    ru: 'Сохраняем...',
    en: 'Saving...',
    kk: 'Сақталуда...',
  },
  saved: {
    ru: 'Сохранено.',
    en: 'Saved.',
    kk: 'Сақталды.',
  },
  saveError: {
    ru: 'Ошибка сохранения.',
    en: 'Save failed.',
    kk: 'Сақтау қатесі.',
  },
  deleteSchoolProfile: {
    ru: 'Удалить профиль школы',
    en: 'Delete school profile',
    kk: 'Мектеп профилін жою',
  },
  deleting: {
    ru: 'Удаляем...',
    en: 'Deleting...',
    kk: 'Жойылуда...',
  },
  deleted: {
    ru: 'Профиль школы удален.',
    en: 'School profile deleted.',
    kk: 'Мектеп профилі жойылды.',
  },
  deleteError: {
    ru: 'Не удалось удалить профиль школы.',
    en: 'Failed to delete school profile.',
    kk: 'Мектеп профилін жою мүмкін болмады.',
  },
  confirmDelete: {
    ru: 'Удалить профиль школы? Действие необратимо.',
    en: 'Delete school profile? This cannot be undone.',
    kk: 'Мектеп профилін жоясыз ба? Бұл әрекет қайтарылмайды.',
  },
  fullName: {
    ru: 'ФИО',
    en: 'Full name',
    kk: 'Аты-жөні',
  },
  firstName: {
    ru: 'Имя',
    en: 'First name',
    kk: 'Аты',
  },
  lastName: {
    ru: 'Фамилия',
    en: 'Last name',
    kk: 'Тегі',
  },
  email: {
    ru: 'Email',
    en: 'Email',
    kk: 'Email',
  },
  organization: {
    ru: 'Организация',
    en: 'Organization',
    kk: 'Ұйым',
  },
  contactPhone: {
    ru: 'Контактный телефон',
    en: 'Contact phone',
    kk: 'Байланыс телефоны',
  },
  website: {
    ru: 'Сайт',
    en: 'Website',
    kk: 'Сайт',
  },
  bin: {
    ru: 'БИН',
    en: 'BIN',
    kk: 'БСН',
  },
  iin: {
    ru: 'ИИН представителя',
    en: 'Representative IIN',
    kk: 'Өкілдің ЖСН',
  },
  licenseNumber: {
    ru: 'Номер лицензии',
    en: 'License number',
    kk: 'Лицензия нөмірі',
  },
  licenseIssuedAt: {
    ru: 'Дата выдачи лицензии',
    en: 'License issued at',
    kk: 'Лицензия берілген күні',
  },
  licenseExpiresAt: {
    ru: 'Срок действия лицензии',
    en: 'License expires at',
    kk: 'Лицензия мерзімі',
  },
  requestsTitle: {
    ru: 'Запросы',
    en: 'Requests',
    kk: 'Өтінімдер',
  },
  requestsStub: {
    ru: 'Список заявок появится здесь.',
    en: 'Requests list will appear here.',
    kk: 'Өтінімдер тізімі осында көрсетіледі.',
  },
  statisticsTitle: {
    ru: 'Статистика',
    en: 'Statistics',
    kk: 'Статистика',
  },
  statisticsStub: {
    ru: 'Статистика будет добавлена позже.',
    en: 'Statistics will be added later.',
    kk: 'Статистика кейін қосылады.',
  },
  checkingSession: {
    ru: 'Проверяем сессию...',
    en: 'Checking session...',
    kk: 'Сессия тексерілуде...',
  },
};

const fallbackT = (key: string) => LABELS[key]?.ru || key;

const AdminLocaleContext = createContext<LocaleContextValue>({
  locale: 'ru',
  setLocale: () => {},
  t: fallbackT,
});

export const AdminLocaleProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocale] = useState<AdminLocale>('ru');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as AdminLocale | null;
    if (saved === 'ru' || saved === 'en' || saved === 'kk') {
      setLocale(saved);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, locale);
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key: string) => LABELS[key]?.[locale] || fallbackT(key),
    }),
    [locale]
  );

  return (
    <AdminLocaleContext.Provider value={value}>
      {children}
    </AdminLocaleContext.Provider>
  );
};

export const useAdminLocale = () => useContext(AdminLocaleContext);
