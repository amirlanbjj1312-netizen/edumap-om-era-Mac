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
  navNews: {
    ru: 'Новости',
    en: 'News',
    kk: 'Жаңалықтар',
  },
  navCourses: {
    ru: 'Курсы',
    en: 'Courses',
    kk: 'Курстар',
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
  profileNotificationsTitle: {
    ru: 'Уведомления от модератора',
    en: 'Moderator notifications',
    kk: 'Модератор хабарламалары',
  },
  profileNotificationsHint: {
    ru: 'Здесь показываются служебные сообщения от модератора/суперадмина.',
    en: 'Service messages from moderator/superadmin are shown here.',
    kk: 'Мұнда модератор/суперадминнің қызметтік хабарламалары көрінеді.',
  },
  profileNotificationsEmpty: {
    ru: 'Новых уведомлений нет.',
    en: 'No new notifications.',
    kk: 'Жаңа хабарламалар жоқ.',
  },
  profileNotificationsMarkRead: {
    ru: 'Отметить прочитанным',
    en: 'Mark as read',
    kk: 'Оқылды деп белгілеу',
  },
  profileNotificationsUnread: {
    ru: 'Новое',
    en: 'New',
    kk: 'Жаңа',
  },
  profileNotificationsFrom: {
    ru: 'От:',
    en: 'From:',
    kk: 'Кімнен:',
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
  schoolsNotify: {
    ru: 'Отправить уведомление',
    en: 'Send notification',
    kk: 'Хабарлама жіберу',
  },
  schoolsNotifyPrompt: {
    ru: 'Текст уведомления для школы',
    en: 'Notification text for school',
    kk: 'Мектепке арналған хабарлама мәтіні',
  },
  schoolsNotifySent: {
    ru: 'Уведомление отправлено.',
    en: 'Notification sent.',
    kk: 'Хабарлама жіберілді.',
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
  schoolsForbidden: {
    ru: 'Доступ только для moderator или superadmin.',
    en: 'Access only for moderator or superadmin.',
    kk: 'Қолжетімділік тек moderator немесе superadmin үшін.',
  },
  usersTitle: {
    ru: 'Пользователи и роли',
    en: 'Users and roles',
    kk: 'Пайдаланушылар және рөлдер',
  },
  usersHint: {
    ru: 'Moderator и superadmin могут управлять пользователями и отзывами.',
    en: 'Moderator and superadmin can manage users and reviews.',
    kk: 'Moderator мен superadmin пайдаланушылар мен пікірлерді басқара алады.',
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
    ru: 'Доступ только для moderator или superadmin.',
    en: 'Access only for moderator or superadmin.',
    kk: 'Қолжетімділік тек moderator немесе superadmin үшін.',
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
  usersDeactivate: {
    ru: 'Деактивировать',
    en: 'Deactivate',
    kk: 'Өшіру',
  },
  usersActivate: {
    ru: 'Активировать',
    en: 'Activate',
    kk: 'Іске қосу',
  },
  usersStatusActive: {
    ru: 'Активен',
    en: 'Active',
    kk: 'Белсенді',
  },
  usersStatusInactive: {
    ru: 'Деактивирован',
    en: 'Inactive',
    kk: 'Өшірілген',
  },
  usersReviewsTitle: {
    ru: 'Отзывы пользователей',
    en: 'User reviews',
    kk: 'Пайдаланушы пікірлері',
  },
  usersReviewsEmpty: {
    ru: 'Отзывов пока нет.',
    en: 'No reviews yet.',
    kk: 'Пікірлер әзірге жоқ.',
  },
  usersReviewDelete: {
    ru: 'Удалить отзыв',
    en: 'Delete review',
    kk: 'Пікірді жою',
  },
  usersSchool: {
    ru: 'Школа:',
    en: 'School:',
    kk: 'Мектеп:',
  },
  usersAuthor: {
    ru: 'Автор:',
    en: 'Author:',
    kk: 'Автор:',
  },
  usersRating: {
    ru: 'Рейтинг:',
    en: 'Rating:',
    kk: 'Рейтинг:',
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
  statisticsProgramInfoHint: {
    ru: 'Клики родителей по объяснениям учебных программ в мобильной карточке школы.',
    en: 'Parent clicks on curriculum explanations in the mobile school card.',
    kk: 'Мобильді мектеп картасындағы оқу бағдарламасы түсіндірмелеріне ата-аналардың басулары.',
  },
  statisticsProgramInfoOpen: {
    ru: 'Открытия карточки программы',
    en: 'Program card opens',
    kk: 'Бағдарлама карточкасын ашу',
  },
  statisticsProgramInfoReadMore: {
    ru: 'Нажатия "Подробнее"',
    en: '"Read more" clicks',
    kk: '"Толығырақ" басулары',
  },
  statisticsProgramInfoClose: {
    ru: 'Закрытия карточки',
    en: 'Program card closes',
    kk: 'Карточканы жабу',
  },
  statisticsProgramInfoRate: {
    ru: 'Доля "Подробнее" от открытий',
    en: 'Read more rate from opens',
    kk: 'Ашулардан "Толығырақ" үлесі',
  },
  statisticsTopPrograms: {
    ru: 'Топ программ',
    en: 'Top programs',
    kk: 'Үздік бағдарламалар',
  },
  statisticsTopSchools: {
    ru: 'Топ школ',
    en: 'Top schools',
    kk: 'Үздік мектептер',
  },
  statisticsSampledEvents: {
    ru: 'Всего событий за период',
    en: 'Total events for period',
    kk: 'Кезеңдегі барлық оқиғалар',
  },
  newsAdminTitle: {
    ru: 'Управление новостями',
    en: 'News management',
    kk: 'Жаңалықтарды басқару',
  },
  newsAdminHint: {
    ru: 'Публикация и редактирование новостей для пользовательского ЛК.',
    en: 'Publish and edit news for the user app.',
    kk: 'Пайдаланушы қолданбасына жаңалық жариялау және өңдеу.',
  },
  newsAdminRefresh: {
    ru: 'Обновить',
    en: 'Refresh',
    kk: 'Жаңарту',
  },
  newsAdminPublish: {
    ru: 'Опубликовать',
    en: 'Publish',
    kk: 'Жариялау',
  },
  newsAdminUpdate: {
    ru: 'Сохранить изменения',
    en: 'Save changes',
    kk: 'Өзгерістерді сақтау',
  },
  newsAdminDelete: {
    ru: 'Удалить',
    en: 'Delete',
    kk: 'Жою',
  },
  newsAdminEdit: {
    ru: 'Редактировать',
    en: 'Edit',
    kk: 'Өңдеу',
  },
  newsAdminCancel: {
    ru: 'Отмена',
    en: 'Cancel',
    kk: 'Бас тарту',
  },
  newsAdminEmpty: {
    ru: 'Новостей пока нет.',
    en: 'No news yet.',
    kk: 'Жаңалықтар әлі жоқ.',
  },
  newsAdminForbidden: {
    ru: 'Доступ только для moderator или superadmin.',
    en: 'Access only for moderator or superadmin.',
    kk: 'Қолжетімділік тек moderator немесе superadmin үшін.',
  },
  coursesAdminTitle: {
    ru: 'Управление курсами',
    en: 'Courses management',
    kk: 'Курстарды басқару',
  },
  coursesAdminHint: {
    ru: 'Создавайте и редактируйте тесты и вопросы для раздела обучения.',
    en: 'Create and edit tests and questions for studying section.',
    kk: 'Оқу бөлімі үшін тесттер мен сұрақтарды жасаңыз және өңдеңіз.',
  },
  coursesAdminForbidden: {
    ru: 'Доступ только для moderator или superadmin.',
    en: 'Access only for moderator or superadmin.',
    kk: 'Қолжетімділік тек moderator немесе superadmin үшін.',
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
