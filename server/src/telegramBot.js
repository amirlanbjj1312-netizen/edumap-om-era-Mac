const { readStore } = require('./services/schoolsStore');

const TELEGRAM_API = 'https://api.telegram.org';
const BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
const POLL_TIMEOUT_SEC = 30;
const PAGE_SIZE = 5;
const REMOTE_SCHOOLS_URL =
  String(process.env.TELEGRAM_SCHOOLS_API_URL || '').trim() ||
  'https://edumap-backend-nkr6.onrender.com/api/schools?include_inactive=1&include_hidden=1';
const CACHE_TTL_MS = 2 * 60 * 1000;

if (!BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN is required');
  process.exit(1);
}

const userState = new Map();
let schoolsCache = { ts: 0, data: [] };

const safe = (value) => String(value || '').replace(/[<>]/g, '');
const DEFAULT_LOCALE = 'ru';
const SUPPORTED_LOCALES = ['ru', 'kk', 'en'];
const I18N = {
  ru: {
    chooseLanguage: 'Выбери язык бота / Тіл / Language:',
    langRu: 'Русский',
    langKk: 'Қазақша',
    langEn: 'English',
    intro: 'Привет! Подберу школу по фильтрам: город, район, тип, цена, язык, программа, сервисы.',
    stepCity: 'Выбери город:',
    stepDistrict: 'Выбери район:',
    stepType: 'Выбери тип школы:',
    stepPrice: 'Выбери диапазон цены:',
    stepLanguage: 'Язык обучения:',
    stepCurriculum: 'Учебная программа / план:',
    stepService: 'Дополнительные сервисы:',
    otherManual: 'Другое (ввести вручную)',
    back: 'Назад',
    reset: 'Сбросить',
    cancelBack: 'Отмена и назад',
    showResults: 'Показать результаты',
    showMore: 'Показать еще',
    editFilters: 'Изменить фильтры',
    noResults: 'Ничего не найдено по этим фильтрам. Нажми "Сбросить".',
    foundTotal: 'Найдено школ: {count}',
    cityDistrict: 'Город/район',
    type: 'Тип',
    price: 'Цена',
    rating: 'Рейтинг',
    phone: 'Телефон',
    address: 'Адрес',
    noPhone: 'не указан',
    noAddress: 'не указан',
    noRating: 'нет',
    pressStart: 'Нажми /start, чтобы начать подбор школы.',
    applyValueError: 'Не удалось применить значение. Нажми /start',
    emptyValue: 'Пустое значение. Введи текст.',
    promptCity: 'Введи город вручную одним сообщением:',
    promptDistrict: 'Введи район вручную одним сообщением:',
    promptType: 'Введи тип школы вручную одним сообщением:',
    promptLanguage: 'Введи язык обучения вручную одним сообщением:',
    promptCurriculum: 'Введи программу/учебный план вручную одним сообщением:',
    priceAny: 'Любая цена',
    priceFree: 'Бесплатно',
    priceUp100k: 'До 100 000',
    price100to300: '100 000 - 300 000',
    price300plus: '300 000+',
    serviceAny: 'Любые сервисы',
    serviceAfterSchool: 'Есть продленка',
    serviceTransport: 'Есть транспорт',
    serviceInclusive: 'Инклюзивное обучение',
    freePrice: 'Бесплатно',
    noPrice: 'Не указана',
  },
  kk: {
    chooseLanguage: 'Тілін таңдаңыз / Choose language / Выбери язык:',
    langRu: 'Русский',
    langKk: 'Қазақша',
    langEn: 'English',
    intro: 'Сүзгілер бойынша мектеп табамын: қала, аудан, түрі, баға, тіл, бағдарлама, сервистер.',
    stepCity: 'Қаланы таңдаңыз:',
    stepDistrict: 'Ауданды таңдаңыз:',
    stepType: 'Мектеп түрін таңдаңыз:',
    stepPrice: 'Баға аралығын таңдаңыз:',
    stepLanguage: 'Оқыту тілі:',
    stepCurriculum: 'Оқу бағдарламасы / жоспар:',
    stepService: 'Қосымша сервистер:',
    otherManual: 'Басқа (қолмен енгізу)',
    back: 'Артқа',
    reset: 'Тазалау',
    cancelBack: 'Бас тарту және артқа',
    showResults: 'Нәтижені көрсету',
    showMore: 'Тағы көрсету',
    editFilters: 'Сүзгіні өзгерту',
    noResults: 'Осы сүзгілер бойынша ештеңе табылмады. "Тазалау" батырмасын басыңыз.',
    foundTotal: 'Табылған мектеп саны: {count}',
    cityDistrict: 'Қала/аудан',
    type: 'Түрі',
    price: 'Бағасы',
    rating: 'Рейтинг',
    phone: 'Телефон',
    address: 'Мекенжай',
    noPhone: 'көрсетілмеген',
    noAddress: 'көрсетілмеген',
    noRating: 'жоқ',
    pressStart: '/start басып, мектеп іздеуді бастаңыз.',
    applyValueError: 'Мәнді қолдану мүмкін болмады. /start басыңыз',
    emptyValue: 'Бос мән. Мәтін енгізіңіз.',
    promptCity: 'Қаланы бір хабарламамен қолмен енгізіңіз:',
    promptDistrict: 'Ауданды бір хабарламамен қолмен енгізіңіз:',
    promptType: 'Мектеп түрін бір хабарламамен қолмен енгізіңіз:',
    promptLanguage: 'Оқыту тілін бір хабарламамен қолмен енгізіңіз:',
    promptCurriculum: 'Бағдарламаны/жоспарды бір хабарламамен қолмен енгізіңіз:',
    priceAny: 'Кез келген баға',
    priceFree: 'Тегін',
    priceUp100k: '100 000 дейін',
    price100to300: '100 000 - 300 000',
    price300plus: '300 000+',
    serviceAny: 'Кез келген сервис',
    serviceAfterSchool: 'Ұзартылған күн тобы бар',
    serviceTransport: 'Тасымал бар',
    serviceInclusive: 'Инклюзивті оқу',
    freePrice: 'Тегін',
    noPrice: 'Көрсетілмеген',
  },
  en: {
    chooseLanguage: 'Choose bot language / Выбери язык / Тілді таңда:',
    langRu: 'Русский',
    langKk: 'Қазақша',
    langEn: 'English',
    intro: 'I will find schools by filters: city, district, type, price, language, program, services.',
    stepCity: 'Choose city:',
    stepDistrict: 'Choose district:',
    stepType: 'Choose school type:',
    stepPrice: 'Choose price range:',
    stepLanguage: 'Study language:',
    stepCurriculum: 'Curriculum / program:',
    stepService: 'Additional services:',
    otherManual: 'Other (type manually)',
    back: 'Back',
    reset: 'Reset',
    cancelBack: 'Cancel and back',
    showResults: 'Show results',
    showMore: 'Show more',
    editFilters: 'Edit filters',
    noResults: 'No schools found with these filters. Press "Reset".',
    foundTotal: 'Schools found: {count}',
    cityDistrict: 'City/district',
    type: 'Type',
    price: 'Price',
    rating: 'Rating',
    phone: 'Phone',
    address: 'Address',
    noPhone: 'not specified',
    noAddress: 'not specified',
    noRating: 'none',
    pressStart: 'Press /start to begin school search.',
    applyValueError: 'Could not apply value. Press /start',
    emptyValue: 'Empty value. Please enter text.',
    promptCity: 'Type city in one message:',
    promptDistrict: 'Type district in one message:',
    promptType: 'Type school type in one message:',
    promptLanguage: 'Type study language in one message:',
    promptCurriculum: 'Type curriculum/program in one message:',
    priceAny: 'Any price',
    priceFree: 'Free',
    priceUp100k: 'Up to 100,000',
    price100to300: '100,000 - 300,000',
    price300plus: '300,000+',
    serviceAny: 'Any services',
    serviceAfterSchool: 'After-school available',
    serviceTransport: 'Transport available',
    serviceInclusive: 'Inclusive education',
    freePrice: 'Free',
    noPrice: 'Not specified',
  },
};
const t = (locale, key, vars = {}) => {
  const lang = SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
  const dict = I18N[lang] || I18N[DEFAULT_LOCALE];
  const fallback = I18N[DEFAULT_LOCALE];
  const template = dict[key] || fallback[key] || key;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ''));
};
const DISPLAY_LABELS = {
  type: {
    ru: {
      State: 'Государственная',
      Private: 'Частная',
      International: 'Международная',
      Autonomous: 'Автономная',
    },
    kk: {
      State: 'Мемлекеттік',
      Private: 'Жеке',
      International: 'Халықаралық',
      Autonomous: 'Автономды',
    },
    en: {
      State: 'State',
      Private: 'Private',
      International: 'International',
      Autonomous: 'Autonomous',
    },
  },
  language: {
    ru: {
      Kazakh: 'Казахский',
      Russian: 'Русский',
      English: 'Английский',
      Chinese: 'Китайский',
      French: 'Французский',
      German: 'Немецкий',
    },
    kk: {
      Kazakh: 'Қазақ тілі',
      Russian: 'Орыс тілі',
      English: 'Ағылшын тілі',
      Chinese: 'Қытай тілі',
      French: 'Француз тілі',
      German: 'Неміс тілі',
    },
    en: {
      Kazakh: 'Kazakh',
      Russian: 'Russian',
      English: 'English',
      Chinese: 'Chinese',
      French: 'French',
      German: 'German',
    },
  },
  payment: {
    ru: {
      'Per month': 'В месяц',
      'Per semester': 'В семестр',
      'Per year': 'В год',
      Free: 'Бесплатно',
      Paid: 'Платно',
      Included: 'Включено',
    },
    kk: {
      'Per month': 'Айына',
      'Per semester': 'Семестрге',
      'Per year': 'Жылына',
      Free: 'Тегін',
      Paid: 'Ақылы',
      Included: 'Ішінде',
    },
    en: {
      'Per month': 'Per month',
      'Per semester': 'Per semester',
      'Per year': 'Per year',
      Free: 'Free',
      Paid: 'Paid',
      Included: 'Included',
    },
  },
};
const CANON_CITIES = ['Almaty', 'Astana', 'Karaganda'];
const CITY_LABELS = {
  ru: { Almaty: 'Алматы', Astana: 'Астана', Karaganda: 'Караганда' },
  kk: { Almaty: 'Алматы', Astana: 'Астана', Karaganda: 'Қарағанды' },
  en: { Almaty: 'Almaty', Astana: 'Astana', Karaganda: 'Karaganda' },
};
const CITY_ALIASES = {
  алматы: 'Almaty',
  almaty: 'Almaty',
  астана: 'Astana',
  astana: 'Astana',
  karaganda: 'Karaganda',
  караганда: 'Karaganda',
};
const DISTRICT_CANON_BY_CITY = {
  Almaty: ['Almaly', 'Auezov', 'Bostandyk', 'Zhetysu', 'Medeu', 'Nauryzbay'],
  Astana: ['Almaty District', 'Baikonyr', 'Yesil', 'Saryarka', 'Nura'],
  Karaganda: ['City', 'Maikuduk', 'Yugo-Vostok', 'Prishakhtinsk', 'Sortirovka'],
};
const DISTRICT_LABELS = {
  ru: {
    Almaly: 'Алмалы',
    Auezov: 'Ауэзов',
    Bostandyk: 'Бостандык',
    Zhetysu: 'Жетысу',
    Medeu: 'Медеу',
    Nauryzbay: 'Наурызбай',
    'Almaty District': 'Алматы ауданы',
    Baikonyr: 'Байконур',
    Yesil: 'Есиль',
    Saryarka: 'Сарыарка',
    Nura: 'Нура',
    City: 'Город',
    Maikuduk: 'Майкудук',
    'Yugo-Vostok': 'Юго-Восток',
    'South-East': 'Юго-Восток',
    Prishakhtinsk: 'Пришахтинск',
    Sortirovka: 'Сортировка',
  },
  kk: {
    Almaly: 'Алмалы',
    Auezov: 'Әуезов',
    Bostandyk: 'Бостандық',
    Zhetysu: 'Жетісу',
    Medeu: 'Медеу',
    Nauryzbay: 'Наурызбай',
    'Almaty District': 'Алматы ауданы',
    Baikonyr: 'Байқоңыр',
    Yesil: 'Есіл',
    Saryarka: 'Сарыарқа',
    Nura: 'Нұра',
    City: 'Қала',
    Maikuduk: 'Майқұдық',
    'Yugo-Vostok': 'Оңтүстік-Шығыс',
    'South-East': 'Оңтүстік-Шығыс',
    Prishakhtinsk: 'Пришахтинск',
    Sortirovka: 'Сортировка',
  },
  en: {
    Almaly: 'Almaly',
    Auezov: 'Auezov',
    Bostandyk: 'Bostandyk',
    Zhetysu: 'Zhetysu',
    Medeu: 'Medeu',
    Nauryzbay: 'Nauryzbay',
    'Almaty District': 'Almaty District',
    Baikonyr: 'Baikonyr',
    Yesil: 'Yesil',
    Saryarka: 'Saryarka',
    Nura: 'Nura',
    City: 'City',
    Maikuduk: 'Maikuduk',
    'Yugo-Vostok': 'South-East',
    'South-East': 'South-East',
    Prishakhtinsk: 'Prishakhtinsk',
    Sortirovka: 'Sortirovka',
  },
};
const TYPE_CANON = ['State', 'Private', 'International', 'Autonomous'];
const TYPE_ALIASES = {
  state: 'State',
  private: 'Private',
  international: 'International',
  autonomous: 'Autonomous',
  государственная: 'State',
  частная: 'Private',
  международная: 'International',
  автономная: 'Autonomous',
};
const DISTRICT_ALIASES = {
  almaly: 'Almaly',
  алмалы: 'Almaly',
  auezov: 'Auezov',
  ауэзов: 'Auezov',
  bostandyk: 'Bostandyk',
  бостандык: 'Bostandyk',
  zhetysu: 'Zhetysu',
  жетысу: 'Zhetysu',
  medeu: 'Medeu',
  медеу: 'Medeu',
  nauryzbay: 'Nauryzbay',
  наурызбай: 'Nauryzbay',
  'almaty district': 'Almaty District',
  'алматы ауданы': 'Almaty District',
  baikonyr: 'Baikonyr',
  байконур: 'Baikonyr',
  yesil: 'Yesil',
  есиль: 'Yesil',
  saryarka: 'Saryarka',
  сарыарка: 'Saryarka',
  nura: 'Nura',
  нура: 'Nura',
  city: 'City',
  город: 'City',
  maikuduk: 'Maikuduk',
  майкудук: 'Maikuduk',
  'yugo-vostok': 'Yugo-Vostok',
  'юго-восток': 'Yugo-Vostok',
  'south-east': 'Yugo-Vostok',
  prishakhtinsk: 'Prishakhtinsk',
  пришахтинск: 'Prishakhtinsk',
  sortirovka: 'Sortirovka',
  сортировка: 'Sortirovka',
};
const KNOWN_DISTRICTS = new Set(Object.keys(DISTRICT_LABELS.ru));
const LANGUAGE_CANON = ['Kazakh', 'Russian', 'English', 'Chinese', 'French', 'German'];

const normalizeText = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    return String(value.ru || value.en || value.kk || '').trim();
  }
  return String(value).trim();
};

const splitCsv = (value) =>
  String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

const parsePrice = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const normalized = raw.replace(/\s+/g, '').replace(',', '.');
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
};

const displayLabel = (kind, value, locale = DEFAULT_LOCALE) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const lang = SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
  if (kind === 'city') return CITY_LABELS[lang]?.[raw] || CITY_LABELS[DEFAULT_LOCALE]?.[raw] || raw;
  if (kind === 'district')
    return DISTRICT_LABELS[lang]?.[raw] || DISTRICT_LABELS[DEFAULT_LOCALE]?.[raw] || raw;
  return DISPLAY_LABELS[kind]?.[lang]?.[raw] || DISPLAY_LABELS[kind]?.[DEFAULT_LOCALE]?.[raw] || raw;
};
const normalizeCity = (value) => {
  const key = String(value || '').trim().toLowerCase();
  return CITY_ALIASES[key] || String(value || '').trim();
};
const normalizeDistrict = (value) => {
  const key = String(value || '').trim().toLowerCase();
  return DISTRICT_ALIASES[key] || String(value || '').trim();
};
const normalizeType = (value) => {
  const key = String(value || '').trim().toLowerCase();
  return TYPE_ALIASES[key] || String(value || '').trim();
};
const normalizeCsvFirst = (value, normalizer) => {
  const parts = splitCsv(value);
  for (const part of parts) {
    const normalized = normalizer(part);
    if (normalized) return normalized;
  }
  return normalizer(normalizeText(value));
};

const ranges = [
  { id: 'any', titleKey: 'priceAny', test: () => true },
  { id: 'free', titleKey: 'priceFree', test: (price) => price === 0 },
  { id: 'up100k', titleKey: 'priceUp100k', test: (price) => price != null && price > 0 && price < 100000 },
  { id: '100to300', titleKey: 'price100to300', test: (price) => price != null && price >= 100000 && price <= 300000 },
  { id: '300plus', titleKey: 'price300plus', test: (price) => price != null && price > 300000 },
];

const serviceModes = [
  { id: 'any', titleKey: 'serviceAny' },
  { id: 'after_school', titleKey: 'serviceAfterSchool' },
  { id: 'transport', titleKey: 'serviceTransport' },
  { id: 'inclusive', titleKey: 'serviceInclusive' },
];
const SERVICE_IDS = new Set(serviceModes.filter((m) => m.id !== 'any').map((m) => m.id));

const toInlineRows = (items, prefix, columns = 2) => {
  const rows = [];
  let row = [];
  for (const item of items) {
    row.push({ text: item.title, callback_data: `${prefix}:${item.id}` });
    if (row.length >= columns) {
      rows.push(row);
      row = [];
    }
  }
  if (row.length) rows.push(row);
  return rows;
};

const uniqueSorted = (values) =>
  [...new Set(values.map((v) => String(v || '').trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'ru')
  );

const mapSchool = (school) => {
  const curricula = [
    ...(school?.education?.curricula?.national || []),
    ...(school?.education?.curricula?.international || []),
    ...(school?.education?.curricula?.additional || []),
    normalizeText(school?.education?.curricula?.other),
  ].filter(Boolean);
  const languages = splitCsv(school?.education?.languages);
  const transportType = normalizeText(school?.location?.transport_stop_type);

  return {
    id: String(school?.school_id || '').trim(),
    name: normalizeText(school?.basic_info?.display_name) || normalizeText(school?.basic_info?.name),
    city: normalizeCsvFirst(normalizeText(school?.basic_info?.city), normalizeCity),
    district: normalizeCsvFirst(normalizeText(school?.basic_info?.district), normalizeDistrict),
    type: normalizeCsvFirst(normalizeText(school?.basic_info?.type), normalizeType),
    price: parsePrice(school?.finance?.monthly_fee),
    priceRaw: String(school?.finance?.monthly_fee || '').trim(),
    phone: String(school?.basic_info?.phone || '').trim(),
    address: normalizeText(school?.basic_info?.address),
    rating: Number(school?.reviews?.average_rating || school?.system?.rating || 0),
    reviewsCount: Number(school?.reviews?.count || school?.system?.reviews_count || 0),
    languages,
    curricula,
    transportType,
    afterSchool: Boolean(school?.services?.after_school),
    transport: Boolean(school?.services?.transport),
    inclusive: Boolean(school?.services?.inclusive_education),
  };
};

const getOrInitState = (chatId) => {
  const key = String(chatId);
  if (!userState.has(key)) {
    userState.set(key, {
      page: 0,
      awaitingCustom: '',
      locale: DEFAULT_LOCALE,
      options: {},
      filters: {
        city: '',
        district: '',
        type: '',
        priceRange: 'any',
        language: '',
        curriculum: '',
        services: [],
      },
    });
  }
  return userState.get(key);
};

const resetState = (chatId) => {
  userState.set(String(chatId), {
    page: 0,
    awaitingCustom: '',
    locale: DEFAULT_LOCALE,
    options: {},
    filters: {
      city: '',
      district: '',
      type: '',
      priceRange: 'any',
      language: '',
      curriculum: '',
      services: [],
    },
  });
  return userState.get(String(chatId));
};

const tg = async (method, payload = {}) => {
  const resp = await fetch(`${TELEGRAM_API}/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data?.ok) {
    throw new Error(`Telegram ${method} failed: ${data?.description || resp.status}`);
  }
  return data.result;
};

const sendText = (chatId, text, inlineKeyboard) =>
  tg('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    reply_markup: inlineKeyboard ? { inline_keyboard: inlineKeyboard } : undefined,
  });

const answerCallback = (id) =>
  tg('answerCallbackQuery', { callback_query_id: id }).catch(() => {});

const loadRemoteSchools = async () => {
  const resp = await fetch(REMOTE_SCHOOLS_URL);
  if (!resp.ok) return [];
  const payload = await resp.json().catch(() => ({}));
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return rows;
};

const listSchools = async () => {
  const now = Date.now();
  if (now - schoolsCache.ts < CACHE_TTL_MS && schoolsCache.data.length) {
    return schoolsCache.data;
  }

  let raw = await readStore().catch(() => []);
  if (!Array.isArray(raw) || !raw.length) {
    raw = await loadRemoteSchools().catch(() => []);
  }

  const mapped = (raw || [])
    .map(mapSchool)
    .filter((item) => item.id && item.name && item.city && item.type);

  schoolsCache = { ts: now, data: mapped };
  return mapped;
};

const withCommonButtons = (rows, backCb, locale = DEFAULT_LOCALE) => {
  const next = [...rows];
  if (backCb) next.push([{ text: t(locale, 'back'), callback_data: backCb }]);
  next.push([{ text: t(locale, 'reset'), callback_data: 'reset' }]);
  return next;
};

const customPrompt = (locale) => ({
  city: t(locale, 'promptCity'),
  district: t(locale, 'promptDistrict'),
  type: t(locale, 'promptType'),
  language: t(locale, 'promptLanguage'),
  curriculum: t(locale, 'promptCurriculum'),
});

const customToFilterAndStep = {
  city: { filterKey: 'city', step: 'city' },
  district: { filterKey: 'district', step: 'district' },
  type: { filterKey: 'type', step: 'type' },
  language: { filterKey: 'language', step: 'language' },
  curriculum: { filterKey: 'curriculum', step: 'curriculum' },
};

const openCityMenu = async (chatId) => {
  const state = getOrInitState(chatId);
  const locale = state.locale || DEFAULT_LOCALE;
  const cities = [...CANON_CITIES];
  state.options.city = cities;
  const rows = toInlineRows(
    cities.slice(0, 40).map((title, index) => ({
      id: String(index),
      title: displayLabel('city', title, locale),
    })),
    'city',
    2
  );
  rows.push([{ text: t(locale, 'otherManual'), callback_data: 'custom:city' }]);
  return sendText(chatId, t(locale, 'stepCity'), withCommonButtons(rows, null, locale));
};

const openDistrictMenu = async (chatId) => {
  const state = getOrInitState(chatId);
  const locale = state.locale || DEFAULT_LOCALE;
  const schools = await listSchools();
  const cityCanon = normalizeCity(state.filters.city);
  const districts = uniqueSorted([
    ...(DISTRICT_CANON_BY_CITY[cityCanon] || []),
    schools
      .filter((s) => (state.filters.city ? normalizeCity(s.city) === cityCanon : true))
      .map((s) => s.district)
      .filter((value) => value && KNOWN_DISTRICTS.has(value)),
  ]);
  state.options.district = districts;
  const rows = toInlineRows(
    districts.slice(0, 40).map((title, index) => ({
      id: String(index),
      title: displayLabel('district', title, locale),
    })),
    'district',
    2
  );
  rows.push([{ text: t(locale, 'otherManual'), callback_data: 'custom:district' }]);
  return sendText(chatId, t(locale, 'stepDistrict'), withCommonButtons(rows, 'step:city', locale));
};

const openTypeMenu = async (chatId) => {
  const state = getOrInitState(chatId);
  const locale = state.locale || DEFAULT_LOCALE;
  const types = [...TYPE_CANON];
  state.options.type = types;
  const rows = toInlineRows(
    types.map((title, index) => ({
      id: String(index),
      title: displayLabel('type', title, locale),
    })),
    'type',
    2
  );
  rows.push([{ text: t(locale, 'otherManual'), callback_data: 'custom:type' }]);
  return sendText(chatId, t(locale, 'stepType'), withCommonButtons(rows, 'step:district', locale));
};

const openPriceMenu = async (chatId) => {
  const state = getOrInitState(chatId);
  const locale = state.locale || DEFAULT_LOCALE;
  const rows = toInlineRows(
    ranges.map((r) => ({ id: r.id, title: t(locale, r.titleKey) })),
    'price',
    2
  );
  return sendText(chatId, t(locale, 'stepPrice'), withCommonButtons(rows, 'step:type', locale));
};

const openLanguageMenu = async (chatId) => {
  const state = getOrInitState(chatId);
  const locale = state.locale || DEFAULT_LOCALE;
  const untilStep = state.filters.type === 'Private' ? 'price' : 'type';
  const schools = applyFilters(await listSchools(), state.filters, { until: untilStep });
  const langs = uniqueSorted([...LANGUAGE_CANON, ...schools.flatMap((s) => s.languages)]);
  state.options.language = langs;
  const rows = toInlineRows(
    langs.slice(0, 40).map((title, index) => ({
      id: String(index),
      title: displayLabel('language', title, locale),
    })),
    'lang',
    2
  );
  rows.push([{ text: t(locale, 'otherManual'), callback_data: 'custom:language' }]);
  const backStep = state.filters.type === 'Private' ? 'step:price' : 'step:type';
  return sendText(chatId, t(locale, 'stepLanguage'), withCommonButtons(rows, backStep, locale));
};

const openCurriculumMenu = async (chatId) => {
  const state = getOrInitState(chatId);
  const locale = state.locale || DEFAULT_LOCALE;
  const schools = applyFilters(await listSchools(), state.filters, { until: 'language' });
  const curricula = uniqueSorted(schools.flatMap((s) => s.curricula));
  state.options.curriculum = curricula;
  const rows = toInlineRows(
    curricula.slice(0, 30).map((title, index) => ({
      id: String(index),
      title:
        (displayLabel('curriculum', title, locale).length > 28
          ? `${displayLabel('curriculum', title, locale).slice(0, 28)}...`
          : displayLabel('curriculum', title, locale)),
    })),
    'curr',
    1
  );
  rows.push([{ text: t(locale, 'otherManual'), callback_data: 'custom:curriculum' }]);
  return sendText(chatId, t(locale, 'stepCurriculum'), withCommonButtons(rows, 'step:language', locale));
};

const openServiceMenu = async (chatId) => {
  const state = getOrInitState(chatId);
  const locale = state.locale || DEFAULT_LOCALE;
  const selected = new Set(Array.isArray(state.filters.services) ? state.filters.services : []);
  const rows = toInlineRows(
    serviceModes.map((f) => {
      if (f.id === 'any') {
        const isSelected = selected.size === 0;
        return { id: f.id, title: `${isSelected ? '✅ ' : ''}${t(locale, f.titleKey)}` };
      }
      return {
        id: f.id,
        title: `${selected.has(f.id) ? '✅ ' : ''}${t(locale, f.titleKey)}`,
      };
    }),
    'svc',
    2
  );
  rows.push([{ text: t(locale, 'showResults'), callback_data: 'apply' }]);
  const backStep = state.filters.type === 'Private' ? 'step:price' : 'step:curriculum';
  return sendText(chatId, t(locale, 'stepService'), withCommonButtons(rows, backStep, locale));
};

const menuByStep = {
  city: openCityMenu,
  district: openDistrictMenu,
  type: openTypeMenu,
  price: openPriceMenu,
  language: openLanguageMenu,
  curriculum: openCurriculumMenu,
  service: openServiceMenu,
};

const applyFilters = (schools, filters, options = {}) => {
  const until = options.until || 'service';
  const sequence = ['city', 'district', 'type', 'price', 'language', 'curriculum', 'service'];
  const index = sequence.indexOf(until);
  const can = (step) => sequence.indexOf(step) <= index;

  const range = ranges.find((r) => r.id === filters.priceRange) || ranges[0];

  return schools.filter((s) => {
    if (can('city') && filters.city && s.city !== filters.city) return false;
    if (can('district') && filters.district && s.district !== filters.district) return false;
    if (can('type') && filters.type && s.type !== filters.type) return false;
    if (can('price') && !range.test(s.price)) return false;
    if (can('language') && filters.language && !s.languages.includes(filters.language)) return false;
    if (can('curriculum') && filters.curriculum && !s.curricula.includes(filters.curriculum))
      return false;
    if (can('service')) {
      const selectedServices = Array.isArray(filters.services) ? filters.services : [];
      if (selectedServices.includes('after_school') && !s.afterSchool) return false;
      if (selectedServices.includes('transport') && !s.transport) return false;
      if (selectedServices.includes('inclusive') && !s.inclusive) return false;
    }
    return true;
  });
};

const formatPrice = (item, locale = DEFAULT_LOCALE) => {
  if (item.price === 0) return t(locale, 'freePrice');
  if (item.price != null) return `${Math.round(item.price).toLocaleString('ru-RU')} тг/мес`;
  return item.priceRaw || t(locale, 'noPrice');
};

const showResults = async (chatId) => {
  const state = getOrInitState(chatId);
  const locale = state.locale || DEFAULT_LOCALE;
  const schools = await listSchools();
  const filtered = applyFilters(schools, state.filters);
  const total = filtered.length;
  if (!total) {
    return sendText(
      chatId,
      t(locale, 'noResults'),
      [[{ text: t(locale, 'reset'), callback_data: 'reset' }]]
    );
  }

  const start = state.page * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);
  const lines = [`<b>${safe(t(locale, 'foundTotal', { count: total }))}</b>`, ''];
  pageItems.forEach((item, index) => {
    const ratingText =
      item.reviewsCount > 0 ? `${item.rating.toFixed(1)} (${item.reviewsCount})` : t(locale, 'noRating');
    lines.push(
      `${start + index + 1}. <b>${safe(item.name)}</b>\n` +
        `${safe(t(locale, 'cityDistrict'))}: ${safe(displayLabel('city', normalizeCity(item.city), locale))} / ${safe(displayLabel('district', item.district, locale))}\n` +
        `${safe(t(locale, 'type'))}: ${safe(displayLabel('type', item.type, locale))}\n` +
        `${safe(t(locale, 'price'))}: ${safe(formatPrice(item, locale))}\n` +
        `${safe(t(locale, 'rating'))}: ${safe(ratingText)}\n` +
        `${safe(t(locale, 'phone'))}: ${safe(item.phone || t(locale, 'noPhone'))}\n` +
        `${safe(t(locale, 'address'))}: ${safe(item.address || t(locale, 'noAddress'))}`
    );
    lines.push('');
  });

  const rows = [];
  if (start + PAGE_SIZE < total) {
    rows.push([{ text: t(locale, 'showMore'), callback_data: 'more' }]);
  }
  rows.push([{ text: t(locale, 'editFilters'), callback_data: 'step:city' }]);
  rows.push([{ text: t(locale, 'reset'), callback_data: 'reset' }]);
  return sendText(chatId, lines.join('\n'), rows);
};

const openLocaleMenu = async (chatId) =>
  sendText(chatId, t(DEFAULT_LOCALE, 'chooseLanguage'), [
    [
      { text: I18N.ru.langRu, callback_data: 'locale:ru' },
      { text: I18N.ru.langKk, callback_data: 'locale:kk' },
      { text: I18N.ru.langEn, callback_data: 'locale:en' },
    ],
  ]);

const onStart = async (chatId) => {
  resetState(chatId);
  return openLocaleMenu(chatId);
};

const goToNext = async (chatId, currentStep) => {
  const state = getOrInitState(chatId);
  const isPrivate = normalizeType(state.filters.type) === 'Private';

  if (currentStep === 'city') return openDistrictMenu(chatId);
  if (currentStep === 'district') return openTypeMenu(chatId);
  if (currentStep === 'type') {
    if (!isPrivate) {
      state.filters.priceRange = 'any';
      return openLanguageMenu(chatId);
    }
    return openPriceMenu(chatId);
  }
  if (currentStep === 'price') return openLanguageMenu(chatId);
  if (currentStep === 'language') return openCurriculumMenu(chatId);
  if (currentStep === 'curriculum') return openServiceMenu(chatId);
  if (currentStep === 'service') return showResults(chatId);
  return showResults(chatId);
};

const askCustomInput = async (chatId, target) => {
  const state = getOrInitState(chatId);
  const locale = state.locale || DEFAULT_LOCALE;
  const promptMap = customPrompt(locale);
  if (!promptMap[target]) return;
  state.awaitingCustom = target;
  return sendText(chatId, promptMap[target], [
    [{ text: t(locale, 'cancelBack'), callback_data: `step:${customToFilterAndStep[target]?.step || 'city'}` }],
  ]);
};

const handleCallback = async (query) => {
  const chatId = query?.message?.chat?.id;
  const data = String(query?.data || '').trim();
  if (!chatId || !data) return;
  const state = getOrInitState(chatId);
  await answerCallback(query.id);

  if (data === 'reset') return onStart(chatId);
  if (data.startsWith('locale:')) {
    const picked = data.split(':')[1];
    if (SUPPORTED_LOCALES.includes(picked)) {
      state.locale = picked;
    } else {
      state.locale = DEFAULT_LOCALE;
    }
    await sendText(chatId, t(state.locale, 'intro'));
    return openCityMenu(chatId);
  }
  if (data === 'more') {
    state.page += 1;
    return showResults(chatId);
  }
  if (data === 'apply') {
    state.page = 0;
    return showResults(chatId);
  }
  if (data.startsWith('step:')) {
    const step = data.split(':')[1];
    if (!menuByStep[step]) return;
    state.awaitingCustom = '';
    return menuByStep[step](chatId);
  }
  if (data.startsWith('custom:')) {
    const target = data.split(':')[1];
    return askCustomInput(chatId, target);
  }

  const [prefix, rawId] = data.split(':');
  if (!prefix) return;
  const idx = Number(rawId);

  if (prefix === 'city') {
    state.filters.city = normalizeCity(state.options.city?.[idx] || '');
    state.awaitingCustom = '';
    state.filters.district = '';
    return goToNext(chatId, 'city');
  }
  if (prefix === 'district') {
    state.filters.district = normalizeDistrict(state.options.district?.[idx] || '');
    state.awaitingCustom = '';
    return goToNext(chatId, 'district');
  }
  if (prefix === 'type') {
    state.filters.type = state.options.type?.[idx] || '';
    state.awaitingCustom = '';
    if (normalizeType(state.filters.type) !== 'Private') {
      state.filters.priceRange = 'any';
    }
    return goToNext(chatId, 'type');
  }
  if (prefix === 'price') {
    state.filters.priceRange = ranges.some((r) => r.id === rawId) ? rawId : 'any';
    return goToNext(chatId, 'price');
  }
  if (prefix === 'lang') {
    state.filters.language = state.options.language?.[idx] || '';
    state.awaitingCustom = '';
    return goToNext(chatId, 'language');
  }
  if (prefix === 'curr') {
    state.filters.curriculum = state.options.curriculum?.[idx] || '';
    state.awaitingCustom = '';
    return goToNext(chatId, 'curriculum');
  }
  if (prefix === 'svc') {
    if (rawId === 'any') {
      state.filters.services = [];
      return openServiceMenu(chatId);
    }
    if (SERVICE_IDS.has(rawId)) {
      const selected = new Set(Array.isArray(state.filters.services) ? state.filters.services : []);
      if (selected.has(rawId)) selected.delete(rawId);
      else selected.add(rawId);
      state.filters.services = [...selected];
      return openServiceMenu(chatId);
    }
    return openServiceMenu(chatId);
  }
};

const handleMessage = async (message) => {
  const chatId = message?.chat?.id;
  const text = String(message?.text || '').trim();
  if (!chatId) return;
  const state = getOrInitState(chatId);
  const locale = state.locale || DEFAULT_LOCALE;

  if (text === '/start' || /поиск/i.test(text) || /school/i.test(text)) {
    return onStart(chatId);
  }

  if (state.awaitingCustom) {
    const target = state.awaitingCustom;
    const map = customToFilterAndStep[target];
    if (!map) return sendText(chatId, t(locale, 'applyValueError'));
    if (!text) return sendText(chatId, t(locale, 'emptyValue'));
    if (map.filterKey === 'city') {
      state.filters[map.filterKey] = normalizeCity(text);
    } else if (map.filterKey === 'district') {
      state.filters[map.filterKey] = normalizeDistrict(text);
    } else if (map.filterKey === 'type') {
      state.filters[map.filterKey] = normalizeType(text);
    } else {
      state.filters[map.filterKey] = text;
    }
    state.awaitingCustom = '';
    if (map.step === 'city') {
      state.filters.district = '';
    }
    return goToNext(chatId, map.step);
  }
  return;
};

const runPolling = async () => {
  let offset = Number(process.env.TELEGRAM_OFFSET || 0);
  console.log('Telegram bot is running (long polling)');
  console.log(`Schools source URL: ${REMOTE_SCHOOLS_URL}`);

  while (true) {
    try {
      const updates = await tg('getUpdates', {
        timeout: POLL_TIMEOUT_SEC,
        offset,
        allowed_updates: ['message', 'callback_query'],
      });

      for (const update of updates) {
        offset = update.update_id + 1;
        if (update.message) await handleMessage(update.message);
        if (update.callback_query) await handleCallback(update.callback_query);
      }
    } catch (error) {
      console.error('[telegram-bot] poll error:', error.message);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
};

runPolling().catch((error) => {
  console.error('[telegram-bot] fatal:', error);
  process.exit(1);
});
