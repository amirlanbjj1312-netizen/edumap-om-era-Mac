'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { loadSchools, requestAiSchoolChat } from '@/lib/api';
import { useParentLocale } from '@/lib/parentLocale';
import { getParentPlan } from '@/lib/parentSubscription';
import { consumeAiMatch, getAiMatchLeft } from '@/lib/parentUsage';
import { isGuestMode } from '@/lib/guestMode';
import { supabase } from '@/lib/supabaseClient';
import { clearCompareIds, toggleCompareId } from '@/lib/parentCompare';

type SchoolRow = {
  school_id?: string;
  basic_info?: {
    display_name?: unknown;
    brand_name?: unknown;
    short_name?: unknown;
    name?: unknown;
    type?: unknown;
    city?: unknown;
    district?: unknown;
  };
  education?: { languages?: unknown };
  finance?: { tuition_monthly?: unknown; monthly_fee?: unknown; price_monthly?: unknown };
};

type LanguageCode = 'ru' | 'kk' | 'en' | 'zh' | 'fr' | 'de' | 'tr';

const toText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    const localized = value as Record<string, unknown>;
    const picked = localized.ru ?? localized.kk ?? localized.en;
    if (typeof picked === 'string') return picked;
    if (typeof picked === 'number') return String(picked);
  }
  return '';
};

const toLocaleText = (value: unknown, locale: 'ru' | 'en' | 'kk'): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    const localized = value as Record<string, unknown>;
    const picked = localized[locale] ?? localized.ru ?? localized.kk ?? localized.en;
    if (typeof picked === 'string') return picked;
    if (typeof picked === 'number') return String(picked);
  }
  return '';
};

const toList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((v) => toText(v).trim()).filter(Boolean);
  return toText(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalize = (value: string) => value.toLowerCase().trim();

const CITY_ALIAS_TO_KEY: Record<string, 'astana' | 'almaty'> = {
  astana: 'astana',
  'астана': 'astana',
  'нур-султан': 'astana',
  'nur-sultan': 'astana',
  almaty: 'almaty',
  'алматы': 'almaty',
};

const CITY_LABELS: Record<'astana' | 'almaty', Record<'ru' | 'en' | 'kk', string>> = {
  astana: { ru: 'Астана', en: 'Astana', kk: 'Астана' },
  almaty: { ru: 'Алматы', en: 'Almaty', kk: 'Алматы' },
};

const normalizeLanguageCode = (value: string): LanguageCode | '' => {
  const key = normalize(value);
  if (!key) return '';
  if (
    key === 'русский' ||
    key === 'russian' ||
    key === 'орыс'
  ) return 'ru';
  if (
    key === 'казахский' ||
    key === 'kazakh' ||
    key === 'қазақ' ||
    key === 'kazak'
  ) return 'kk';
  if (
    key === 'английский' ||
    key === 'english' ||
    key === 'ағылшын'
  ) return 'en';
  if (key === 'китайский' || key === 'chinese' || key === 'қытай') return 'zh';
  if (key === 'французский' || key === 'french' || key === 'француз') return 'fr';
  if (key === 'немецкий' || key === 'german' || key === 'неміс') return 'de';
  if (key === 'турецкий' || key === 'turkish' || key === 'түрік') return 'tr';
  return '';
};

const LANGUAGE_LABELS: Record<LanguageCode, Record<'ru' | 'en' | 'kk', string>> = {
  ru: { ru: 'Русский', en: 'Russian', kk: 'Орыс тілі' },
  kk: { ru: 'Казахский', en: 'Kazakh', kk: 'Қазақ тілі' },
  en: { ru: 'Английский', en: 'English', kk: 'Ағылшын тілі' },
  zh: { ru: 'Китайский', en: 'Chinese', kk: 'Қытай тілі' },
  fr: { ru: 'Французский', en: 'French', kk: 'Француз тілі' },
  de: { ru: 'Немецкий', en: 'German', kk: 'Неміс тілі' },
  tr: { ru: 'Турецкий', en: 'Turkish', kk: 'Түрік тілі' },
};

const formatLanguages = (value: unknown, locale: 'ru' | 'en' | 'kk'): string => {
  const raw = toList(value);
  const codes = Array.from(
    new Set(
      raw
        .map((item) => normalizeLanguageCode(item))
        .filter(Boolean)
    )
  ) as LanguageCode[];
  if (codes.length) return codes.map((code) => LANGUAGE_LABELS[code][locale]).join(', ');
  return raw.join(', ');
};

const schoolName = (row: SchoolRow, locale: 'ru' | 'en' | 'kk') =>
  toLocaleText(row.basic_info?.display_name, locale).trim() ||
  toLocaleText(row.basic_info?.brand_name, locale).trim() ||
  toLocaleText(row.basic_info?.short_name, locale).trim() ||
  toText(row.basic_info?.name).trim() ||
  'School';

const toPriceNumber = (value: unknown): number => {
  const raw = toText(value);
  if (!raw) return 0;
  const match = raw.replace(/\s+/g, '').match(/\d+(?:[.,]\d+)?/);
  if (!match) return 0;
  const number = Number(match[0].replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
};

const monthlyFee = (row: SchoolRow): number =>
  toPriceNumber(row.finance?.tuition_monthly || row.finance?.monthly_fee || row.finance?.price_monthly);

const isPrivateType = (value: string): boolean => {
  const v = normalize(value);
  return v.includes('private') || v.includes('част') || v.includes('жеке');
};

export default function ParentAiMatchPage() {
  const router = useRouter();
  const { locale } = useParentLocale();
  const [guest] = useState(() => isGuestMode());
  const previewUnlocked = true;
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [rows, setRows] = useState<SchoolRow[]>([]);
  const [left, setLeft] = useState<number | null>(() => getAiMatchLeft(getParentPlan()));
  const [error, setError] = useState('');
  const [aiReply, setAiReply] = useState('');
  const [results, setResults] = useState<SchoolRow[]>([]);
  const [hasRun, setHasRun] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode | ''>('');
  const [selectedType, setSelectedType] = useState<'state' | 'private' | ''>('');
  const [selectedBudget, setSelectedBudget] = useState(0);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelectedIds, setCompareSelectedIds] = useState<string[]>([]);

  const ui = useMemo(
    () =>
      locale === 'en'
        ? {
            title: 'AI match',
            subtitle: 'Describe your request in plain language. AI will return schools and explain why.',
            promptLabel: 'Your request',
            promptPlaceholder:
              'Example: I need a private school in Astana with English and monthly budget up to 500 000 KZT',
            run: 'Generate match',
            running: 'Generating...',
            left: 'Requests left',
            unlimited: 'Unlimited',
            guest: 'AI match is unavailable in guest mode.',
            signIn: 'Sign in',
            limit: 'AI match limit reached for your plan.',
            enterPrompt: 'Enter your request for AI selection.',
            authRequired: 'Sign in is required for AI selection.',
            noSchoolData: 'No schools available for selection.',
            aiUnavailable: 'AI service is currently unavailable.',
            noResult: 'No matching schools found.',
            aiAnswer: 'AI explanation',
            openCard: 'Open school card',
            compareStart: 'Compare',
            compareShow: 'Show comparison',
            compareNeedTwo: 'Select 2 schools',
            comparePickHint: 'Select exactly two schools to compare.',
            chipsTitle: 'Quick criteria',
            chipsCity: 'City',
            chipsLanguage: 'Language',
            chipsType: 'School type',
            chipsBudget: 'Monthly budget',
            chipsAny: 'Any',
            chipsState: 'State',
            chipsPrivate: 'Private',
            chipsApply: 'Use selected criteria in AI request',
            chipsClear: 'Clear criteria',
            defaultPrompt: 'Find suitable schools by selected criteria.',
          }
        : locale === 'kk'
          ? {
              title: 'AI іріктеу',
              subtitle: 'Сұранысты еркін түрде жазыңыз. AI мектептерді ұсынып, неге ұсынғанын түсіндіреді.',
              promptLabel: 'Сұранысыңыз',
              promptPlaceholder:
                'Мысалы: Астанада ағылшын тілді, айына 500 000 KZT-ге дейінгі жеке мектеп керек',
              run: 'Іріктеу жасау',
              running: 'Іріктелуде...',
              left: 'Қалған сұраныс',
              unlimited: 'Шексіз',
              guest: 'Қонақ режимінде AI іріктеу қолжетімсіз.',
              signIn: 'Кіру',
              limit: 'Тариф бойынша AI іріктеу лимиті таусылды.',
              enterPrompt: 'AI іріктеу үшін сұранысты енгізіңіз.',
              authRequired: 'AI іріктеу үшін жүйеге кіру қажет.',
              noSchoolData: 'Іріктеу үшін мектеп деректері жоқ.',
              aiUnavailable: 'AI сервисі қазір қолжетімсіз.',
              noResult: 'Сәйкес мектеп табылмады.',
              aiAnswer: 'AI түсіндірмесі',
              openCard: 'Мектеп картасын ашу',
              compareStart: 'Салыстыру',
              compareShow: 'Салыстыруды көрсету',
              compareNeedTwo: '2 мектеп таңдаңыз',
              comparePickHint: 'Салыстыру үшін дәл 2 мектеп таңдаңыз.',
              chipsTitle: 'Жылдам критерийлер',
              chipsCity: 'Қала',
              chipsLanguage: 'Тіл',
              chipsType: 'Мектеп түрі',
              chipsBudget: 'Айлық бюджет',
              chipsAny: 'Кез келгені',
              chipsState: 'Мемлекеттік',
              chipsPrivate: 'Жеке',
              chipsApply: 'Таңдалған критерийлерді AI сұранысына қолдану',
              chipsClear: 'Критерийлерді тазалау',
              defaultPrompt: 'Таңдалған критерийлер бойынша мектептерді ұсыныңыз.',
            }
          : {
              title: 'AI подбор',
              subtitle: 'Опишите запрос обычным языком. AI подберет школы и объяснит, почему именно они.',
              promptLabel: 'Ваш запрос',
              promptPlaceholder:
                'Например: нужна частная школа в Астане с английским и бюджетом до 500 000 ₸ в месяц',
              run: 'Сделать подбор',
              running: 'Подбираем...',
              left: 'Осталось запросов',
              unlimited: 'Безлимит',
              guest: 'В гостевом режиме AI подбор недоступен.',
              signIn: 'Войти',
              limit: 'Лимит AI подбора по тарифу исчерпан.',
              enterPrompt: 'Введите запрос для AI подбора.',
              authRequired: 'Для AI подбора нужно войти в аккаунт.',
              noSchoolData: 'Нет данных школ для подбора.',
              aiUnavailable: 'Сервис AI сейчас недоступен.',
              noResult: 'Подходящие школы не найдены.',
              aiAnswer: 'Пояснение AI',
              openCard: 'Открыть карточку школы',
              compareStart: 'Сравнить',
              compareShow: 'Показать сравнение',
              compareNeedTwo: 'Выберите 2 школы',
              comparePickHint: 'Для сравнения выберите ровно 2 школы.',
              chipsTitle: 'Быстрые критерии',
              chipsCity: 'Город',
              chipsLanguage: 'Язык',
              chipsType: 'Тип школы',
              chipsBudget: 'Бюджет в месяц',
              chipsAny: 'Любой',
              chipsState: 'Государственная',
              chipsPrivate: 'Частная',
              chipsApply: 'Использовать выбранные критерии в запросе к AI',
              chipsClear: 'Очистить критерии',
              defaultPrompt: 'Подбери школы по выбранным критериям.',
            },
    [locale]
  );

  const syncLeft = () => {
    setLeft(getAiMatchLeft(getParentPlan()));
  };

  useEffect(() => {
    let mounted = true;
    loadSchools()
      .then((payload) => {
        if (!mounted) return;
        setRows(Array.isArray(payload?.data) ? payload.data : []);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const cityOptions = useMemo(() => {
    const cityKeys = Array.from(
      new Set(
        rows
          .map((row) => CITY_ALIAS_TO_KEY[normalize(toText(row.basic_info?.city))])
          .filter(Boolean)
      )
    ) as Array<'astana' | 'almaty'>;
    const keys: Array<'astana' | 'almaty'> = cityKeys.length ? cityKeys : ['astana'];
    return keys.map((key) => ({ key, label: CITY_LABELS[key][locale] }));
  }, [rows, locale]);

  const languageOptions = useMemo(() => {
    const codes = Array.from(
      new Set(
        rows
          .flatMap((row) => toList(row.education?.languages))
          .map((item) => normalizeLanguageCode(item))
          .filter(Boolean)
      )
    ) as LanguageCode[];
    const preferred: LanguageCode[] = ['ru', 'kk', 'en'];
    const extra = codes.filter((code) => !preferred.includes(code));
    const merged = [...preferred.filter((code) => codes.includes(code)), ...extra];
    return (merged.length ? merged : preferred).slice(0, 8);
  }, [rows]);

  const typeOptions = useMemo(() => ['state', 'private'] as Array<'state' | 'private'>, []);

  const budgetOptions = useMemo(() => [300000, 500000, 800000, 1200000], []);

  const onRun = async () => {
    if (guest && !previewUnlocked) return;
    const basePrompt = prompt.trim();
    const criteriaParts: string[] = [];
    const selectedCityLabel = cityOptions.find((item) => item.key === selectedCity)?.label || '';
    if (selectedCityLabel) criteriaParts.push(`${ui.chipsCity}: ${selectedCityLabel}`);
    if (selectedLanguage) criteriaParts.push(`${ui.chipsLanguage}: ${LANGUAGE_LABELS[selectedLanguage][locale]}`);
    if (selectedType) criteriaParts.push(`${ui.chipsType}: ${selectedType === 'state' ? ui.chipsState : ui.chipsPrivate}`);
    if (selectedBudget > 0) criteriaParts.push(`${ui.chipsBudget}: ≤ ${selectedBudget.toLocaleString('ru-RU')} ₸`);
    if (!basePrompt && !criteriaParts.length) {
      setError(ui.enterPrompt);
      return;
    }
    const baseMessage = basePrompt || ui.defaultPrompt;
    const message = criteriaParts.length
      ? `${baseMessage}\n\n${ui.chipsApply}: ${criteriaParts.join('; ')}.`
      : baseMessage;

    const usage = previewUnlocked ? { ok: true, left } : consumeAiMatch(getParentPlan());
    if (!usage.ok) {
      setError(ui.limit);
      syncLeft();
      return;
    }
    const schoolIds = rows
      .map((row) => String(row.school_id || '').trim())
      .filter(Boolean);
    if (!schoolIds.length) {
      setError(ui.noSchoolData);
      return;
    }

    setError('');
    setAiReply('');
    setHasRun(true);
    setCompareMode(false);
    setCompareSelectedIds([]);
    setLeft(usage.left);
    setProcessing(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token || '';
      if (!token) {
        setError(ui.authRequired);
        setResults([]);
        return;
      }
      const response = await requestAiSchoolChat(token, {
        message,
        schoolIds,
      });
      const payload = response?.data;
      setAiReply(String(payload?.reply || '').trim());
      const recommended = Array.isArray(payload?.recommendedSchoolIds)
        ? payload.recommendedSchoolIds.map((id) => String(id || '').trim()).filter(Boolean)
        : [];
      const sorted = recommended
        .map((id) => rows.find((row) => String(row.school_id || '') === id))
        .filter(Boolean) as SchoolRow[];
      setResults(sorted.slice(0, 7));
    } catch {
      setError(ui.aiUnavailable);
      setResults([]);
    } finally {
      setProcessing(false);
    }
  };

  const toggleCompareSelect = (schoolId: string) => {
    if (!schoolId) return;
    setCompareSelectedIds((prev) => {
      if (prev.includes(schoolId)) return prev.filter((id) => id !== schoolId);
      if (prev.length >= 2) return prev;
      return [...prev, schoolId];
    });
  };

  const onCompareAction = () => {
    if (!compareMode) {
      setCompareMode(true);
      setCompareSelectedIds([]);
      return;
    }
    if (compareSelectedIds.length !== 2) return;
    clearCompareIds();
    compareSelectedIds.forEach((id) => {
      toggleCompareId(id, 5);
    });
    router.push('/parent/compare');
  };

  return (
    <div className="card">
      <h2 className="section-title">{ui.title}</h2>
      <p className="muted">{ui.subtitle}</p>
      {guest ? (
        <div style={{ marginTop: 10 }}>
          <p className="muted">{ui.guest}</p>
          {previewUnlocked ? null : (
            <Link className="button" href="/login">
              {ui.signIn}
            </Link>
          )}
        </div>
      ) : (
        <p className="muted">
          {ui.left}: <strong>{left == null ? ui.unlimited : left}</strong>
        </p>
      )}

      <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        <label className="field">
          <span>{ui.promptLabel}</span>
          <textarea
            className="input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={ui.promptPlaceholder}
            rows={3}
          />
        </label>
        <div
          style={{
            border: '1px solid rgba(120,106,255,0.2)',
            borderRadius: 14,
            padding: 12,
            background: '#fff',
            display: 'grid',
            gap: 10,
          }}
        >
          <p style={{ margin: 0, fontWeight: 700 }}>{ui.chipsTitle}</p>

          <div style={{ display: 'grid', gap: 6 }}>
            <p className="muted" style={{ margin: 0 }}>{ui.chipsCity}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`locale-chip ${selectedCity ? '' : 'active'}`}
                onClick={() => setSelectedCity('')}
              >
                {ui.chipsAny}
              </button>
              {cityOptions.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`locale-chip ${selectedCity === item.key ? 'active' : ''}`}
                  onClick={() => setSelectedCity((prev) => (prev === item.key ? '' : item.key))}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            <p className="muted" style={{ margin: 0 }}>{ui.chipsLanguage}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`locale-chip ${selectedLanguage ? '' : 'active'}`}
                onClick={() => setSelectedLanguage('')}
              >
                {ui.chipsAny}
              </button>
              {languageOptions.map((item, index) => (
                <button
                  key={`${item}-${index}`}
                  type="button"
                  className={`locale-chip ${selectedLanguage === item ? 'active' : ''}`}
                  onClick={() => setSelectedLanguage((prev) => (prev === item ? '' : item))}
                >
                  {LANGUAGE_LABELS[item][locale]}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            <p className="muted" style={{ margin: 0 }}>{ui.chipsType}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`locale-chip ${selectedType ? '' : 'active'}`}
                onClick={() => setSelectedType('')}
              >
                {ui.chipsAny}
              </button>
              {typeOptions.map((item, index) => (
                <button
                  key={`${item}-${index}`}
                  type="button"
                  className={`locale-chip ${selectedType === item ? 'active' : ''}`}
                  onClick={() => setSelectedType((prev) => (prev === item ? '' : item))}
                >
                  {item === 'state' ? ui.chipsState : ui.chipsPrivate}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            <p className="muted" style={{ margin: 0 }}>{ui.chipsBudget}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`locale-chip ${selectedBudget === 0 ? 'active' : ''}`}
                onClick={() => setSelectedBudget(0)}
              >
                {ui.chipsAny}
              </button>
              {budgetOptions.map((item, index) => (
                <button
                  key={`${item}-${index}`}
                  type="button"
                  className={`locale-chip ${selectedBudget === item ? 'active' : ''}`}
                  onClick={() => setSelectedBudget((prev) => (prev === item ? 0 : item))}
                >
                  {`≤ ${item.toLocaleString('ru-RU')} ₸`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setSelectedCity('');
                setSelectedLanguage('');
                setSelectedType('');
                setSelectedBudget(0);
              }}
            >
              {ui.chipsClear}
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="button" onClick={onRun} disabled={(guest && !previewUnlocked) || loading || processing}>
          {processing ? ui.running : ui.run}
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={onCompareAction}
          disabled={compareMode && compareSelectedIds.length !== 2}
        >
          {compareMode ? ui.compareShow : ui.compareStart}
        </button>
      </div>
      {compareMode && compareSelectedIds.length !== 2 ? (
        <p className="muted" style={{ marginTop: 8 }}>
          {ui.compareNeedTwo}: {compareSelectedIds.length}/2. {ui.comparePickHint}
        </p>
      ) : null}
      {error ? <p style={{ marginTop: 10, color: '#b91c1c' }}>{error}</p> : null}
      {aiReply ? (
        <div
          style={{
            marginTop: 12,
            border: '1px solid rgba(120,106,255,0.2)',
            borderRadius: 14,
            padding: 12,
            background: '#f7f8ff',
          }}
        >
          <p style={{ margin: 0, fontWeight: 700 }}>{ui.aiAnswer}</p>
          <p className="muted" style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>
            {aiReply}
          </p>
        </div>
      ) : null}

      {results.length ? (
        <div className="schools-grid market-grid booking-cards-grid" style={{ marginTop: 14 }}>
          {results.map((row, index) => {
            const id = String(row.school_id || '');
            const title = schoolName(row, locale);
            const cityLabel = toText(row.basic_info?.city);
            const fee = monthlyFee(row);
            const type = toText(row.basic_info?.type);
            return (
              <article key={`${id}-${index}`} className="parent-school-card">
                <p className="parent-school-name">{title}</p>
                <p className="market-school-city">{cityLabel}</p>
                <p className="muted">{formatLanguages(row.education?.languages, locale) || '—'}</p>
                {isPrivateType(type) && fee > 0 ? (
                  <p className="market-school-price">{fee.toLocaleString('ru-RU')} ₸</p>
                ) : null}
                {id ? (
                  <Link className="parent-school-expand-hint" href={`/parent/schools/${encodeURIComponent(id)}`}>
                    {ui.openCard}
                  </Link>
                ) : null}
                {compareMode && id ? (
                  <label className="school-chip" style={{ marginTop: 8, display: 'inline-flex', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={compareSelectedIds.includes(id)}
                      onChange={() => toggleCompareSelect(id)}
                    />
                    {ui.compareStart}
                  </label>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : hasRun && !loading && !processing ? (
        <p className="muted" style={{ marginTop: 14 }}>{ui.noResult}</p>
      ) : null}
    </div>
  );
}
