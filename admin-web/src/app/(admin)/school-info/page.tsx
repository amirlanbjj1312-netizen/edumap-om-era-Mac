'use client';

import { useEffect, useMemo, useState } from 'react';
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

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="card">
    <h2>{title}</h2>
    {children}
  </section>
);

const FieldRow = ({ children }: { children: React.ReactNode }) => (
  <div className="form-row">{children}</div>
);

const Input = ({ label, value, onChange, placeholder, type = 'text' }: any) => (
  <label className="field">
    <span>{label}</span>
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  </label>
);

const TextArea = ({ label, value, onChange, placeholder, rows = 3 }: any) => (
  <label className="field">
    <span>{label}</span>
    <textarea
      value={value}
      placeholder={placeholder}
      rows={rows}
      onChange={(event) => onChange(event.target.value)}
    />
  </label>
);

const Toggle = ({ label, checked, onChange }: any) => (
  <label className="toggle">
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    <span>{label}</span>
  </label>
);

const Select = ({ label, value, onChange, options }: any) => (
  <label className="field">
    <span>{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option: any) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

const CheckboxGroup = ({ label, options, values, onChange }: any) => (
  <div className="field">
    <span>{label}</span>
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
            <span>{option}</span>
          </label>
        );
      })}
    </div>
  </div>
);

export default function SchoolInfoPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  const [state, setState] = useState<LoadingState>('idle');
  const [message, setMessage] = useState('');
  const [contentLocale, setContentLocale] = useState<'ru' | 'en'>('ru');

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
          setProfile(existing ? createEmptySchoolProfile(existing) : base);
          setState('idle');
        }
      } catch (error) {
        if (!ignore) {
          setProfile(createEmptySchoolProfile({ school_id: fallbackId }));
          setState('error');
          setMessage('Не удалось загрузить данные.');
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
      setMessage('Сохранено.');
      setTimeout(() => setState('idle'), 1500);
    } catch (error) {
      setState('error');
      setMessage('Ошибка сохранения.');
    }
  };

  if (!profile) {
    return <div className="card">Загрузка...</div>;
  }

  return (
    <div className="page">
      <div className="locale-toggle">
        {(['ru', 'en'] as const).map((lang) => (
          <button
            key={lang}
            type="button"
            className={`locale-chip${contentLocale === lang ? ' active' : ''}`}
            onClick={() => setContentLocale(lang)}
          >
            {lang.toUpperCase()}
          </button>
        ))}
      </div>
      <Section title="Основная информация">
        <FieldRow>
          <Input
            label="Название"
            value={getDeep(profile, localePath('basic_info.name'))}
            onChange={(value: string) => updateField(localePath('basic_info.name'), value)}
          />
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
              { value: '', label: 'Не выбрано' },
              ...SCHOOL_TYPES.map((item) => ({ value: item, label: item })),
            ]}
          />
          <Select
            label="Город"
            value={getDeep(profile, 'basic_info.city')}
            onChange={(value: string) => updateField('basic_info.city', value)}
            options={[
              { value: '', label: 'Не выбрано' },
              ...CITY_NAMES.map((item) => ({ value: item, label: item })),
            ]}
          />
          <Select
            label="Район"
            value={getDeep(profile, 'basic_info.district')}
            onChange={(value: string) => updateField('basic_info.district', value)}
            options={
              availableDistricts.length
                ? [
                    { value: '', label: 'Не выбрано' },
                    ...availableDistricts.map((item) => ({ value: item, label: item })),
                  ]
                : [{ value: '', label: 'Сначала выберите город' }]
            }
          />
        </FieldRow>
        <FieldRow>
          <Input
            label="Адрес"
            value={getDeep(profile, localePath('basic_info.address'))}
            onChange={(value: string) => updateField(localePath('basic_info.address'), value)}
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
            onChange={(value: string) => updateField('basic_info.coordinates.latitude', value)}
          />
          <Input
            label="Долгота"
            value={getDeep(profile, 'basic_info.coordinates.longitude')}
            onChange={(value: string) => updateField('basic_info.coordinates.longitude', value)}
          />
        </FieldRow>
      </Section>

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
            onChange={(value: string) => updateField('basic_info.whatsapp_phone', value)}
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

      <Section title="Лицензия">
        <FieldRow>
          <Input
            label="Номер лицензии"
            value={getDeep(profile, 'basic_info.license_details.number')}
            onChange={(value: string) => updateField('basic_info.license_details.number', value)}
          />
          <Input
            label="Дата выдачи"
            type="date"
            value={getDeep(profile, 'basic_info.license_details.issued_at')}
            onChange={(value: string) => updateField('basic_info.license_details.issued_at', value)}
          />
          <Input
            label="Срок действия"
            type="date"
            value={getDeep(profile, 'basic_info.license_details.valid_until')}
            onChange={(value: string) => updateField('basic_info.license_details.valid_until', value)}
          />
        </FieldRow>
        <Input
          label="Аккредитация"
          value={getDeep(profile, 'basic_info.license_accreditation')}
          onChange={(value: string) => updateField('basic_info.license_accreditation', value)}
        />
      </Section>

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
              { value: '', label: 'Не выбрано' },
              ...CLASS_SIZE_OPTIONS.map((item) => ({ value: item, label: item })),
            ]}
          />
        </FieldRow>
      </Section>

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
              { value: '', label: 'Не выбрано' },
              { value: 'test', label: 'Тест' },
              { value: 'exam', label: 'Экзамен' },
              { value: 'interview', label: 'Собеседование' },
              { value: 'none', label: 'Нет' },
              { value: 'other', label: 'Другое' },
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

      <Section title="Сервисы">
        <FieldRow>
          <Select
            label="Питание"
            value={getDeep(profile, 'services.meals_status')}
            onChange={(value: string) => updateField('services.meals_status', value)}
            options={[
              { value: '', label: 'Не выбрано' },
              ...MEAL_OPTIONS.map((item) => ({ value: item, label: item })),
            ]}
          />
          <Select
            label="Разов в день"
            value={getDeep(profile, 'services.meals_times_per_day')}
            onChange={(value: string) => updateField('services.meals_times_per_day', value)}
            options={[
              { value: '', label: 'Не выбрано' },
              ...MEAL_TIMES_OPTIONS.map((item) => ({ value: item, label: item })),
            ]}
          />
          <Select
            label="Бесплатно до класса"
            value={getDeep(profile, 'services.meals_free_until_grade')}
            onChange={(value: string) => updateField('services.meals_free_until_grade', value)}
            options={[
              { value: '', label: 'Не выбрано' },
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
              { value: '', label: 'Не выбрано' },
              ...PAYMENT_SYSTEM_OPTIONS.map((item) => ({ value: item, label: item })),
            ]}
          />
        </FieldRow>
        <Input
          label="Скидки / гранты"
          value={getDeep(profile, 'finance.grants_discounts')}
          onChange={(value: string) => updateField('finance.grants_discounts', value)}
        />
      </Section>

      <Section title="Медиа">
        <FieldRow>
          <Input
            label="Логотип URL"
            value={getDeep(profile, 'media.logo')}
            onChange={(value: string) => updateField('media.logo', value)}
          />
          <Input
            label="Фото (URL, через запятую)"
            value={getDeep(profile, 'media.photos')}
            onChange={(value: string) => updateField('media.photos', value)}
          />
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

      <div className="actions">
        <button className="primary" onClick={save} disabled={state === 'saving'}>
          {state === 'saving' ? 'Сохраняем...' : 'Сохранить'}
        </button>
        {message && <span className={`status ${state}`}>{message}</span>}
        {schoolId && <span className="muted">ID: {schoolId}</span>}
      </div>
    </div>
  );
}
