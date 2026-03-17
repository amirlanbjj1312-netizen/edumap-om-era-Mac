'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  loadSchools,
  upsertSchool,
} from '@/lib/api';
import { createEmptySchoolProfile } from '@/lib/schoolProfile';
import { buildFallbackSchoolId } from '@/lib/auth';
import { useAdminLocale } from '@/lib/adminLocale';
import { formatKzPhone } from '@/lib/phone';
import { useImageCropper } from '@/lib/useImageCropper';
import {
  buildLegacyClubsCatalogFromUnified,
  buildUnifiedClubsFromServices,
} from '@/lib/clubsSchedule';
import {
  buildFeeRulesFromFinance,
  buildGradeFeeMapFromRules,
  SCHOOL_FEE_CURRENCIES,
  SCHOOL_GRADE_OPTIONS,
} from '@/lib/schoolFinance';

type SchoolProfile = ReturnType<typeof createEmptySchoolProfile>;

type LoadingState = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

const formatArrayValue = (value: unknown) =>
  Array.isArray(value) ? value.join(', ') : value ? String(value) : '';

const parseArrayValue = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const WEEKDAY_OPTIONS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

type WeekdayKey = (typeof WEEKDAY_OPTIONS)[number];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_item, idx) =>
  String(idx).padStart(2, '0')
);
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_item, idx) =>
  String(idx).padStart(2, '0')
);

const splitTime = (value: string) => {
  const raw = String(value || '').trim();
  const match = raw.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return { hour: '', minute: '' };
  return { hour: match[1], minute: match[2] };
};

const composeTime = (hour: string, minute: string) => {
  const h = String(hour || '').trim();
  const m = String(minute || '').trim();
  if (!h || !m) return '';
  return `${h}:${m}`;
};

const parseSchedulePreset = (value: string) => {
  const raw = String(value || '').trim();
  const days = WEEKDAY_OPTIONS.filter((item) =>
    new RegExp(
      item === 'Monday'
        ? 'понедельник|monday|дүйсенбі'
        : item === 'Tuesday'
          ? 'вторник|tuesday|сейсенбі'
          : item === 'Wednesday'
            ? 'среда|wednesday|сәрсенбі'
            : item === 'Thursday'
              ? 'четверг|thursday|бейсенбі'
              : item === 'Friday'
                ? 'пятница|friday|жұма'
                : item === 'Saturday'
                  ? 'суббота|saturday|сенбі'
                  : 'воскресенье|sunday|жексенбі',
      'i'
    ).test(raw)
  );
  const times = Array.from(raw.matchAll(/([01]?\d|2[0-3])[:.][0-5]\d/g)).map(
    (item) => item[0].replace('.', ':')
  );
  const [start = '', end = ''] = times;
  return { days, start, end };
};

const buildSchedulePreset = (
  days: WeekdayKey[],
  start: string,
  end: string,
  locale: 'ru' | 'en' | 'kk'
) => {
  const dayLabel = days.map((item) => translateOption(item, locale)).join(', ');
  const time = start && end ? `${start}-${end}` : start ? `${start}` : end ? `${end}` : '';
  if (dayLabel && time) return `${dayLabel} ${time}`;
  if (dayLabel) return dayLabel;
  if (time) return time;
  return '';
};

const parseGradeRange = (value: string) => {
  const raw = String(value || '');
  const match = raw.match(/(\d{1,2})\s*-\s*(\d{1,2})/);
  if (!match) return { from: '', to: '' };
  return { from: match[1], to: match[2] };
};

const normalizeEmail = (value: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';
const SELECTED_SCHOOL_STORAGE_KEY = 'EDUMAP_ADMIN_SELECTED_SCHOOL_ID';

const createFeeRuleEntry = (overrides: Record<string, unknown> = {}) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  from_grade: '',
  to_grade: '',
  amount: '',
  currency: 'KZT',
  comment: '',
  ...overrides,
});

const LocaleContext = createContext<'ru' | 'en' | 'kk'>('ru');

const LABELS: Record<string, { en: string; kk: string }> = {
  Основное: { en: 'Basic', kk: 'Негізгі' },
  Контакты: { en: 'Contacts', kk: 'Байланыс' },
  Образование: { en: 'Education', kk: 'Білім' },
  Поступление: { en: 'Admission', kk: 'Қабылдау' },
  Сервисы: { en: 'Services', kk: 'Қызметтер' },
  Финансы: { en: 'Finance', kk: 'Қаржы' },
  Медиа: { en: 'Media', kk: 'Медиа' },
  Локация: { en: 'Location', kk: 'Орналасуы' },
  'Основная информация': { en: 'Basic information', kk: 'Негізгі ақпарат' },
  Лицензия: { en: 'License', kk: 'Лицензия' },
  'Учебный процесс': { en: 'Learning process', kk: 'Оқу процесі' },
  'Требуется вступительный экзамен': {
    en: 'Entrance exam required',
    kk: 'Қабылдау емтиханы қажет',
  },
  'Отображаемое имя': { en: 'Display name', kk: 'Көрсетілетін атау' },
  'Тип школы': { en: 'School type', kk: 'Мектеп түрі' },
  'Подтип школы': { en: 'School subtype', kk: 'Мектеп ішкі түрі' },
  Город: { en: 'City', kk: 'Қала' },
  Район: { en: 'District', kk: 'Аудан' },
  Адрес: { en: 'Address', kk: 'Мекенжай' },
  Описание: { en: 'Description', kk: 'Сипаттама' },
  Широта: { en: 'Latitude', kk: 'Ендік' },
  Долгота: { en: 'Longitude', kk: 'Бойлық' },
  Директор: { en: 'Principal', kk: 'Директор' },
  'Зам. директора': { en: 'Deputy principal', kk: 'Директор орынбасары' },
  'Кураторы классов': { en: 'Class curators', kk: 'Сынып кураторлары' },
  'Есть кураторы классов': { en: 'Class curators available', kk: 'Сынып кураторлары бар' },
  'По одному на класс': { en: 'One per class', kk: 'Әр сыныпқа бір куратор' },
  'По параллелям': { en: 'By grade level', kk: 'Параллельдер бойынша' },
  'Кураторская служба': { en: 'Curator service', kk: 'Кураторлық қызмет' },
  'Руководство школы': { en: 'School leadership', kk: 'Мектеп басшылығы' },
  'ФИО': { en: 'Full name', kk: 'Аты-жөні' },
  'Короткое описание': { en: 'Short description', kk: 'Қысқаша сипаттама' },
  'Фото руководителя (файл)': { en: 'Leadership photo (file)', kk: 'Басшылық фотосы (файл)' },
  'Члены персонала': { en: 'Staff members', kk: 'Персонал мүшелері' },
  Психолог: { en: 'Psychologist', kk: 'Психолог' },
  Логопед: { en: 'Speech therapist', kk: 'Логопед' },
  Дефектолог: { en: 'Defectologist', kk: 'Дефектолог' },
  Спецпедагог: { en: 'Special educator', kk: 'Арнайы педагог' },
  Тьютор: { en: 'Tutor', kk: 'Тьютор' },
  'Социальный работник': { en: 'Social worker', kk: 'Әлеуметтік қызметкер' },
  Медсестра: { en: 'Nurse', kk: 'Медбике' },
  Медкабинет: { en: 'Medical room', kk: 'Медкабинет' },
  Телефон: { en: 'Phone', kk: 'Телефон' },
  WhatsApp: { en: 'WhatsApp', kk: 'WhatsApp' },
  Email: { en: 'Email', kk: 'Email' },
  Сайт: { en: 'Website', kk: 'Сайт' },
  'Номер лицензии': { en: 'License number', kk: 'Лицензия нөмірі' },
  'Дата выдачи': { en: 'Issued at', kk: 'Берілген күні' },
  'Срок действия': { en: 'Valid until', kk: 'Жарамдылық мерзімі' },
  Аккредитация: { en: 'Accreditation', kk: 'Аккредитация' },
  'Языки обучения': { en: 'Teaching languages', kk: 'Оқыту тілдері' },
  'Языки (доп.)': { en: 'Other languages', kk: 'Қосымша тілдер' },
  Программы: { en: 'Programs', kk: 'Бағдарламалар' },
  'Учебные программы (национальные)': { en: 'Curricula (national)', kk: 'Оқу жоспарлары (ұлттық)' },
  'Учебные программы (международные)': { en: 'Curricula (international)', kk: 'Оқу жоспарлары (халықаралық)' },
  'Учебные программы (дополнительные)': { en: 'Curricula (additional)', kk: 'Оқу жоспарлары (қосымша)' },
  'Учебные программы (другое)': { en: 'Curricula (other)', kk: 'Оқу жоспарлары (басқа)' },
  'Углубленные предметы': { en: 'Advanced subjects', kk: 'Тереңдетілген пәндер' },
  'Углубленные (доп.)': { en: 'Advanced (other)', kk: 'Тереңдетілген (басқа)' },
  Классы: { en: 'Grades', kk: 'Сыныптар' },
  'Средний размер класса': { en: 'Average class size', kk: 'Сыныптың орташа көлемі' },
  Формат: { en: 'Format', kk: 'Формат' },
  'Формат (доп.)': { en: 'Format (other)', kk: 'Формат (басқа)' },
  Предметы: { en: 'Subjects', kk: 'Пәндер' },
  'Предметы (доп.)': { en: 'Subjects (other)', kk: 'Пәндер (басқа)' },
  Этапы: { en: 'Stages', kk: 'Кезеңдер' },
  'Свободные места по классам': { en: 'Available seats by grade', kk: 'Сыныптар бойынша бос орындар' },
  'Период набора': { en: 'Enrollment period', kk: 'Қабылдау кезеңі' },
  'Сроки подачи документов': { en: 'Document submission deadlines', kk: 'Құжат тапсыру мерзімі' },
  'Детализация этапов набора': { en: 'Admission stages details', kk: 'Қабылдау кезеңдерінің сипаттамасы' },
  'Конкурс на место': { en: 'Competition per seat', kk: 'Бір орынға конкурс' },
  'Средний балл экзаменов': { en: 'Average exam score', kk: 'Емтиханның орташа балы' },
  'Поступление выпускников в вузы (%)': { en: 'University admission rate (%)', kk: 'Түлектердің ЖОО-ға түсуі (%)' },
  'Куда поступают выпускники': { en: 'Top universities', kk: 'Түлектер қай ЖОО-ға түседі' },
  'Олимпиадные достижения': { en: 'Olympiad achievements', kk: 'Олимпиада жетістіктері' },
  'Размер класса (начальная школа)': { en: 'Class size (primary)', kk: 'Сынып көлемі (бастауыш)' },
  'Размер класса (средняя школа)': { en: 'Class size (middle)', kk: 'Сынып көлемі (орта буын)' },
  'Размер класса (старшая школа)': { en: 'Class size (high)', kk: 'Сынып көлемі (жоғары сынып)' },
  'Сменность обучения': { en: 'School shifts', kk: 'Оқу ауысымы' },
  'Формат домашней работы': { en: 'Homework format', kk: 'Үй жұмысының форматы' },
  'Формат оценивания': { en: 'Assessment format', kk: 'Бағалау форматы' },
  'Цифровые платформы': { en: 'Digital platforms', kk: 'Цифрлық платформалар' },
  Питание: { en: 'Meals', kk: 'Тамақтану' },
  'Разов в день': { en: 'Times per day', kk: 'Күніне қанша рет' },
  'Бесплатно до класса': { en: 'Free until grade', kk: 'Тегін қай сыныпқа дейін' },
  'Примечание по питанию': { en: 'Meals notes', kk: 'Тамақтану туралы ескертпе' },
  'Иностранные преподаватели': { en: 'Foreign teachers', kk: 'Шетелдік мұғалімдер' },
  'Что включено в стоимость': { en: 'Included in tuition', kk: 'Құнына не кіреді' },
  'Что оплачивается отдельно': { en: 'Paid separately', kk: 'Не бөлек төленеді' },
  'Регистрационный взнос': { en: 'Registration fee', kk: 'Тіркеу жарнасы' },
  'Валюта регистрационного взноса': { en: 'Registration fee currency', kk: 'Тіркеу жарнасының валютасы' },
  'Маршруты автобуса': { en: 'Bus routes', kk: 'Автобус маршруттары' },
  'Стоимость транспорта по районам': { en: 'Transport cost by district', kk: 'Аудандар бойынша көлік құны' },
  'Время подачи автобуса': { en: 'Bus pickup time', kk: 'Автобустың келу уақыты' },
  'Время развоза автобуса': { en: 'Bus drop-off time', kk: 'Автобустың тарату уақыты' },
  'Медперсонал': { en: 'Medical staff', kk: 'Медицина қызметкерлері' },
  'График медкабинета': { en: 'Medical office schedule', kk: 'Медкабинет кестесі' },
  'Поддержка психолога': { en: 'Psychologist support', kk: 'Психолог қолдауы' },
  'Поддержка логопеда': { en: 'Speech therapist support', kk: 'Логопед қолдауы' },
  'Поддержка дефектолога': { en: 'Defectologist support', kk: 'Дефектолог қолдауы' },
  'Работа с аллергиями/особыми диетами': { en: 'Allergies and diet support', kk: 'Аллергия/арнайы диета қолдауы' },
  'Протоколы безопасности': { en: 'Security protocols', kk: 'Қауіпсіздік хаттамалары' },
  'Политика доступа на территорию': { en: 'Campus access policy', kk: 'Аумаққа кіру саясаты' },
  'Формат обратной связи с родителями': { en: 'Parent feedback format', kk: 'Ата-анамен кері байланыс форматы' },
  'Частота встреч с родителями': { en: 'Parent meeting frequency', kk: 'Ата-анамен кездесу жиілігі' },
  'Родительский комитет': { en: 'Parent committee', kk: 'Ата-ана комитеті' },
  'SLA ответа школе (часы)': { en: 'Response SLA (hours)', kk: 'Жауап SLA (сағат)' },
  'Наш преподавательский состав': { en: 'Our teaching staff', kk: 'Біздің педагогикалық құрам' },
  'Фото преподавателя URL': { en: 'Teacher photo URL', kk: 'Мұғалім фотосы URL' },
  'Фото преподавателя (файл)': { en: 'Teacher photo (file)', kk: 'Мұғалім фотосы (файл)' },
  'Описание / опыт преподавателя': {
    en: 'Teacher description / experience',
    kk: 'Мұғалімнің сипаттамасы / тәжірибесі',
  },
  'ФИО преподавателя': { en: 'Teacher full name', kk: 'Мұғалімнің аты-жөні' },
  Должность: { en: 'Position', kk: 'Лауазымы' },
  'Стаж (лет)': { en: 'Experience (years)', kk: 'Тәжірибе (жыл)' },
  'Категория преподавателя': { en: 'Teacher category', kk: 'Мұғалім санаты' },
  'Образование / академическая степень': {
    en: 'Education / academic degree',
    kk: 'Білімі / академиялық дәрежесі',
  },
  'Языки преподавания': { en: 'Teaching languages', kk: 'Оқыту тілдері' },
  'Подготовка к экзаменам': { en: 'Exam preparation', kk: 'Емтиханға дайындық' },
  'Добавить преподавателя': { en: 'Add teacher', kk: 'Мұғалім қосу' },
  'Удалить преподавателя': { en: 'Remove teacher', kk: 'Мұғалімді жою' },
  'Добавьте хотя бы одного преподавателя.': {
    en: 'Add at least one teacher.',
    kk: 'Кемінде бір мұғалім қосыңыз.',
  },
  'Каталог кружков и секций': { en: 'Clubs catalog', kk: 'Үйірмелер каталогы' },
  'Добавить кружок': { en: 'Add club', kk: 'Үйірме қосу' },
  'Добавить следующий кружок': { en: 'Add next club', kk: 'Келесі үйірмені қосу' },
  'Удалить кружок': { en: 'Remove club', kk: 'Үйірмені жою' },
  Развернуть: { en: 'Expand', kk: 'Кеңейту' },
  Свернуть: { en: 'Collapse', kk: 'Жинау' },
  'Добавьте хотя бы один кружок.': {
    en: 'Add at least one club.',
    kk: 'Кемінде бір үйірме қосыңыз.',
  },
  'Название кружка': { en: 'Club name', kk: 'Үйірме атауы' },
  'Описание кружка': { en: 'Club description', kk: 'Үйірме сипаттамасы' },
  'Расписание': { en: 'Schedule', kk: 'Кесте' },
  'Дни недели': { en: 'Weekdays', kk: 'Апта күндері' },
  'День недели': { en: 'Weekday', kk: 'Апта күні' },
  'Время начала': { en: 'Start time', kk: 'Басталу уақыты' },
  'Минуты (начало)': { en: 'Minutes (start)', kk: 'Минут (басы)' },
  'Время окончания': { en: 'End time', kk: 'Аяқталу уақыты' },
  'Минуты (окончание)': { en: 'Minutes (end)', kk: 'Минут (соңы)' },
  'Кто ведет (ФИО)': { en: 'Teacher name', kk: 'Жетекші (АЖТ)' },
  'Инфо про тренера': { en: 'Trainer info', kk: 'Жаттықтырушы туралы' },
  'Фото тренера (файл)': { en: 'Trainer photo (file)', kk: 'Жаттықтырушы фотосы (файл)' },
  'Фото секции (файлы)': { en: 'Section photos (files)', kk: 'Секция фотолары (файл)' },
  'Добавить еще фото секции': { en: 'Add more section photos', kk: 'Секция фотоларын тағы қосу' },
  'Удалить фото': { en: 'Remove photo', kk: 'Фотоны жою' },
  'Фото тренера загружено': { en: 'Trainer photo uploaded', kk: 'Жаттықтырушы фотосы жүктелді' },
  'Фото тренера не загружено': { en: 'Trainer photo not uploaded', kk: 'Жаттықтырушы фотосы жүктелмеген' },
  'Загружено фото секции': { en: 'Section photos uploaded', kk: 'Жүктелген секция фотолары' },
  'Фото преподавателя загружено': { en: 'Teacher photo uploaded', kk: 'Мұғалім фотосы жүктелді' },
  'Фото преподавателя не загружено': { en: 'Teacher photo not uploaded', kk: 'Мұғалім фотосы жүктелмеген' },
  'Для классов': { en: 'Grades', kk: 'Сыныптар үшін' },
  'Стоимость в месяц': { en: 'Monthly fee', kk: 'Айлық төлем' },
  ИЛИ: { en: 'OR', kk: 'НЕМЕСЕ' },
  'Можно указать URL или загрузить файл. Если заполнены оба поля, приоритет у файла.': {
    en: 'You can provide a URL or upload a file. If both are set, file has priority.',
    kk: 'URL көрсетуге немесе файл жүктеуге болады. Екеуі де толса, файлға басымдық беріледі.',
  },
  Транспорт: { en: 'Transport', kk: 'Көлік' },
  Инклюзив: { en: 'Inclusive', kk: 'Инклюзивті' },
  Продленка: { en: 'After-school', kk: 'Ұзартылған топ' },
  'Гос финансирование': { en: 'State funding', kk: 'Мемлекеттік қаржыландыру' },
  Самоокупаемость: { en: 'Self-funded', kk: 'Өзін-өзі қаржыландыру' },
  'Бесплатные места': { en: 'Free places', kk: 'Тегін орындар' },
  'Стоимость / мес': { en: 'Monthly fee', kk: 'Айлық төлем' },
  'Опции оплаты': { en: 'Payment options', kk: 'Төлем опциялары' },
  Скидки: { en: 'Discounts', kk: 'Жеңілдіктер' },
  Гранты: { en: 'Grants', kk: 'Гранттар' },
  'Добавить цену': { en: 'Add fee', kk: 'Төлем қосу' },
  'Удалить цену': { en: 'Remove fee', kk: 'Төлемді жою' },
  'С класса': { en: 'From grade', kk: 'Сыныптан бастап' },
  'По класс': { en: 'To grade', kk: 'Сыныпқа дейін' },
  Цена: { en: 'Price', kk: 'Бағасы' },
  Валюта: { en: 'Currency', kk: 'Валюта' },
  Комментарий: { en: 'Comment', kk: 'Түсініктеме' },
  'Добавьте хотя бы одну цену.': { en: 'Add at least one fee.', kk: 'Кемінде бір төлем қосыңыз.' },
  'Система оплаты': { en: 'Payment system', kk: 'Төлем жүйесі' },
  'Скидки / гранты': { en: 'Grants / discounts', kk: 'Гранттар / жеңілдіктер' },
  'Логотип URL': { en: 'Logo URL', kk: 'Логотип URL' },
  'Логотип (файл)': { en: 'Logo (file)', kk: 'Логотип (файл)' },
  'Фото (URL, через запятую)': { en: 'Photos (URLs)', kk: 'Фотолар (URL)' },
  'Фото (файлы)': { en: 'Photos (files)', kk: 'Фотолар (файл)' },
  'Видео (URL, через запятую)': { en: 'Videos (URLs)', kk: 'Бейнелер (URL)' },
  'Видео (файлы)': { en: 'Videos (files)', kk: 'Бейнелер (файл)' },
  'Аккредитация (URL, через запятую)': {
    en: 'Accreditation (URLs)',
    kk: 'Аккредитация (URL)',
  },
  'Аккредитация (файлы)': {
    en: 'Accreditation (files)',
    kk: 'Аккредитация (файлдар)',
  },
  'Добавить файл': { en: 'Add file', kk: 'Файл қосу' },
  'Добавить фото': { en: 'Add photos', kk: 'Фото қосу' },
  'Добавить видео': { en: 'Add videos', kk: 'Видео қосу' },
  'Добавить аккредитацию': { en: 'Add accreditation', kk: 'Аккредитация қосу' },
  'или перетащите файлы сюда': { en: 'or drag files here', kk: 'немесе файлдарды осында сүйреп әкеліңіз' },
  'Логотип загружен': { en: 'Logo uploaded', kk: 'Логотип жүктелді' },
  'Логотип не загружен': { en: 'Logo not uploaded', kk: 'Логотип жүктелмеген' },
  'Загружено фото': { en: 'Photos uploaded', kk: 'Жүктелген фото' },
  'Загружено видео': { en: 'Videos uploaded', kk: 'Жүктелген видео' },
  'Загружено аккредитаций': { en: 'Accreditations uploaded', kk: 'Жүктелген аккредитациялар' },
  Instagram: { en: 'Instagram', kk: 'Instagram' },
  TikTok: { en: 'TikTok', kk: 'TikTok' },
  YouTube: { en: 'YouTube', kk: 'YouTube' },
  Facebook: { en: 'Facebook', kk: 'Facebook' },
  VK: { en: 'VK', kk: 'VK' },
  Telegram: { en: 'Telegram', kk: 'Telegram' },
  LinkedIn: { en: 'LinkedIn', kk: 'LinkedIn' },
  'Ближайшее метро': { en: 'Nearest метро', kk: 'Жақын метро' },
  'Ближайшая остановка': { en: 'Nearest stop', kk: 'Жақын аялдама' },
  'Дистанция до метро (км)': { en: 'Distance to метро (km)', kk: 'Метроға дейінгі қашықтық (км)' },
  'Тип остановки': { en: 'Stop type', kk: 'Аялдама түрі' },
  Метро: { en: 'Metro', kk: 'Метро' },
  Автобус: { en: 'Bus', kk: 'Автобус' },
  'Дистанция до остановки (км)': {
    en: 'Distance to bus stop (km)',
    kk: 'Аялдамаға дейінгі қашықтық (км)',
  },
  'Зона обслуживания': { en: 'Service area', kk: 'Қызмет көрсету аумағы' },
  'Не выбрано': { en: 'Not selected', kk: 'Таңдалмаған' },
  'Сначала выберите город': { en: 'Select city first', kk: 'Әуелі қаланы таңдаңыз' },
  'Сохранить': { en: 'Save', kk: 'Сақтау' },
  'Сохраняем...': { en: 'Saving...', kk: 'Сақталуда...' },
  'Сохранено.': { en: 'Saved.', kk: 'Сақталды.' },
  'Ошибка сохранения.': { en: 'Save failed.', kk: 'Сақтау қатесі.' },
  'Подписка и продвижение': { en: 'Subscription and promotion', kk: 'Жазылым және ілгерілету' },
  Тариф: { en: 'Tariff', kk: 'Тариф' },
  'Оплатить (тест)': { en: 'Pay (test)', kk: 'Төлеу (тест)' },
  'Проводим оплату...': { en: 'Processing payment...', kk: 'Төлем өңделуде...' },
  'Продлить по текущему тарифу': { en: 'Renew current tariff', kk: 'Ағымдағы тарифпен ұзарту' },
  'Текущий статус подписки': { en: 'Current subscription status', kk: 'Ағымдағы жазылым күйі' },
  'Скрыть из ЛК родителя': { en: 'Hide from parent cabinet', kk: 'Ата-ана кабинетінде жасыру' },
  'Тарифы недоступны': { en: 'No tariffs available', kk: 'Тарифтер қолжетімсіз' },
  'Нет предыдущего тарифа для продления': {
    en: 'No previous tariff to renew',
    kk: 'Ұзарту үшін алдыңғы тариф жоқ',
  },
  'Тестовая оплата успешна': {
    en: 'Test payment successful',
    kk: 'Тест төлемі сәтті',
  },
  'Не удалось загрузить данные.': {
    en: 'Failed to load data.',
    kk: 'Деректерді жүктеу мүмкін болмады.',
  },
  'Загрузка...': { en: 'Loading...', kk: 'Жүктелуде...' },
  Тест: { en: 'Test', kk: 'Тест' },
  Экзамен: { en: 'Exam', kk: 'Емтихан' },
  Собеседование: { en: 'Interview', kk: 'Сұхбат' },
  Нет: { en: 'No', kk: 'Жоқ' },
  Другое: { en: 'Other', kk: 'Басқа' },
};

const translateLabel = (label: string, locale: 'ru' | 'en' | 'kk') => {
  const entry = LABELS[label];
  if (!entry) return label;
  if (locale === 'en') return entry.en;
  if (locale === 'kk') return entry.kk;
  return label;
};

const OPTION_LABELS: Record<
  string,
  { ru: string; en: string; kk: string }
> = {
  State: { ru: 'Государственная', en: 'State', kk: 'Мемлекеттік' },
  Private: { ru: 'Частная', en: 'Private', kk: 'Жеке' },
  'General School': { ru: 'Обычная средняя школа', en: 'General school', kk: 'Жалпы орта мектеп' },
  'Autonomous School': { ru: 'Автономная школа', en: 'Autonomous school', kk: 'Автономды мектеп' },
  Gymnasium: { ru: 'Гимназия', en: 'Gymnasium', kk: 'Гимназия' },
  Lyceum: { ru: 'Лицей', en: 'Lyceum', kk: 'Лицей' },
  'Specialized School': { ru: 'Специализированная школа', en: 'Specialized school', kk: 'Мамандандырылған мектеп' },
  'International School': { ru: 'Международная школа', en: 'International school', kk: 'Халықаралық мектеп' },
  'Private General School': { ru: 'Частная общеобразовательная школа', en: 'Private general school', kk: 'Жеке жалпы білім беретін мектеп' },
  'Innovative School': { ru: 'Инновационная школа', en: 'Innovative school', kk: 'Инновациялық мектеп' },
  'Advanced Subjects School': { ru: 'Школа с углублённым изучением предметов', en: 'Advanced subjects school', kk: 'Пәндерді тереңдетіп оқытатын мектеп' },
  'Author School': { ru: 'Авторская школа', en: 'Author school', kk: 'Авторлық мектеп' },
  'Online School': { ru: 'Онлайн-школа / дистанционная школа', en: 'Online / distance school', kk: 'Онлайн / қашықтан оқыту мектебі' },
  'Boarding School': { ru: 'Школа-интернат', en: 'Boarding school', kk: 'Мектеп-интернат' },
  International: { ru: 'Международная', en: 'International', kk: 'Халықаралық' },
  Autonomous: { ru: 'Автономная', en: 'Autonomous', kk: 'Автономды' },
  Almaty: { ru: 'Алматы', en: 'Almaty', kk: 'Алматы' },
  Almaly: { ru: 'Алмалы', en: 'Almaly', kk: 'Алмалы' },
  Auezov: { ru: 'Ауэзов', en: 'Auezov', kk: 'Әуезов' },
  Bostandyk: { ru: 'Бостандык', en: 'Bostandyk', kk: 'Бостандық' },
  Zhetysu: { ru: 'Жетысу', en: 'Zhetysu', kk: 'Жетісу' },
  Medeu: { ru: 'Медеу', en: 'Medeu', kk: 'Медеу' },
  Nauryzbay: { ru: 'Наурызбай', en: 'Nauryzbay', kk: 'Наурызбай' },
  Astana: { ru: 'Астана', en: 'Astana', kk: 'Астана' },
  'Almaty District': { ru: 'Алматы', en: 'Almaty District', kk: 'Алматы' },
  Baikonyr: { ru: 'Байконур', en: 'Baikonyr', kk: 'Байқоңыр' },
  Yesil: { ru: 'Есиль', en: 'Yesil', kk: 'Есіл' },
  Saryarka: { ru: 'Сарыарка', en: 'Saryarka', kk: 'Сарыарқа' },
  Nura: { ru: 'Нура', en: 'Nura', kk: 'Нұра' },
  Karaganda: { ru: 'Караганда', en: 'Karaganda', kk: 'Қарағанды' },
  City: { ru: 'Город', en: 'City', kk: 'Қала' },
  Maikuduk: { ru: 'Майкудук', en: 'Maikuduk', kk: 'Майқұдық' },
  'Yugo-Vostok': { ru: 'Юго-Восток', en: 'Yugo-Vostok', kk: 'Оңтүстік-Шығыс' },
  Prishakhtinsk: { ru: 'Пришахтинск', en: 'Prishakhtinsk', kk: 'Пришахтинск' },
  Sortirovka: { ru: 'Сортировка', en: 'Sortirovka', kk: 'Сортировка' },
  'Per month': { ru: 'В месяц', en: 'Per month', kk: 'Айына' },
  'Per semester': { ru: 'В семестр', en: 'Per semester', kk: 'Семестрге' },
  'Per year': { ru: 'В год', en: 'Per year', kk: 'Жылына' },
  'In installments': { ru: 'Несколькими траншами', en: 'In installments', kk: 'Бірнеше траншпен' },
  'Single shift': { ru: 'Одна смена', en: 'Single shift', kk: 'Бір ауысым' },
  'Double shift': { ru: 'Две смены', en: 'Double shift', kk: 'Екі ауысым' },
  'Mixed shift': { ru: 'Смешанная сменность', en: 'Mixed shift', kk: 'Аралас ауысым' },
  'No competition': { ru: 'Без конкурса', en: 'No competition', kk: 'Конкурссіз' },
  'January-March': { ru: 'Январь-Март', en: 'January-March', kk: 'Қаңтар-Наурыз' },
  'April-June': { ru: 'Апрель-Июнь', en: 'April-June', kk: 'Сәуір-Маусым' },
  'July-August': { ru: 'Июль-Август', en: 'July-August', kk: 'Шілде-Тамыз' },
  'September-October': { ru: 'Сентябрь-Октябрь', en: 'September-October', kk: 'Қыркүйек-Қазан' },
  'Year-round': { ru: 'Круглый год', en: 'Year-round', kk: 'Жыл бойы' },
  '<50%': { ru: 'До 50%', en: '<50%', kk: '50%-ға дейін' },
  '50-70%': { ru: '50-70%', en: '50-70%', kk: '50-70%' },
  '70-85%': { ru: '70-85%', en: '70-85%', kk: '70-85%' },
  '85-95%': { ru: '85-95%', en: '85-95%', kk: '85-95%' },
  '95-100%': { ru: '95-100%', en: '95-100%', kk: '95-100%' },
  'On request': { ru: 'По запросу', en: 'On request', kk: 'Сұраныс бойынша' },
  'Part-time': { ru: 'Частично', en: 'Part-time', kk: 'Жартылай' },
  'Full-time': { ru: 'Постоянно', en: 'Full-time', kk: 'Тұрақты' },
  Yes: { ru: 'Да', en: 'Yes', kk: 'Иә' },
  No: { ru: 'Нет', en: 'No', kk: 'Жоқ' },
  'Messenger chat': { ru: 'Чат в мессенджере', en: 'Messenger chat', kk: 'Мессенджер чаты' },
  Calls: { ru: 'Звонки', en: 'Calls', kk: 'Қоңыраулар' },
  'Offline meetings': { ru: 'Офлайн встречи', en: 'Offline meetings', kk: 'Офлайн кездесулер' },
  Mixed: { ru: 'Смешанный формат', en: 'Mixed', kk: 'Аралас формат' },
  Weekly: { ru: 'Еженедельно', en: 'Weekly', kk: 'Апта сайын' },
  Biweekly: { ru: 'Раз в 2 недели', en: 'Biweekly', kk: 'Екі аптада бір рет' },
  Monthly: { ru: 'Ежемесячно', en: 'Monthly', kk: 'Ай сайын' },
  Quarterly: { ru: 'Раз в квартал', en: 'Quarterly', kk: 'Тоқсанына бір рет' },
  Kundelik: { ru: 'Kundelik', en: 'Kundelik', kk: 'Kundelik' },
  Moodle: { ru: 'Moodle', en: 'Moodle', kk: 'Moodle' },
  Zoom: { ru: 'Zoom', en: 'Zoom', kk: 'Zoom' },
  Canvas: { ru: 'Canvas', en: 'Canvas', kk: 'Canvas' },
  BilimClass: { ru: 'BilimClass', en: 'BilimClass', kk: 'BilimClass' },
  Free: { ru: 'Бесплатно', en: 'Free', kk: 'Тегін' },
  Paid: { ru: 'Платно', en: 'Paid', kk: 'Ақылы' },
  Included: { ru: 'Включено', en: 'Included', kk: 'Қамтылған' },
  'Not included in tuition': {
    ru: 'Не включено в стоимость',
    en: 'Not included in tuition',
    kk: 'Құнына кірмейді',
  },
  'No meals': { ru: 'Без питания', en: 'No meals', kk: 'Тамақсыз' },
  Metro: { ru: 'Метро', en: 'Metro', kk: 'Метро' },
  Bus: { ru: 'Автобус', en: 'Bus', kk: 'Автобус' },
  Kazakh: { ru: 'Казахский', en: 'Kazakh', kk: 'Қазақ тілі' },
  Russian: { ru: 'Русский', en: 'Russian', kk: 'Орыс тілі' },
  English: { ru: 'Английский', en: 'English', kk: 'Ағылшын тілі' },
  Chinese: { ru: 'Китайский', en: 'Chinese', kk: 'Қытай тілі' },
  French: { ru: 'Французский', en: 'French', kk: 'Француз тілі' },
  German: { ru: 'Немецкий', en: 'German', kk: 'Неміс тілі' },
  Monday: { ru: 'Понедельник', en: 'Monday', kk: 'Дүйсенбі' },
  Tuesday: { ru: 'Вторник', en: 'Tuesday', kk: 'Сейсенбі' },
  Wednesday: { ru: 'Среда', en: 'Wednesday', kk: 'Сәрсенбі' },
  Thursday: { ru: 'Четверг', en: 'Thursday', kk: 'Бейсенбі' },
  Friday: { ru: 'Пятница', en: 'Friday', kk: 'Жұма' },
  Saturday: { ru: 'Суббота', en: 'Saturday', kk: 'Сенбі' },
  Sunday: { ru: 'Воскресенье', en: 'Sunday', kk: 'Жексенбі' },
  Педагог: { ru: 'Учитель', en: 'Teacher', kk: 'Мұғалім' },
  'Педагог-модератор': { ru: 'Учитель-модератор', en: 'Teacher moderator', kk: 'Мұғалім-модератор' },
  'Педагог-эксперт': { ru: 'Учитель-эксперт', en: 'Teacher expert', kk: 'Мұғалім-сарапшы' },
  'Педагог-исследователь': { ru: 'Учитель-исследователь', en: 'Teacher researcher', kk: 'Мұғалім-зерттеуші' },
  'Педагог-мастер': { ru: 'Учитель-мастер', en: 'Teacher master', kk: 'Мұғалім-шебер' },
  Учитель: { ru: 'Учитель', en: 'Teacher', kk: 'Мұғалім' },
  'Учитель-модератор': { ru: 'Учитель-модератор', en: 'Teacher moderator', kk: 'Мұғалім-модератор' },
  'Учитель-эксперт': { ru: 'Учитель-эксперт', en: 'Teacher expert', kk: 'Мұғалім-сарапшы' },
  'Учитель-исследователь': { ru: 'Учитель-исследователь', en: 'Teacher researcher', kk: 'Мұғалім-зерттеуші' },
  'Учитель-мастер': { ru: 'Учитель-мастер', en: 'Teacher master', kk: 'Мұғалім-шебер' },
  'Высшая категория': { ru: 'Высшая категория', en: 'Highest category', kk: 'Жоғары санат' },
  'Первая категория': { ru: 'Первая категория', en: 'First category', kk: 'Бірінші санат' },
  'Вторая категория': { ru: 'Вторая категория', en: 'Second category', kk: 'Екінші санат' },
  ЕНТ: { ru: 'ЕНТ', en: 'UNT', kk: 'ҰБТ' },
  IELTS: { ru: 'IELTS', en: 'IELTS', kk: 'IELTS' },
  TOEFL: { ru: 'TOEFL', en: 'TOEFL', kk: 'TOEFL' },
  SAT: { ru: 'SAT', en: 'SAT', kk: 'SAT' },
  NIS: { ru: 'NIS', en: 'NIS', kk: 'NIS' },
  Олимпиады: { ru: 'Олимпиады', en: 'Olympiads', kk: 'Олимпиадалар' },
  'State program (Kazakhstan)': {
    ru: 'Госпрограмма (Казахстан)',
    en: 'State program (Kazakhstan)',
    kk: 'Мемлекеттік бағдарлама (Қазақстан)',
  },
  'Updated content': { ru: 'Обновленное содержание', en: 'Updated content', kk: 'Жаңартылған мазмұн' },
  'NIS Integrated Program': {
    ru: 'Интегрированная программа НИШ',
    en: 'NIS Integrated Program',
    kk: 'НЗМ интеграцияланған бағдарламасы',
  },
  'Cambridge Primary': { ru: 'Cambridge Primary', en: 'Cambridge Primary', kk: 'Cambridge Primary' },
  'Cambridge Lower Secondary': {
    ru: 'Cambridge Lower Secondary',
    en: 'Cambridge Lower Secondary',
    kk: 'Cambridge Lower Secondary',
  },
  'Cambridge IGCSE': { ru: 'Cambridge IGCSE', en: 'Cambridge IGCSE', kk: 'Cambridge IGCSE' },
  'Cambridge A-Level': { ru: 'Cambridge A-Level', en: 'Cambridge A-Level', kk: 'Cambridge A-Level' },
  'IB PYP': { ru: 'IB PYP', en: 'IB PYP', kk: 'IB PYP' },
  STEAM: { ru: 'STEAM', en: 'STEAM', kk: 'STEAM' },
  STEM: { ru: 'STEM', en: 'STEM', kk: 'STEM' },
  Montessori: { ru: 'Монтессори', en: 'Montessori', kk: 'Монтессори' },
  Waldorf: { ru: 'Вальдорф', en: 'Waldorf', kk: 'Вальдорф' },
  'American Curriculum': {
    ru: 'Американская программа',
    en: 'American Curriculum',
    kk: 'Америкалық бағдарлама',
  },
  'British National Curriculum': {
    ru: 'Британская национальная программа',
    en: 'British National Curriculum',
    kk: 'Британ ұлттық бағдарламасы',
  },
  'Bilingual Program': { ru: 'Билингвальная программа', en: 'Bilingual Program', kk: 'Қостілді бағдарлама' },
  'Author program': { ru: 'Авторская программа', en: 'Author program', kk: 'Авторлық бағдарлама' },
  Mathematics: { ru: 'Математика', en: 'Mathematics', kk: 'Математика' },
  Physics: { ru: 'Физика', en: 'Physics', kk: 'Физика' },
  Chemistry: { ru: 'Химия', en: 'Chemistry', kk: 'Химия' },
  Biology: { ru: 'Биология', en: 'Biology', kk: 'Биология' },
  'Computer Science': { ru: 'Информатика', en: 'Computer Science', kk: 'Информатика' },
  Robotics: { ru: 'Робототехника', en: 'Robotics', kk: 'Робототехника' },
  Engineering: { ru: 'Инженерия', en: 'Engineering', kk: 'Инженерия' },
  'Artificial Intelligence': { ru: 'Искусственный интеллект', en: 'Artificial Intelligence', kk: 'Жасанды интеллект' },
  'Data Science': { ru: 'Наука о данных', en: 'Data Science', kk: 'Деректер ғылымы' },
  Economics: { ru: 'Экономика', en: 'Economics', kk: 'Экономика' },
  Business: { ru: 'Бизнес', en: 'Business', kk: 'Бизнес' },
  Entrepreneurship: { ru: 'Предпринимательство', en: 'Entrepreneurship', kk: 'Кәсіпкерлік' },
  'English Language': { ru: 'Английский язык', en: 'English Language', kk: 'Ағылшын тілі' },
  'World History': { ru: 'Всемирная история', en: 'World History', kk: 'Әлем тарихы' },
  Geography: { ru: 'География', en: 'Geography', kk: 'География' },
  'Design & Technology': { ru: 'Дизайн и технологии', en: 'Design & Technology', kk: 'Дизайн және технология' },
  'Art & Design': { ru: 'Искусство и дизайн', en: 'Art & Design', kk: 'Өнер және дизайн' },
  Music: { ru: 'Музыка', en: 'Music', kk: 'Музыка' },
  'Media Studies': { ru: 'Медиазнание', en: 'Media Studies', kk: 'Медиа зерттеулері' },
  Algebra: { ru: 'Алгебра', en: 'Algebra', kk: 'Алгебра' },
  Geometry: { ru: 'Геометрия', en: 'Geometry', kk: 'Геометрия' },
  Science: { ru: 'Естествознание', en: 'Science', kk: 'Жаратылыстану' },
  'Natural Science': { ru: 'Природоведение', en: 'Natural Science', kk: 'Табиғаттану' },
  Programming: { ru: 'Программирование', en: 'Programming', kk: 'Бағдарламалау' },
  Astronomy: { ru: 'Астрономия', en: 'Astronomy', kk: 'Астрономия' },
  'History of Kazakhstan': {
    ru: 'История Казахстана',
    en: 'History of Kazakhstan',
    kk: 'Қазақстан тарихы',
  },
  'Social Studies': { ru: 'Обществознание', en: 'Social Studies', kk: 'Қоғамтану' },
  Law: { ru: 'Право', en: 'Law', kk: 'Құқық' },
  'Financial Literacy': { ru: 'Финансовая грамотность', en: 'Financial Literacy', kk: 'Қаржылық сауаттылық' },
  'Kazakh Language': { ru: 'Казахский язык', en: 'Kazakh Language', kk: 'Қазақ тілі' },
  'Russian Language': { ru: 'Русский язык', en: 'Russian Language', kk: 'Орыс тілі' },
  'Chinese Language': { ru: 'Китайский язык', en: 'Chinese Language', kk: 'Қытай тілі' },
  'French Language': { ru: 'Французский язык', en: 'French Language', kk: 'Француз тілі' },
  'German Language': { ru: 'Немецкий язык', en: 'German Language', kk: 'Неміс тілі' },
  Literature: { ru: 'Литература', en: 'Literature', kk: 'Әдебиет' },
  Reading: { ru: 'Чтение', en: 'Reading', kk: 'Оқу' },
  Writing: { ru: 'Письмо', en: 'Writing', kk: 'Жазу' },
  'Speech and Debate': { ru: 'Риторика и дебаты', en: 'Speech and Debate', kk: 'Сөйлеу және дебат' },
  Art: { ru: 'Искусство', en: 'Art', kk: 'Өнер' },
  Drawing: { ru: 'Рисование', en: 'Drawing', kk: 'Сурет салу' },
  Vocal: { ru: 'Вокал', en: 'Vocal', kk: 'Вокал' },
  Choreography: { ru: 'Хореография', en: 'Choreography', kk: 'Хореография' },
  Theater: { ru: 'Театр', en: 'Theater', kk: 'Театр' },
  'Physical Education': { ru: 'Физкультура', en: 'Physical Education', kk: 'Дене шынықтыру' },
  Swimming: { ru: 'Плавание', en: 'Swimming', kk: 'Жүзу' },
  Football: { ru: 'Футбол', en: 'Football', kk: 'Футбол' },
  Basketball: { ru: 'Баскетбол', en: 'Basketball', kk: 'Баскетбол' },
  Volleyball: { ru: 'Волейбол', en: 'Volleyball', kk: 'Волейбол' },
  Chess: { ru: 'Шахматы', en: 'Chess', kk: 'Шахмат' },
  Logic: { ru: 'Логика', en: 'Logic', kk: 'Логика' },
  'Pre-school Preparation': {
    ru: 'Подготовка к школе',
    en: 'Pre-school Preparation',
    kk: 'Мектепке дайындық',
  },
  Psychology: { ru: 'Психология', en: 'Psychology', kk: 'Психология' },
};

const translateOption = (value: string, locale: 'ru' | 'en' | 'kk') => {
  const entry = OPTION_LABELS[value];
  if (!entry) return value;
  if (locale === 'ru') return entry.ru;
  if (locale === 'kk') return entry.kk;
  return entry.en;
};

const normalizeListValue = (value: unknown) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return parseArrayValue(value);
  return [];
};

const sanitizeHttpUrl = (value: unknown) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    if (!/^https?:$/i.test(parsed.protocol)) return '';
    return parsed.toString();
  } catch {
    return '';
  }
};

const sanitizeUrlList = (value: unknown) =>
  normalizeListValue(value)
    .map((item) => sanitizeHttpUrl(item))
    .filter(Boolean);

const normalizeFinanceFeeRules = (profile: SchoolProfile | null) => {
  const rawRules = profile?.finance?.fee_rules;
  if (Array.isArray(rawRules) && rawRules.length) {
    return rawRules.map((rule) => {
      const item =
        rule && typeof rule === 'object' && !Array.isArray(rule)
          ? (rule as Record<string, unknown>)
          : {};
      return createFeeRuleEntry({
        id: String(item.id || ''),
        from_grade: String(item.from_grade || ''),
        to_grade: String(item.to_grade || ''),
        amount: String(item.amount || ''),
        currency: String(item.currency || 'KZT'),
        comment: String(item.comment || ''),
      });
    });
  }

  return buildFeeRulesFromFinance(profile?.finance).map((rule) =>
    createFeeRuleEntry({
      from_grade: String(rule.from_grade),
      to_grade: String(rule.to_grade),
      amount: String(rule.amount),
      currency: rule.currency,
      comment: rule.comment,
    })
  );
};

const toggleListValue = (list: string[], item: string) =>
  list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item];

const SCHOOL_TYPES = ['State', 'Private'];
const SCHOOL_SUBTYPE_OPTIONS = [
  'General School',
  'Autonomous School',
  'Gymnasium',
  'Lyceum',
  'Specialized School',
  'International School',
  'Private General School',
  'Innovative School',
  'Advanced Subjects School',
  'Author School',
  'Online School',
  'Boarding School',
];
const SCHOOL_TYPE_ALIASES: Record<string, string> = {
  State: 'State',
  Private: 'Private',
  International: 'International',
  Autonomous: 'Autonomous',
  Государственная: 'State',
  Частная: 'Private',
  Международная: 'International',
  Автономная: 'Autonomous',
  Мемлекеттік: 'State',
  Жеке: 'Private',
  Халықаралық: 'International',
  Автономды: 'Autonomous',
};

const normalizeSchoolType = (value: unknown): string => {
  const items = normalizeListValue(value)
    .map((item) => SCHOOL_TYPE_ALIASES[String(item).trim()] || String(item).trim())
    .filter(Boolean);
  const first = items[0] || '';
  if (!first) return '';
  if (first === 'International' || first === 'Autonomous') return 'Private';
  return SCHOOL_TYPES.includes(first) ? first : '';
};

const CITY_OPTIONS = [
  {
    name: 'Almaty',
    districts: ['Almaly', 'Auezov', 'Bostandyk', 'Zhetysu', 'Medeu', 'Nauryzbay'],
  },
  {
    name: 'Astana',
    districts: ['Almaty', 'Baikonyr', 'Yesil', 'Saryarka', 'Nura'],
  },
  {
    name: 'Karaganda',
    districts: ['City', 'Maikuduk', 'Yugo-Vostok', 'Prishakhtinsk', 'Sortirovka'],
  },
];

const CITY_NAMES = CITY_OPTIONS.map((option) => option.name);

const CURRICULA_GROUPS = {
  national: [
    'State program (Kazakhstan)',
    'Updated content',
    'NIS Integrated Program',
    'Cambridge Primary',
    'Cambridge Lower Secondary',
    'Cambridge IGCSE',
    'Cambridge A-Level',
  ],
  international: [
    'IB PYP',
    'STEAM',
    'STEM',
    'Montessori',
    'Waldorf',
    'American Curriculum',
    'British National Curriculum',
  ],
  additional: ['Bilingual Program', 'Author program'],
};

const GRADE_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const TEACHING_LANGUAGE_OPTIONS = [
  'Kazakh',
  'Russian',
  'English',
  'Chinese',
  'French',
  'German',
];
const ADVANCED_SUBJECT_OPTIONS = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'Computer Science',
  'Robotics',
  'Engineering',
  'Artificial Intelligence',
  'Data Science',
  'Economics',
  'Business',
  'Entrepreneurship',
  'English Language',
  'World History',
  'Geography',
  'Design & Technology',
  'Art & Design',
  'Music',
  'Media Studies',
  'Psychology',
];

const CLASS_SIZE_OPTIONS = ['10', '12', '15', '18', '20', '22', '24', '26', '30', '35+'];
const PAYMENT_SYSTEM_OPTIONS = ['Per month', 'Per semester', 'Per year', 'In installments'];
const SHIFT_MODE_OPTIONS = ['Single shift', 'Double shift', 'Mixed shift'];
const ADMISSION_COMPETITION_OPTIONS = ['No competition', '1-2', '2-3', '3-5', '5+'];
const ADMISSION_PERIOD_OPTIONS = [
  'January-March',
  'April-June',
  'July-August',
  'September-October',
  'Year-round',
];
const UNIVERSITY_ADMISSION_RATE_OPTIONS = ['<50%', '50-70%', '70-85%', '85-95%', '95-100%'];
const SUPPORT_LEVEL_OPTIONS = ['No', 'On request', 'Part-time', 'Full-time'];
const PARENT_COMMITTEE_OPTIONS = ['No', 'Yes'];
const PERSONNEL_MEMBER_OPTIONS = [
  'Психолог',
  'Логопед',
  'Дефектолог',
  'Спецпедагог',
  'Тьютор',
  'Социальный работник',
  'Медсестра',
];
const RESPONSE_SLA_OPTIONS = ['4', '8', '12', '24', '48', '72'];
const DIGITAL_PLATFORM_OPTIONS = [
  'Kundelik',
  'Google Classroom',
  'Moodle',
  'Microsoft Teams',
  'Zoom',
  'Canvas',
  'BilimClass',
];
const MEAL_OPTIONS = [
  'Free',
  'Paid',
  'Included',
  'Not included in tuition',
  'No meals',
];
const MEAL_TIMES_OPTIONS = ['1', '2', '3', '4'];
const MEAL_GRADE_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
const PARENT_FEEDBACK_FORMAT_OPTIONS = ['Messenger chat', 'Email', 'Calls', 'Offline meetings', 'Mixed'];
const PARENT_MEETING_FREQUENCY_OPTIONS = [
  'Weekly',
  'Biweekly',
  'Monthly',
  'Quarterly',
  'By request',
];
const TEACHER_EXPERIENCE_MAX = 40;
const TEACHER_CATEGORY_OPTIONS = [
  'Учитель',
  'Учитель-модератор',
  'Учитель-эксперт',
  'Учитель-исследователь',
  'Учитель-мастер',
  'Высшая категория',
  'Первая категория',
  'Вторая категория',
];
const TEACHER_LANGUAGE_OPTIONS = ['Kazakh', 'Russian', 'English', 'German', 'French', 'Chinese'];
const TEACHER_EXAM_OPTIONS = ['ЕНТ', 'IELTS', 'TOEFL', 'SAT', 'NIS', 'Олимпиады'];
const TEACHER_SUBJECT_OPTIONS = [
  'Mathematics',
  'Algebra',
  'Geometry',
  'Physics',
  'Chemistry',
  'Biology',
  'Science',
  'Natural Science',
  'Computer Science',
  'Programming',
  'Robotics',
  'Engineering',
  'Artificial Intelligence',
  'Data Science',
  'Astronomy',
  'Geography',
  'World History',
  'History of Kazakhstan',
  'Social Studies',
  'Law',
  'Economics',
  'Financial Literacy',
  'Business',
  'Entrepreneurship',
  'Psychology',
  'English Language',
  'Kazakh Language',
  'Russian Language',
  'Chinese Language',
  'French Language',
  'German Language',
  'Literature',
  'Reading',
  'Writing',
  'Speech and Debate',
  'Art',
  'Art & Design',
  'Drawing',
  'Music',
  'Vocal',
  'Choreography',
  'Theater',
  'Design & Technology',
  'Media Studies',
  'Physical Education',
  'Swimming',
  'Football',
  'Basketball',
  'Volleyball',
  'Chess',
  'Logic',
  'Pre-school Preparation',
];

const withCurrentOption = (options: string[], current: string) =>
  current && !options.includes(current) ? [current, ...options] : options;
const withCurrentOptions = (options: string[], currentValues: string[]) => {
  const normalized = Array.isArray(currentValues)
    ? currentValues.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  return Array.from(new Set([...normalized, ...options]));
};

const getDeep = (obj: any, path: string, fallback: any = '') => {
  return path.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), obj) ?? fallback;
};

const setDeep = (obj: any, path: string, value: any) => {
  const keys = path.split('.');
  const next = Array.isArray(obj) ? [...obj] : { ...obj };
  let cursor: any = next;

  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      cursor[key] = value;
      return;
    }

    const current = cursor[key];
    if (current && typeof current === 'object') {
      cursor[key] = Array.isArray(current) ? [...current] : { ...current };
    } else {
      cursor[key] = {};
    }
    cursor = cursor[key];
  });

  return next;
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const locale = useContext(LocaleContext);
  return (
    <section className="card">
      <h2>{translateLabel(title, locale)}</h2>
      {children}
    </section>
  );
};

const FieldRow = ({ children }: { children: React.ReactNode }) => (
  <div className="form-row">{children}</div>
);

const Input = ({ label, value, onChange, placeholder, type = 'text', ...inputProps }: any) => {
  const locale = useContext(LocaleContext);
  return (
    <label className="field">
      <span>{translateLabel(label, locale)}</span>
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      {...inputProps}
      onChange={(event) => onChange(event.target.value)}
    />
    </label>
  );
};

const TextArea = ({ label, value, onChange, placeholder, rows = 3 }: any) => {
  const locale = useContext(LocaleContext);
  return (
    <label className="field">
      <span>{translateLabel(label, locale)}</span>
    <textarea
      value={value}
      placeholder={placeholder}
      rows={rows}
      onChange={(event) => onChange(event.target.value)}
    />
    </label>
  );
};

const applyTextFormat = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  mode: 'bold' | 'italic' | 'underline' | 'bullet' | 'dash'
) => {
  const text = String(value || '');
  const start = Math.max(0, selectionStart || 0);
  const end = Math.max(start, selectionEnd || 0);
  const selected = text.slice(start, end);
  const before = text.slice(0, start);
  const after = text.slice(end);

  if (mode === 'bold') {
    const wrapped = `**${selected || 'текст'}**`;
    return { nextValue: `${before}${wrapped}${after}`, nextStart: start + 2, nextEnd: start + wrapped.length - 2 };
  }
  if (mode === 'italic') {
    const wrapped = `_${selected || 'текст'}_`;
    return { nextValue: `${before}${wrapped}${after}`, nextStart: start + 1, nextEnd: start + wrapped.length - 1 };
  }
  if (mode === 'underline') {
    const wrapped = `__${selected || 'текст'}__`;
    return { nextValue: `${before}${wrapped}${after}`, nextStart: start + 2, nextEnd: start + wrapped.length - 2 };
  }

  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const lineEndRaw = text.indexOf('\n', end);
  const lineEnd = lineEndRaw === -1 ? text.length : lineEndRaw;
  const lineChunk = text.slice(lineStart, lineEnd);
  const prefixed = lineChunk
    .split('\n')
    .map((line) => {
      if (!line.trim()) return line;
      const prefix = mode === 'bullet' ? '• ' : '- ';
      if (line.startsWith(prefix)) return line;
      return `${prefix}${line}`;
    })
    .join('\n');
  const nextValue = `${text.slice(0, lineStart)}${prefixed}${text.slice(lineEnd)}`;
  return { nextValue, nextStart: start, nextEnd: end + 2 };
};

const RichTextArea = ({ label, value, onChange, placeholder, rows = 4 }: any) => {
  const locale = useContext(LocaleContext);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const apply = (mode: 'bold' | 'italic' | 'underline' | 'bullet' | 'dash') => {
    const el = textareaRef.current;
    const start = el?.selectionStart || 0;
    const end = el?.selectionEnd || 0;
    const { nextValue, nextStart, nextEnd } = applyTextFormat(String(value || ''), start, end, mode);
    onChange(nextValue);
    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(nextStart, nextEnd);
    });
  };

  return (
    <label className="field">
      <span>{translateLabel(label, locale)}</span>
      <div className="rich-toolbar">
        <button type="button" className="rich-btn" onClick={() => apply('bold')}>Ж</button>
        <button type="button" className="rich-btn" onClick={() => apply('italic')}>К</button>
        <button type="button" className="rich-btn" onClick={() => apply('underline')}>Ч</button>
        <button type="button" className="rich-btn" onClick={() => apply('bullet')}>•</button>
        <button type="button" className="rich-btn" onClick={() => apply('dash')}>—</button>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        placeholder={placeholder}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
};

const Toggle = ({ label, checked, onChange }: any) => {
  const locale = useContext(LocaleContext);
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{translateLabel(label, locale)}</span>
    </label>
  );
};

const Select = ({ label, value, onChange, options }: any) => {
  const locale = useContext(LocaleContext);
  return (
    <label className="field">
      <span>{translateLabel(label, locale)}</span>
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option: any) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
    </label>
  );
};

const CheckboxGroup = ({ label, options, values, onChange }: any) => {
  const locale = useContext(LocaleContext);
  return (
    <div className="field">
      <span>{translateLabel(label, locale)}</span>
    <div className="option-grid">
      {options.map((option: string) => {
        const checked = values.includes(option);
        return (
          <label
            key={option}
            className={`option-chip${checked ? ' active' : ''}`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onChange(toggleListValue(values, option))}
            />
            <span>{translateOption(option, locale)}</span>
          </label>
        );
      })}
    </div>
    </div>
  );
};

const SubjectPicker = ({ label, options, values, onChange }: any) => {
  const locale = useContext(LocaleContext);
  const [query, setQuery] = useState('');
  const normalizedQuery = String(query || '').trim().toLowerCase();
  const filteredOptions = useMemo(() => {
    if (!normalizedQuery) return options;
    return options.filter((option: string) =>
      translateOption(option, locale).toLowerCase().includes(normalizedQuery)
    );
  }, [locale, normalizedQuery, options]);
  const selectedPreview = values
    .slice(0, 3)
    .map((item: string) => translateOption(item, locale))
    .join(', ');
  return (
    <div className="field">
      <span>{translateLabel(label, locale)}</span>
      <details className="subject-picker">
        <summary className="subject-picker-summary">
          {values.length
            ? `${values.length} • ${selectedPreview}${values.length > 3 ? '…' : ''}`
            : translateLabel('Не выбрано', locale)}
        </summary>
        <div className="subject-picker-panel">
          <input
            className="subject-picker-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              locale === 'en'
                ? 'Search subject'
                : locale === 'kk'
                ? 'Пәнді іздеу'
                : 'Поиск предмета'
            }
          />
          <div className="subject-picker-grid">
            {filteredOptions.map((option: string) => {
              const checked = values.includes(option);
              return (
                <label key={option} className={`option-chip${checked ? ' active' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onChange(toggleListValue(values, option))}
                  />
                  <span>{translateOption(option, locale)}</span>
                </label>
              );
            })}
          </div>
        </div>
      </details>
    </div>
  );
};

const CategoryPicker = ({ label, options, value, onChange }: any) => {
  const locale = useContext(LocaleContext);
  const [query, setQuery] = useState('');
  const normalizedQuery = String(query || '').trim().toLowerCase();
  const filteredOptions = useMemo(() => {
    if (!normalizedQuery) return options;
    return options.filter((option: string) =>
      translateOption(option, locale).toLowerCase().includes(normalizedQuery)
    );
  }, [locale, normalizedQuery, options]);
  const selectedLabel = value ? translateOption(value, locale) : translateLabel('Не выбрано', locale);
  return (
    <div className="field">
      <span>{translateLabel(label, locale)}</span>
      <details className="subject-picker">
        <summary className="subject-picker-summary">{selectedLabel}</summary>
        <div className="subject-picker-panel">
          <input
            className="subject-picker-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              locale === 'en'
                ? 'Search category'
                : locale === 'kk'
                ? 'Санатты іздеу'
                : 'Поиск категории'
            }
          />
          <div className="subject-picker-grid subject-picker-grid-single">
            <button
              type="button"
              className={`option-chip${!value ? ' active' : ''}`}
              onClick={() => onChange('')}
            >
              <span>{translateLabel('Не выбрано', locale)}</span>
            </button>
            {filteredOptions.map((option: string) => (
              <button
                key={option}
                type="button"
                className={`option-chip${value === option ? ' active' : ''}`}
                onClick={() => onChange(option)}
              >
                <span>{translateOption(option, locale)}</span>
              </button>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
};

export default function SchoolInfoPage() {
  const router = useRouter();
  const { locale: contentLocale, setLocale: setContentLocale } = useAdminLocale();
  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  const [state, setState] = useState<LoadingState>('idle');
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<
    'basic' | 'contacts' | 'education' | 'admission' | 'services' | 'finance' | 'media'
  >('basic');
  const [expandedTeacherIndex, setExpandedTeacherIndex] = useState<number | null>(null);
  const [expandedLeadershipKey, setExpandedLeadershipKey] = useState<'principal' | 'deputy_principal' | null>(null);
  const [expandedClubIndex, setExpandedClubIndex] = useState<number | null>(0);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const schoolId = useMemo(() => {
    if (!profile?.school_id) return '';
    return profile.school_id;
  }, [profile?.school_id]);
  const [fallbackSchoolId, setFallbackSchoolId] = useState('');

  const cityValue = useMemo(() => getDeep(profile, 'basic_info.city', ''), [profile]);
  const schoolTypeValue = useMemo(
    () => normalizeSchoolType(getDeep(profile, 'basic_info.type', '')),
    [profile]
  );
  const paymentOptionsValue = useMemo(() => {
    const explicit = normalizeListValue(getDeep(profile, 'finance.payment_options', ''));
    if (explicit.length) return explicit;
    const legacy = String(getDeep(profile, 'finance.payment_system', '') || '').trim();
    return legacy ? [legacy] : [];
  }, [profile]);
  const discountsValue = useMemo(
    () =>
      String(
        getDeep(profile, 'finance.discounts_info', '') ||
          getDeep(profile, 'finance.grants_discounts', '') ||
          ''
      ),
    [profile]
  );
  const grantsValue = useMemo(
    () => String(getDeep(profile, 'finance.grants_info', '') || ''),
    [profile]
  );
  const showFinance = useMemo(() => schoolTypeValue === 'Private', [schoolTypeValue]);
  const localePath = (path: string) => `${path}.${contentLocale}`;
  const t = (label: string) => translateLabel(label, contentLocale);
  const availableDistricts = useMemo(() => {
    const match = CITY_OPTIONS.find((option) => option.name === cityValue);
    return match?.districts ?? [];
  }, [cityValue]);
  const languagesValue = useMemo(
    () => normalizeListValue(getDeep(profile, 'education.languages', '')),
    [profile]
  );
  const gradesValue = useMemo(
    () => normalizeListValue(getDeep(profile, 'education.grades', '')),
    [profile]
  );
  const advancedValue = useMemo(
    () => normalizeListValue(getDeep(profile, 'education.advanced_subjects', '')),
    [profile]
  );
  const digitalPlatformsValue = useMemo(
    () => normalizeListValue(getDeep(profile, 'education.learning_conditions.digital_platforms', '')),
    [profile]
  );
  const legacyCuratorsValue = useMemo(
    () => String(getDeep(profile, 'basic_info.team.class_curators', '') || '').trim(),
    [profile]
  );
  const classCuratorsEnabled = useMemo(
    () =>
      Boolean(getDeep(profile, 'basic_info.team.class_curators_enabled')) ||
      Boolean(legacyCuratorsValue),
    [profile, legacyCuratorsValue]
  );
  const classCuratorsComment = useMemo(
    () =>
      String(
        getDeep(profile, localePath('basic_info.team.class_curators_comment')) ||
          legacyCuratorsValue ||
          ''
      ),
    [profile, legacyCuratorsValue]
  );
  const personnelMembersValue = useMemo(() => {
    const next: string[] = [];
    if (Boolean(getDeep(profile, 'services.psychologists'))) next.push('Психолог');
    if (Boolean(getDeep(profile, 'services.speech_therapists'))) next.push('Логопед');
    if (Boolean(getDeep(profile, 'services.defectologists'))) next.push('Дефектолог');
    if (Boolean(getDeep(profile, 'services.special_educators'))) next.push('Спецпедагог');
    if (Boolean(getDeep(profile, 'services.tutors'))) next.push('Тьютор');
    if (Boolean(getDeep(profile, 'services.social_workers'))) next.push('Социальный работник');
    if (Boolean(getDeep(profile, 'services.nurses'))) next.push('Медсестра');
    return next;
  }, [profile]);

  const updateListField = (path: string, list: string[]) => {
    updateField(path, list.join(', '));
  };
  const updatePersonnelMembers = (selected: string[]) => {
    updateField('services.psychologists', selected.includes('Психолог'));
    updateField('services.speech_therapists', selected.includes('Логопед'));
    updateField('services.defectologists', selected.includes('Дефектолог'));
    updateField('services.special_educators', selected.includes('Спецпедагог'));
    updateField('services.tutors', selected.includes('Тьютор'));
    updateField('services.social_workers', selected.includes('Социальный работник'));
    updateField('services.nurses', selected.includes('Медсестра'));
  };
  const changeTab = (
    tab: 'basic' | 'contacts' | 'education' | 'admission' | 'services' | 'finance' | 'media'
  ) => {
    setActiveTab(tab);
    requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  };
  const createTeacherMember = () => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    full_name: '',
    position: '',
    education_degree: '',
    subjects: '',
    experience_years: '',
    category: '',
    teaching_languages: '',
    exam_prep: '',
    photo_url: '',
    bio: { ru: '', en: '', kk: '' },
  });
  const createLeadershipMember = (role: 'principal' | 'deputy_principal') => ({
    full_name: '',
    position: role === 'principal' ? 'Директор' : 'Зам. директора',
    photo_url: '',
    bio: { ru: '', en: '', kk: '' },
  });
  const createClubEntry = () => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: { ru: '', en: '', kk: '' },
    description: { ru: '', en: '', kk: '' },
    schedule: { ru: '', en: '', kk: '' },
    teacher_name: '',
    trainer_info: '',
    trainer_photo: '',
    section_photos: '',
    grades: '',
    price_monthly: '',
    price_currency: 'KZT',
  });
  const createStudentSuccessStoryEntry = () => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    student_name: '',
    admitted_to: '',
    ent_score: '',
    ielts_score: '',
    sat_score: '',
    school_average_score: '',
    achievements: { ru: '', en: '', kk: '' },
    admission_subjects: '',
    application_deadline: '',
    student_photo: '',
  });
  const getFinanceFeeRules = () => normalizeFinanceFeeRules(profile);
  const setFinanceFeeRules = (rules: Array<Record<string, unknown>>, shouldSave = false) => {
    if (!profile) return;
    const nextProfile = setDeep(profile, 'finance.fee_rules', rules);
    setProfile(nextProfile);
    if (shouldSave) {
      save(nextProfile);
    }
  };
  const updateFinanceFeeRule = (
    index: number,
    patch: Record<string, unknown>,
    shouldSave = false
  ) => {
    const rules = getFinanceFeeRules();
    if (!rules[index]) return;
    const nextRules = rules.map((rule, ruleIndex) =>
      ruleIndex === index ? { ...rule, ...patch } : rule
    );
    setFinanceFeeRules(nextRules, shouldSave);
  };
  const feeRules = getFinanceFeeRules();

  const getTeachingStaffMembers = () => {
    const members = getDeep(profile, 'services.teaching_staff.members', []);
    if (Array.isArray(members) && members.length) {
      return members;
    }
    const legacyPhoto = String(getDeep(profile, 'services.teaching_staff.photo', '') || '');
    const legacyDescription = getDeep(profile, 'services.teaching_staff.description', {});
    const hasLegacyDescription = ['ru', 'en', 'kk'].some((localeKey) =>
      String((legacyDescription as any)?.[localeKey] || '').trim()
    );
    if (legacyPhoto || hasLegacyDescription) {
      return [
        {
          id: 'legacy-staff',
          full_name: '',
          position: '',
          subjects: '',
          experience_years: '',
          category: '',
          teaching_languages: '',
          exam_prep: '',
          photo_url: legacyPhoto,
          bio: {
            ru: String((legacyDescription as any)?.ru || ''),
            en: String((legacyDescription as any)?.en || ''),
            kk: String((legacyDescription as any)?.kk || ''),
          },
        },
      ];
    }
    return Array.isArray(members) ? members : [];
  };

  const buildProfileWithTeachingStaffMembers = (
    baseProfile: SchoolProfile,
    members: Array<any>
  ) => {
    const next = setDeep(baseProfile, 'services.teaching_staff.members', members);
    const first = members[0];
    const legacyDescription =
      first?.bio && typeof first.bio === 'object'
        ? {
            ru: String(first.bio.ru || ''),
            en: String(first.bio.en || ''),
            kk: String(first.bio.kk || ''),
          }
        : { ru: '', en: '', kk: '' };
    const withPhoto = setDeep(next, 'services.teaching_staff.photo', first?.photo_url || '');
    return setDeep(withPhoto, 'services.teaching_staff.description', legacyDescription);
  };

  const setTeachingStaffMembers = (members: Array<any>, shouldSave = false) => {
    if (!profile) return;
    const nextProfile = buildProfileWithTeachingStaffMembers(profile, members);
    setProfile(nextProfile);
    if (shouldSave) {
      save(nextProfile);
    }
  };

  const updateTeachingStaffMember = (
    index: number,
    patch: Record<string, any>,
    shouldSave = false
  ) => {
    const members = getTeachingStaffMembers();
    if (!members[index]) return;
    const nextMembers = members.map((member, memberIndex) =>
      memberIndex === index ? { ...member, ...patch } : member
    );
    setTeachingStaffMembers(nextMembers, shouldSave);
  };
  const removeTeachingStaffMemberPhoto = (index: number) => {
    updateTeachingStaffMember(index, { photo_url: '' }, true);
  };
  const teachingStaffMembers = useMemo(() => getTeachingStaffMembers(), [profile]);
  useEffect(() => {
    setExpandedTeacherIndex((prev) => {
      if (!teachingStaffMembers.length) return null;
      if (prev == null) return null;
      if (prev >= teachingStaffMembers.length) return teachingStaffMembers.length - 1;
      return prev;
    });
  }, [teachingStaffMembers.length]);

  const getLeadershipMember = (role: 'principal' | 'deputy_principal') => {
    const current = getDeep(profile, `basic_info.team.leadership.${role}`, {});
    const fallbackName = String(
      getDeep(profile, role === 'principal' ? 'basic_info.team.principal' : 'basic_info.team.deputy_principal', '') || ''
    );
    return {
      ...createLeadershipMember(role),
      ...(current && typeof current === 'object' ? current : {}),
      full_name: String(
        getDeep(profile, `basic_info.team.leadership.${role}.full_name`, '') || fallbackName || ''
      ),
      position: String(
        getDeep(profile, `basic_info.team.leadership.${role}.position`, '') ||
          (role === 'principal' ? 'Директор' : 'Зам. директора')
      ),
      photo_url: String(getDeep(profile, `basic_info.team.leadership.${role}.photo_url`, '') || ''),
      bio: {
        ru: String(getDeep(profile, `basic_info.team.leadership.${role}.bio.ru`, '') || ''),
        en: String(getDeep(profile, `basic_info.team.leadership.${role}.bio.en`, '') || ''),
        kk: String(getDeep(profile, `basic_info.team.leadership.${role}.bio.kk`, '') || ''),
      },
    };
  };

  const updateLeadershipMember = (
    role: 'principal' | 'deputy_principal',
    patch: Record<string, any>,
    shouldSave = false
  ) => {
    if (!profile) return;
    const current = getLeadershipMember(role);
    let nextProfile = setDeep(
      profile,
      `basic_info.team.leadership.${role}`,
      { ...current, ...patch }
    );
    if (patch.full_name !== undefined) {
      nextProfile = setDeep(
        nextProfile,
        role === 'principal' ? 'basic_info.team.principal' : 'basic_info.team.deputy_principal',
        String(patch.full_name || '')
      );
    }
    setProfile(nextProfile);
    if (shouldSave) save(nextProfile);
  };

  const leadershipMembers = useMemo(
    () => [
      { key: 'principal' as const, title: 'Директор', member: getLeadershipMember('principal') },
      {
        key: 'deputy_principal' as const,
        title: 'Зам. директора',
        member: getLeadershipMember('deputy_principal'),
      },
    ],
    [profile]
  );

  const getClubsCatalog = () => {
    const legacySource = getDeep(profile, 'services.clubs_catalog', []);
    const legacyItems = Array.isArray(legacySource) ? legacySource : [];
    if (legacyItems.length) {
      return legacyItems.map((item: any) => ({
        id: item?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: item?.name && typeof item.name === 'object' ? item.name : { ru: '', en: '', kk: '' },
        description:
          item?.description && typeof item.description === 'object'
            ? item.description
            : { ru: '', en: '', kk: '' },
        schedule:
          item?.schedule && typeof item.schedule === 'object'
            ? item.schedule
            : { ru: '', en: '', kk: '' },
        teacher_name: String(item?.teacher_name || ''),
        trainer_info: String(item?.trainer_info || ''),
        trainer_photo: String(item?.trainer_photo || ''),
        section_photos: String(item?.section_photos || ''),
        grades: String(item?.grades || ''),
        price_monthly: String(item?.price_monthly || ''),
        price_currency: String(item?.price_currency || 'KZT'),
      }));
    }

    const normalizedLegacy = buildLegacyClubsCatalogFromUnified(
      buildUnifiedClubsFromServices(getDeep(profile, 'services', {}))
    );
    return normalizedLegacy.map((item: any) => ({
      id: item?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: item?.name && typeof item.name === 'object' ? item.name : { ru: '', en: '', kk: '' },
      description:
        item?.description && typeof item.description === 'object'
          ? item.description
          : { ru: '', en: '', kk: '' },
      schedule:
        item?.schedule && typeof item.schedule === 'object'
          ? item.schedule
          : { ru: '', en: '', kk: '' },
      teacher_name: String(item?.teacher_name || ''),
      trainer_info: String(item?.trainer_info || ''),
      trainer_photo: String(item?.trainer_photo || ''),
      section_photos: String(item?.section_photos || ''),
      grades: String(item?.grades || ''),
      price_monthly: String(item?.price_monthly || ''),
      price_currency: String(item?.price_currency || 'KZT'),
    }));
  };

  const setClubsCatalog = (clubs: Array<any>, shouldSave = false) => {
    if (!profile) return;
    const withLegacy = setDeep(profile, 'services.clubs_catalog', clubs);
    const unified = buildUnifiedClubsFromServices({ clubs_catalog: clubs });
    const nextProfile = setDeep(withLegacy, 'services.clubs_unified', unified);
    setProfile(nextProfile);
    if (shouldSave) {
      save(nextProfile);
    }
  };

  const updateClubEntry = (index: number, patch: Record<string, any>, shouldSave = false) => {
    const clubs = getClubsCatalog();
    if (!clubs[index]) return;
    const next = clubs.map((club: any, clubIndex: number) =>
      clubIndex === index ? { ...club, ...patch } : club
    );
    setClubsCatalog(next, shouldSave);
  };

  const removeClubTrainerPhoto = (index: number) => {
    updateClubEntry(index, { trainer_photo: '' });
  };

  const removeClubSectionPhoto = (index: number, photoIndex: number) => {
    const clubs = getClubsCatalog();
    const current = clubs[index];
    if (!current) return;
    const list = normalizeListValue(current.section_photos || '');
    const next = list.filter((_item: string, itemIndex: number) => itemIndex !== photoIndex);
    updateClubEntry(index, { section_photos: next.join(', ') });
  };

  const updateClubSchedulePreset = (
    index: number,
    patch: Partial<{ days: WeekdayKey[]; start: string; end: string }>
  ) => {
    const clubs = getClubsCatalog();
    const current = clubs[index];
    if (!current) return;
    const currentText = String(current?.schedule?.[contentLocale] || '');
    const parsed = parseSchedulePreset(currentText);
    const nextDays = patch.days ?? parsed.days;
    const nextStart = patch.start ?? parsed.start;
    const nextEnd = patch.end ?? parsed.end;
    const nextText = buildSchedulePreset(nextDays, nextStart, nextEnd, contentLocale);
    updateClubEntry(index, {
      schedule: {
        ...(current?.schedule || {}),
        [contentLocale]: nextText,
      },
    });
  };

  const updateClubGradeRangePreset = (
    index: number,
    patch: Partial<{ from: string; to: string }>
  ) => {
    const clubs = getClubsCatalog();
    const current = clubs[index];
    if (!current) return;
    const parsed = parseGradeRange(String(current?.grades || ''));
    const from = patch.from ?? parsed.from;
    const to = patch.to ?? parsed.to;
    const next = from && to ? `${from}-${to}` : from || to || '';
    updateClubEntry(index, { grades: next });
  };

  const clubsCatalog = useMemo(() => getClubsCatalog(), [profile]);
  const getStudentSuccessStories = () => {
    const raw = getDeep(profile, 'education.results.student_success_stories', []);
    if (!Array.isArray(raw)) return [];
    return raw.map((item: any, index: number) => ({
      id: String(item?.id || `success-story-${index}`),
      student_name: String(item?.student_name || ''),
      admitted_to: String(item?.admitted_to || ''),
      ent_score: String(item?.ent_score || ''),
      ielts_score: String(item?.ielts_score || ''),
      sat_score: String(item?.sat_score || ''),
      school_average_score: String(item?.school_average_score || ''),
      achievements:
        item?.achievements && typeof item.achievements === 'object'
          ? item.achievements
          : { ru: '', en: '', kk: '' },
      admission_subjects: String(item?.admission_subjects || ''),
      application_deadline: String(item?.application_deadline || ''),
      student_photo: String(item?.student_photo || ''),
    }));
  };
  const setStudentSuccessStories = (stories: Array<any>, shouldSave = false) => {
    if (!profile) return;
    const nextProfile = setDeep(profile, 'education.results.student_success_stories', stories);
    setProfile(nextProfile);
    if (shouldSave) {
      save(nextProfile);
    }
  };
  const updateStudentSuccessStory = (
    index: number,
    patch: Record<string, any>,
    shouldSave = false
  ) => {
    const stories = getStudentSuccessStories();
    if (!stories[index]) return;
    const nextStories = stories.map((story: any, storyIndex: number) =>
      storyIndex === index ? { ...story, ...patch } : story
    );
    setStudentSuccessStories(nextStories, shouldSave);
  };
  const studentSuccessStories = useMemo(() => getStudentSuccessStories(), [profile]);

  const updateLocalizedField = (pathBase: string, value: string) => {
    updateField(`${pathBase}.${contentLocale}`, value);
    if (contentLocale === 'ru') {
      const enPath = `${pathBase}.en`;
      const kkPath = `${pathBase}.kk`;
      if (!getDeep(profile, enPath)) {
        updateField(enPath, value);
      }
      if (!getDeep(profile, kkPath)) {
        updateField(kkPath, value);
      }
    }
  };

  const [mediaMessage, setMediaMessage] = useState('');
  const { openImageCropper, cropperModal } = useImageCropper();
  const prepareImageFiles = async (
    files: File[],
    options: { title: string; aspect?: number }
  ) => {
    const processed: File[] = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        processed.push(file);
        continue;
      }
      const nextFile = await openImageCropper(file, options);
      if (!nextFile) return null;
      processed.push(nextFile);
    }
    return processed;
  };
  const photoItems = useMemo(
    () => normalizeListValue(getDeep(profile, 'media.photos', '')).filter(Boolean),
    [profile]
  );
  const videoItems = useMemo(
    () => normalizeListValue(getDeep(profile, 'media.videos', '')).filter(Boolean),
    [profile]
  );
  const certificateItems = useMemo(
    () => normalizeListValue(getDeep(profile, 'media.certificates', '')).filter(Boolean),
    [profile]
  );
  const photosCount = useMemo(
    () => photoItems.length,
    [photoItems]
  );
  const videosCount = useMemo(
    () => videoItems.length,
    [videoItems]
  );
  const certificatesCount = useMemo(
    () => certificateItems.length,
    [certificateItems]
  );
  const logoUrl = useMemo(
    () => String(getDeep(profile, 'media.logo', '') || '').trim(),
    [profile]
  );
  const hasLogo = useMemo(
    () => Boolean(String(getDeep(profile, 'media.logo', '') || '').trim()),
    [profile]
  );

  const uploadMediaFiles = async (files: File[], folder: string) => {
    if (!files.length) return [];
    const configuredBucket = (process.env.NEXT_PUBLIC_MEDIA_BUCKET || '').trim();
    const buckets = Array.from(
      new Set([configuredBucket, 'school media', 'school-media'].filter(Boolean))
    );
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const baseId = schoolId || 'school';
    const results: string[] = [];
    let lastError: any = null;

    const toSafeFilePart = (name: string) => {
      const trimmed = name.trim().toLowerCase();
      const normalized = trimmed
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^[-_.]+|[-_.]+$/g, '');
      return normalized || 'file';
    };

    for (const file of files) {
      const safeName = toSafeFilePart(file.name);
      const dotIndex = safeName.lastIndexOf('.');
      const baseName = dotIndex > 0 ? safeName.slice(0, dotIndex) : safeName;
      const ext = dotIndex > 0 ? safeName.slice(dotIndex + 1) : 'bin';
      const cleanExt = ext.replace(/[^a-z0-9]+/g, '') || 'bin';
      const cleanBase = baseName.replace(/[^a-z0-9._-]+/g, '-') || 'file';
      const path = `schools/${baseId}/${folder}/${Date.now()}-${cleanBase}.${cleanExt}`;

      let uploaded = false;
      for (const bucket of buckets) {
        const { error } = await supabase.storage.from(bucket).upload(path, file, {
          upsert: true,
          contentType: file.type || undefined,
        });
        if (error) {
          lastError = error;
          if (/bucket not found/i.test(error.message || '')) {
            continue;
          }
          throw error;
        }
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        const publicUrl =
          data?.publicUrl ||
          (supabaseUrl
            ? `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(
                bucket
              )}/${path}`
            : '');
        if (publicUrl) {
          results.push(publicUrl);
        }
        uploaded = true;
        break;
      }

      if (!uploaded) {
        throw lastError || new Error('Bucket not found');
      }
    }
    return results;
  };

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      setState('loading');
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        router.replace('/login');
        return;
      }

      const sessionEmail = normalizeEmail(session.user.email || '');
      const fallbackId = buildFallbackSchoolId(sessionEmail);
      const selectedSchoolId =
        typeof window !== 'undefined'
          ? localStorage.getItem(SELECTED_SCHOOL_STORAGE_KEY) || ''
          : '';
      const targetId = selectedSchoolId || fallbackId;
      setFallbackSchoolId(targetId);

      try {
        const result = await loadSchools();
        const existing =
          result.data.find((item: any) => item?.school_id === selectedSchoolId) ||
          result.data.find((item: any) => {
          const itemEmail = normalizeEmail(item?.basic_info?.email);
          return item?.school_id === fallbackId || (itemEmail && itemEmail === sessionEmail);
        });
        const base = createEmptySchoolProfile({ school_id: targetId });
        if (!ignore) {
          const nextProfile = existing ? createEmptySchoolProfile(existing) : base;
          nextProfile.finance = {
            ...(nextProfile.finance || {}),
            fee_rules: normalizeFinanceFeeRules(nextProfile),
          };
          const isCustomSchoolContext =
            Boolean(selectedSchoolId) && selectedSchoolId !== fallbackId;
          const meta = session.user?.user_metadata || {};
          const fromMeta = (...keys: string[]) => {
            for (const key of keys) {
              const value = key.includes('.')
                ? key.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), meta as any)
                : (meta as any)?.[key];
              if (typeof value === 'string' && value.trim()) {
                return value.trim();
              }
            }
            return '';
          };
          const setIfEmpty = (path: string, value?: string) => {
            if (!value) return;
            const current = getDeep(nextProfile, path);
            if (!current) {
              setDeep(nextProfile, path, value);
            }
          };
          const setIfDifferent = (path: string, value?: string) => {
            if (!value) return false;
            const current = String(getDeep(nextProfile, path, '') || '').trim();
            if (current === value) return false;
            setDeep(nextProfile, path, value);
            return true;
          };
          const ruName = getDeep(nextProfile, 'basic_info.name.ru', '');
          const enName = getDeep(nextProfile, 'basic_info.name.en', '');
          const kkName = getDeep(nextProfile, 'basic_info.name.kk', '');
          if (ruName && (!enName || !kkName)) {
            if (!enName) {
              nextProfile.basic_info.name.en = ruName;
            }
            if (!kkName) {
              nextProfile.basic_info.name.kk = ruName;
            }
          }
          if (!nextProfile.school_id) {
            nextProfile.school_id = fallbackId;
          }

          if (!isCustomSchoolContext) {
            const organization = fromMeta(
              'organization',
              'schoolName',
              'school_name',
              'companyName',
              'company_name'
            );
            const contactPhone = fromMeta('contactPhone', 'contact_phone', 'phone');
            const website = fromMeta('website', 'site', 'url');
            const licenseNumber = fromMeta(
              'licenseNumber',
              'license_number',
              'licenseNo',
              'license_no'
            );
            const licenseIssuedAt = fromMeta(
              'licenseIssuedAt',
              'license_issued_at',
              'licenseIssueDate',
              'license_issue_date',
              'license.issuedAt',
              'license.issued_at'
            );
            const licenseExpiresAt = fromMeta(
              'licenseExpiresAt',
              'license_expires_at',
              'licenseExpiryDate',
              'license_expiry_date',
              'licenseValidUntil',
              'license_valid_until',
              'license.expiresAt',
              'license.expires_at',
              'license.validUntil',
              'license.valid_until'
            );
            const nestedLicenseNumber = fromMeta(
              'license.number',
              'license.licenseNumber'
            );
            const resolvedLicenseNumber = licenseNumber || nestedLicenseNumber;
            const currentSchoolEmail = String(getDeep(nextProfile, 'basic_info.email', '') || '')
              .trim()
              .toLowerCase();

            if (currentSchoolEmail && currentSchoolEmail === sessionEmail) {
              setDeep(nextProfile, 'basic_info.email', '');
            }

            setIfEmpty('basic_info.display_name.ru', organization);
            setIfEmpty('basic_info.display_name.en', organization);
            setIfEmpty('basic_info.display_name.kk', organization);
            setIfEmpty('basic_info.name.ru', organization);
            setIfEmpty('basic_info.name.en', organization);
            setIfEmpty('basic_info.name.kk', organization);
            setIfEmpty('basic_info.phone', formatKzPhone(contactPhone));
            setIfEmpty('basic_info.website', website);
            setIfEmpty('basic_info.license_details.number', resolvedLicenseNumber);
            setIfEmpty('basic_info.license_details.issued_at', licenseIssuedAt);
            setIfEmpty('basic_info.license_details.valid_until', licenseExpiresAt);

            // Keep web admin in sync with registration metadata.
            const profileChanged =
              setIfDifferent('basic_info.display_name.ru', organization) ||
              setIfDifferent('basic_info.display_name.en', organization) ||
              setIfDifferent('basic_info.display_name.kk', organization) ||
              setIfDifferent('basic_info.name.ru', organization) ||
              setIfDifferent('basic_info.name.en', organization) ||
              setIfDifferent('basic_info.name.kk', organization) ||
              setIfDifferent('basic_info.phone', formatKzPhone(contactPhone)) ||
              setIfDifferent('basic_info.website', website) ||
              setIfDifferent(
                'basic_info.license_details.number',
                resolvedLicenseNumber
              ) ||
              setIfDifferent('basic_info.license_details.issued_at', licenseIssuedAt) ||
              setIfDifferent(
                'basic_info.license_details.valid_until',
                licenseExpiresAt
              );

            if (profileChanged) {
              try {
                await upsertSchool(nextProfile);
              } catch {
                // Keep UI working even if background sync fails.
              }
            }
          }

          setProfile(nextProfile);
          setState('idle');
        }
      } catch (error) {
        if (!ignore) {
          setProfile(createEmptySchoolProfile({ school_id: fallbackId }));
          setState('error');
          setMessage(t('Не удалось загрузить данные.'));
        }
      }
    };

    load();
    return () => {
      ignore = true;
    };
  }, [router]);
  const updateField = (path: string, value: any) => {
    setProfile((prev: SchoolProfile | null) => (prev ? setDeep(prev, path, value) : prev));
  };

  const applyAndSave = (path: string, value: any) => {
    if (!profile) return;
    const nextProfile = setDeep(profile, path, value);
    setProfile(nextProfile);
    save(nextProfile);
  };
  const removeMediaItem = (path: 'media.photos' | 'media.videos' | 'media.certificates', index: number) => {
    if (!profile) return;
    const current = normalizeListValue(getDeep(profile, path, ''));
    const next = current.filter((_item, itemIndex) => itemIndex !== index);
    applyAndSave(path, next.join(', '));
  };
  const removeLogo = () => {
    applyAndSave('media.logo', '');
  };

  const save = async (nextProfile?: SchoolProfile | null) => {
    const candidate = nextProfile ?? profile;
    const currentProfile =
      candidate &&
      typeof candidate === 'object' &&
      'basic_info' in candidate
        ? candidate
        : profile;
    if (!currentProfile) return;
    setState('saving');
    setMessage('');
    try {
      const education = currentProfile.education || ({} as SchoolProfile['education']);
      const curricula = education.curricula || ({} as SchoolProfile['education']['curricula']);
      const ensuredId = currentProfile.school_id || schoolId || fallbackSchoolId || 'local-school';
      const normalizedFeeRules = buildFeeRulesFromFinance(currentProfile.finance);
      const derivedGradeFeeMap = buildGradeFeeMapFromRules(normalizedFeeRules);
      const derivedMonthlyFee = normalizedFeeRules.length
        ? String(Math.min(...normalizedFeeRules.map((rule) => rule.amount)))
        : String(currentProfile.finance?.monthly_fee || '');
      const normalizedSchoolType = normalizeSchoolType(currentProfile.basic_info?.type);
      const paymentOptions = normalizeListValue(currentProfile.finance?.payment_options);
      const normalizedPaymentOptions = withCurrentOptions(PAYMENT_SYSTEM_OPTIONS, paymentOptions)
        .filter((item) => paymentOptions.includes(item));
      const discountsInfo = String(currentProfile.finance?.discounts_info || '').trim();
      const grantsInfo = String(currentProfile.finance?.grants_info || '').trim();
      const legacyGrantsDiscounts = [discountsInfo && `Скидки: ${discountsInfo}`, grantsInfo && `Гранты: ${grantsInfo}`]
        .filter(Boolean)
        .join('; ');
      const normalizedClubsUnified = buildUnifiedClubsFromServices(currentProfile.services);
      const normalizedClubsCatalog = buildLegacyClubsCatalogFromUnified(normalizedClubsUnified);
      const payload = {
        ...currentProfile,
        school_id: ensuredId,
        basic_info: {
          ...(currentProfile.basic_info || {}),
          type: normalizedSchoolType,
          phone: formatKzPhone(currentProfile.basic_info?.phone),
          whatsapp_phone: formatKzPhone(currentProfile.basic_info?.whatsapp_phone),
        },
        finance: {
          ...(currentProfile.finance || {}),
          fee_rules: normalizedFeeRules,
          monthly_fee_by_grade: derivedGradeFeeMap,
          monthly_fee: derivedMonthlyFee,
          payment_options: normalizedPaymentOptions,
          payment_system: normalizedPaymentOptions[0] || String(currentProfile.finance?.payment_system || ''),
          discounts_info: discountsInfo,
          grants_info: grantsInfo,
          grants_discounts: legacyGrantsDiscounts || String(currentProfile.finance?.grants_discounts || ''),
        },
        media: {
          ...(currentProfile.media || {}),
          logo: sanitizeHttpUrl(currentProfile.media?.logo),
          photos: sanitizeUrlList(currentProfile.media?.photos),
          videos: sanitizeUrlList(currentProfile.media?.videos),
          certificates: sanitizeUrlList(currentProfile.media?.certificates),
          social_links: {
            ...(currentProfile.media?.social_links || {}),
            instagram: sanitizeHttpUrl(currentProfile.media?.social_links?.instagram),
            tiktok: sanitizeHttpUrl(currentProfile.media?.social_links?.tiktok),
            youtube: sanitizeHttpUrl(currentProfile.media?.social_links?.youtube),
            facebook: sanitizeHttpUrl(currentProfile.media?.social_links?.facebook),
            vk: sanitizeHttpUrl(currentProfile.media?.social_links?.vk),
            telegram: sanitizeHttpUrl(currentProfile.media?.social_links?.telegram),
            linkedin: sanitizeHttpUrl(currentProfile.media?.social_links?.linkedin),
          },
        },
        education: {
          ...education,
          curricula: {
            ...curricula,
            national: curricula.national || [],
            international: curricula.international || [],
            additional: curricula.additional || [],
          },
        },
        services: {
          ...(currentProfile.services || {}),
          clubs_unified: normalizedClubsUnified,
          clubs_catalog: normalizedClubsCatalog,
        },
      };
      await upsertSchool(payload);
      setState('saved');
      setMessage(t('Сохранено.'));
      setTimeout(() => setState('idle'), 1500);
    } catch (error) {
      setState('error');
      const detail =
        (error as any)?.message ||
        (error as any)?.error ||
        t('Ошибка сохранения.');
      setMessage(detail);
    }
  };
  if (!profile) {
    return <div className="card">{t('Загрузка...')}</div>;
  }

  const subscriptionStatus = String(getDeep(profile, 'monetization.subscription_status') || 'inactive');
  const subscriptionPlan = String(getDeep(profile, 'monetization.plan_name') || '').trim() || '—';
  const ratingValue = String(getDeep(profile, 'system.rating') || '0');
  const reviewsCountValue = String(getDeep(profile, 'system.reviews_count') || '0');
  const viewsCountValue = String(getDeep(profile, 'system.views_count') || '0');
  const popularityScoreValue = String(getDeep(profile, 'system.popularity_score') || '0');
  const summaryUi =
    contentLocale === 'en'
      ? {
          title: 'School summary',
          subscription: 'Subscription',
          tariff: 'Tariff',
          status: 'Status',
          analytics: 'Analytics',
          rating: 'Rating',
          reviews: 'Reviews',
          views: 'Views',
          popularity: 'Popularity score',
        }
      : contentLocale === 'kk'
        ? {
            title: 'Мектеп сводкасы',
            subscription: 'Жазылым',
            tariff: 'Тариф',
            status: 'Күйі',
            analytics: 'Аналитика',
            rating: 'Рейтинг',
            reviews: 'Пікірлер',
            views: 'Қаралымдар',
            popularity: 'Танымалдық ұпайы',
          }
        : {
            title: 'Сводка школы',
            subscription: 'Подписка',
            tariff: 'Тариф',
            status: 'Статус',
            analytics: 'Аналитика',
            rating: 'Рейтинг',
            reviews: 'Отзывы',
            views: 'Просмотры',
            popularity: 'Popularity score',
          };

  return (
    <LocaleContext.Provider value={contentLocale}>
    <div className="page">
      <div className="locale-toggle">
        {(['ru', 'en', 'kk'] as const).map((lang) => (
          <button
            key={lang}
            type="button"
            className={`locale-chip${contentLocale === lang ? ' active' : ''}`}
            onClick={() => setContentLocale(lang)}
          >
            {lang === 'kk' ? 'KZ' : lang.toUpperCase()}
          </button>
        ))}
      </div>
      <section className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>{summaryUi.title}</h2>
        <div style={{ marginBottom: 12 }}>
          <Toggle
            label="Скрыть из ЛК родителя"
            checked={Boolean(getDeep(profile, 'system.hidden_from_users'))}
            onChange={(value: boolean) => updateField('system.hidden_from_users', value)}
          />
        </div>
        <div className="form-row">
          <label className="field">
            <span>{summaryUi.tariff}</span>
            <input value={subscriptionPlan} readOnly />
          </label>
          <label className="field">
            <span>{summaryUi.status}</span>
            <input value={subscriptionStatus} readOnly />
          </label>
        </div>
        <div className="form-row">
          <label className="field">
            <span>{summaryUi.rating}</span>
            <input value={ratingValue} readOnly />
          </label>
          <label className="field">
            <span>{summaryUi.reviews}</span>
            <input value={reviewsCountValue} readOnly />
          </label>
        </div>
        <div className="form-row">
          <label className="field">
            <span>{summaryUi.views}</span>
            <input value={viewsCountValue} readOnly />
          </label>
          <label className="field">
            <span>{summaryUi.popularity}</span>
            <input value={popularityScoreValue} readOnly />
          </label>
        </div>
      </section>
      <div className="tabs-layout">
        <aside className="side-tabs">
          <button
            type="button"
            className={activeTab === 'basic' ? 'active' : ''}
            onClick={() => changeTab('basic')}
          >
            {t('Основное')}
          </button>
          <button
            type="button"
            className={activeTab === 'contacts' ? 'active' : ''}
            onClick={() => changeTab('contacts')}
          >
            {t('Контакты')}
          </button>
          <button
            type="button"
            className={activeTab === 'education' ? 'active' : ''}
            onClick={() => changeTab('education')}
          >
            {t('Образование')}
          </button>
          <button
            type="button"
            className={activeTab === 'admission' ? 'active' : ''}
            onClick={() => changeTab('admission')}
          >
            {t('Поступление')}
          </button>
          <button
            type="button"
            className={activeTab === 'services' ? 'active' : ''}
            onClick={() => changeTab('services')}
          >
            {t('Сервисы')}
          </button>
          <button
            type="button"
            className={activeTab === 'media' ? 'active' : ''}
            onClick={() => changeTab('media')}
          >
            {t('Медиа')}
          </button>
        </aside>
        <div className="panel" ref={panelRef}>
          {activeTab === 'basic' && (
            <>
              <Section title="Основная информация">
                <FieldRow>
                  <Input
                    label="Отображаемое имя"
                    value={getDeep(profile, localePath('basic_info.display_name'))}
                    onChange={(value: string) =>
                      updateField(localePath('basic_info.display_name'), value)
                    }
                  />
                </FieldRow>
                <FieldRow>
                  <Select
                    label="Тип школы"
                    value={schoolTypeValue}
                    onChange={(value: string) => updateField('basic_info.type', normalizeSchoolType(value))}
                    options={[
                      { value: '', label: t('Не выбрано') },
                      ...SCHOOL_TYPES.map((item) => ({
                        value: item,
                        label: translateOption(item, contentLocale),
                      })),
                    ]}
                  />
                  <Select
                    label="Подтип школы"
                    value={String(getDeep(profile, 'basic_info.school_subtype') || '')}
                    onChange={(value: string) => updateField('basic_info.school_subtype', value)}
                    options={[
                      { value: '', label: t('Не выбрано') },
                      ...SCHOOL_SUBTYPE_OPTIONS.map((item) => ({
                        value: item,
                        label: translateOption(item, contentLocale),
                      })),
                    ]}
                  />
                </FieldRow>
                <FieldRow>
                  <Select
                    label="Город"
                    value={getDeep(profile, 'basic_info.city')}
                    onChange={(value: string) => updateField('basic_info.city', value)}
                    options={[
                      { value: '', label: t('Не выбрано') },
                      ...CITY_NAMES.map((item) => ({
                        value: item,
                        label: translateOption(item, contentLocale),
                      })),
                    ]}
                  />
                  <Select
                    label="Район"
                    value={getDeep(profile, 'basic_info.district')}
                    onChange={(value: string) => updateField('basic_info.district', value)}
                    options={
                      availableDistricts.length
                        ? [
                            { value: '', label: t('Не выбрано') },
                            ...availableDistricts.map((item) => ({
                              value: item,
                              label: translateOption(item, contentLocale),
                            })),
                          ]
                        : [{ value: '', label: t('Сначала выберите город') }]
                    }
                  />
                </FieldRow>
                <FieldRow>
                  <Input
                    label="Адрес"
                    value={getDeep(profile, localePath('basic_info.address'))}
                    onChange={(value: string) =>
                      updateField(localePath('basic_info.address'), value)
                    }
                  />
                </FieldRow>
                <FieldRow>
                  <TextArea
                    label="Описание"
                    rows={4}
                    value={getDeep(profile, localePath('basic_info.description'))}
                    onChange={(value: string) =>
                      updateField(localePath('basic_info.description'), value)
                    }
                  />
                </FieldRow>
                <FieldRow>
                  <div className="field">
                    <span>{t('Кураторы классов')}</span>
                    <Toggle
                      label="Есть кураторы классов"
                      checked={classCuratorsEnabled}
                      onChange={(value: boolean) =>
                        updateField('basic_info.team.class_curators_enabled', value)
                      }
                    />
                  </div>
                </FieldRow>
                {classCuratorsEnabled ? (
                  <FieldRow>
                    <Select
                      label="Формат"
                      value={getDeep(profile, 'basic_info.team.class_curators_format')}
                      onChange={(value: string) =>
                        updateField('basic_info.team.class_curators_format', value)
                      }
                      options={[
                        { value: '', label: t('Не выбрано') },
                        { value: 'per_class', label: t('По одному на класс') },
                        { value: 'by_parallel', label: t('По параллелям') },
                        { value: 'curator_service', label: t('Кураторская служба') },
                      ]}
                    />
                    <Input
                      label="Комментарий"
                      value={classCuratorsComment}
                      onChange={(value: string) =>
                        updateField(localePath('basic_info.team.class_curators_comment'), value)
                      }
                    />
                  </FieldRow>
                ) : null}
                <FieldRow>
                  <Input
                    label="Широта"
                    value={getDeep(profile, 'basic_info.coordinates.latitude')}
                    onChange={(value: string) =>
                      updateField('basic_info.coordinates.latitude', value)
                    }
                  />
                  <Input
                    label="Долгота"
                    value={getDeep(profile, 'basic_info.coordinates.longitude')}
                    onChange={(value: string) =>
                      updateField('basic_info.coordinates.longitude', value)
                    }
                  />
                </FieldRow>
              </Section>

              <Section title="Лицензия">
                <FieldRow>
                  <Input
                    label="Номер лицензии"
                    value={getDeep(profile, 'basic_info.license_details.number')}
                    onChange={(value: string) =>
                      updateField('basic_info.license_details.number', value)
                    }
                  />
                  <Input
                    label="Дата выдачи"
                    type="date"
                    value={getDeep(profile, 'basic_info.license_details.issued_at')}
                    onChange={(value: string) =>
                      updateField('basic_info.license_details.issued_at', value)
                    }
                  />
                  <Input
                    label="Срок действия"
                    type="date"
                    value={getDeep(profile, 'basic_info.license_details.valid_until')}
                    onChange={(value: string) =>
                      updateField('basic_info.license_details.valid_until', value)
                    }
                  />
                </FieldRow>
              </Section>

              {showFinance && (
                <Section title="Финансы">
                  <FieldRow>
                    <Toggle
                      label="Гос финансирование"
                      checked={Boolean(getDeep(profile, 'finance.funding_state'))}
                      onChange={(value: boolean) =>
                        updateField('finance.funding_state', value)
                      }
                    />
                    <Toggle
                      label="Самоокупаемость"
                      checked={Boolean(getDeep(profile, 'finance.funding_self'))}
                      onChange={(value: boolean) =>
                        updateField('finance.funding_self', value)
                      }
                    />
                    <Toggle
                      label="Бесплатные места"
                      checked={Boolean(getDeep(profile, 'finance.free_places'))}
                      onChange={(value: boolean) =>
                        updateField('finance.free_places', value)
                      }
                    />
                  </FieldRow>
                  <FieldRow>
                    <Input
                      label="Регистрационный взнос"
                      value={getDeep(profile, 'finance.registration_fee')}
                      onChange={(value: string) =>
                        updateField('finance.registration_fee', value)
                      }
                    />
                    <Select
                      label="Валюта регистрационного взноса"
                      value={String(getDeep(profile, 'finance.registration_fee_currency') || 'KZT')}
                      onChange={(value: string) =>
                        updateField('finance.registration_fee_currency', value || 'KZT')
                      }
                      options={SCHOOL_FEE_CURRENCIES.map((currency) => ({
                        value: currency,
                        label: currency,
                      }))}
                    />
                  </FieldRow>
                  <FieldRow>
                    <TextArea
                      label="Что включено в стоимость"
                      rows={2}
                      value={getDeep(profile, 'finance.included_in_tuition')}
                      onChange={(value: string) =>
                        updateField('finance.included_in_tuition', value)
                      }
                    />
                  </FieldRow>
                  <FieldRow>
                    <TextArea
                      label="Что оплачивается отдельно"
                      rows={2}
                      value={getDeep(profile, 'finance.extra_fees')}
                      onChange={(value: string) =>
                        updateField('finance.extra_fees', value)
                      }
                    />
                  </FieldRow>
                  <CheckboxGroup
                    label="Опции оплаты"
                    options={withCurrentOptions(PAYMENT_SYSTEM_OPTIONS, paymentOptionsValue)}
                    values={paymentOptionsValue}
                    onChange={(next: string[]) => updateListField('finance.payment_options', next)}
                  />
                  <div className="teacher-actions">
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => {
                        const nextRules = [...feeRules, createFeeRuleEntry()];
                        setFinanceFeeRules(nextRules);
                      }}
                    >
                      {t('Добавить цену')}
                    </button>
                  </div>
                  {feeRules.length ? (
                    <div className="teacher-list">
                      {feeRules.map((rule, index) => (
                        <div key={String(rule.id || `fee-rule-${index}`)} className="teacher-card">
                          <div className="teacher-card-head">
                            <h3>{`${t('Стоимость / мес')} #${index + 1}`}</h3>
                            <button
                              type="button"
                              className="button secondary"
                              onClick={() => {
                                const nextRules = feeRules.filter(
                                  (_item, ruleIndex) => ruleIndex !== index
                                );
                                setFinanceFeeRules(nextRules);
                              }}
                            >
                              {t('Удалить цену')}
                            </button>
                          </div>
                          <FieldRow>
                            <Select
                              label="С класса"
                              value={String(rule.from_grade || '')}
                              onChange={(value: string) =>
                                updateFinanceFeeRule(index, { from_grade: value })
                              }
                              options={[
                                { value: '', label: t('Не выбрано') },
                                ...SCHOOL_GRADE_OPTIONS.map((grade) => ({
                                  value: String(grade),
                                  label: `${grade}`,
                                })),
                              ]}
                            />
                            <Select
                              label="По класс"
                              value={String(rule.to_grade || '')}
                              onChange={(value: string) =>
                                updateFinanceFeeRule(index, { to_grade: value })
                              }
                              options={[
                                { value: '', label: t('Не выбрано') },
                                ...SCHOOL_GRADE_OPTIONS.map((grade) => ({
                                  value: String(grade),
                                  label: `${grade}`,
                                })),
                              ]}
                            />
                          </FieldRow>
                          <FieldRow>
                            <Input
                              label="Цена"
                              value={String(rule.amount || '')}
                              onChange={(value: string) =>
                                updateFinanceFeeRule(index, { amount: value })
                              }
                            />
                            <Select
                              label="Валюта"
                              value={String(rule.currency || 'KZT')}
                              onChange={(value: string) =>
                                updateFinanceFeeRule(index, { currency: value || 'KZT' })
                              }
                              options={SCHOOL_FEE_CURRENCIES.map((currency) => ({
                                value: currency,
                                label: currency,
                              }))}
                            />
                          </FieldRow>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">{t('Добавьте хотя бы одну цену.')}</p>
                  )}
                  <TextArea
                    label="Комментарий"
                    value={getDeep(profile, 'finance.comment')}
                    onChange={(value: string) =>
                      updateField('finance.comment', value)
                    }
                    rows={3}
                  />
                  <FieldRow>
                    <Input
                      label="Скидки"
                      value={discountsValue}
                      onChange={(value: string) =>
                        updateField('finance.discounts_info', value)
                      }
                    />
                    <Input
                      label="Гранты"
                      value={grantsValue}
                      onChange={(value: string) =>
                        updateField('finance.grants_info', value)
                      }
                    />
                  </FieldRow>
                </Section>
              )}
            </>
          )}

          {activeTab === 'contacts' && (
            <Section title="Контакты">
              <FieldRow>
                <Input
                  label="Телефон"
                  value={getDeep(profile, 'basic_info.phone')}
                  type="tel"
                  placeholder="+7 (___) ___-__-__"
                  onChange={(value: string) => updateField('basic_info.phone', formatKzPhone(value))}
                />
                <Input
                  label="WhatsApp"
                  value={getDeep(profile, 'basic_info.whatsapp_phone')}
                  type="tel"
                  placeholder="+7 (___) ___-__-__"
                  onChange={(value: string) =>
                    updateField('basic_info.whatsapp_phone', formatKzPhone(value))
                  }
                />
              </FieldRow>
              <FieldRow>
                <Input
                  label="Email"
                  value={getDeep(profile, 'basic_info.email')}
                  onChange={(value: string) => updateField('basic_info.email', value)}
                />
                <Input
                  label="Сайт"
                  value={getDeep(profile, 'basic_info.website')}
                  onChange={(value: string) => updateField('basic_info.website', value)}
                />
              </FieldRow>
            </Section>
          )}

          {activeTab === 'education' && (
            <Section title="Учебный процесс">
        <CheckboxGroup
          label="Языки обучения"
          options={TEACHING_LANGUAGE_OPTIONS}
          values={languagesValue}
          onChange={(next: string[]) => updateListField('education.languages', next)}
        />
        <FieldRow>
          <Input
            label="Языки (доп.)"
            value={getDeep(profile, localePath('education.languages_other'))}
            onChange={(value: string) =>
              updateField(localePath('education.languages_other'), value)
            }
          />
        </FieldRow>
        <CheckboxGroup
          label="Учебные программы (национальные)"
          options={CURRICULA_GROUPS.national}
          values={normalizeListValue(getDeep(profile, 'education.curricula.national', []))}
          onChange={(next: string[]) =>
            updateField('education.curricula.national', next)
          }
        />
        <CheckboxGroup
          label="Учебные программы (международные)"
          options={CURRICULA_GROUPS.international}
          values={normalizeListValue(getDeep(profile, 'education.curricula.international', []))}
          onChange={(next: string[]) =>
            updateField('education.curricula.international', next)
          }
        />
        <CheckboxGroup
          label="Учебные программы (дополнительные)"
          options={CURRICULA_GROUPS.additional}
          values={normalizeListValue(getDeep(profile, 'education.curricula.additional', []))}
          onChange={(next: string[]) =>
            updateField('education.curricula.additional', next)
          }
        />
        <FieldRow>
          <Input
            label="Учебные программы (другое)"
            value={getDeep(profile, localePath('education.curricula.other'))}
            onChange={(value: string) =>
              updateField(localePath('education.curricula.other'), value)
            }
          />
        </FieldRow>
        <CheckboxGroup
          label="Углубленные предметы"
          options={ADVANCED_SUBJECT_OPTIONS}
          values={advancedValue}
          onChange={(next: string[]) => updateListField('education.advanced_subjects', next)}
        />
        <FieldRow>
          <Input
            label="Углубленные (доп.)"
            value={getDeep(profile, localePath('education.advanced_subjects_other'))}
            onChange={(value: string) =>
              updateField(localePath('education.advanced_subjects_other'), value)
            }
          />
        </FieldRow>
        <CheckboxGroup
          label="Классы"
          options={GRADE_OPTIONS}
          values={gradesValue}
          onChange={(next: string[]) => updateListField('education.grades', next)}
        />
        <FieldRow>
                  <Select
                    label="Средний размер класса"
                    value={getDeep(profile, 'education.average_class_size')}
                    onChange={(value: string) => updateField('education.average_class_size', value)}
                    options={[
                      { value: '', label: t('Не выбрано') },
                      ...CLASS_SIZE_OPTIONS.map((item) => ({ value: item, label: item })),
                    ]}
                  />
                </FieldRow>
        <FieldRow>
          <Select
            label="Размер класса (начальная школа)"
            value={getDeep(profile, 'education.learning_conditions.class_size_primary')}
            onChange={(value: string) =>
              updateField('education.learning_conditions.class_size_primary', value)
            }
            options={[
              { value: '', label: t('Не выбрано') },
              ...withCurrentOption(
                CLASS_SIZE_OPTIONS,
                String(getDeep(profile, 'education.learning_conditions.class_size_primary') || '')
              ).map((item) => ({ value: item, label: item })),
            ]}
          />
          <Select
            label="Размер класса (средняя школа)"
            value={getDeep(profile, 'education.learning_conditions.class_size_middle')}
            onChange={(value: string) =>
              updateField('education.learning_conditions.class_size_middle', value)
            }
            options={[
              { value: '', label: t('Не выбрано') },
              ...withCurrentOption(
                CLASS_SIZE_OPTIONS,
                String(getDeep(profile, 'education.learning_conditions.class_size_middle') || '')
              ).map((item) => ({ value: item, label: item })),
            ]}
          />
          <Select
            label="Размер класса (старшая школа)"
            value={getDeep(profile, 'education.learning_conditions.class_size_high')}
            onChange={(value: string) =>
              updateField('education.learning_conditions.class_size_high', value)
            }
            options={[
              { value: '', label: t('Не выбрано') },
              ...withCurrentOption(
                CLASS_SIZE_OPTIONS,
                String(getDeep(profile, 'education.learning_conditions.class_size_high') || '')
              ).map((item) => ({ value: item, label: item })),
            ]}
          />
        </FieldRow>
        <FieldRow>
          <Select
            label="Сменность обучения"
            value={getDeep(profile, 'education.learning_conditions.shift_mode')}
            onChange={(value: string) =>
              updateField('education.learning_conditions.shift_mode', value)
            }
            options={[
              { value: '', label: t('Не выбрано') },
              ...withCurrentOption(
                SHIFT_MODE_OPTIONS,
                String(getDeep(profile, 'education.learning_conditions.shift_mode') || '')
              ).map((item) => ({
                value: item,
                label: translateOption(item, contentLocale),
              })),
            ]}
          />
        </FieldRow>
        <CheckboxGroup
          label="Цифровые платформы"
          options={withCurrentOptions(DIGITAL_PLATFORM_OPTIONS, digitalPlatformsValue)}
          values={digitalPlatformsValue}
          onChange={(next: string[]) =>
            updateListField('education.learning_conditions.digital_platforms', next)
          }
        />
        <FieldRow>
          <TextArea
            label="Формат домашней работы"
            rows={3}
            value={getDeep(profile, localePath('education.learning_conditions.homework_format'))}
            onChange={(value: string) =>
              updateField(localePath('education.learning_conditions.homework_format'), value)
            }
          />
        </FieldRow>
        <FieldRow>
          <TextArea
            label="Формат оценивания"
            rows={3}
            value={getDeep(profile, localePath('education.learning_conditions.assessment_format'))}
            onChange={(value: string) =>
              updateField(localePath('education.learning_conditions.assessment_format'), value)
            }
          />
        </FieldRow>
        <FieldRow>
          <Input
            label="Средний балл экзаменов"
            value={getDeep(profile, 'education.results.average_exam_score')}
            onChange={(value: string) =>
              updateField('education.results.average_exam_score', value)
            }
          />
          <Select
            label="Поступление выпускников в вузы (%)"
            value={getDeep(profile, 'education.results.university_admission_rate')}
            onChange={(value: string) =>
              updateField('education.results.university_admission_rate', value)
            }
            options={[
              { value: '', label: t('Не выбрано') },
              ...withCurrentOption(
                UNIVERSITY_ADMISSION_RATE_OPTIONS,
                String(getDeep(profile, 'education.results.university_admission_rate') || '')
              ).map((item) => ({
                value: item,
                label: translateOption(item, contentLocale),
              })),
            ]}
          />
        </FieldRow>
        <FieldRow>
          <TextArea
            label="Куда поступают выпускники"
            rows={3}
            value={getDeep(profile, localePath('education.results.top_universities'))}
            onChange={(value: string) =>
              updateField(localePath('education.results.top_universities'), value)
            }
          />
        </FieldRow>
        <FieldRow>
          <TextArea
            label="Олимпиадные достижения"
            rows={3}
            value={getDeep(profile, localePath('education.results.olympiad_achievements'))}
            onChange={(value: string) =>
              updateField(localePath('education.results.olympiad_achievements'), value)
            }
          />
        </FieldRow>
        <div className="teacher-actions">
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              const nextStories = [...studentSuccessStories, createStudentSuccessStoryEntry()];
              setStudentSuccessStories(nextStories);
            }}
          >
            {t('Добавить кейс выпускника')}
          </button>
        </div>
        {studentSuccessStories.length ? (
          <div className="teacher-list">
            {studentSuccessStories.map((story: any, index: number) => {
              const subjectsValues = normalizeListValue(story?.admission_subjects || '');
              return (
                <div key={String(story.id || `student-story-${index}`)} className="teacher-card">
                  <div className="teacher-card-head">
                    <h3>{`${t('Кейс выпускника')} #${index + 1}`}</h3>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => {
                        const nextStories = studentSuccessStories.filter(
                          (_item, storyIndex) => storyIndex !== index
                        );
                        setStudentSuccessStories(nextStories);
                      }}
                    >
                      {t('Удалить кейс')}
                    </button>
                  </div>
                  <FieldRow>
                    <Input
                      label="Имя ученика"
                      value={String(story?.student_name || '')}
                      onChange={(value: string) => updateStudentSuccessStory(index, { student_name: value })}
                    />
                    <Input
                      label="Куда поступил"
                      value={String(story?.admitted_to || '')}
                      onChange={(value: string) => updateStudentSuccessStory(index, { admitted_to: value })}
                    />
                  </FieldRow>
                  <FieldRow>
                    <Input
                      label="ЕНТ"
                      value={String(story?.ent_score || '')}
                      onChange={(value: string) => updateStudentSuccessStory(index, { ent_score: value })}
                    />
                    <Input
                      label="IELTS"
                      value={String(story?.ielts_score || '')}
                      onChange={(value: string) => updateStudentSuccessStory(index, { ielts_score: value })}
                    />
                  </FieldRow>
                  <FieldRow>
                    <Input
                      label="SAT"
                      value={String(story?.sat_score || '')}
                      onChange={(value: string) => updateStudentSuccessStory(index, { sat_score: value })}
                    />
                    <Input
                      label="Средний балл в школе"
                      value={String(story?.school_average_score || '')}
                      onChange={(value: string) =>
                        updateStudentSuccessStory(index, { school_average_score: value })
                      }
                    />
                  </FieldRow>
                  <FieldRow>
                    <Input
                      label="Срок подачи документов"
                      type="date"
                      value={String(story?.application_deadline || '')}
                      onChange={(value: string) =>
                        updateStudentSuccessStory(index, { application_deadline: value })
                      }
                    />
                  </FieldRow>
                  <FieldRow>
                    <label className="field">
                      <span>{t('Фото ученика (файл)')}</span>
                      <div className="media-inline">
                        {String(story?.student_photo || '').trim() ? (
                          <div className="media-inline-thumb">
                            <img src={String(story.student_photo)} alt="" />
                            <button
                              type="button"
                              className="media-inline-remove"
                              onClick={() => updateStudentSuccessStory(index, { student_photo: '' })}
                              aria-label={t('Удалить фото')}
                            >
                              ×
                            </button>
                            <span className="media-inline-badge">{t('Фото ученика загружено')}</span>
                          </div>
                        ) : null}
                        <label className="media-inline-add">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={async (event) => {
                              try {
                                const files = Array.from(event.target.files || []);
                                const prepared = await prepareImageFiles(files.slice(0, 1), {
                                  title: t('Фото ученика (файл)'),
                                  aspect: 1,
                                });
                                if (!prepared || !prepared.length) {
                                  event.target.value = '';
                                  return;
                                }
                                const uploaded = await uploadMediaFiles(prepared, 'student-success');
                                const photoUrl = uploaded[0] || '';
                                if (photoUrl) {
                                  updateStudentSuccessStory(index, { student_photo: photoUrl });
                                }
                                setMediaMessage('');
                              } catch (error: any) {
                                setMediaMessage(error?.message || t('Не удалось загрузить файл.'));
                              } finally {
                                event.target.value = '';
                              }
                            }}
                          />
                          <span className="media-inline-add-text">{t('Загрузить фото')}</span>
                        </label>
                      </div>
                    </label>
                    <TextArea
                      label="Достижения"
                      rows={3}
                      value={String(story?.achievements?.[contentLocale] || '')}
                      onChange={(value: string) =>
                        updateStudentSuccessStory(index, {
                          achievements: {
                            ...(story?.achievements || { ru: '', en: '', kk: '' }),
                            [contentLocale]: value,
                          },
                        })
                      }
                    />
                  </FieldRow>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="muted">{t('Пока нет кейсов выпускников.')}</p>
        )}
            </Section>
          )}

          {activeTab === 'admission' && (
            <Section title="Поступление">
        <Toggle
          label="Требуется вступительный экзамен"
          checked={Boolean(getDeep(profile, 'education.entrance_exam.required'))}
          onChange={(value: boolean) => updateField('education.entrance_exam.required', value)}
        />
        <FieldRow>
          <Select
            label="Формат"
            value={getDeep(profile, 'education.entrance_exam.format')}
            onChange={(value: string) => updateField('education.entrance_exam.format', value)}
            options={[
              { value: '', label: t('Не выбрано') },
              { value: 'test', label: t('Тест') },
              { value: 'exam', label: t('Экзамен') },
              { value: 'interview', label: t('Собеседование') },
              { value: 'none', label: t('Нет') },
              { value: 'other', label: t('Другое') },
            ]}
          />
          <Input
            label="Формат (доп.)"
            value={getDeep(profile, localePath('education.entrance_exam.format_other'))}
            onChange={(value: string) =>
              updateField(localePath('education.entrance_exam.format_other'), value)
            }
          />
        </FieldRow>
        <FieldRow>
          <TextArea
            label="Этапы"
            value={getDeep(profile, localePath('education.entrance_exam.stages'))}
            onChange={(value: string) =>
              updateField(localePath('education.entrance_exam.stages'), value)
            }
          />
        </FieldRow>
        <FieldRow>
          <Input
            label="Свободные места по классам"
            value={getDeep(profile, 'education.admission_details.seats_by_grade')}
            onChange={(value: string) =>
              updateField('education.admission_details.seats_by_grade', value)
            }
          />
          <Select
            label="Период набора"
            value={getDeep(profile, 'education.admission_details.enrollment_period')}
            onChange={(value: string) =>
              updateField('education.admission_details.enrollment_period', value)
            }
            options={[
              { value: '', label: t('Не выбрано') },
              ...withCurrentOption(
                ADMISSION_PERIOD_OPTIONS,
                String(getDeep(profile, 'education.admission_details.enrollment_period') || '')
              ).map((item) => ({
                value: item,
                label: translateOption(item, contentLocale),
              })),
            ]}
          />
        </FieldRow>
        <FieldRow>
          <Input
            label="Сроки подачи документов"
            type="date"
            value={getDeep(profile, 'education.admission_details.document_deadlines')}
            onChange={(value: string) =>
              updateField('education.admission_details.document_deadlines', value)
            }
          />
          <Select
            label="Конкурс на место"
            value={getDeep(profile, 'education.admission_details.competition_per_seat')}
            onChange={(value: string) =>
              updateField('education.admission_details.competition_per_seat', value)
            }
            options={[
              { value: '', label: t('Не выбрано') },
              ...withCurrentOption(
                ADMISSION_COMPETITION_OPTIONS,
                String(getDeep(profile, 'education.admission_details.competition_per_seat') || '')
              ).map((item) => ({
                value: item,
                label: translateOption(item, contentLocale),
              })),
            ]}
          />
        </FieldRow>
        <FieldRow>
          <TextArea
            label="Детализация этапов набора"
            rows={3}
            value={getDeep(profile, localePath('education.admission_details.admission_stages_detail'))}
            onChange={(value: string) =>
              updateField(localePath('education.admission_details.admission_stages_detail'), value)
            }
          />
        </FieldRow>
            </Section>
          )}

          {activeTab === 'services' && (
            <Section title="Сервисы">
        <FieldRow>
          <Select
            label="Питание"
            value={getDeep(profile, 'services.meals_status')}
            onChange={(value: string) => {
              updateField('services.meals_status', value);
              if (value !== 'Not included in tuition') {
                updateField('services.meals_price', '');
                updateField('services.meals_currency', 'KZT');
              }
            }}
            options={[
              { value: '', label: t('Не выбрано') },
              ...MEAL_OPTIONS.map((item) => ({
                value: item,
                label: translateOption(item, contentLocale),
              })),
            ]}
          />
          <Select
            label="Разов в день"
            value={getDeep(profile, 'services.meals_times_per_day')}
            onChange={(value: string) => updateField('services.meals_times_per_day', value)}
            options={[
              { value: '', label: t('Не выбрано') },
              ...MEAL_TIMES_OPTIONS.map((item) => ({ value: item, label: item })),
            ]}
          />
          <Select
            label="Бесплатно до класса"
            value={getDeep(profile, 'services.meals_free_until_grade')}
            onChange={(value: string) => updateField('services.meals_free_until_grade', value)}
            options={[
              { value: '', label: t('Не выбрано') },
              ...MEAL_GRADE_OPTIONS.map((item) => ({ value: item, label: item })),
            ]}
          />
        </FieldRow>
        {getDeep(profile, 'services.meals_status') === 'Not included in tuition' ? (
          <FieldRow>
            <Input
              label="Стоимость питания"
              value={getDeep(profile, 'services.meals_price')}
              onChange={(value: string) => updateField('services.meals_price', value)}
            />
            <Select
              label="Валюта питания"
              value={String(getDeep(profile, 'services.meals_currency') || 'KZT')}
              onChange={(value: string) =>
                updateField('services.meals_currency', value || 'KZT')
              }
              options={SCHOOL_FEE_CURRENCIES.map((currency) => ({
                value: currency,
                label: currency,
              }))}
            />
          </FieldRow>
        ) : null}
        <FieldRow>
          <Toggle
            label="Иностранные преподаватели"
            checked={Boolean(getDeep(profile, 'services.foreign_teachers'))}
            onChange={(value: boolean) => updateField('services.foreign_teachers', value)}
          />
        </FieldRow>
        <FieldRow>
          <TextArea
            label="Маршруты автобуса"
            rows={2}
            value={getDeep(profile, localePath('services.transport_details.routes'))}
            onChange={(value: string) =>
              updateField(localePath('services.transport_details.routes'), value)
            }
          />
        </FieldRow>
        <FieldRow>
          <TextArea
            label="Стоимость транспорта по районам"
            rows={2}
            value={getDeep(profile, localePath('services.transport_details.cost_by_district'))}
            onChange={(value: string) =>
              updateField(localePath('services.transport_details.cost_by_district'), value)
            }
          />
        </FieldRow>
        <FieldRow>
          <Input
            label="Время подачи автобуса"
            type="time"
            value={getDeep(profile, localePath('services.transport_details.pickup_schedule'))}
            onChange={(value: string) =>
              updateField(localePath('services.transport_details.pickup_schedule'), value)
            }
          />
          <Input
            label="Время развоза автобуса"
            type="time"
            value={getDeep(profile, localePath('services.transport_details.dropoff_schedule'))}
            onChange={(value: string) =>
              updateField(localePath('services.transport_details.dropoff_schedule'), value)
            }
          />
        </FieldRow>
        <CheckboxGroup
          label="Члены персонала"
          options={PERSONNEL_MEMBER_OPTIONS}
          values={personnelMembersValue}
          onChange={(next: string[]) => updatePersonnelMembers(next)}
        />
        <FieldRow>
          <Toggle
            label="Медкабинет"
            checked={Boolean(getDeep(profile, 'services.medical_office'))}
            onChange={(value: boolean) => updateField('services.medical_office', value)}
          />
        </FieldRow>
        <FieldRow>
          <TextArea
            label="Работа с аллергиями/особыми диетами"
            rows={2}
            value={getDeep(profile, localePath('services.health_support.allergy_support'))}
            onChange={(value: string) =>
              updateField(localePath('services.health_support.allergy_support'), value)
            }
          />
        </FieldRow>
        <FieldRow>
          <TextArea
            label="Протоколы безопасности"
            rows={2}
            value={getDeep(profile, localePath('services.safety.security_protocols'))}
            onChange={(value: string) =>
              updateField(localePath('services.safety.security_protocols'), value)
            }
          />
          <TextArea
            label="Политика доступа на территорию"
            rows={2}
            value={getDeep(profile, localePath('services.safety.access_policy'))}
            onChange={(value: string) =>
              updateField(localePath('services.safety.access_policy'), value)
            }
          />
        </FieldRow>
        <FieldRow>
          <Select
            label="Формат обратной связи с родителями"
            value={getDeep(profile, localePath('services.parent_engagement.feedback_format'))}
            onChange={(value: string) =>
              updateField(localePath('services.parent_engagement.feedback_format'), value)
            }
            options={[
              { value: '', label: t('Не выбрано') },
              ...withCurrentOption(
                PARENT_FEEDBACK_FORMAT_OPTIONS,
                String(getDeep(profile, localePath('services.parent_engagement.feedback_format')) || '')
              ).map((item) => ({
                value: item,
                label: translateOption(item, contentLocale),
              })),
            ]}
          />
          <Select
            label="Частота встреч с родителями"
            value={getDeep(profile, localePath('services.parent_engagement.meeting_frequency'))}
            onChange={(value: string) =>
              updateField(localePath('services.parent_engagement.meeting_frequency'), value)
            }
            options={[
              { value: '', label: t('Не выбрано') },
              ...withCurrentOption(
                PARENT_MEETING_FREQUENCY_OPTIONS,
                String(getDeep(profile, localePath('services.parent_engagement.meeting_frequency')) || '')
              ).map((item) => ({
                value: item,
                label: translateOption(item, contentLocale),
              })),
            ]}
          />
        </FieldRow>
        <FieldRow>
          <Select
            label="Родительский комитет"
            value={getDeep(profile, 'services.parent_engagement.parent_committee')}
            onChange={(value: string) =>
              updateField('services.parent_engagement.parent_committee', value)
            }
            options={[
              { value: '', label: t('Не выбрано') },
              ...withCurrentOption(
                PARENT_COMMITTEE_OPTIONS,
                String(getDeep(profile, 'services.parent_engagement.parent_committee') || '')
              ).map((item) => ({
                value: item,
                label: translateOption(item, contentLocale),
              })),
            ]}
          />
          <Select
            label="SLA ответа школе (часы)"
            value={getDeep(profile, 'services.parent_engagement.response_sla_hours')}
            onChange={(value: string) =>
              updateField('services.parent_engagement.response_sla_hours', value)
            }
            options={[
              { value: '', label: t('Не выбрано') },
              ...withCurrentOption(
                RESPONSE_SLA_OPTIONS,
                String(getDeep(profile, 'services.parent_engagement.response_sla_hours') || '')
              ).map((item) => ({
                value: item,
                label: item,
              })),
            ]}
          />
        </FieldRow>
        <Section title="Руководство школы">
          <div className="teacher-list">
            {leadershipMembers.map(({ key, title, member }) => {
              const isExpanded = expandedLeadershipKey === key;
              const summaryParts = [
                String(member?.full_name || '').trim(),
                String(member?.position || '').trim(),
                String(member?.bio?.[contentLocale] || '').trim(),
              ].filter(Boolean);
              return (
                <div key={key} className="teacher-card">
                  <div className="teacher-card-head">
                    <h3>{t(title)}</h3>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() =>
                          setExpandedLeadershipKey((prev) => (prev === key ? null : key))
                        }
                      >
                        {isExpanded ? t('Свернуть') : t('Развернуть')}
                      </button>
                    </div>
                  </div>
                  {!isExpanded ? (
                    <p className="muted" style={{ marginTop: 8 }}>
                      {summaryParts.join(' • ') || t('Не выбрано')}
                    </p>
                  ) : null}
                  {isExpanded ? (
                    <>
                      <FieldRow>
                        <Input
                          label="ФИО"
                          value={member?.full_name || ''}
                          onChange={(value: string) =>
                            updateLeadershipMember(key, { full_name: value })
                          }
                        />
                        <Input
                          label="Должность"
                          value={member?.position || ''}
                          onChange={(value: string) =>
                            updateLeadershipMember(key, { position: value })
                          }
                        />
                      </FieldRow>
                      <FieldRow>
                        <label className="field">
                          <span>{t('Фото руководителя (файл)')}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={async (event) => {
                              const input = event.currentTarget;
                              const file = input.files?.[0];
                              if (!file) return;
                              try {
                                setMediaMessage('');
                                const preparedFiles = await prepareImageFiles([file], {
                                  title: t('Фото руководителя (файл)'),
                                  aspect: 1,
                                });
                                if (!preparedFiles?.length) return;
                                const urls = await uploadMediaFiles(preparedFiles, 'leadership');
                                if (urls[0]) {
                                  updateLeadershipMember(key, { photo_url: urls[0] }, true);
                                }
                              } catch (error: any) {
                                setMediaMessage(
                                  error?.message ||
                                    'Не удалось загрузить фото руководителя. Проверьте bucket в Supabase.'
                                );
                              } finally {
                                input.value = '';
                              }
                            }}
                          />
                          {member?.photo_url ? (
                            <div className="teacher-photo-preview">
                              <img src={member.photo_url} alt={member.full_name || title} />
                              <button
                                type="button"
                                className="button secondary"
                                onClick={() => updateLeadershipMember(key, { photo_url: '' }, true)}
                              >
                                {t('Удалить фото')}
                              </button>
                            </div>
                          ) : null}
                        </label>
                      </FieldRow>
                      <FieldRow>
                        <TextArea
                          label="Короткое описание"
                          rows={3}
                          value={member?.bio?.[contentLocale] || ''}
                          onChange={(value: string) =>
                            updateLeadershipMember(key, {
                              bio: {
                                ...(member?.bio || { ru: '', en: '', kk: '' }),
                                [contentLocale]: value,
                              },
                            })
                          }
                        />
                      </FieldRow>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Section>
        <Section title="Наш преподавательский состав">
          <div className="teacher-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                const nextMembers = [...teachingStaffMembers, createTeacherMember()];
                setTeachingStaffMembers(nextMembers);
                setExpandedTeacherIndex(nextMembers.length - 1);
              }}
            >
              {t('Добавить преподавателя')}
            </button>
          </div>
          {teachingStaffMembers.length ? (
            <div className="teacher-list">
              {teachingStaffMembers.map((member: any, index: number) => (
                <div key={member?.id || `teacher-${index}`} className="teacher-card">
                  {(() => {
                    const isExpanded = expandedTeacherIndex === index;
                    const summaryParts = [
                      String(member?.full_name || '').trim(),
                      String(member?.position || '').trim(),
                      String(member?.education_degree || '').trim(),
                      String(member?.subjects || '').trim(),
                      Number(member?.experience_years || 0) > 0
                        ? `${t('Стаж (лет)')}: ${
                            Number(member?.experience_years || 0) >= TEACHER_EXPERIENCE_MAX
                              ? `${TEACHER_EXPERIENCE_MAX}+`
                              : Number(member?.experience_years || 0)
                          }`
                        : '',
                    ].filter(Boolean);
                    return (
                      <>
                        <div className="teacher-card-head">
                          <h3>{`${t('Наш преподавательский состав')} #${index + 1}`}</h3>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              type="button"
                              className="button secondary"
                              onClick={() =>
                                setExpandedTeacherIndex((prev) => (prev === index ? null : index))
                              }
                            >
                              {isExpanded ? t('Свернуть') : t('Развернуть')}
                            </button>
                            <button
                              type="button"
                              className="button secondary"
                              onClick={() => {
                                const nextMembers = teachingStaffMembers.filter(
                                  (_item: any, itemIndex: number) => itemIndex !== index
                                );
                                setTeachingStaffMembers(nextMembers);
                                setExpandedTeacherIndex((prev) => {
                                  if (!nextMembers.length) return null;
                                  if (prev === null) return null;
                                  if (prev === index) return Math.min(index, nextMembers.length - 1);
                                  if (prev > index) return prev - 1;
                                  return prev;
                                });
                              }}
                            >
                              {t('Удалить преподавателя')}
                            </button>
                          </div>
                        </div>
                        {!isExpanded ? (
                          <p className="muted" style={{ marginTop: 8 }}>
                            {summaryParts.join(' • ') || t('Не выбрано')}
                          </p>
                        ) : null}
                        {isExpanded ? (
                          <>
                  <FieldRow>
                    <Input
                      label="ФИО преподавателя"
                      value={member?.full_name || ''}
                      onChange={(value: string) =>
                        updateTeachingStaffMember(index, { full_name: value })
                      }
                    />
                    <Input
                      label="Должность"
                      value={member?.position || ''}
                      onChange={(value: string) =>
                        updateTeachingStaffMember(index, { position: value })
                      }
                    />
                  </FieldRow>
                  <FieldRow>
                    <Input
                      label="Образование / академическая степень"
                      value={member?.education_degree || ''}
                      onChange={(value: string) =>
                        updateTeachingStaffMember(index, { education_degree: value })
                      }
                    />
                  </FieldRow>
                  <FieldRow>
                    <SubjectPicker
                      label="Предметы"
                      options={withCurrentOptions(
                        TEACHER_SUBJECT_OPTIONS,
                        normalizeListValue(member?.subjects)
                      )}
                      values={normalizeListValue(member?.subjects)}
                      onChange={(next: string[]) =>
                        updateTeachingStaffMember(index, {
                          subjects: next.join(', '),
                        })
                      }
                    />
                    <label className="field">
                      <span>
                        {t('Стаж (лет)')}:{' '}
                        {Number(member?.experience_years || 0) >= TEACHER_EXPERIENCE_MAX
                          ? `${TEACHER_EXPERIENCE_MAX}+`
                          : Number(member?.experience_years || 0)}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={TEACHER_EXPERIENCE_MAX}
                        step={1}
                        value={Number(member?.experience_years || 0)}
                        onChange={(event) =>
                          updateTeachingStaffMember(index, {
                            experience_years: String(event.target.value),
                          })
                        }
                      />
                    </label>
                  </FieldRow>
                  <FieldRow>
                    <CategoryPicker
                      label="Категория преподавателя"
                      value={member?.category || ''}
                      onChange={(value: string) =>
                        updateTeachingStaffMember(index, { category: value })
                      }
                      options={withCurrentOption(
                        TEACHER_CATEGORY_OPTIONS,
                        member?.category || ''
                      )}
                    />
                    <CheckboxGroup
                      label="Языки преподавания"
                      options={withCurrentOptions(
                        TEACHER_LANGUAGE_OPTIONS,
                        normalizeListValue(member?.teaching_languages)
                      )}
                      values={normalizeListValue(member?.teaching_languages)}
                      onChange={(next: string[]) =>
                        updateTeachingStaffMember(index, {
                          teaching_languages: next.join(', '),
                        })
                      }
                    />
                  </FieldRow>
                  <FieldRow>
                    <Select
                      label="Подготовка к экзаменам"
                      value={member?.exam_prep || ''}
                      onChange={(value: string) =>
                        updateTeachingStaffMember(index, { exam_prep: value })
                      }
                      options={[
                        { value: '', label: t('Не выбрано') },
                        ...withCurrentOption(
                          TEACHER_EXAM_OPTIONS,
                          member?.exam_prep || ''
                        ).map((item) => ({
                          value: item,
                          label: translateOption(item, contentLocale),
                        })),
                      ]}
                    />
                  </FieldRow>
                  <FieldRow>
                    <label className="field">
                      <span>{t('Фото преподавателя (файл)')}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (event) => {
                          const input = event.currentTarget;
                          const file = input.files?.[0];
                          if (!file) return;
                          try {
                            setMediaMessage('');
                            const preparedFiles = await prepareImageFiles([file], {
                              title: t('Фото преподавателя (файл)'),
                              aspect: 1,
                            });
                            if (!preparedFiles?.length) return;
                            const urls = await uploadMediaFiles(preparedFiles, 'teachers');
                            if (urls[0]) {
                              updateTeachingStaffMember(index, { photo_url: urls[0] }, true);
                            }
                          } catch (error: any) {
                            setMediaMessage(
                              error?.message ||
                                'Не удалось загрузить фото преподавателя. Проверьте bucket в Supabase.'
                            );
                          } finally {
                            input.value = '';
                          }
                        }}
                      />
                    </label>
                  </FieldRow>
                  {member?.photo_url ? (
                    <div className="media-inline-grid" style={{ marginTop: -4, marginBottom: 8 }}>
                      <div className="media-inline-item">
                        <button
                          type="button"
                          className="media-inline-remove"
                          onClick={() => removeTeachingStaffMemberPhoto(index)}
                          aria-label={t('Удалить фото')}
                        >
                          ×
                        </button>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={member.photo_url} alt="teacher" className="media-inline-preview" />
                        <span className="media-inline-badge">{t('Фото преподавателя загружено')}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="muted" style={{ marginTop: -6, marginBottom: 4 }}>
                      {t('Фото преподавателя не загружено')}
                    </p>
                  )}
                  <FieldRow>
                    <RichTextArea
                      label="Описание / опыт преподавателя"
                      value={getDeep(member, `bio.${contentLocale}`, '')}
                      onChange={(value: string) =>
                        updateTeachingStaffMember(index, {
                          bio: {
                            ...(member?.bio || {}),
                            [contentLocale]: value,
                          },
                        })
                      }
                      rows={4}
                    />
                  </FieldRow>
                          </>
                        ) : null}
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">{t('Добавьте хотя бы одного преподавателя.')}</p>
          )}
        </Section>
        <Section title="Каталог кружков и секций">
          {clubsCatalog.length ? (
            <div className="teacher-list">
              {clubsCatalog.map((club: any, index: number) => {
                const parsedSchedule = parseSchedulePreset(
                  String(club?.schedule?.[contentLocale] || '')
                );
                const startTime = splitTime(parsedSchedule.start);
                const endTime = splitTime(parsedSchedule.end);
                const parsedGrades = parseGradeRange(String(club?.grades || ''));
                const sectionPhotos = normalizeListValue(club?.section_photos || '');
                const isExpanded = expandedClubIndex === index;
                const summaryParts = [
                  String(club?.name?.[contentLocale] || '').trim(),
                  String(club?.teacher_name || '').trim(),
                  String(club?.schedule?.[contentLocale] || '').trim(),
                  String(club?.grades || '').trim(),
                  String(club?.price_monthly || '').trim()
                    ? `${club.price_monthly} ${String(club?.price_currency || 'KZT')}`
                    : '',
                ].filter(Boolean);
                return (
                  <div key={club?.id || `club-${index}`} className="teacher-card">
                    <div className="teacher-card-head">
                      <h3>{`${t('Каталог кружков и секций')} #${index + 1}`}</h3>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          className="button secondary"
                          onClick={() =>
                            setExpandedClubIndex((prev) => (prev === index ? null : index))
                          }
                        >
                          {isExpanded ? t('Свернуть') : t('Развернуть')}
                        </button>
                        <button
                          type="button"
                          className="button secondary"
                          onClick={() => {
                            const nextClubs = clubsCatalog.filter(
                              (_item: any, itemIndex: number) => itemIndex !== index
                            );
                            setClubsCatalog(nextClubs);
                            setExpandedClubIndex((prev) => {
                              if (!nextClubs.length) return null;
                              if (prev === null) return null;
                              if (prev === index) return Math.min(index, nextClubs.length - 1);
                              if (prev > index) return prev - 1;
                              return prev;
                            });
                          }}
                        >
                          {t('Удалить кружок')}
                        </button>
                      </div>
                    </div>
                    {!isExpanded ? (
                      <p className="muted" style={{ marginTop: 8 }}>
                        {summaryParts.join(' • ') || t('Не выбрано')}
                      </p>
                    ) : null}
                    {isExpanded ? (
                      <>
                    <FieldRow>
                      <Input
                        label="Название кружка"
                        value={String(club?.name?.[contentLocale] || '')}
                        placeholder="Например: Шахматы"
                        onChange={(value: string) =>
                          updateClubEntry(index, {
                            name: {
                              ...(club?.name || {}),
                              [contentLocale]: value,
                            },
                          })
                        }
                      />
                      <Input
                        label="Кто ведет (ФИО)"
                        value={club?.teacher_name || ''}
                        placeholder="Например: Ким Валерий"
                        onChange={(value: string) =>
                          updateClubEntry(index, { teacher_name: value })
                        }
                      />
                    </FieldRow>
                    <FieldRow>
                      <RichTextArea
                        label="Инфо про тренера"
                        rows={3}
                        value={club?.trainer_info || ''}
                        placeholder="Например: КМС • 8 лет стажа - международный сертификат"
                        onChange={(value: string) =>
                          updateClubEntry(index, { trainer_info: value })
                        }
                      />
                    </FieldRow>
                    <FieldRow>
                      <label className="field">
                        <span>{t('Фото тренера (файл)')}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (event) => {
                            const input = event.currentTarget;
                            const file = input.files?.[0];
                            if (!file) return;
                            try {
                              setMediaMessage('');
                              const preparedFiles = await prepareImageFiles([file], {
                                title: t('Фото тренера (файл)'),
                                aspect: 1,
                              });
                              if (!preparedFiles?.length) return;
                              const urls = await uploadMediaFiles(preparedFiles, 'clubs-trainers');
                              if (urls[0]) {
                                updateClubEntry(index, { trainer_photo: urls[0] });
                              }
                            } catch (error: any) {
                              setMediaMessage(
                                error?.message ||
                                  'Не удалось загрузить фото тренера. Проверьте bucket в Supabase.'
                              );
                            } finally {
                              input.value = '';
                            }
                          }}
                        />
                      </label>
                    </FieldRow>
                    {club?.trainer_photo ? (
                      <div className="media-inline-grid" style={{ marginTop: -4, marginBottom: 8 }}>
                        <div className="media-inline-item">
                          <button
                            type="button"
                            className="media-inline-remove"
                            onClick={() => removeClubTrainerPhoto(index)}
                            aria-label={t('Удалить фото')}
                          >
                            ×
                          </button>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={club.trainer_photo} alt="trainer" className="media-inline-preview" />
                          <span className="media-inline-badge">{t('Фото тренера загружено')}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="muted" style={{ marginTop: -6, marginBottom: 4 }}>
                        {t('Фото тренера не загружено')}
                      </p>
                    )}
                    <FieldRow>
                      <RichTextArea
                        label="Описание кружка"
                        rows={4}
                        value={String(club?.description?.[contentLocale] || '')}
                        placeholder="Можно писать с пробелами между словами"
                        onChange={(value: string) =>
                          updateClubEntry(index, {
                            description: {
                              ...(club?.description || {}),
                              [contentLocale]: value,
                            },
                          })
                        }
                      />
                    </FieldRow>
                    <FieldRow>
                      <label className="field">
                        <span>{t('Фото секции (файлы)')}</span>
                        <input
                          id={`club-section-photos-${index}`}
                          type="file"
                          accept="image/*"
                          multiple
                          style={sectionPhotos.length ? { display: 'none' } : undefined}
                          onChange={async (event) => {
                            const input = event.currentTarget;
                            const files = Array.from(input.files || []);
                            if (!files.length) return;
                            try {
                              setMediaMessage('');
                              const preparedFiles = await prepareImageFiles(files, {
                                title: t('Фото секции (файлы)'),
                                aspect: 4 / 3,
                              });
                              if (!preparedFiles?.length) return;
                              const urls = await uploadMediaFiles(preparedFiles, 'clubs-sections');
                              if (urls.length) {
                                const merged = [...sectionPhotos, ...urls];
                                updateClubEntry(index, { section_photos: merged.join(', ') });
                              }
                            } catch (error: any) {
                              setMediaMessage(
                                error?.message ||
                                  'Не удалось загрузить фото секции. Проверьте bucket в Supabase.'
                              );
                            } finally {
                              input.value = '';
                            }
                          }}
                        />
                      </label>
                    </FieldRow>
                    {sectionPhotos.length ? (
                      <>
                        <div className="media-inline-grid" style={{ marginTop: -4, marginBottom: 8 }}>
                          {sectionPhotos.map((url: string, photoIndex: number) => (
                            <div key={`${url}-${photoIndex}`} className="media-inline-item">
                              <button
                                type="button"
                                className="media-inline-remove"
                                onClick={() => removeClubSectionPhoto(index, photoIndex)}
                                aria-label={t('Удалить фото')}
                              >
                                ×
                              </button>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt={`section-${photoIndex + 1}`} className="media-inline-preview" />
                            </div>
                          ))}
                        </div>
                        <p className="muted" style={{ marginTop: -2, marginBottom: 8 }}>
                          {`${t('Загружено фото секции')}: ${sectionPhotos.length}`}
                        </p>
                        <div className="teacher-actions" style={{ marginTop: 0 }}>
                          <label htmlFor={`club-section-photos-${index}`} className="button secondary">
                            {t('Добавить еще фото секции')}
                          </label>
                        </div>
                      </>
                    ) : null}
                    <FieldRow>
                      <CheckboxGroup
                        label="Дни недели"
                        options={WEEKDAY_OPTIONS as unknown as string[]}
                        values={parsedSchedule.days}
                        onChange={(next: string[]) =>
                          updateClubSchedulePreset(index, {
                            days: next as WeekdayKey[],
                          })
                        }
                      />
                    </FieldRow>
                    <FieldRow>
                      <Select
                        label="Время начала"
                        value={startTime.hour}
                        onChange={(value: string) =>
                          updateClubSchedulePreset(index, {
                            start: composeTime(value, startTime.minute || '00'),
                          })
                        }
                        options={[
                          { value: '', label: t('Не выбрано') },
                          ...HOUR_OPTIONS.map((hour) => ({ value: hour, label: hour })),
                        ]}
                      />
                      <Select
                        label="Минуты (начало)"
                        value={startTime.minute}
                        onChange={(value: string) =>
                          updateClubSchedulePreset(index, {
                            start: composeTime(startTime.hour || '00', value),
                          })
                        }
                        options={[
                          { value: '', label: t('Не выбрано') },
                          ...MINUTE_OPTIONS.map((minute) => ({ value: minute, label: minute })),
                        ]}
                      />
                    </FieldRow>
                    <FieldRow>
                      <Select
                        label="Время окончания"
                        value={endTime.hour}
                        onChange={(value: string) =>
                          updateClubSchedulePreset(index, {
                            end: composeTime(value, endTime.minute || '00'),
                          })
                        }
                        options={[
                          { value: '', label: t('Не выбрано') },
                          ...HOUR_OPTIONS.map((hour) => ({ value: hour, label: hour })),
                        ]}
                      />
                      <Select
                        label="Минуты (окончание)"
                        value={endTime.minute}
                        onChange={(value: string) =>
                          updateClubSchedulePreset(index, {
                            end: composeTime(endTime.hour || '00', value),
                          })
                        }
                        options={[
                          { value: '', label: t('Не выбрано') },
                          ...MINUTE_OPTIONS.map((minute) => ({ value: minute, label: minute })),
                        ]}
                      />
                    </FieldRow>
                    <FieldRow>
                      <Select
                        label="С класса"
                        value={parsedGrades.from}
                        onChange={(value: string) =>
                          updateClubGradeRangePreset(index, { from: value })
                        }
                        options={[
                          { value: '', label: t('Не выбрано') },
                          ...SCHOOL_GRADE_OPTIONS.map((grade) => ({
                            value: String(grade),
                            label: String(grade),
                          })),
                        ]}
                      />
                      <Select
                        label="По класс"
                        value={parsedGrades.to}
                        onChange={(value: string) =>
                          updateClubGradeRangePreset(index, { to: value })
                        }
                        options={[
                          { value: '', label: t('Не выбрано') },
                          ...SCHOOL_GRADE_OPTIONS.map((grade) => ({
                            value: String(grade),
                            label: String(grade),
                          })),
                        ]}
                      />
                    </FieldRow>
                    <FieldRow>
                      <Input
                        label="Стоимость в месяц"
                        type="number"
                        value={club?.price_monthly || ''}
                        placeholder="0"
                        onChange={(value: string) =>
                          updateClubEntry(index, { price_monthly: value })
                        }
                      />
                      <Select
                        label="Валюта"
                        value={String(club?.price_currency || 'KZT')}
                        onChange={(value: string) =>
                          updateClubEntry(index, { price_currency: value || 'KZT' })
                        }
                        options={SCHOOL_FEE_CURRENCIES.map((currency) => ({
                          value: currency,
                          label: currency,
                        }))}
                      />
                    </FieldRow>
                      </>
                    ) : null}
                    <div className="teacher-actions" style={{ marginTop: 8 }}>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => {
                          const nextClubs = [
                            ...clubsCatalog.slice(0, index + 1),
                            createClubEntry(),
                            ...clubsCatalog.slice(index + 1),
                          ];
                          setClubsCatalog(nextClubs);
                          setExpandedClubIndex(index + 1);
                        }}
                      >
                        {t('Добавить следующий кружок')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              <p className="muted">{t('Добавьте хотя бы один кружок.')}</p>
              <div className="teacher-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    const nextClubs = [createClubEntry()];
                    setClubsCatalog(nextClubs);
                    setExpandedClubIndex(0);
                  }}
                >
                  {t('Добавить кружок')}
                </button>
              </div>
            </>
          )}
        </Section>
        <FieldRow>
          <Toggle
            label="Транспорт"
            checked={Boolean(getDeep(profile, 'services.transport'))}
            onChange={(value: boolean) => updateField('services.transport', value)}
          />
          <Toggle
            label="Инклюзив"
            checked={Boolean(getDeep(profile, 'services.inclusive_education'))}
            onChange={(value: boolean) => updateField('services.inclusive_education', value)}
          />
          <Toggle
            label="Продленка"
            checked={Boolean(getDeep(profile, 'services.after_school'))}
            onChange={(value: boolean) => updateField('services.after_school', value)}
          />
        </FieldRow>
        {mediaMessage ? <p className="muted">{mediaMessage}</p> : null}
            </Section>
          )}

          {activeTab === 'media' && (
            <Section title="Медиа">
              <div className="media-device-group">
                <p className="media-device-label">{t('Логотип (файл)')}</p>
                {logoUrl ? (
                  <div className="media-inline-grid" style={{ marginBottom: 12 }}>
                    <div className="media-inline-item">
                      <button
                        type="button"
                        className="media-inline-remove"
                        onClick={removeLogo}
                        aria-label="Удалить"
                      >
                        ×
                      </button>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logoUrl} alt="logo" className="media-inline-preview" />
                    </div>
                  </div>
                ) : null}
                <label className="media-device-upload">
                  <input
                    className="media-device-input"
                    type="file"
                    accept="image/*"
                    onChange={async (event) => {
                      const input = event.currentTarget;
                      const file = input.files?.[0];
                      if (!file) return;
                      try {
                        setMediaMessage('');
                        const preparedFiles = await prepareImageFiles([file], {
                          title: t('Логотип (файл)'),
                          aspect: 1,
                        });
                        if (!preparedFiles?.length) return;
                        const urls = await uploadMediaFiles(preparedFiles, 'logo');
                        if (urls[0]) {
                          applyAndSave('media.logo', urls[0]);
                        }
                      } catch (error: any) {
                        setMediaMessage(
                          error?.message ||
                            'Не удалось загрузить логотип. Проверьте bucket в Supabase.'
                        );
                      } finally {
                        input.value = '';
                      }
                    }}
                  />
                  <span className="media-device-upload-title">{t('Добавить файл')}</span>
                  <span className="media-device-upload-subtitle">{t('или перетащите файлы сюда')}</span>
                </label>
                <p className="muted">{hasLogo ? t('Логотип загружен') : t('Логотип не загружен')}</p>
              </div>

              <div className="media-divider" />

              <div className="media-device-group">
                <p className="media-device-label">{t('Фото (файлы)')}</p>
                <div className="media-inline-grid">
                  {photoItems.map((url, index) => (
                    <div key={`${url}-${index}`} className="media-inline-item">
                      <button
                        type="button"
                        className="media-inline-remove"
                        onClick={() => removeMediaItem('media.photos', index)}
                        aria-label="Удалить"
                      >
                        ×
                      </button>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`photo-${index + 1}`} className="media-inline-preview" />
                      {index === 0 ? <span className="media-inline-badge">Главное фото</span> : null}
                    </div>
                  ))}
                  <label className="media-inline-add">
                    <input
                      className="media-device-input"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={async (event) => {
                        const input = event.currentTarget;
                        const files = Array.from(input.files || []);
                        if (!files.length) return;
                        try {
                          setMediaMessage('');
                          const preparedFiles = await prepareImageFiles(files, {
                            title: t('Фото (файлы)'),
                            aspect: 4 / 3,
                          });
                          if (!preparedFiles?.length) return;
                          const urls = await uploadMediaFiles(preparedFiles, 'photos');
                          if (profile) {
                            const existing = normalizeListValue(getDeep(profile, 'media.photos', ''));
                            const next = [...existing, ...urls].filter(Boolean);
                            applyAndSave('media.photos', next.join(', '));
                          }
                        } catch (error: any) {
                          setMediaMessage(
                            error?.message ||
                              'Не удалось загрузить фото. Проверьте bucket в Supabase.'
                          );
                        } finally {
                          input.value = '';
                        }
                      }}
                    />
                    <span className="media-inline-plus">+</span>
                    <span className="media-inline-add-text">{t('Добавить фото')}</span>
                  </label>
                </div>
                <p className="muted">{`${t('Загружено фото')}: ${photosCount}`}</p>
              </div>

              <div className="media-divider" />

              <div className="media-device-group">
                <p className="media-device-label">{t('Видео (файлы)')}</p>
                <div className="media-inline-grid">
                  {videoItems.map((url, index) => (
                    <div key={`${url}-${index}`} className="media-inline-item">
                      <button
                        type="button"
                        className="media-inline-remove"
                        onClick={() => removeMediaItem('media.videos', index)}
                        aria-label="Удалить"
                      >
                        ×
                      </button>
                      <video className="media-inline-preview" src={url} muted playsInline preload="metadata" />
                    </div>
                  ))}
                  <label className="media-inline-add">
                    <input
                      className="media-device-input"
                      type="file"
                      accept="video/*"
                      multiple
                      onChange={async (event) => {
                        const input = event.currentTarget;
                        const files = Array.from(input.files || []);
                        if (!files.length) return;
                        try {
                          setMediaMessage('');
                          const urls = await uploadMediaFiles(files, 'videos');
                          if (profile) {
                            const existing = normalizeListValue(getDeep(profile, 'media.videos', ''));
                            const next = [...existing, ...urls].filter(Boolean);
                            applyAndSave('media.videos', next.join(', '));
                          }
                        } catch (error: any) {
                          setMediaMessage(
                            error?.message ||
                              'Не удалось загрузить видео. Проверьте bucket в Supabase.'
                          );
                        } finally {
                          input.value = '';
                        }
                      }}
                    />
                    <span className="media-inline-plus">+</span>
                    <span className="media-inline-add-text">{t('Добавить видео')}</span>
                  </label>
                </div>
                <p className="muted">{`${t('Загружено видео')}: ${videosCount}`}</p>
              </div>

              <div className="media-divider" />

              <div className="media-device-group">
                <p className="media-device-label">{t('Аккредитация (файлы)')}</p>
                <div className="media-inline-grid">
                  {certificateItems.map((url, index) => {
                    const fileName = decodeURIComponent(String(url).split('/').pop() || `file-${index + 1}`);
                    return (
                      <div key={`${url}-${index}`} className="media-inline-item media-inline-doc">
                        <button
                          type="button"
                          className="media-inline-remove"
                          onClick={() => removeMediaItem('media.certificates', index)}
                          aria-label="Удалить"
                        >
                          ×
                        </button>
                        <a href={url} target="_blank" rel="noreferrer" className="media-inline-doc-link">
                          <span className="media-inline-doc-icon">📄</span>
                          <span className="media-inline-doc-name">{fileName}</span>
                        </a>
                      </div>
                    );
                  })}
                  <label className="media-inline-add">
                    <input
                      className="media-device-input"
                      type="file"
                      accept="image/*,.pdf,.doc,.docx"
                      multiple
                      onChange={async (event) => {
                        const input = event.currentTarget;
                        const files = Array.from(input.files || []);
                        if (!files.length) return;
                        try {
                          setMediaMessage('');
                          const urls = await uploadMediaFiles(files, 'certificates');
                          if (profile) {
                            const existing = normalizeListValue(
                              getDeep(profile, 'media.certificates', '')
                            );
                            const next = [...existing, ...urls].filter(Boolean);
                            applyAndSave('media.certificates', next.join(', '));
                          }
                        } catch (error: any) {
                          setMediaMessage(
                            error?.message ||
                              'Не удалось загрузить аккредитацию. Проверьте bucket в Supabase.'
                          );
                        } finally {
                          input.value = '';
                        }
                      }}
                    />
                    <span className="media-inline-plus">+</span>
                    <span className="media-inline-add-text">{t('Добавить аккредитацию')}</span>
                  </label>
                </div>
                <p className="muted">{`${t('Загружено аккредитаций')}: ${certificatesCount}`}</p>
              </div>

              {mediaMessage ? <p className="muted">{mediaMessage}</p> : null}
        <div className="media-divider" />
        <FieldRow>
          <Input
            label="Instagram"
            value={getDeep(profile, 'media.social_links.instagram')}
            onChange={(value: string) => updateField('media.social_links.instagram', value)}
          />
          <Input
            label="TikTok"
            value={getDeep(profile, 'media.social_links.tiktok')}
            onChange={(value: string) => updateField('media.social_links.tiktok', value)}
          />
          <Input
            label="YouTube"
            value={getDeep(profile, 'media.social_links.youtube')}
            onChange={(value: string) => updateField('media.social_links.youtube', value)}
          />
        </FieldRow>
        <FieldRow>
          <Input
            label="Facebook"
            value={getDeep(profile, 'media.social_links.facebook')}
            onChange={(value: string) => updateField('media.social_links.facebook', value)}
          />
          <Input
            label="VK"
            value={getDeep(profile, 'media.social_links.vk')}
            onChange={(value: string) => updateField('media.social_links.vk', value)}
          />
          <Input
            label="Telegram"
            value={getDeep(profile, 'media.social_links.telegram')}
            onChange={(value: string) => updateField('media.social_links.telegram', value)}
          />
        </FieldRow>
        <FieldRow>
          <Input
            label="LinkedIn"
            value={getDeep(profile, 'media.social_links.linkedin')}
            onChange={(value: string) => updateField('media.social_links.linkedin', value)}
          />
        </FieldRow>
            </Section>
          )}

        </div>
      </div>

      <div className="actions">
        <button
          className="primary"
          onClick={() => save()}
          disabled={state === 'saving'}
        >
          {state === 'saving' ? t('Сохраняем...') : t('Сохранить')}
        </button>
        {message && <span className={`status ${state}`}>{message}</span>}
        {schoolId && <span className="muted">ID: {schoolId}</span>}
      </div>
      {cropperModal}
    </div>
    </LocaleContext.Provider>
  );
}
