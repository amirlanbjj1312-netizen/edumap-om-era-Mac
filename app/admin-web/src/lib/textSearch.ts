const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a',
  ә: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  ғ: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'i',
  к: 'k',
  қ: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  ң: 'n',
  о: 'o',
  ө: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ұ: 'u',
  ү: 'u',
  ф: 'f',
  х: 'h',
  һ: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sh',
  ъ: '',
  ы: 'y',
  і: 'i',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

const SEARCH_ALIASES: Array<[RegExp, string]> = [
  [/\bkvantum\b/g, 'quantum'],
  [/\bkuantum\b/g, 'quantum'],
  [/\bkventum\b/g, 'quantum'],
  [/\bqvantum\b/g, 'quantum'],
  [/\bkvantom\b/g, 'quantum'],
  [/\bquantom\b/g, 'quantum'],
  [/\bkwantum\b/g, 'quantum'],
  [/\bqsi\b/g, 'qsi'],
  [/\bksi\b/g, 'qsi'],
  [/\bkiu?esai\b/g, 'qsi'],
  [/\bhailebury\b/g, 'haileybury'],
  [/\bheilibery\b/g, 'haileybury'],
  [/\bnurorda\b/g, 'nurorda'],
  [/\bnurorda\b/g, 'nuro rda'],
];

const KEYBOARD_EN_TO_RU: Record<string, string> = {
  q: 'й',
  w: 'ц',
  e: 'у',
  r: 'к',
  t: 'е',
  y: 'н',
  u: 'г',
  i: 'ш',
  o: 'щ',
  p: 'з',
  '[': 'х',
  ']': 'ъ',
  a: 'ф',
  s: 'ы',
  d: 'в',
  f: 'а',
  g: 'п',
  h: 'р',
  j: 'о',
  k: 'л',
  l: 'д',
  ';': 'ж',
  "'": 'э',
  z: 'я',
  x: 'ч',
  c: 'с',
  v: 'м',
  b: 'и',
  n: 'т',
  m: 'ь',
  ',': 'б',
  '.': 'ю',
};

const KEYBOARD_RU_TO_EN: Record<string, string> = Object.fromEntries(
  Object.entries(KEYBOARD_EN_TO_RU).map(([en, ru]) => [ru, en])
);

const transliterate = (value: string): string =>
  Array.from(value)
    .map((char) => CYRILLIC_TO_LATIN[char] ?? char)
    .join('');

const swapKeyboardLayout = (value: string, dictionary: Record<string, string>): string =>
  Array.from(value.toLowerCase())
    .map((char) => dictionary[char] ?? char)
    .join('');

export const normalizeSearchText = (value: string): string => {
  if (!value) return '';
  let next = transliterate(value.toLowerCase());
  next = next.replace(/['’`"]/g, ' ');
  for (const [pattern, replacement] of SEARCH_ALIASES) {
    next = next.replace(pattern, replacement);
  }
  next = next.replace(/[^a-z0-9\s-]/g, ' ');
  next = next.replace(/[-_]+/g, ' ');
  next = next.replace(/\s+/g, ' ').trim();
  return next;
};

const isOneEditAwayOrLess = (left: string, right: string): boolean => {
  if (left === right) return true;
  const aLen = left.length;
  const bLen = right.length;
  if (Math.abs(aLen - bLen) > 1) return false;
  if (!aLen || !bLen) return Math.max(aLen, bLen) <= 1;

  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < aLen && j < bLen) {
    if (left[i] === right[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (aLen > bLen) i += 1;
    else if (bLen > aLen) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  if (i < aLen || j < bLen) edits += 1;
  return edits <= 1;
};

const tokenMatches = (queryToken: string, hayTokens: string[]): boolean => {
  if (!queryToken) return true;
  return hayTokens.some((hay) => {
    if (hay.includes(queryToken)) return true;
    if (queryToken.length < 4 || hay.length < 4) return false;
    return isOneEditAwayOrLess(queryToken, hay);
  });
};

const buildQueryVariants = (query: string): string[] => {
  const rawVariants = new Set<string>([
    query,
    swapKeyboardLayout(query, KEYBOARD_EN_TO_RU),
    swapKeyboardLayout(query, KEYBOARD_RU_TO_EN),
  ]);
  const normalizedBase = Array.from(rawVariants)
    .map((value) => normalizeSearchText(value))
    .filter(Boolean);
  if (!normalizedBase.length) return [''];
  const normalized = normalizedBase[0];
  const variants = new Set<string>([normalized]);
  normalizedBase.forEach((item) => variants.add(item));

  const tokenReplacementRules: Array<[RegExp, string]> = [
    [/^kv/, 'qu'],
    [/^kv/, 'q'],
    [/^ku/, 'qu'],
    [/^k/, 'q'],
    [/^q/, 'k'],
    [/kh/g, 'h'],
    [/^h/, 'kh'],
    [/w/g, 'v'],
    [/v/g, 'w'],
    [/x/g, 'ks'],
    [/ks/g, 'x'],
    [/ts/g, 'c'],
    [/c/g, 'ts'],
    [/ya/g, 'ia'],
    [/ia/g, 'ya'],
    [/yu/g, 'iu'],
    [/iu/g, 'yu'],
    [/yo/g, 'io'],
    [/io/g, 'yo'],
    [/zh/g, 'j'],
    [/j/g, 'zh'],
  ];

  const buildTokenVariants = (token: string): string[] => {
    const local = new Set<string>([token]);
    for (const [pattern, replacement] of tokenReplacementRules) {
      const current = Array.from(local);
      for (const candidate of current) {
        const next = candidate.replace(pattern, replacement);
        if (next && next !== candidate) local.add(next);
      }
    }
    return Array.from(local).slice(0, 8);
  };

  for (const base of normalizedBase) {
    const tokens = base.split(' ').filter(Boolean);
    if (!tokens.length) continue;
    const perToken = tokens.map((token) => buildTokenVariants(token));
    const combinations: string[] = [''];
    for (const tokenVariants of perToken) {
      const nextCombos: string[] = [];
      for (const prefix of combinations) {
        for (const variant of tokenVariants) {
          const merged = `${prefix} ${variant}`.trim();
          nextCombos.push(merged);
          if (nextCombos.length >= 64) break;
        }
        if (nextCombos.length >= 64) break;
      }
      combinations.splice(0, combinations.length, ...nextCombos);
      if (!combinations.length) break;
    }
    combinations.forEach((combo) => variants.add(combo));
  }
  return Array.from(variants).filter(Boolean);
};

export const matchesSearch = (values: Array<string | null | undefined>, query: string): boolean => {
  const queryVariants = buildQueryVariants(query);
  if (!queryVariants[0]) return true;

  const normalizedHaystack = normalizeSearchText(values.filter(Boolean).join(' '));
  if (!normalizedHaystack) return false;
  const hayTokens = normalizedHaystack.split(' ').filter(Boolean);
  return queryVariants.some((normalizedQuery) => {
    if (normalizedHaystack.includes(normalizedQuery)) return true;
    const queryTokens = normalizedQuery.split(' ').filter(Boolean);
    return queryTokens.every((token) => tokenMatches(token, hayTokens));
  });
};

export const rankSearchCandidates = <T>(
  candidates: T[],
  query: string,
  getText: (candidate: T) => string,
  limit = 4
): T[] => {
  if (!candidates.length) return [];
  const queryVariants = buildQueryVariants(query);
  if (!queryVariants[0]) return candidates.slice(0, limit);

  const scored = candidates
    .map((candidate, index) => {
      const normalizedText = normalizeSearchText(getText(candidate));
      if (!normalizedText) return null;
      const hayTokens = normalizedText.split(' ').filter(Boolean);
      let score = 0;
      for (const variant of queryVariants) {
        const queryTokens = variant.split(' ').filter(Boolean);
        if (normalizedText === variant) score = Math.max(score, 100);
        else if (normalizedText.startsWith(variant)) score = Math.max(score, 80);
        else if (normalizedText.includes(variant)) score = Math.max(score, 60);
        else if (queryTokens.every((token) => tokenMatches(token, hayTokens))) score = Math.max(score, 30);
      }
      if (!score) return null;
      return { candidate, score, index };
    })
    .filter(Boolean) as Array<{ candidate: T; score: number; index: number }>;

  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.slice(0, limit).map((item) => item.candidate);
};
