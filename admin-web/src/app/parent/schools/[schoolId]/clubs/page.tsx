'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { loadSchoolById } from '@/lib/api';
import { isGuestMode } from '@/lib/guestMode';
import { useParentLocale } from '@/lib/parentLocale';
import { buildSchoolClubs } from '@/lib/clubViews';

type Locale = 'ru' | 'en' | 'kk';
type WeekdayKey =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

const getSchoolId = (value: unknown): string => {
  if (!value || typeof value !== 'object') return '';
  const raw = (value as Record<string, unknown>).school_id;
  return typeof raw === 'string' ? raw : '';
};

const getName = (school: unknown, locale: 'ru' | 'en' | 'kk') => {
  const root = school && typeof school === 'object' ? (school as Record<string, unknown>) : {};
  const basicInfo =
    root.basic_info && typeof root.basic_info === 'object'
      ? (root.basic_info as Record<string, unknown>)
      : {};
  const displayName = basicInfo.display_name;
  if (displayName && typeof displayName === 'object') {
    const localized = displayName as Partial<Record<'ru' | 'en' | 'kk', unknown>>;
    return String(localized[locale] || localized.ru || localized.en || localized.kk || '');
  }
  return '';
};

const WEEK_ORDER: WeekdayKey[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const WEEKDAY_MATCHERS: Array<{ key: WeekdayKey; patterns: RegExp[] }> = [
  { key: 'monday', patterns: [/\bmon(day)?\b/i, /\bпн\b/i, /понедельник/i, /дүйсенбі/i, /duisenbi/i] },
  { key: 'tuesday', patterns: [/\btue(s(day)?)?\b/i, /\bвт\b/i, /вторник/i, /сейсенбі/i, /seisenbi/i] },
  { key: 'wednesday', patterns: [/\bwed(nesday)?\b/i, /\bср\b/i, /среда/i, /сәрсенбі/i, /sarsenbi/i] },
  { key: 'thursday', patterns: [/\bthu(r(s(day)?)?)?\b/i, /\bчт\b/i, /четверг/i, /бейсенбі/i, /beisenbi/i] },
  { key: 'friday', patterns: [/\bfri(day)?\b/i, /\bпт\b/i, /пятница/i, /жұма/i, /zhuma/i] },
  { key: 'saturday', patterns: [/\bsat(urday)?\b/i, /\bсб\b/i, /суббота/i, /сенбі/i, /senbi/i] },
  { key: 'sunday', patterns: [/\bsun(day)?\b/i, /\bвс\b/i, /воскресенье/i, /жексенбі/i, /zheksenbi/i] },
];

const detectWeekdays = (schedule: string): WeekdayKey[] => {
  const raw = schedule.trim();
  if (!raw) return [];
  const matched = WEEKDAY_MATCHERS
    .filter((item) => item.patterns.some((pattern) => pattern.test(raw)))
    .map((item) => item.key);
  return matched;
};

const extractTime = (schedule: string) => {
  const match = schedule.match(/([01]?\d|2[0-3])[:.][0-5]\d/);
  return match ? match[0].replace('.', ':') : '';
};

const getWeekdayTitle = (locale: Locale, key: WeekdayKey) => {
  const ru: Record<WeekdayKey, string> = {
    monday: 'Понедельник',
    tuesday: 'Вторник',
    wednesday: 'Среда',
    thursday: 'Четверг',
    friday: 'Пятница',
    saturday: 'Суббота',
    sunday: 'Воскресенье',
  };
  const en: Record<WeekdayKey, string> = {
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
  };
  const kk: Record<WeekdayKey, string> = {
    monday: 'Дүйсенбі',
    tuesday: 'Сейсенбі',
    wednesday: 'Сәрсенбі',
    thursday: 'Бейсенбі',
    friday: 'Жұма',
    saturday: 'Сенбі',
    sunday: 'Жексенбі',
  };
  return locale === 'en' ? en[key] : locale === 'kk' ? kk[key] : ru[key];
};

export default function ParentSchoolClubsPage() {
  const { locale } = useParentLocale();
  const [guest] = useState(() => isGuestMode());
  const params = useParams<{ schoolId: string }>();
  const schoolId = decodeURIComponent(String(params?.schoolId || ''));

  const [school, setSchool] = useState<unknown | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      try {
        const result = await loadSchoolById(schoolId);
        if (!active) return;
        setSchool(result?.data || null);
      } catch {
        if (!active) return;
        setSchool(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, []);

  const schoolName = useMemo(() => getName(school, locale), [school, locale]);
  const clubs = useMemo(() => buildSchoolClubs(school, locale), [school, locale]);
  const groupedByWeekday = useMemo(() => {
    const map = new Map<WeekdayKey, typeof clubs>();
    for (const key of WEEK_ORDER) map.set(key, []);
    for (const club of clubs) {
      const weekdays = detectWeekdays(club.schedule || '');
      for (const weekday of weekdays) {
        const current = map.get(weekday) || [];
        current.push(club);
        map.set(weekday, current);
      }
    }
    return WEEK_ORDER.map((key) => ({
      key,
      title: getWeekdayTitle(locale, key),
      items: (map.get(key) || []).sort((a, b) => {
        const at = extractTime(a.schedule || '');
        const bt = extractTime(b.schedule || '');
        return at.localeCompare(bt);
      }),
    })).filter((block) => block.items.length > 0);
  }, [clubs, locale]);

  const ui = {
    back: locale === 'en' ? 'Back to school' : locale === 'kk' ? 'Мектепке оралу' : 'Назад к школе',
    title: locale === 'en' ? 'Clubs and sections' : locale === 'kk' ? 'Үйірмелер мен секциялар' : 'Кружки и секции',
    empty:
      locale === 'en'
        ? 'School has not added clubs yet.'
        : locale === 'kk'
          ? 'Мектеп әлі үйірмелерді қоспаған.'
          : 'Школа пока не добавила кружки.',
    schedule: locale === 'en' ? 'Schedule' : locale === 'kk' ? 'Кесте' : 'Расписание',
    teacher: locale === 'en' ? 'Teacher' : locale === 'kk' ? 'Мұғалім' : 'Преподаватель',
    classes: locale === 'en' ? 'Classes' : locale === 'kk' ? 'Сыныптар' : 'Классы',
    dayTable: locale === 'en' ? 'Weekly schedule' : locale === 'kk' ? 'Апталық кесте' : 'Расписание по неделе',
    emptyDay:
      locale === 'en'
        ? 'No sections'
        : locale === 'kk'
          ? 'Секция жоқ'
          : 'Нет секций',
    guestGateTitle:
      locale === 'en'
        ? 'Clubs are available after sign in'
        : locale === 'kk'
          ? 'Үйірмелер кіруден кейін ашылады'
          : 'Кружки доступны после входа',
    guestGateText:
      locale === 'en'
        ? 'Club schedules and detailed section cards are available only for registered users.'
        : locale === 'kk'
          ? 'Үйірме кестесі мен толық карточкалар тек тіркелген пайдаланушыларға қолжетімді.'
          : 'Расписание кружков и подробные карточки секций доступны только зарегистрированным пользователям.',
    signIn: locale === 'en' ? 'Sign in' : locale === 'kk' ? 'Кіру' : 'Войти',
  };

  return (
    <div className="school-mobile-page">
      <div className="school-mobile-backrow">
        <Link href={`/parent/schools/${encodeURIComponent(schoolId)}`} className="school-mobile-back">
          ‹ {ui.back}
        </Link>
      </div>
      <section className={`school-mobile-photo-card${guest ? ' guest-gated-panel' : ''}`}>
        <div className={guest ? 'guest-gated-content' : ''}>
          <h3 className="school-mobile-photo-title">{ui.title}</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            {schoolName}
          </p>
          {loading ? <p className="muted">...</p> : null}
          {!loading && !clubs.length ? <p className="muted">{ui.empty}</p> : null}
          {!loading && clubs.length ? (
            <div className="club-schedule-table">
              <p className="club-week-table-title">{ui.dayTable}</p>
              <div className="club-schedule-scroll">
                <div className="club-schedule-grid">
                  {groupedByWeekday.map((group) => (
                    <section key={group.key} className="club-schedule-col">
                      <h4 className="club-schedule-col-title">{group.title}</h4>
                      <div className="club-schedule-col-body">
                        {group.items.length ? (
                          group.items.map((club) => (
                            <Link
                              key={`${group.key}-${club.id}`}
                              href={`/parent/schools/${encodeURIComponent(schoolId)}/clubs/${encodeURIComponent(club.id)}`}
                              className="club-schedule-item"
                            >
                              <p className="club-schedule-item-name">{club.name}</p>
                              <p className="club-schedule-item-meta">
                                {ui.classes}: {club.class_range || '—'}
                              </p>
                              <p className="club-schedule-item-meta">
                                {ui.teacher}: {club.teacher_name || '—'}
                              </p>
                            </Link>
                          ))
                        ) : (
                          <p className="club-schedule-empty">{ui.emptyDay}</p>
                        )}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
        {guest ? (
          <div className="guest-gated-overlay">
            <p className="guest-gated-title">{ui.guestGateTitle}</p>
            <p className="guest-gated-text">{ui.guestGateText}</p>
            <Link className="button" href="/login">
              {ui.signIn}
            </Link>
          </div>
        ) : null}
      </section>
    </div>
  );
}
