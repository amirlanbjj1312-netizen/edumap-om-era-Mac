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
  navUsers: {
    ru: 'Пользователи',
    en: 'Users',
    kk: 'Пайдаланушылар',
  },
  navSchools: {
    ru: 'Школы',
    en: 'Schools',
    kk: 'Мектептер',
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
    ru: 'Деактивировать школу',
    en: 'Deactivate school',
    kk: 'Мектепті өшіру',
  },
  deleting: {
    ru: 'Удаляем...',
    en: 'Deleting...',
    kk: 'Жойылуда...',
  },
  deleted: {
    ru: 'Школа деактивирована.',
    en: 'School deactivated.',
    kk: 'Мектеп өшірілді.',
  },
  deleteError: {
    ru: 'Не удалось удалить профиль школы.',
    en: 'Failed to delete school profile.',
    kk: 'Мектеп профилін жою мүмкін болмады.',
  },
  confirmDelete: {
    ru: 'Деактивировать школу? Ее можно будет снова активировать в разделе "Школы".',
    en: 'Deactivate school? You can activate it again in "Schools".',
    kk: 'Мектепті өшіру керек пе? Кейін "Мектептер" бөлімінде қайта іске қоса аласыз.',
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
    ru: 'Заявки',
    en: 'Requests',
    kk: 'Өтінімдер',
  },
  requestsRefresh: {
    ru: 'Обновить',
    en: 'Refresh',
    kk: 'Жаңарту',
  },
  requestsLoading: {
    ru: 'Загрузка заявок...',
    en: 'Loading requests...',
    kk: 'Өтінімдер жүктелуде...',
  },
  requestsEmpty: {
    ru: 'Пока нет заявок.',
    en: 'No requests yet.',
    kk: 'Әзірге өтінімдер жоқ.',
  },
  requestsPhone: {
    ru: 'Телефон:',
    en: 'Phone:',
    kk: 'Телефон:',
  },
  requestsEmail: {
    ru: 'Email:',
    en: 'Email:',
    kk: 'Email:',
  },
  requestsComment: {
    ru: 'Комментарий:',
    en: 'Comment:',
    kk: 'Пікір:',
  },
  requestsSchool: {
    ru: 'Школа:',
    en: 'School:',
    kk: 'Мектеп:',
  },
  schoolsTitle: {
    ru: 'Управление школами',
    en: 'Schools management',
    kk: 'Мектептерді басқару',
  },
  schoolsHint: {
    ru: 'Модератор может деактивировать школу и скрывать ее из пользовательского кабинета.',
    en: 'Moderator can deactivate schools and hide them from user cabinet.',
    kk: 'Модератор мектепті өшіріп, пайдаланушы кабинетінен жасыра алады.',
  },
  schoolsRefresh: {
    ru: 'Обновить',
    en: 'Refresh',
    kk: 'Жаңарту',
  },
  schoolsLoading: {
    ru: 'Загрузка школ...',
    en: 'Loading schools...',
    kk: 'Мектептер жүктелуде...',
  },
  schoolsEmpty: {
    ru: 'Школы не найдены.',
    en: 'No schools found.',
    kk: 'Мектептер табылмады.',
  },
  schoolsSearch: {
    ru: 'Поиск по названию, email, school_id',
    en: 'Search by name, email, school_id',
    kk: 'Атауы, email, school_id бойынша іздеу',
  },
  schoolsDeactivate: {
    ru: 'Деактивировать',
    en: 'Deactivate',
    kk: 'Өшіру',
  },
  schoolsActivate: {
    ru: 'Активировать',
    en: 'Activate',
    kk: 'Іске қосу',
  },
  schoolsHide: {
    ru: 'Скрыть из ЛК',
    en: 'Hide from LK',
    kk: 'ЛК-дан жасыру',
  },
  schoolsShow: {
    ru: 'Показать в ЛК',
    en: 'Show in LK',
    kk: 'ЛК-да көрсету',
  },
  schoolsEdit: {
    ru: 'Редактировать',
    en: 'Edit',
    kk: 'Өңдеу',
  },
  schoolsStatusActive: {
    ru: 'Активна',
    en: 'Active',
    kk: 'Белсенді',
  },
  schoolsStatusInactive: {
    ru: 'Деактивирована',
    en: 'Inactive',
    kk: 'Өшірілген',
  },
  schoolsStatusHidden: {
    ru: 'Скрыта из ЛК',
    en: 'Hidden from LK',
    kk: 'ЛК-дан жасырылған',
  },
  schoolsStatusVisible: {
    ru: 'Видна в ЛК',
    en: 'Visible in LK',
    kk: 'ЛК-да көрінеді',
  },
  schoolsAudit: {
    ru: 'История действий',
    en: 'Audit log',
    kk: 'Әрекет журналы',
  },
  usersTitle: {
    ru: 'Пользователи и роли',
    en: 'Users and roles',
    kk: 'Пайдаланушылар және рөлдер',
  },
  usersHint: {
    ru: 'Только superadmin может назначать роли.',
    en: 'Only superadmin can assign roles.',
    kk: 'Тек superadmin рөл тағайындай алады.',
  },
  usersEmail: {
    ru: 'Email',
    en: 'Email',
    kk: 'Email',
  },
  usersRole: {
    ru: 'Роль',
    en: 'Role',
    kk: 'Рөл',
  },
  usersSetRole: {
    ru: 'Назначить роль',
    en: 'Set role',
    kk: 'Рөл беру',
  },
  usersLoading: {
    ru: 'Загрузка пользователей...',
    en: 'Loading users...',
    kk: 'Пайдаланушылар жүктелуде...',
  },
  usersForbidden: {
    ru: 'Доступ только для superadmin.',
    en: 'Access only for superadmin.',
    kk: 'Қолжетімділік тек superadmin үшін.',
  },
  usersSaved: {
    ru: 'Роль обновлена.',
    en: 'Role updated.',
    kk: 'Рөл жаңартылды.',
  },
  usersRefresh: {
    ru: 'Обновить',
    en: 'Refresh',
    kk: 'Жаңарту',
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
