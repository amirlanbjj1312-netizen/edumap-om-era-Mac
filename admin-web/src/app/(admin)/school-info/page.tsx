'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { loadSchools, upsertSchool } from '@/lib/api';
import { createEmptySchoolProfile } from '@/lib/schoolProfile';
import { buildFallbackSchoolId } from '@/lib/auth';

type SchoolProfile = ReturnType<typeof createEmptySchoolProfile>;

type LoadingState = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

const formatArrayValue = (value: unknown) =>
  Array.isArray(value) ? value.join(', ') : value ? String(value) : '';

const parseArrayValue = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

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
  Город: { en: 'City', kk: 'Қала' },
  Район: { en: 'District', kk: 'Аудан' },
  Адрес: { en: 'Address', kk: 'Мекенжай' },
  Описание: { en: 'Description', kk: 'Сипаттама' },
  Широта: { en: 'Latitude', kk: 'Ендік' },
  Долгота: { en: 'Longitude', kk: 'Бойлық' },
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
  'Учебные планы (национальные)': { en: 'Curricula (national)', kk: 'Оқу жоспарлары (ұлттық)' },
  'Учебные планы (международные)': { en: 'Curricula (international)', kk: 'Оқу жоспарлары (халықаралық)' },
  'Учебные планы (дополнительные)': { en: 'Curricula (additional)', kk: 'Оқу жоспарлары (қосымша)' },
  'Учебные планы (другое)': { en: 'Curricula (other)', kk: 'Оқу жоспарлары (басқа)' },
  'Углубленные предметы': { en: 'Advanced subjects', kk: 'Тереңдетілген пәндер' },
  'Углубленные (доп.)': { en: 'Advanced (other)', kk: 'Тереңдетілген (басқа)' },
  Классы: { en: 'Grades', kk: 'Сыныптар' },
  'Средний размер класса': { en: 'Average class size', kk: 'Сыныптың орташа көлемі' },
  Формат: { en: 'Format', kk: 'Формат' },
  'Формат (доп.)': { en: 'Format (other)', kk: 'Формат (басқа)' },
  Предметы: { en: 'Subjects', kk: 'Пәндер' },
  'Предметы (доп.)': { en: 'Subjects (other)', kk: 'Пәндер (басқа)' },
  Этапы: { en: 'Stages', kk: 'Кезеңдер' },
  Питание: { en: 'Meals', kk: 'Тамақтану' },
  'Разов в день': { en: 'Times per day', kk: 'Күніне қанша рет' },
  'Бесплатно до класса': { en: 'Free until grade', kk: 'Тегін қай сыныпқа дейін' },
  'Примечание по питанию': { en: 'Meals notes', kk: 'Тамақтану туралы ескертпе' },
  'Иностранные преподаватели': { en: 'Foreign teachers', kk: 'Шетелдік мұғалімдер' },
  Комментарий: { en: 'Comment', kk: 'Түсініктеме' },
  Транспорт: { en: 'Transport', kk: 'Көлік' },
  Инклюзив: { en: 'Inclusive', kk: 'Инклюзивті' },
  Продленка: { en: 'After-school', kk: 'Ұзартылған топ' },
  'Гос финансирование': { en: 'State funding', kk: 'Мемлекеттік қаржыландыру' },
  Самоокупаемость: { en: 'Self-funded', kk: 'Өзін-өзі қаржыландыру' },
  'Бесплатные места': { en: 'Free places', kk: 'Тегін орындар' },
  'Стоимость / мес': { en: 'Monthly fee', kk: 'Айлық төлем' },
  'Система оплаты': { en: 'Payment system', kk: 'Төлем жүйесі' },
  'Скидки / гранты': { en: 'Grants / discounts', kk: 'Гранттар / жеңілдіктер' },
  'Логотип URL': { en: 'Logo URL', kk: 'Логотип URL' },
  'Логотип (файл)': { en: 'Logo (file)', kk: 'Логотип (файл)' },
  'Фото (URL, через запятую)': { en: 'Photos (URLs)', kk: 'Фотолар (URL)' },
  'Фото (файлы)': { en: 'Photos (files)', kk: 'Фотолар (файл)' },
  'Видео (URL, через запятую)': { en: 'Videos (URLs)', kk: 'Бейнелер (URL)' },
  'Видео (файлы)': { en: 'Videos (files)', kk: 'Бейнелер (файл)' },
  'Сертификаты (URL)': { en: 'Certificates (URL)', kk: 'Сертификаттар (URL)' },
  Instagram: { en: 'Instagram', kk: 'Instagram' },
  TikTok: { en: 'TikTok', kk: 'TikTok' },
  YouTube: { en: 'YouTube', kk: 'YouTube' },
  Facebook: { en: 'Facebook', kk: 'Facebook' },
  VK: { en: 'VK', kk: 'VK' },
  Telegram: { en: 'Telegram', kk: 'Telegram' },
  'Ближайшее метро': { en: 'Nearest метро', kk: 'Жақын метро' },
  'Ближайшая остановка': { en: 'Nearest stop', kk: 'Жақын аялдама' },
  'Дистанция до метро (км)': { en: 'Distance to метро (km)', kk: 'Метроға дейінгі қашықтық (км)' },
  'Зона обслуживания': { en: 'Service area', kk: 'Қызмет көрсету аумағы' },
  'Не выбрано': { en: 'Not selected', kk: 'Таңдалмаған' },
  'Сначала выберите город': { en: 'Select city first', kk: 'Әуелі қаланы таңдаңыз' },
  'Сохранить': { en: 'Save', kk: 'Сақтау' },
  'Сохраняем...': { en: 'Saving...', kk: 'Сақталуда...' },
  'Сохранено.': { en: 'Saved.', kk: 'Сақталды.' },
  'Ошибка сохранения.': { en: 'Save failed.', kk: 'Сақтау қатесі.' },
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
  'Almaty District': { ru: 'Алматы ауданы', en: 'Almaty District', kk: 'Алматы ауданы' },
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
  Free: { ru: 'Бесплатно', en: 'Free', kk: 'Тегін' },
  Paid: { ru: 'Платно', en: 'Paid', kk: 'Ақылы' },
  Included: { ru: 'Включено', en: 'Included', kk: 'Қамтылған' },
  'No meals': { ru: 'Без питания', en: 'No meals', kk: 'Тамақсыз' },
  Kazakh: { ru: 'Казахский', en: 'Kazakh', kk: 'Қазақ тілі' },
  Russian: { ru: 'Русский', en: 'Russian', kk: 'Орыс тілі' },
  English: { ru: 'Английский', en: 'English', kk: 'Ағылшын тілі' },
  Chinese: { ru: 'Китайский', en: 'Chinese', kk: 'Қытай тілі' },
  French: { ru: 'Французский', en: 'French', kk: 'Француз тілі' },
  German: { ru: 'Немецкий', en: 'German', kk: 'Неміс тілі' },
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

const toggleListValue = (list: string[], item: string) =>
  list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item];

const SCHOOL_TYPES = ['State', 'Private', 'International', 'Autonomous'];

const CITY_OPTIONS = [
  {
    name: 'Almaty',
    districts: ['Almaly', 'Auezov', 'Bostandyk', 'Zhetysu', 'Medeu', 'Nauryzbay'],
  },
  {
    name: 'Astana',
    districts: ['Almaty District', 'Baikonyr', 'Yesil', 'Saryarka', 'Nura'],
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
const PAYMENT_SYSTEM_OPTIONS = ['Per month', 'Per semester', 'Per year'];
const MEAL_OPTIONS = ['Free', 'Paid', 'Included', 'No meals'];
const MEAL_TIMES_OPTIONS = ['1', '2', '3', '4'];
const MEAL_GRADE_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];

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

const Input = ({ label, value, onChange, placeholder, type = 'text' }: any) => {
  const locale = useContext(LocaleContext);
  return (
    <label className="field">
      <span>{translateLabel(label, locale)}</span>
    <input
      type={type}
      value={value}
      placeholder={placeholder}
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

export default function SchoolInfoPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  const [state, setState] = useState<LoadingState>('idle');
  const [message, setMessage] = useState('');
  const [contentLocale, setContentLocale] = useState<'ru' | 'en' | 'kk'>('ru');
  const [activeTab, setActiveTab] = useState<
    'basic' | 'contacts' | 'education' | 'admission' | 'services' | 'finance' | 'media' | 'location'
  >('basic');

  const schoolId = useMemo(() => {
    if (!profile?.school_id) return '';
    return profile.school_id;
  }, [profile?.school_id]);

  const cityValue = useMemo(() => getDeep(profile, 'basic_info.city', ''), [profile]);
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

  const updateListField = (path: string, list: string[]) => {
    updateField(path, list.join(', '));
  };

  const localePath = (path: string) => `${path}.${contentLocale}`;
  const t = (label: string) => translateLabel(label, contentLocale);

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

  const uploadMediaFiles = async (files: File[], folder: string) => {
    if (!files.length) return [];
    const bucket = process.env.NEXT_PUBLIC_MEDIA_BUCKET || 'school-media';
    const baseId = schoolId || 'school';
    const results: string[] = [];

    for (const file of files) {
      const safeName = file.name.replace(/\s+/g, '-').toLowerCase();
      const dotIndex = safeName.lastIndexOf('.');
      const baseName = dotIndex > 0 ? safeName.slice(0, dotIndex) : safeName;
      const ext = dotIndex > 0 ? safeName.slice(dotIndex + 1) : 'bin';
      const path = `schools/${baseId}/${folder}/${Date.now()}-${baseName}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        upsert: true,
        contentType: file.type || undefined,
      });
      if (error) {
        throw error;
      }
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      if (data?.publicUrl) {
        results.push(data.publicUrl);
      }
    }
    return results;
  };

  const appendMediaUrls = (field: string, urls: string[]) => {
    if (!urls.length) return;
    const existing = normalizeListValue(getDeep(profile, field, ''));
    const next = [...existing, ...urls].filter(Boolean);
    updateField(field, next.join(', '));
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

      const fallbackId = buildFallbackSchoolId(
        `${session.user.email || ''} ${session.user.user_metadata?.full_name || ''}`.trim()
      );

      try {
        const result = await loadSchools();
        const existing = result.data.find((item: any) => item.school_id === fallbackId);
        const base = createEmptySchoolProfile({ school_id: fallbackId });
        if (!ignore) {
          const nextProfile = existing ? createEmptySchoolProfile(existing) : base;
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

  const save = async () => {
    if (!profile) return;
    setState('saving');
    setMessage('');
    try {
      const payload = {
        ...profile,
        education: {
          ...profile.education,
          curricula: {
            ...profile.education.curricula,
            national: profile.education.curricula.national || [],
            international: profile.education.curricula.international || [],
            additional: profile.education.curricula.additional || [],
          },
        },
      };
      await upsertSchool(payload);
      setState('saved');
      setMessage(t('Сохранено.'));
      setTimeout(() => setState('idle'), 1500);
    } catch (error) {
      setState('error');
      setMessage(t('Ошибка сохранения.'));
    }
  };

  if (!profile) {
    return <div className="card">{t('Загрузка...')}</div>;
  }

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
      <div className="tabs-layout">
        <aside className="side-tabs">
          <button
            type="button"
            className={activeTab === 'basic' ? 'active' : ''}
            onClick={() => setActiveTab('basic')}
          >
            {t('Основное')}
          </button>
          <button
            type="button"
            className={activeTab === 'contacts' ? 'active' : ''}
            onClick={() => setActiveTab('contacts')}
          >
            {t('Контакты')}
          </button>
          <button
            type="button"
            className={activeTab === 'education' ? 'active' : ''}
            onClick={() => setActiveTab('education')}
          >
            {t('Образование')}
          </button>
          <button
            type="button"
            className={activeTab === 'admission' ? 'active' : ''}
            onClick={() => setActiveTab('admission')}
          >
            {t('Поступление')}
          </button>
          <button
            type="button"
            className={activeTab === 'services' ? 'active' : ''}
            onClick={() => setActiveTab('services')}
          >
            {t('Сервисы')}
          </button>
          <button
            type="button"
            className={activeTab === 'finance' ? 'active' : ''}
            onClick={() => setActiveTab('finance')}
          >
            {t('Финансы')}
          </button>
          <button
            type="button"
            className={activeTab === 'media' ? 'active' : ''}
            onClick={() => setActiveTab('media')}
          >
            {t('Медиа')}
          </button>
          <button
            type="button"
            className={activeTab === 'location' ? 'active' : ''}
            onClick={() => setActiveTab('location')}
          >
            {t('Локация')}
          </button>
        </aside>
        <div className="panel">
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
                    value={getDeep(profile, 'basic_info.type')}
                    onChange={(value: string) => updateField('basic_info.type', value)}
                    options={[
                      { value: '', label: t('Не выбрано') },
                      ...SCHOOL_TYPES.map((item) => ({
                        value: item,
                        label: translateOption(item, contentLocale),
                      })),
                    ]}
                  />
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
                <Input
                  label="Аккредитация"
                  value={getDeep(profile, 'basic_info.license_accreditation')}
                  onChange={(value: string) =>
                    updateField('basic_info.license_accreditation', value)
                  }
                />
              </Section>
            </>
          )}

          {activeTab === 'contacts' && (
            <Section title="Контакты">
              <FieldRow>
                <Input
                  label="Телефон"
                  value={getDeep(profile, 'basic_info.phone')}
                  onChange={(value: string) => updateField('basic_info.phone', value)}
                />
                <Input
                  label="WhatsApp"
                  value={getDeep(profile, 'basic_info.whatsapp_phone')}
                  onChange={(value: string) =>
                    updateField('basic_info.whatsapp_phone', value)
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
        <FieldRow>
          <Input
            label="Программы"
            value={getDeep(profile, localePath('education.programs'))}
            onChange={(value: string) => updateField(localePath('education.programs'), value)}
          />
        </FieldRow>
        <CheckboxGroup
          label="Учебные планы (национальные)"
          options={CURRICULA_GROUPS.national}
          values={normalizeListValue(getDeep(profile, 'education.curricula.national', []))}
          onChange={(next: string[]) =>
            updateField('education.curricula.national', next)
          }
        />
        <CheckboxGroup
          label="Учебные планы (международные)"
          options={CURRICULA_GROUPS.international}
          values={normalizeListValue(getDeep(profile, 'education.curricula.international', []))}
          onChange={(next: string[]) =>
            updateField('education.curricula.international', next)
          }
        />
        <CheckboxGroup
          label="Учебные планы (дополнительные)"
          options={CURRICULA_GROUPS.additional}
          values={normalizeListValue(getDeep(profile, 'education.curricula.additional', []))}
          onChange={(next: string[]) =>
            updateField('education.curricula.additional', next)
          }
        />
        <FieldRow>
          <Input
            label="Учебные планы (другое)"
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
          <Input
            label="Предметы"
            value={getDeep(profile, 'education.entrance_exam.subjects')}
            onChange={(value: string) => updateField('education.entrance_exam.subjects', value)}
          />
          <Input
            label="Предметы (доп.)"
            value={getDeep(profile, localePath('education.entrance_exam.subjects_other'))}
            onChange={(value: string) =>
              updateField(localePath('education.entrance_exam.subjects_other'), value)
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
            </Section>
          )}

          {activeTab === 'services' && (
            <Section title="Сервисы">
        <FieldRow>
          <Select
            label="Питание"
            value={getDeep(profile, 'services.meals_status')}
            onChange={(value: string) => updateField('services.meals_status', value)}
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
        <FieldRow>
          <TextArea
            label="Примечание по питанию"
            value={getDeep(profile, localePath('services.meals_notes'))}
            onChange={(value: string) =>
              updateField(localePath('services.meals_notes'), value)
            }
          />
        </FieldRow>
        <FieldRow>
          <Toggle
            label="Иностранные преподаватели"
            checked={Boolean(getDeep(profile, 'services.foreign_teachers'))}
            onChange={(value: boolean) => updateField('services.foreign_teachers', value)}
          />
          <TextArea
            label="Комментарий"
            value={getDeep(profile, localePath('services.foreign_teachers_notes'))}
            onChange={(value: string) =>
              updateField(localePath('services.foreign_teachers_notes'), value)
            }
          />
        </FieldRow>
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
            </Section>
          )}

          {activeTab === 'finance' && (
            <Section title="Финансы">
        <FieldRow>
          <Toggle
            label="Гос финансирование"
            checked={Boolean(getDeep(profile, 'finance.funding_state'))}
            onChange={(value: boolean) => updateField('finance.funding_state', value)}
          />
          <Toggle
            label="Самоокупаемость"
            checked={Boolean(getDeep(profile, 'finance.funding_self'))}
            onChange={(value: boolean) => updateField('finance.funding_self', value)}
          />
          <Toggle
            label="Бесплатные места"
            checked={Boolean(getDeep(profile, 'finance.free_places'))}
            onChange={(value: boolean) => updateField('finance.free_places', value)}
          />
        </FieldRow>
        <FieldRow>
          <Input
            label="Стоимость / мес"
            value={getDeep(profile, 'finance.monthly_fee')}
            onChange={(value: string) => updateField('finance.monthly_fee', value)}
          />
          <Select
            label="Система оплаты"
            value={getDeep(profile, 'finance.payment_system')}
            onChange={(value: string) => updateField('finance.payment_system', value)}
            options={[
              { value: '', label: t('Не выбрано') },
              ...PAYMENT_SYSTEM_OPTIONS.map((item) => ({
                value: item,
                label: translateOption(item, contentLocale),
              })),
            ]}
          />
        </FieldRow>
        <Input
          label="Скидки / гранты"
          value={getDeep(profile, 'finance.grants_discounts')}
          onChange={(value: string) => updateField('finance.grants_discounts', value)}
        />
            </Section>
          )}

          {activeTab === 'media' && (
            <Section title="Медиа">
        <FieldRow>
          <Input
            label="Логотип URL"
            value={getDeep(profile, 'media.logo')}
            onChange={(value: string) => updateField('media.logo', value)}
          />
          <label className="field">
            <span>{t('Логотип (файл)')}</span>
            <input
              type="file"
              accept="image/*"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  setMediaMessage('');
                  const urls = await uploadMediaFiles([file], 'logo');
                  if (urls[0]) {
                    updateField('media.logo', urls[0]);
                  }
                } catch (error: any) {
                  setMediaMessage(
                    error?.message ||
                      'Не удалось загрузить логотип. Проверьте bucket в Supabase.'
                  );
                } finally {
                  event.currentTarget.value = '';
                }
              }}
            />
          </label>
          <Input
            label="Фото (URL, через запятую)"
            value={getDeep(profile, 'media.photos')}
            onChange={(value: string) => updateField('media.photos', value)}
          />
        </FieldRow>
        <FieldRow>
          <label className="field">
            <span>{t('Фото (файлы)')}</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={async (event) => {
                const files = Array.from(event.target.files || []);
                if (!files.length) return;
                try {
                  setMediaMessage('');
                  const urls = await uploadMediaFiles(files, 'photos');
                  appendMediaUrls('media.photos', urls);
                } catch (error: any) {
                  setMediaMessage(
                    error?.message ||
                      'Не удалось загрузить фото. Проверьте bucket в Supabase.'
                  );
                } finally {
                  event.currentTarget.value = '';
                }
              }}
            />
          </label>
        </FieldRow>
        <FieldRow>
          <Input
            label="Видео (URL, через запятую)"
            value={getDeep(profile, 'media.videos')}
            onChange={(value: string) => updateField('media.videos', value)}
          />
          <Input
            label="Сертификаты (URL)"
            value={getDeep(profile, 'media.certificates')}
            onChange={(value: string) => updateField('media.certificates', value)}
          />
        </FieldRow>
        <FieldRow>
          <label className="field">
            <span>{t('Видео (файлы)')}</span>
            <input
              type="file"
              accept="video/*"
              multiple
              onChange={async (event) => {
                const files = Array.from(event.target.files || []);
                if (!files.length) return;
                try {
                  setMediaMessage('');
                  const urls = await uploadMediaFiles(files, 'videos');
                  appendMediaUrls('media.videos', urls);
                } catch (error: any) {
                  setMediaMessage(
                    error?.message ||
                      'Не удалось загрузить видео. Проверьте bucket в Supabase.'
                  );
                } finally {
                  event.currentTarget.value = '';
                }
              }}
            />
          </label>
        </FieldRow>
        {mediaMessage ? <p className="muted">{mediaMessage}</p> : null}
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
            </Section>
          )}

          {activeTab === 'location' && (
            <Section title="Локация">
        <FieldRow>
          <Input
            label="Ближайшее метро"
            value={getDeep(profile, localePath('location.nearest_metro_stop'))}
            onChange={(value: string) =>
              updateField(localePath('location.nearest_metro_stop'), value)
            }
          />
        </FieldRow>
        <FieldRow>
          <Input
            label="Ближайшая остановка"
            value={getDeep(profile, localePath('location.nearest_bus_stop'))}
            onChange={(value: string) =>
              updateField(localePath('location.nearest_bus_stop'), value)
            }
          />
        </FieldRow>
        <FieldRow>
          <Input
            label="Дистанция до метро (км)"
            value={getDeep(profile, 'location.distance_to_metro_km')}
            onChange={(value: string) => updateField('location.distance_to_metro_km', value)}
          />
          <TextArea
            label="Зона обслуживания"
            value={getDeep(profile, localePath('location.service_area'))}
            onChange={(value: string) =>
              updateField(localePath('location.service_area'), value)
            }
          />
        </FieldRow>
            </Section>
          )}
        </div>
      </div>

      <div className="actions">
        <button className="primary" onClick={save} disabled={state === 'saving'}>
          {state === 'saving' ? t('Сохраняем...') : t('Сохранить')}
        </button>
        {message && <span className={`status ${state}`}>{message}</span>}
        {schoolId && <span className="muted">ID: {schoolId}</span>}
      </div>
    </div>
    </LocaleContext.Provider>
  );
}
