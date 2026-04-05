'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getAccessToken, loadSchools, recordEngagementEvent, requestAiSchoolChat } from '@/lib/api';
import { isGuestMode } from '@/lib/guestMode';
import { getParentPlan } from '@/lib/parentSubscription';
import { consumeAiChat, getAiChatLeft } from '@/lib/parentUsage';
import { useParentLocale } from '@/lib/parentLocale';
import { getSchoolFeeSummary } from '@/lib/schoolFinance';

type Role = 'user' | 'assistant';
type ChatMessage = {
  id: string;
  role: Role;
  text: string;
  links?: { label: string; href: string }[];
};

type SchoolRow = {
  school_id?: string;
  basic_info?: {
    display_name?: unknown;
    brand_name?: unknown;
    short_name?: unknown;
    name?: unknown;
    city?: unknown;
    district?: unknown;
    address?: unknown;
    type?: unknown;
    subtype?: unknown;
  };
  education?: { languages?: unknown };
  finance?: unknown;
};

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
  if (Array.isArray(value)) {
    return value.map((item) => toText(item).trim()).filter(Boolean);
  }
  return toText(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const uniqueList = (items: string[]) => Array.from(new Set(items.filter(Boolean)));

const normalize = (value: string) => value.toLowerCase().trim();

const LEFT_BANK_KEYWORDS = ['левый берег', 'левом берег', 'левобереж', 'left bank', 'left'];
const RIGHT_BANK_KEYWORDS = ['правый берег', 'правом берег', 'правобереж', 'right bank', 'right'];
const LEFT_BANK_DISTRICTS = ['есиль', 'yesil'];
const RIGHT_BANK_DISTRICTS = ['сарыарка', 'saryarka', 'байконур', 'baikonur', 'алматы', 'almaty'];

const detectBankSide = (question: string) => {
  const q = normalize(question);
  if (LEFT_BANK_KEYWORDS.some((key) => q.includes(key))) return 'left';
  if (RIGHT_BANK_KEYWORDS.some((key) => q.includes(key))) return 'right';
  return '';
};

const matchesBank = (row: SchoolRow, side: 'left' | 'right') => {
  const district = normalize(toText(row.basic_info?.district || ''));
  const address = normalize(toText(row.basic_info?.address || ''));
  if (side === 'left') {
    return LEFT_BANK_DISTRICTS.some((key) => district.includes(key) || address.includes(key));
  }
  return RIGHT_BANK_DISTRICTS.some((key) => district.includes(key) || address.includes(key));
};

const wantsSingleAnswer = (question: string) => {
  const q = normalize(question);
  return [
    'самая',
    'самый',
    'самое',
    'лучшая',
    'лучший',
    'лучшое',
    'одну',
    'только одну',
    'единственную',
    'same conditions',
    'same',
    'те же условия',
    'те же',
  ].some((key) => q.includes(key));
};

const TYPE_ALIASES: Record<string, 'State' | 'Private'> = {
  state: 'State',
  private: 'Private',
  international: 'Private',
  autonomous: 'Private',
  государственная: 'State',
  частная: 'Private',
  международная: 'Private',
  автономная: 'Private',
  мемлекеттік: 'State',
  жеке: 'Private',
  халықаралық: 'Private',
  автономды: 'Private',
};

const TYPE_LABELS: Record<'State' | 'Private', Record<'ru' | 'en' | 'kk', string>> = {
  State: { ru: 'Государственная', en: 'State', kk: 'Мемлекеттік' },
  Private: { ru: 'Частная', en: 'Private', kk: 'Жеке' },
};

const normalizeTypeKey = (value: string): 'State' | 'Private' | '' =>
  TYPE_ALIASES[normalize(value)] || '';

const LANGUAGE_I18N: Record<string, { ru: string; en: string; kk: string }> = {
  english: { ru: 'Английский', en: 'English', kk: 'Ағылшын' },
  russian: { ru: 'Русский', en: 'Russian', kk: 'Орыс' },
  kazakh: { ru: 'Казахский', en: 'Kazakh', kk: 'Қазақ' },
  англииский: { ru: 'Английский', en: 'English', kk: 'Ағылшын' },
  английский: { ru: 'Английский', en: 'English', kk: 'Ағылшын' },
  русский: { ru: 'Русский', en: 'Russian', kk: 'Орыс' },
  казахский: { ru: 'Казахский', en: 'Kazakh', kk: 'Қазақ' },
  қазақ: { ru: 'Казахский', en: 'Kazakh', kk: 'Қазақ' },
  орыс: { ru: 'Русский', en: 'Russian', kk: 'Орыс' },
  ағылшын: { ru: 'Английский', en: 'English', kk: 'Ағылшын' },
  en: { ru: 'Английский', en: 'English', kk: 'Ағылшын' },
  ru: { ru: 'Русский', en: 'Russian', kk: 'Орыс' },
  kk: { ru: 'Казахский', en: 'Kazakh', kk: 'Қазақ' },
};

const localizeLanguage = (value: string, locale: 'ru' | 'en' | 'kk') => {
  const raw = normalize(value);
  return LANGUAGE_I18N[raw]?.[locale] || value;
};

const localizeReplyLanguages = (value: string, locale: 'ru' | 'en' | 'kk') => {
  if (!value || locale === 'en') return value;
  const map = locale === 'kk'
    ? { English: 'Ағылшын', Russian: 'Орыс', Kazakh: 'Қазақ' }
    : { English: 'Английский', Russian: 'Русский', Kazakh: 'Казахский' };
  return value
    .replace(/\bEnglish\b/gi, map.English)
    .replace(/\bRussian\b/gi, map.Russian)
    .replace(/\bKazakh\b/gi, map.Kazakh);
};

const isHighPriceQuestion = (question: string, locale: 'ru' | 'en' | 'kk') => {
  const q = normalize(question);
  const keywords =
    locale === 'en'
      ? ['highest', 'expensive', 'most expensive', 'high fee', 'high tuition']
      : locale === 'kk'
        ? ['ең қымбат', 'жоғары төлем', 'құны жоғары', 'ақылы']
        : ['самая дорог', 'дорогая', 'высокая стоимость', 'высокооплачиваем', 'платная'];
  return keywords.some((keyword) => q.includes(keyword));
};

const schoolName = (row: SchoolRow, locale: 'ru' | 'en' | 'kk') =>
  toLocaleText(row.basic_info?.display_name, locale).trim() ||
  toLocaleText(row.basic_info?.brand_name, locale).trim() ||
  toLocaleText(row.basic_info?.short_name, locale).trim() ||
  toText(row.basic_info?.name).trim();

const schoolTypeLabel = (row: SchoolRow, locale: 'ru' | 'en' | 'kk') => {
  const raw = toText(row.basic_info?.type).trim();
  const key = normalizeTypeKey(raw);
  const base = key ? TYPE_LABELS[key][locale] : '';
  const subtype = toLocaleText(row.basic_info?.subtype, locale).trim() || toText(row.basic_info?.subtype).trim();
  return subtype || base || raw;
};

const buildSchoolLine = (
  item: { row: SchoolRow; name: string; city: string; type: string; langs: string[]; feeSummary: ReturnType<typeof getSchoolFeeSummary> },
  index: number
) => {
  const parts = [item.city, item.type].filter(Boolean);
  const fee =
    item.feeSummary.hasAnyFee && item.feeSummary.max > 0
      ? `${item.feeSummary.min.toLocaleString('ru-RU')}–${item.feeSummary.max.toLocaleString('ru-RU')} ${item.feeSummary.currency || 'KZT'}`
      : '';
  const suffix = [parts.join(', '), item.langs.length ? item.langs.join(', ') : '', fee]
    .filter(Boolean)
    .join(' | ');
  return `${index + 1}. ${item.name}${suffix ? ` — ${suffix}` : ''}`;
};

const buildLinesFromRows = (
  locale: 'ru' | 'en' | 'kk',
  rows: SchoolRow[],
  ids?: string[]
) => {
  const source = ids?.length
    ? ids
        .map((id) => rows.find((row) => String(row.school_id || '').trim() === id))
        .filter(Boolean) as SchoolRow[]
    : rows;

  return source
    .map((row) => {
      const name = schoolName(row, locale);
      const city = toText(row.basic_info?.city);
      const type = schoolTypeLabel(row, locale);
      const langs = uniqueList(
        toList(row.education?.languages).map((item) => localizeLanguage(item, locale))
      );
      const feeSummary = getSchoolFeeSummary(row as Parameters<typeof getSchoolFeeSummary>[0]);
      return { row, name, city, type, langs, feeSummary };
    })
    .filter((item) => item.name)
    .map(buildSchoolLine);
};

const buildLinkItemsFromRows = (
  locale: 'ru' | 'en' | 'kk',
  rows: SchoolRow[],
  ids?: string[]
) => {
  const source = ids?.length
    ? ids
        .map((id) => rows.find((row) => String(row.school_id || '').trim() === id))
        .filter(Boolean) as SchoolRow[]
    : rows;

  return source
    .map((row) => {
      const name = schoolName(row, locale);
      const city = toText(row.basic_info?.city);
      const type = schoolTypeLabel(row, locale);
      const langs = uniqueList(
        toList(row.education?.languages).map((item) => localizeLanguage(item, locale))
      );
      const feeSummary = getSchoolFeeSummary(row as Parameters<typeof getSchoolFeeSummary>[0]);
      return { row, name, city, type, langs, feeSummary };
    })
    .filter((item) => item.name && item.row.school_id)
    .map((item) => ({
      label: item.name,
      href: `/parent/schools/${String(item.row.school_id || '').trim()}`,
    }));
};

const stripListLines = (value: string) =>
  value
    .split('\n')
    .filter((line) => !/^\s*(\d+\.|•|-)\s+/.test(line))
    .join('\n')
    .trim();

const composeAnswer = (
  locale: 'ru' | 'en' | 'kk',
  question: string,
  rows: SchoolRow[]
) => {
  const q = normalize(question);
  const bankSide = detectBankSide(question);
  const bankFiltered = bankSide
    ? rows.filter((row) => matchesBank(row, bankSide as 'left' | 'right'))
    : rows;
  const sourceRows = bankFiltered.length ? bankFiltered : rows;
  const scored = sourceRows
    .map((row) => {
      const name = schoolName(row, locale);
      const city = toText(row.basic_info?.city);
      const type = schoolTypeLabel(row, locale);
      const langs = toList(row.education?.languages);
      const feeSummary = getSchoolFeeSummary(row as Parameters<typeof getSchoolFeeSummary>[0]);
      let score = 0;
      const tokens = q.split(/\s+/).filter((token) => token.length >= 3);
      if (q && normalize(name).includes(q)) score += 6;
      if (q && normalize(city).includes(q)) score += 4;
      if (q && normalize(type).includes(q)) score += 3;
      if (tokens.some((token) => normalize(name).includes(token))) score += 2;
      if (tokens.some((token) => normalize(city).includes(token))) score += 1;
      if (langs.some((lang) => normalize(lang).includes(q))) score += 2;
      if (feeSummary.hasAnyFee && feeSummary.max > 0) score += 1;
      return { row, name, city, type, langs, score, feeSummary };
    })
    .filter((item) => item.name)
    .sort((a, b) => b.score - a.score);

  const highPrice = isHighPriceQuestion(question, locale);
  const priced = highPrice
    ? [...scored]
        .filter((item) => item.feeSummary.hasAnyFee && item.feeSummary.max > 0)
        .sort((a, b) => b.feeSummary.max - a.feeSummary.max)
        .slice(0, 3)
    : [];

  const picks = scored.filter((item) => item.score > 0).slice(0, 3);
  const fallback = scored.slice(0, 3);
  const result = picks.length ? picks : fallback;
  let finalResult = priced.length ? priced : result;
  if (wantsSingleAnswer(question)) {
    finalResult = finalResult.slice(0, 1);
  }

  if (!finalResult.length) {
    if (locale === 'en') return 'I could not find matching schools. Try another query.';
    if (locale === 'kk') return 'Сәйкес мектеп табылмады. Басқа сұраныс жасап көріңіз.';
    return 'Подходящие школы не найдены. Попробуйте другой запрос.';
  }

  const head =
    highPrice
      ? locale === 'en'
        ? 'Schools with the highest tuition in your current list:'
        : locale === 'kk'
          ? 'Ағымдағы тізім бойынша ең қымбат мектептер:'
          : 'Школы с самой высокой стоимостью в текущем списке:'
      : locale === 'en'
      ? 'Here are schools that may fit your request:'
      : locale === 'kk'
        ? 'Сұранысыңызға сай келуі мүмкін мектептер:'
        : 'Вот школы, которые могут подойти по вашему запросу:';

  const lines = finalResult.map(buildSchoolLine);

  const foot =
    locale === 'en'
      ? 'Use "Compare" in schools list to compare selected schools side by side.'
      : locale === 'kk'
        ? 'Мектептер тізіміндегі "Салыстыру" арқылы мектептерді қатар салыстыра аласыз.'
        : 'Используйте "Сравнить" в списке школ, чтобы сравнить выбранные школы.';

  return [head, ...lines, '', foot].join('\n');
};

export default function ParentChatPage() {
  const router = useRouter();
  const { locale } = useParentLocale();
  const [rows, setRows] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [guest] = useState(() => isGuestMode());
  const [left, setLeft] = useState<number>(() => getAiChatLeft(getParentPlan()));
  const previewUnlocked = false;
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const storageKey = `edumap_parent_ai_chat_${locale}`;

  const ui = useMemo(
    () =>
      locale === 'en'
        ? {
            title: 'AI chat',
            subtitle: 'Ask about schools and get recommendations.',
            update: 'Refresh limits',
            placeholder: 'Ask a question about schools',
            send: 'Send',
            sending: 'Sending...',
            empty: 'No messages yet.',
            backToSchools: 'Back to schools',
            guest: 'AI chat is unavailable in guest mode.',
            signIn: 'Sign in',
            limit: 'Daily AI chat limit reached for your plan.',
            left: 'Requests left today',
          }
        : locale === 'kk'
          ? {
              title: 'AI чат',
              subtitle: 'Мектептер туралы сұрақ қойып, ұсыныс алыңыз.',
              update: 'Лимитті жаңарту',
              placeholder: 'Мектептер бойынша сұрақ енгізіңіз',
              send: 'Жіберу',
              sending: 'Жіберілуде...',
              empty: 'Хабарламалар жоқ.',
              backToSchools: 'Мектептер тізіміне оралу',
              guest: 'Қонақ режимінде AI чат қолжетімсіз.',
              signIn: 'Кіру',
              limit: 'Тариф бойынша AI чат лимиті таусылды.',
              left: 'Бүгін қалған сұраныс',
            }
          : {
              title: 'AI чат',
              subtitle: 'Задавайте вопросы о школах и получайте подборки.',
              update: 'Обновить лимит',
              placeholder: 'Введите вопрос о школах',
              send: 'Отправить',
              sending: 'Отправка...',
              empty: 'Пока нет сообщений.',
              backToSchools: 'Вернуться к школам',
              guest: 'В гостевом режиме AI чат недоступен.',
              signIn: 'Войти',
              limit: 'Лимит AI чата по вашему тарифу исчерпан.',
              left: 'Осталось запросов сегодня',
            },
    [locale]
  );

  const syncLeft = () => {
    const plan = getParentPlan();
    setLeft(getAiChatLeft(plan));
  };

  const schoolIds = useMemo(
    () =>
      rows
        .map((row) => String(row.school_id || '').trim())
        .filter(Boolean)
        .slice(0, 20),
    [rows]
  );

  useEffect(() => {
    void recordEngagementEvent({
      eventType: 'ai_chat_open',
      locale,
      source: 'ai_chat',
    }).catch(() => undefined);
  }, [locale]);

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setMessages(parsed);
      }
    } catch {
      // ignore broken cache
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, JSON.stringify(messages.slice(-50)));
  }, [messages, storageKey]);

  const onSend = async () => {
    const body = text.trim();
    if (!body || sending) return;
    const usage = previewUnlocked ? { ok: true, left } : consumeAiChat(getParentPlan());
    if (!usage.ok) {
      setError(ui.limit);
      syncLeft();
      return;
    }
    setSending(true);
    setText('');
    setError('');
    try {
      void recordEngagementEvent({
        eventType: 'ai_chat_message',
        locale,
        source: 'ai_chat',
      }).catch(() => undefined);
      const token = await getAccessToken();
      if (!token) {
        throw new Error(
          locale === 'en'
            ? 'Authorization token is required.'
            : locale === 'kk'
              ? 'Авторизация токені қажет.'
              : 'Нужна авторизация.'
        );
      }

      if (!schoolIds.length) {
        throw new Error(
          locale === 'en'
            ? 'No schools found for AI request.'
            : locale === 'kk'
              ? 'AI сұранысына арналған мектептер табылмады.'
              : 'Не найдены школы для AI-запроса.'
        );
      }

      const aiResponse = await requestAiSchoolChat(token, {
        message: body,
        schoolIds,
      });
      const reply = localizeReplyLanguages(String(aiResponse?.data?.reply || '').trim(), locale);
      const recommendedSchoolIds = Array.isArray(aiResponse?.data?.recommendedSchoolIds)
        ? aiResponse.data.recommendedSchoolIds.map((id) => String(id || '').trim()).filter(Boolean)
        : [];
      const bankSide = detectBankSide(body);
      const rowsForSide = bankSide
        ? rows.filter((row) => matchesBank(row, bankSide as 'left' | 'right'))
        : rows;
      const limitedToSingle = wantsSingleAnswer(body);
      const filteredRecommendedIds = recommendedSchoolIds.length
        ? recommendedSchoolIds.filter((id) =>
            rowsForSide.some((row) => String(row.school_id || '').trim() === id)
          )
        : [];
      const finalRecommendedIds = limitedToSingle
        ? filteredRecommendedIds.slice(0, 1)
        : filteredRecommendedIds;
      recommendedSchoolIds.forEach((recommendedSchoolId) => {
        void recordEngagementEvent({
          eventType: 'ai_school_mention',
          schoolId: recommendedSchoolId,
          locale,
          source: 'ai_chat_results',
        }).catch(() => undefined);
      });
      const replyHasList = /(^|\n)\s*(\d+\.|•|-)\s+/.test(reply);
      const fallbackAnswer = composeAnswer(locale, body, rows);
      const listLines = finalRecommendedIds.length
        ? buildLinesFromRows(locale, rowsForSide, finalRecommendedIds).join('\n')
        : buildLinesFromRows(locale, rowsForSide).join('\n');
      const cleanedReply = replyHasList ? stripListLines(reply) : reply;
      const answer = reply
        ? cleanedReply
        : fallbackAnswer;
      const linkItems = finalRecommendedIds.length
        ? buildLinkItemsFromRows(locale, rowsForSide, finalRecommendedIds)
        : buildLinkItemsFromRows(locale, rowsForSide);

      const userMessage: ChatMessage = {
        id: `${Date.now()}-u`,
        role: 'user',
        text: body,
      };
      const assistantMessage: ChatMessage = {
        id: `${Date.now()}-a`,
        role: 'assistant',
        text: answer,
        links: linkItems.length ? linkItems : undefined,
      };
      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setLeft(typeof usage.left === 'number' ? usage.left : 0);
    } catch (error) {
      const fallbackText = composeAnswer(locale, body, rows);
      const userMessage: ChatMessage = {
        id: `${Date.now()}-u`,
        role: 'user',
        text: body,
      };
      const assistantMessage: ChatMessage = {
        id: `${Date.now()}-a`,
        role: 'assistant',
        text: fallbackText,
      };
      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setError(error instanceof Error ? error.message : 'Error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="card parent-ai-chat-card">
      <div className="requests-head parent-ai-chat-head">
        <button
          type="button"
          className="button secondary parent-ai-chat-toggle"
          aria-label={ui.backToSchools}
          onClick={() => router.push('/parent/schools')}
        >
          ×
        </button>
        <h2>{ui.title}</h2>
        <button
          type="button"
          className="button secondary"
          onClick={syncLeft}
        >
          {ui.update}
        </button>
      </div>
      <>
      <p className="muted parent-ai-chat-subtitle">{ui.subtitle}</p>
      {!guest ? (
        <p className="muted parent-ai-chat-limit">
          {ui.left}: <strong>{left}</strong>
        </p>
      ) : <p className="muted parent-ai-chat-limit">Preview mode: unlocked</p>}
      {guest ? (
        <div className="parent-ai-chat-guest">
          <p>
            {ui.guest}
          </p>
          {previewUnlocked ? null : (
            <Link className="button" href="/login">
              {ui.signIn}
            </Link>
          )}
        </div>
      ) : null}

      <div className="parent-ai-chat-shell">
        <div className="parent-ai-chat-messages">
        {loading ? <p className="muted">...</p> : null}
        {!loading && !messages.length ? <p className="muted">{ui.empty}</p> : null}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`parent-ai-chat-row ${message.role === 'assistant' ? 'assistant' : 'user'}`}
          >
            <p className="parent-ai-chat-author">
              {message.role === 'assistant' ? 'EDUMAP AI' : 'You'}
            </p>
            <p className="parent-ai-chat-text">{message.text}</p>
            {message.role === 'assistant' && message.links?.length ? (
              <ol className="parent-ai-chat-links">
                {message.links.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href}>{item.label}</Link>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        ))}
        <div ref={messagesEndRef} />
        </div>
      <div className="parent-ai-chat-compose">
        <input
          className="input parent-ai-chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={ui.placeholder}
          disabled={guest && !previewUnlocked}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
        />
        <button
          type="button"
          className="button parent-ai-chat-send"
          disabled={(guest && !previewUnlocked) || !text.trim() || sending}
          onClick={onSend}
        >
          {sending ? ui.sending : ui.send}
        </button>
      </div>
      </div>

      {error ? <p className="parent-ai-chat-error">{error}</p> : null}
      </>
    </div>
  );
}
