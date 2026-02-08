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

export default function SchoolInfoPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  const [state, setState] = useState<LoadingState>('idle');
  const [message, setMessage] = useState('');

  const schoolId = useMemo(() => {
    if (!profile?.school_id) return '';
    return profile.school_id;
  }, [profile?.school_id]);

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
        session.user.email || '',
        session.user.user_metadata?.full_name || ''
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
    setProfile((prev) => (prev ? setDeep(prev, path, value) : prev));
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
      <Section title="Основная информация">
        <FieldRow>
          <Input
            label="Название (RU)"
            value={getDeep(profile, 'basic_info.name.ru')}
            onChange={(value: string) => updateField('basic_info.name.ru', value)}
          />
          <Input
            label="Название (EN)"
            value={getDeep(profile, 'basic_info.name.en')}
            onChange={(value: string) => updateField('basic_info.name.en', value)}
          />
        </FieldRow>
        <FieldRow>
          <Input
            label="Отображаемое имя (RU)"
            value={getDeep(profile, 'basic_info.display_name.ru')}
            onChange={(value: string) => updateField('basic_info.display_name.ru', value)}
          />
          <Input
            label="Отображаемое имя (EN)"
            value={getDeep(profile, 'basic_info.display_name.en')}
            onChange={(value: string) => updateField('basic_info.display_name.en', value)}
          />
        </FieldRow>
        <FieldRow>
          <Input
            label="Тип школы"
            value={getDeep(profile, 'basic_info.type')}
            onChange={(value: string) => updateField('basic_info.type', value)}
          />
          <Input
            label="Город"
            value={getDeep(profile, 'basic_info.city')}
            onChange={(value: string) => updateField('basic_info.city', value)}
          />
          <Input
            label="Район"
            value={getDeep(profile, 'basic_info.district')}
            onChange={(value: string) => updateField('basic_info.district', value)}
          />
        </FieldRow>
        <FieldRow>
          <Input
            label="Адрес (RU)"
            value={getDeep(profile, 'basic_info.address.ru')}
            onChange={(value: string) => updateField('basic_info.address.ru', value)}
          />
          <Input
            label="Адрес (EN)"
            value={getDeep(profile, 'basic_info.address.en')}
            onChange={(value: string) => updateField('basic_info.address.en', value)}
          />
        </FieldRow>
        <FieldRow>
          <TextArea
            label="Описание (RU)"
            rows={4}
            value={getDeep(profile, 'basic_info.description.ru')}
            onChange={(value: string) => updateField('basic_info.description.ru', value)}
          />
          <TextArea
            label="Описание (EN)"
            rows={4}
            value={getDeep(profile, 'basic_info.description.en')}
            onChange={(value: string) => updateField('basic_info.description.en', value)}
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
        <FieldRow>
          <Input
            label="Языки"
            value={getDeep(profile, 'education.languages')}
            onChange={(value: string) => updateField('education.languages', value)}
          />
          <Input
            label="Языки (доп.) RU"
            value={getDeep(profile, 'education.languages_other.ru')}
            onChange={(value: string) => updateField('education.languages_other.ru', value)}
          />
          <Input
            label="Языки (доп.) EN"
            value={getDeep(profile, 'education.languages_other.en')}
            onChange={(value: string) => updateField('education.languages_other.en', value)}
          />
        </FieldRow>
        <FieldRow>
          <Input
            label="Программы (RU)"
            value={getDeep(profile, 'education.programs.ru')}
            onChange={(value: string) => updateField('education.programs.ru', value)}
          />
          <Input
            label="Программы (EN)"
            value={getDeep(profile, 'education.programs.en')}
            onChange={(value: string) => updateField('education.programs.en', value)}
          />
        </FieldRow>
        <FieldRow>
          <Input
            label="Учебные планы (нац.)"
            value={formatArrayValue(getDeep(profile, 'education.curricula.national'))}
            onChange={(value: string) => updateField('education.curricula.national', parseArrayValue(value))}
          />
          <Input
            label="Учебные планы (междун.)"
            value={formatArrayValue(getDeep(profile, 'education.curricula.international'))}
            onChange={(value: string) => updateField('education.curricula.international', parseArrayValue(value))}
          />
        </FieldRow>
        <FieldRow>
          <Input
            label="Учебные планы (доп.)"
            value={formatArrayValue(getDeep(profile, 'education.curricula.additional'))}
            onChange={(value: string) => updateField('education.curricula.additional', parseArrayValue(value))}
          />
          <Input
            label="Учебные планы (other RU)"
            value={getDeep(profile, 'education.curricula.other.ru')}
            onChange={(value: string) => updateField('education.curricula.other.ru', value)}
          />
          <Input
            label="Учебные планы (other EN)"
            value={getDeep(profile, 'education.curricula.other.en')}
            onChange={(value: string) => updateField('education.curricula.other.en', value)}
          />
        </FieldRow>
        <FieldRow>
          <Input
            label="Углубленные предметы"
            value={getDeep(profile, 'education.advanced_subjects')}
            onChange={(value: string) => updateField('education.advanced_subjects', value)}
          />
          <Input
            label="Углубленные (доп.) RU"
            value={getDeep(profile, 'education.advanced_subjects_other.ru')}
            onChange={(value: string) => updateField('education.advanced_subjects_other.ru', value)}
          />
          <Input
            label="Углубленные (доп.) EN"
            value={getDeep(profile, 'education.advanced_subjects_other.en')}
            onChange={(value: string) => updateField('education.advanced_subjects_other.en', value)}
          />
        </FieldRow>
        <FieldRow>
          <Input
            label="Средний размер класса"
            value={getDeep(profile, 'education.average_class_size')}
            onChange={(value: string) => updateField('education.average_class_size', value)}
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
            label="Формат (доп.) RU"
            value={getDeep(profile, 'education.entrance_exam.format_other.ru')}
            onChange={(value: string) => updateField('education.entrance_exam.format_other.ru', value)}
          />
          <Input
            label="Формат (доп.) EN"
            value={getDeep(profile, 'education.entrance_exam.format_other.en')}
            onChange={(value: string) => updateField('education.entrance_exam.format_other.en', value)}
          />
        </FieldRow>
        <FieldRow>
          <Input
            label="Предметы"
            value={getDeep(profile, 'education.entrance_exam.subjects')}
            onChange={(value: string) => updateField('education.entrance_exam.subjects', value)}
          />
          <Input
            label="Предметы (доп.) RU"
            value={getDeep(profile, 'education.entrance_exam.subjects_other.ru')}
            onChange={(value: string) => updateField('education.entrance_exam.subjects_other.ru', value)}
          />
          <Input
            label="Предметы (доп.) EN"
            value={getDeep(profile, 'education.entrance_exam.subjects_other.en')}
            onChange={(value: string) => updateField('education.entrance_exam.subjects_other.en', value)}
          />
        </FieldRow>
        <FieldRow>
          <TextArea
            label="Этапы (RU)"
            value={getDeep(profile, 'education.entrance_exam.stages.ru')}
            onChange={(value: string) => updateField('education.entrance_exam.stages.ru', value)}
          />
          <TextArea
            label="Этапы (EN)"
            value={getDeep(profile, 'education.entrance_exam.stages.en')}
            onChange={(value: string) => updateField('education.entrance_exam.stages.en', value)}
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
              { value: 'free', label: 'Бесплатно' },
              { value: 'paid', label: 'Платно' },
              { value: 'none', label: 'Нет' },
            ]}
          />
          <Input
            label="Разов в день"
            value={getDeep(profile, 'services.meals_times_per_day')}
            onChange={(value: string) => updateField('services.meals_times_per_day', value)}
          />
          <Input
            label="Бесплатно до класса"
            value={getDeep(profile, 'services.meals_free_until_grade')}
            onChange={(value: string) => updateField('services.meals_free_until_grade', value)}
          />
        </FieldRow>
        <FieldRow>
          <TextArea
            label="Примечание по питанию (RU)"
            value={getDeep(profile, 'services.meals_notes.ru')}
            onChange={(value: string) => updateField('services.meals_notes.ru', value)}
          />
          <TextArea
            label="Примечание по питанию (EN)"
            value={getDeep(profile, 'services.meals_notes.en')}
            onChange={(value: string) => updateField('services.meals_notes.en', value)}
          />
        </FieldRow>
        <FieldRow>
          <Toggle
            label="Иностранные преподаватели"
            checked={Boolean(getDeep(profile, 'services.foreign_teachers'))}
            onChange={(value: boolean) => updateField('services.foreign_teachers', value)}
          />
          <TextArea
            label="Комментарий (RU)"
            value={getDeep(profile, 'services.foreign_teachers_notes.ru')}
            onChange={(value: string) => updateField('services.foreign_teachers_notes.ru', value)}
          />
          <TextArea
            label="Комментарий (EN)"
            value={getDeep(profile, 'services.foreign_teachers_notes.en')}
            onChange={(value: string) => updateField('services.foreign_teachers_notes.en', value)}
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
          <Input
            label="Система оплаты"
            value={getDeep(profile, 'finance.payment_system')}
            onChange={(value: string) => updateField('finance.payment_system', value)}
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
            label="Ближайшее метро (RU)"
            value={getDeep(profile, 'location.nearest_metro_stop.ru')}
            onChange={(value: string) => updateField('location.nearest_metro_stop.ru', value)}
          />
          <Input
            label="Ближайшее метро (EN)"
            value={getDeep(profile, 'location.nearest_metro_stop.en')}
            onChange={(value: string) => updateField('location.nearest_metro_stop.en', value)}
          />
        </FieldRow>
        <FieldRow>
          <Input
            label="Ближайшая остановка (RU)"
            value={getDeep(profile, 'location.nearest_bus_stop.ru')}
            onChange={(value: string) => updateField('location.nearest_bus_stop.ru', value)}
          />
          <Input
            label="Ближайшая остановка (EN)"
            value={getDeep(profile, 'location.nearest_bus_stop.en')}
            onChange={(value: string) => updateField('location.nearest_bus_stop.en', value)}
          />
        </FieldRow>
        <FieldRow>
          <Input
            label="Дистанция до метро (км)"
            value={getDeep(profile, 'location.distance_to_metro_km')}
            onChange={(value: string) => updateField('location.distance_to_metro_km', value)}
          />
          <Input
            label="Зона обслуживания (RU)"
            value={getDeep(profile, 'location.service_area.ru')}
            onChange={(value: string) => updateField('location.service_area.ru', value)}
          />
          <Input
            label="Зона обслуживания (EN)"
            value={getDeep(profile, 'location.service_area.en')}
            onChange={(value: string) => updateField('location.service_area.en', value)}
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
