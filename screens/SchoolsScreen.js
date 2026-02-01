import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Text,
  View,
  Pressable,
  TextInput,
  FlatList,
  ActivityIndicator,
  Image as RNImage,
  Modal,
  PanResponder,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

let ExpoImageComponent = null;
try {
  ExpoImageComponent = require('expo-image').Image;
} catch (error) {
  ExpoImageComponent = null;
}

const ImageComponent = ExpoImageComponent ?? RNImage;
import { useNavigation } from '@react-navigation/native';
import {
  MapIcon,
  AdjustmentsHorizontalIcon,
  BarsArrowDownIcon,
  SparklesIcon,
  ChatBubbleLeftRightIcon,
  XMarkIcon,
} from 'react-native-heroicons/solid';
import * as Location from 'expo-location';
import { images } from '../assets';
import { useSchools } from '../context/SchoolsContext';
import { useLocale } from '../context/LocaleContext';
import Rating from '../components/home/rating';
import { splitToList } from '../utils/coordinates';
import { parseSchoolQuery } from '../services/aiSchoolParser';

const CITY_OPTIONS = [
  {
    name: 'Almaty',
    areas: ['Almaly', 'Auezov', 'Bostandyk', 'Zhetysu', 'Medeu', 'Nauryzbay'],
  },
  {
    name: 'Astana',
    areas: ['Almaty district', 'Baikonur', 'Yesil', 'Saryarka', 'Nura'],
  },
  {
    name: 'Karaganda',
    areas: ['City', 'Maikudyk', 'South-East', 'Prishakhtinsk', 'Sortirovka'],
  },
];
const CITY_KEYWORDS = {
  Almaty: ['almaty', 'алматы', 'алмата'],
  Astana: ['astana', 'астана', 'nursultan', 'nur-sultan', 'нурсултан', 'нур султан'],
  Karaganda: ['karaganda', 'караг', 'караганда'],
};
const TYPE_OPTIONS = ['State', 'Private', 'International'];
const TYPE_KEYWORDS = {
  state: ['state', 'public', 'государ', 'гос'],
  private: ['private', 'частн'],
  international: ['international', 'междунар'],
};
const LANGUAGE_OPTIONS = ['English', 'Russian', 'Kazakh'];
const LANGUAGE_KEYWORDS = {
  english: ['english', 'англ'],
  russian: ['russian', 'рус'],
  kazakh: ['kazakh', 'қаз', 'каз'],
};
const SERVICE_FLAGS = [
  { key: 'after_school', label: 'After-school' },
  { key: 'transport', label: 'Transport' },
  { key: 'inclusive_education', label: 'Inclusive education' },
  { key: 'security', label: 'Security' },
  { key: 'cameras', label: 'CCTV' },
  { key: 'access_control', label: 'Access control' },
  { key: 'medical_office', label: 'Medical office' },
];
const MEAL_OPTIONS = ['Free', 'Paid', 'No meals'];
const CURRICULA_OPTIONS = [
  'State program (Kazakhstan)',
  'Updated content',
  'NIS Integrated Program',
  'Cambridge Primary',
  'Cambridge Lower Secondary',
  'Cambridge IGCSE',
  'Cambridge A-Level',
  'IB PYP',
  'STEAM',
  'STEM',
  'Montessori',
  'Waldorf',
  'American Curriculum',
  'British National Curriculum',
  'Bilingual Program',
  'Author program',
];
const SUBJECT_OPTIONS = [
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
const SPECIALISTS_OPTIONS = [
  'Psychologist',
  'Speech therapist',
  'Social worker',
  'Tutor',
  'Special education teacher',
  'Nurse',
  'Defectologist',
];
const ACCREDITATION_OPTIONS = ['License', 'Certificates'];
const RATING_OPTIONS = [4.5, 4, 3];
const PRICE_MIN = 0;
const PRICE_MAX = 400000;
const PRICE_HISTOGRAM = [12, 28, 35, 30, 22, 18, 10, 8, 14, 20, 16, 12, 9, 6, 4, 3, 2];
const BOT_EXAMPLES = [
  'Private school in Almaty with English and robotics under 200000 ₸',
  'Public school in Astana near home, no exams',
  'Cambridge school with rating 4+',
];
const SORT_BUTTON_LABEL_KEYS = {
  relevance: 'schools.sort.button.sort',
  rating_desc: 'schools.sort.button.rating',
  price_asc: 'schools.sort.button.priceAsc',
  price_desc: 'schools.sort.button.priceDesc',
  name_asc: 'schools.sort.button.name',
  reviews_desc: 'schools.sort.button.reviews',
  distance_asc: 'schools.sort.button.distance',
  updated_desc: 'schools.sort.button.updated',
};
const SORT_MODAL_LABEL_KEYS = {
  relevance: 'schools.sort.option.relevance',
  rating_desc: 'schools.sort.option.rating_desc',
  reviews_desc: 'schools.sort.option.reviews_desc',
  price_asc: 'schools.sort.option.price_asc',
  price_desc: 'schools.sort.option.price_desc',
  distance_asc: 'schools.sort.option.distance_asc',
  name_asc: 'schools.sort.option.name_asc',
  updated_desc: 'schools.sort.option.updated_desc',
};
const TYPE_LABEL_KEYS = {
  State: 'schools.type.state',
  Private: 'schools.type.private',
  International: 'schools.type.international',
};
const LANGUAGE_LABEL_KEYS = {
  English: 'schools.language.english',
  Russian: 'schools.language.russian',
  Kazakh: 'schools.language.kazakh',
};
const SERVICE_LABEL_KEYS = {
  after_school: 'schools.service.after_school',
  transport: 'schools.service.transport',
  inclusive_education: 'schools.service.inclusive_education',
  security: 'schools.service.security',
  cameras: 'schools.service.cameras',
  access_control: 'schools.service.access_control',
  medical_office: 'schools.service.medical_office',
};
const MEAL_LABEL_KEYS = {
  Free: 'schools.meals.free',
  Paid: 'schools.meals.paid',
  'No meals': 'schools.meals.none',
};
const CURRICULA_LABEL_KEYS = {
  'State program (Kazakhstan)': 'schools.curricula.state_program',
  'Updated content': 'schools.curricula.updated_content',
  'NIS Integrated Program': 'schools.curricula.nis',
  'Cambridge Primary': 'schools.curricula.cambridge_primary',
  'Cambridge Lower Secondary': 'schools.curricula.cambridge_lower_secondary',
  'Cambridge IGCSE': 'schools.curricula.cambridge_igcse',
  'Cambridge A-Level': 'schools.curricula.cambridge_a_level',
  'IB PYP': 'schools.curricula.ib_pyp',
  'STEAM': 'schools.curricula.steam',
  'STEM': 'schools.curricula.stem',
  'Montessori': 'schools.curricula.montessori',
  'Waldorf': 'schools.curricula.waldorf',
  'American Curriculum': 'schools.curricula.american',
  'British National Curriculum': 'schools.curricula.british',
  'Bilingual Program': 'schools.curricula.bilingual',
  'Author program': 'schools.curricula.author',
};
const SUBJECT_LABEL_KEYS = {
  Mathematics: 'schools.subject.mathematics',
  Physics: 'schools.subject.physics',
  Chemistry: 'schools.subject.chemistry',
  Biology: 'schools.subject.biology',
  'Computer Science': 'schools.subject.computer_science',
  Robotics: 'schools.subject.robotics',
  Engineering: 'schools.subject.engineering',
  'Artificial Intelligence': 'schools.subject.artificial_intelligence',
  'Data Science': 'schools.subject.data_science',
  Economics: 'schools.subject.economics',
  Business: 'schools.subject.business',
  Entrepreneurship: 'schools.subject.entrepreneurship',
  'English Language': 'schools.subject.english_language',
  'World History': 'schools.subject.world_history',
  Geography: 'schools.subject.geography',
  'Design & Technology': 'schools.subject.design_technology',
  'Art & Design': 'schools.subject.art_design',
  Music: 'schools.subject.music',
  'Media Studies': 'schools.subject.media_studies',
  Psychology: 'schools.subject.psychology',
};
const SPECIALIST_LABEL_KEYS = {
  Psychologist: 'schools.specialist.psychologist',
  'Speech therapist': 'schools.specialist.speech_therapist',
  'Social worker': 'schools.specialist.social_worker',
  Tutor: 'schools.specialist.tutor',
  'Special education teacher': 'schools.specialist.special_education_teacher',
  Nurse: 'schools.specialist.nurse',
  Defectologist: 'schools.specialist.defectologist',
};
const ACCREDITATION_LABEL_KEYS = {
  License: 'schools.accreditation.license',
  Certificates: 'schools.accreditation.certificates',
};
const EXAM_LABEL_KEYS = {
  Yes: 'schools.exam.yes',
  No: 'schools.exam.no',
};
const CITY_LABEL_KEYS = {
  Almaty: 'schools.city.almaty',
  Astana: 'schools.city.astana',
  Karaganda: 'schools.city.karaganda',
};
const AREA_LABEL_KEYS = {
  Almaty: {
    Almaly: 'schools.area.almaty.almaly',
    Auezov: 'schools.area.almaty.auezov',
    Bostandyk: 'schools.area.almaty.bostandyk',
    Zhetysu: 'schools.area.almaty.zhetysu',
    Medeu: 'schools.area.almaty.medeu',
    Nauryzbay: 'schools.area.almaty.nauryzbay',
  },
  Astana: {
    'Almaty district': 'schools.area.astana.almaty_district',
    Baikonur: 'schools.area.astana.baikonur',
    Yesil: 'schools.area.astana.yesil',
    Saryarka: 'schools.area.astana.saryarka',
    Nura: 'schools.area.astana.nura',
  },
  Karaganda: {
    City: 'schools.area.karaganda.city',
    Maikudyk: 'schools.area.karaganda.maikudyk',
    'South-East': 'schools.area.karaganda.south_east',
    Prishakhtinsk: 'schools.area.karaganda.prishakhtinsk',
    Sortirovka: 'schools.area.karaganda.sortirovka',
  },
};
const SERVICE_KEYWORDS = {
  after_school: ['after school', 'after-school', 'продлен', 'продленка', 'продленного дня'],
  transport: ['transport', 'bus', 'shuttle', 'транспорт', 'подвоз', 'автобус'],
  inclusive_education: ['inclusive', 'инклюзив', 'особые', 'special needs', 'овз'],
  security: ['security', 'охрана', 'безопасн'],
  cameras: ['cctv', 'camera', 'видеонаблюд', 'камера'],
  access_control: ['access control', 'пропуск', 'турникет', 'контроль доступа'],
  medical_office: ['medical office', 'medical', 'медпункт', 'мед кабинет', 'медицин'],
};
const MEAL_KEYWORDS = {
  Free: ['free', 'бесплат', 'free meals', 'free lunch'],
  Paid: ['paid', 'платн', 'paid meals'],
  'No meals': ['no meals', 'без питания', 'нет питания'],
};
const CURRICULA_KEYWORDS = {
  'State program (Kazakhstan)': ['state program', 'гос программа', 'государственная программа', 'госпрограмма'],
  'Updated content': ['updated content', 'обновлен', 'обновленное содержание'],
  'NIS Integrated Program': ['nis', 'ниша', 'назарбаев', 'интегрированная программа'],
  'Cambridge Primary': ['cambridge primary'],
  'Cambridge Lower Secondary': ['cambridge lower', 'lower secondary'],
  'Cambridge IGCSE': ['igcse', 'cambridge igcse'],
  'Cambridge A-Level': ['a-level', 'alevel'],
  'IB PYP': ['ib pyp', 'pyp', 'international baccalaureate'],
  'STEAM': ['steam'],
  'STEM': ['stem'],
  'Montessori': ['montessori', 'монтессори'],
  'Waldorf': ['waldorf', 'вальдорф'],
  'American Curriculum': ['american curriculum', 'американск'],
  'British National Curriculum': ['british national', 'british curriculum', 'британск'],
  'Bilingual Program': ['bilingual', 'билингв', 'двуязыч'],
  'Author program': ['author program', 'авторская программа'],
};
const SUBJECT_KEYWORDS = {
  Mathematics: ['math', 'математ', 'алгебр', 'геометр'],
  Physics: ['physics', 'физик'],
  Chemistry: ['chem', 'хим'],
  Biology: ['biology', 'биолог'],
  'Computer Science': ['computer science', 'cs', 'информат', 'программир', 'компьютерн'],
  Robotics: ['robot', 'робот'],
  Engineering: ['engineering', 'инженер'],
  'Artificial Intelligence': ['artificial intelligence', 'искусственный интеллект', 'ии', 'ai'],
  'Data Science': ['data science', 'data', 'данные', 'аналитик'],
  Economics: ['econom', 'эконом'],
  Business: ['business', 'бизн'],
  Entrepreneurship: ['entrepreneur', 'предприним'],
  'English Language': ['english language', 'английский язык'],
  'World History': ['world history', 'истор', 'history'],
  Geography: ['geograph', 'географ'],
  'Design & Technology': ['design & technology', 'design technology', 'дизайн и технологии', 'технолог'],
  'Art & Design': ['art', 'искусств'],
  Music: ['music', 'музык'],
  'Media Studies': ['media', 'медиа', 'журналист'],
  Psychology: ['psychology', 'психолог'],
};
const SPECIALIST_KEYWORDS = {
  Psychologist: ['psychologist', 'психолог'],
  'Speech therapist': ['speech therapist', 'логопед'],
  'Social worker': ['social worker', 'соц работник', 'социальный'],
  Tutor: ['tutor', 'тьютор'],
  'Special education teacher': ['special education', 'дефектолог', 'спец педагог', 'special needs'],
  Nurse: ['nurse', 'медсестра'],
  Defectologist: ['defectologist', 'дефектолог'],
};
const ACCREDITATION_KEYWORDS = {
  License: ['license', 'лиценз'],
  Certificates: ['certificate', 'сертификат'],
};
const EXAM_KEYWORDS = {
  Yes: ['exam required', 'with exam', 'с экзамен', 'вступительн'],
  No: ['no exam', 'without exam', 'без экзамен', 'без вступительн'],
};
const SORT_KEYWORDS = {
  rating_desc: ['rating', 'по рейтингу', 'рейтинг'],
  price_asc: ['дешев', 'cheap', 'low price', 'price low', 'подешевле'],
  price_desc: ['дорог', 'expensive', 'price high', 'подороже'],
  reviews_desc: ['reviews', 'отзыв'],
  distance_asc: ['near', 'nearby', 'рядом', 'близко', 'недалеко'],
  name_asc: ['name', 'по названию'],
  updated_desc: ['updated', 'новые', 'свежие'],
};
const STOP_WORDS = new Set([
  'school',
  'schools',
  'школа',
  'школы',
  'школу',
  'школе',
  'в',
  'во',
  'на',
  'по',
  'для',
  'с',
  'и',
  'или',
  'рядом',
  'near',
  'nearby',
  'нужна',
  'нужны',
  'нужен',
  'хочу',
  'ищу',
  'найти',
  'найди',
  'помогите',
  'подобрать',
  'подберите',
  'можно',
  'пожалуйста',
  'please',
]);

const getCityLabel = (school) => {
  if (school.city) return school.city;
  if (school.region) {
    return school.region.replace('г.', '').trim();
  }
  if (school.address) {
    const segment = school.address.split(',')[0];
    return segment?.trim();
  }
  return '';
};

const getLogoSource = (logo) => {
  if (!logo) return images.school2;
  if (typeof logo === 'number') return logo;
  return { uri: logo };
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildSearchRemainder = (text, consumed) => {
  let cleaned = text;
  consumed.forEach((phrase) => {
    if (!phrase) return;
    const pattern = /\s/.test(phrase)
      ? new RegExp(escapeRegex(phrase), 'g')
      : new RegExp(`[a-zа-я0-9]*${escapeRegex(phrase)}[a-zа-я0-9]*`, 'gi');
    cleaned = cleaned.replace(pattern, ' ');
  });
  cleaned = cleaned.replace(/[^a-zа-я0-9\s-]/gi, ' ');
  const tokens = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !STOP_WORDS.has(token))
    .filter((token) => token.length > 2 || /^\d+$/.test(token));
  return tokens.join(' ').trim();
};

const parseBotQuery = (rawQuery) => {
  const text = (rawQuery || '').toLowerCase();
  const consumed = new Set();
  const addConsumed = (value) => {
    if (value) consumed.add(value);
  };
  const addUnique = (list, value) => {
    if (value && !list.includes(value)) list.push(value);
  };
  const matchFromMap = (map, toLabel = (key) => key) => {
    const matches = [];
    Object.entries(map).forEach(([key, keywords]) => {
      let hit = false;
      keywords.forEach((keyword) => {
        if (text.includes(keyword)) {
          hit = true;
          addConsumed(keyword);
        }
      });
      if (hit) {
        addUnique(matches, toLabel(key));
      }
    });
    return matches;
  };
  const extractPriceRange = () => {
    const normalized = text.replace(/₸|тг|тенге/gi, ' ');
    let min = null;
    let max = null;
    let hasPrice = false;
    const rangeMatch = normalized.match(/(\d[\d\s]{2,})\s*[-–]\s*(\d[\d\s]{2,})/);
    if (rangeMatch) {
      min = Number(rangeMatch[1].replace(/\s/g, ''));
      max = Number(rangeMatch[2].replace(/\s/g, ''));
      hasPrice = true;
      addConsumed(rangeMatch[0]);
      return { min, max, hasPrice };
    }
    const maxMatch = normalized.match(
      /(до|<=|max|under|below|не дороже|не выше)\s*(\d[\d\s]*)/
    );
    if (maxMatch) {
      max = Number(maxMatch[2].replace(/\s/g, ''));
      hasPrice = true;
      addConsumed(maxMatch[0]);
    }
    const minMatch = normalized.match(
      /(от|>=|min|above|не меньше|не ниже|минимум)\s*(\d[\d\s]*)/
    );
    if (minMatch) {
      min = Number(minMatch[2].replace(/\s/g, ''));
      hasPrice = true;
      addConsumed(minMatch[0]);
    }
    if (!hasPrice && /₸|тг|тенге/.test(text)) {
      const singleMatch = normalized.match(/\d[\d\s]{2,}/);
      if (singleMatch) {
        max = Number(singleMatch[0].replace(/\s/g, ''));
        hasPrice = true;
        addConsumed(singleMatch[0]);
      }
    }
    return { min, max, hasPrice };
  };
  const extractRating = () => {
    const ratingMatch = text.match(
      /(rating|рейтинг|не ниже|минимум)\s*([3-5](?:[.,]\d)?)/
    );
    if (ratingMatch) {
      addConsumed(ratingMatch[0]);
      return Number(ratingMatch[2].replace(',', '.'));
    }
    const plusMatch = text.match(/([3-5](?:[.,]\d)?)\s*\+/);
    if (plusMatch) {
      addConsumed(plusMatch[0]);
      return Number(plusMatch[1].replace(',', '.'));
    }
    return null;
  };
  const extractMinCount = (keywords) => {
    const minMatch = text.match(
      /(не меньше|минимум|от|min|>=)\s*(\d{1,2})\s*([a-zа-я]+)/
    );
    if (minMatch && keywords.some((kw) => minMatch[3].includes(kw))) {
      addConsumed(minMatch[0]);
      return Number(minMatch[2]);
    }
    const directMatch = text.match(/(\d{1,2})\s*([a-zа-я]+)/);
    if (directMatch && keywords.some((kw) => directMatch[2].includes(kw))) {
      addConsumed(directMatch[0]);
      return Number(directMatch[1]);
    }
    return null;
  };

  const cities = [];
  Object.entries(CITY_KEYWORDS).forEach(([city, keywords]) => {
    const hit = keywords.some((kw) => text.includes(kw));
    if (hit) {
      addUnique(cities, city);
      keywords.forEach((kw) => {
        if (text.includes(kw)) addConsumed(kw);
      });
    }
  });
  CITY_OPTIONS.forEach((city) => {
    const lowered = city.name.toLowerCase();
    if (text.includes(lowered)) {
      addUnique(cities, city.name);
      addConsumed(lowered);
    }
  });
  const cityAreas = {};
  CITY_OPTIONS.forEach((city) => {
    city.areas.forEach((area) => {
      const lowered = area.toLowerCase();
      if (text.includes(lowered)) {
        if (!cityAreas[city.name]) cityAreas[city.name] = [];
        if (!cityAreas[city.name].includes(area)) {
          cityAreas[city.name].push(area);
        }
        addUnique(cities, city.name);
        addConsumed(lowered);
      }
    });
  });

  const typeLabels = { state: 'State', private: 'Private', international: 'International' };
  const languageLabels = { english: 'English', russian: 'Russian', kazakh: 'Kazakh' };
  const types = matchFromMap(TYPE_KEYWORDS, (key) => typeLabels[key] || key);
  const languages = matchFromMap(LANGUAGE_KEYWORDS, (key) => languageLabels[key] || key);
  const services = matchFromMap(SERVICE_KEYWORDS);
  const meals = matchFromMap(MEAL_KEYWORDS);
  const curricula = matchFromMap(CURRICULA_KEYWORDS);
  if (text.includes('cambridge') && !curricula.some((item) => item.startsWith('Cambridge'))) {
    addUnique(curricula, 'Cambridge IGCSE');
    addConsumed('cambridge');
  }
  const subjects = matchFromMap(SUBJECT_KEYWORDS);
  const specialists = matchFromMap(SPECIALIST_KEYWORDS);
  const accreditations = matchFromMap(ACCREDITATION_KEYWORDS);
  const ratingValue = extractRating();
  const rating = Number.isFinite(ratingValue) ? ratingValue : null;

  let exam = null;
  if (EXAM_KEYWORDS.No.some((kw) => text.includes(kw))) {
    exam = 'No';
    EXAM_KEYWORDS.No.forEach((kw) => {
      if (text.includes(kw)) addConsumed(kw);
    });
  } else if (EXAM_KEYWORDS.Yes.some((kw) => text.includes(kw))) {
    exam = 'Yes';
    EXAM_KEYWORDS.Yes.forEach((kw) => {
      if (text.includes(kw)) addConsumed(kw);
    });
  }

  let sortOption = null;
  Object.entries(SORT_KEYWORDS).forEach(([option, keywords]) => {
    if (sortOption) return;
    if (keywords.some((kw) => text.includes(kw))) {
      sortOption = option;
      keywords.forEach((kw) => {
        if (text.includes(kw)) addConsumed(kw);
      });
    }
  });

  const useNearby = SORT_KEYWORDS.distance_asc.some((kw) => text.includes(kw));
  if (useNearby) {
    SORT_KEYWORDS.distance_asc.forEach((kw) => {
      if (text.includes(kw)) addConsumed(kw);
    });
  }

  const { min: priceMin, max: priceMax, hasPrice } = extractPriceRange();
  if (hasPrice && !types.includes('Private')) {
    types.push('Private');
  }

  const minClubs = extractMinCount(['круж', 'секц', 'club']);
  const classMatch = text.match(
    /(не меньше|минимум|от|min|>=)\s*(\d{1,2})\s*(класс|ученик|дет)/
  );
  const minClassSize = classMatch ? Number(classMatch[2]) : null;
  if (classMatch) {
    addConsumed(classMatch[0]);
  }

  const remainder = buildSearchRemainder(text, consumed);

  return {
    query: remainder,
    cities,
    cityAreas,
    types,
    languages,
    curricula,
    subjects,
    specialists,
    services,
    meals,
    accreditations,
    exam,
    rating,
    minClubs: minClubs ?? 0,
    minClassSize: minClassSize ?? 0,
    priceRange: hasPrice
      ? [
          Number.isFinite(priceMin) ? Math.max(PRICE_MIN, priceMin) : PRICE_MIN,
          Number.isFinite(priceMax) ? Math.min(PRICE_MAX, priceMax) : PRICE_MAX,
        ]
      : [PRICE_MIN, PRICE_MAX],
    useNearby,
    sortOption,
  };
};

const normalizeCityAreasSelection = (areasMap = {}) => {
  const normalized = {};
  Object.entries(areasMap).forEach(([city, areas]) => {
    const cityDef = CITY_OPTIONS.find((item) => item.name === city);
    if (!cityDef?.areas?.length) return;
    const unique = Array.from(new Set(areas || []));
    if (unique.length >= cityDef.areas.length) return;
    normalized[city] = unique;
  });
  return normalized;
};

const SchoolCard = ({ item, onPress, t }) => {
  const cityLabel = getCityLabel(item);
  const phoneText = item.phone || (t ? t('schools.phoneMissing') : 'Phone not provided');
  const hasLogo = Boolean(item.logo);
  const firstLetter = item.name ? item.name.charAt(0).toUpperCase() : '?';
  const ratingValue = Number(item.rating);
  const hasRating = Number.isFinite(ratingValue);

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center bg-white rounded-3xl px-4 py-4 mb-4 shadow-sm shadow-black/10"
    >
      <View className="w-16 h-16 rounded-2xl bg-bgPurple/10 mr-4 items-center justify-center overflow-hidden">
        {hasLogo ? (
          <ImageComponent
            source={getLogoSource(item.logo)}
            style={{ width: '100%', height: '100%' }}
            {...(ExpoImageComponent
              ? { contentFit: 'cover' }
              : { resizeMode: 'cover' })}
          />
        ) : (
          <Text className="text-bgPurple font-exoSemibold text-2xl">
            {firstLetter}
          </Text>
        )}
      </View>

      <View className="flex-1">
        <Text
          className="text-darkGrayText font-exoSemibold mb-1.5"
          style={{ fontSize: 16, lineHeight: 20 }}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        {cityLabel ? (
          <Text className="text-bgPurple font-exoSemibold text-xs uppercase tracking-wide mb-1.5">
            {cityLabel}
          </Text>
        ) : null}
        <Text className="text-darkGrayText/70 font-exo text-xs mb-1.5">
          {phoneText}
        </Text>
        {hasRating ? (
          <View className="flex-row items-center">
            <Rating rating={ratingValue} size={14} />
            <Text className="text-darkGrayText font-exoSemibold text-sm ml-2">
              {ratingValue.toFixed(1)}
            </Text>
          </View>
        ) : (
          <Text className="text-darkGrayText/60 font-exo text-xs">
            {t ? t('schools.noRating') : 'No rating'}
          </Text>
        )}
      </View>
    </Pressable>
  );
};

export default function SchoolsScreen() {
  const [query, setQuery] = useState('');
  const [selectedCities, setSelectedCities] = useState([]);
  const [selectedCityAreas, setSelectedCityAreas] = useState({});
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [selectedCurricula, setSelectedCurricula] = useState([]);
  const [selectedSpecialists, setSelectedSpecialists] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedMeals, setSelectedMeals] = useState([]);
  const [selectedMinRating, setSelectedMinRating] = useState(null);
  const [selectedLicenses, setSelectedLicenses] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null); // 'Yes' | 'No' | null
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [minClassSize, setMinClassSize] = useState(0);
  const [minClubs, setMinClubs] = useState(0);
  const [priceRange, setPriceRange] = useState([PRICE_MIN, PRICE_MAX]);
  const [sliderWidth, setSliderWidth] = useState(0);
  const startMinRef = useRef(PRICE_MIN);
  const startMaxRef = useRef(PRICE_MAX);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [sortOption, setSortOption] = useState('relevance'); // relevance | rating_desc | price_asc | price_desc | name_asc | reviews_desc | distance_asc | updated_desc
  const [useNearby, setUseNearby] = useState(false);
  const [radiusKm, setRadiusKm] = useState(5);
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [botModalVisible, setBotModalVisible] = useState(false);
  const [botQuery, setBotQuery] = useState('');
  const [botQueryApplied, setBotQueryApplied] = useState('');
  const [botSource, setBotSource] = useState(null);
  const [botError, setBotError] = useState('');
  const [botLoading, setBotLoading] = useState(false);
  const navigation = useNavigation();
  const { t, locale } = useLocale();
  const { schoolCards, loading } = useSchools();
  const isRu = locale === 'ru';
  const headerPadding = isRu ? 12 : 16;
  const searchPaddingX = isRu ? 12 : 16;
  const actionButtonPadding = isRu ? 12 : 16;
  const actionButtonGap = isRu ? 6 : 10;
  const actionTextStyle = { fontSize: isRu ? 12 : 14 };
  const aiButtonPadding = {
    paddingHorizontal: isRu ? 18 : 16,
    paddingVertical: isRu ? 12 : 10,
  };
  const aiTextStyle = isRu ? { fontSize: 15 } : null;

  const getLabel = (map, value) => {
    const key = map[value];
    return key ? t(key) : value;
  };
  const getCityOptionLabel = (value) => getLabel(CITY_LABEL_KEYS, value);
  const getAreaOptionLabel = (city, area) => {
    const key = AREA_LABEL_KEYS[city]?.[area];
    return key ? t(key) : area;
  };
  const getServiceLabel = (service) => {
    const key = SERVICE_LABEL_KEYS[service.key];
    return key ? t(key) : service.label;
  };
  const botExamples =
    locale === 'ru'
      ? [
          'Частная школа в Алматы с английским и робототехникой до 200000 ₸',
          'Гос школа в Астане рядом с домом, без экзаменов',
          'Кембриджская школа с рейтингом 4+',
        ]
      : BOT_EXAMPLES;

  const activeAreas = useMemo(
    () =>
      selectedCities.flatMap((city) => selectedCityAreas[city] ?? []),
    [selectedCities, selectedCityAreas]
  );
  const isFilterActive =
    selectedCities.length > 0 ||
    activeAreas.length > 0 ||
    selectedTypes.length > 0 ||
    selectedLanguages.length > 0 ||
    selectedCurricula.length > 0 ||
    selectedSubjects.length > 0 ||
    selectedSpecialists.length > 0 ||
    selectedServices.length > 0 ||
    selectedMeals.length > 0 ||
    selectedMinRating !== null ||
    selectedLicenses.length > 0 ||
    selectedExam !== null ||
    minClassSize > 0 ||
    minClubs > 0 ||
    priceRange[0] !== PRICE_MIN ||
    priceRange[1] !== PRICE_MAX ||
    useNearby;

  const isPrivateSelected = selectedTypes.includes('Private');

  const resetFiltersState = () => {
    setSelectedCities([]);
    setSelectedCityAreas({});
    setSelectedTypes([]);
    setSelectedLanguages([]);
    setSelectedCurricula([]);
    setSelectedSpecialists([]);
    setSelectedServices([]);
    setSelectedMeals([]);
    setSelectedSubjects([]);
    setSelectedLicenses([]);
    setSelectedMinRating(null);
    setSelectedExam(null);
    setMinClassSize(0);
    setMinClubs(0);
    setPriceRange([PRICE_MIN, PRICE_MAX]);
    setUseNearby(false);
    setRadiusKm(5);
    setUserLocation(null);
    setLocationError(null);
    setBotQueryApplied('');
    setBotSource(null);
    setBotError('');
    setBotLoading(false);
  };

  const clearAiSelection = () => {
    resetFiltersState();
    setQuery('');
    setSortOption('relevance');
    setBotQueryApplied('');
    setBotSource(null);
    setBotError('');
    setBotLoading(false);
    setBotQuery('');
  };

  const handleCityToggle = (city) => {
    setSelectedCities((prev) => {
      if (prev.includes(city)) {
        setSelectedCityAreas((areas) => {
          const next = { ...areas };
          delete next[city];
          return next;
        });
        return prev.filter((item) => item !== city);
      }
      return [...prev, city];
    });
  };

  const handleAreaToggle = (city, area) => {
    setSelectedCityAreas((prev) => {
      const current = prev[city] ?? [];
      const nextAreas = current.includes(area)
        ? current.filter((item) => item !== area)
        : [...current, area];
      const next = { ...prev };
      if (nextAreas.length) {
        next[city] = nextAreas;
      } else {
        delete next[city];
      }
      return next;
    });
  };

  const handleTypeToggle = (type) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type]
    );
  };

  const handleLanguageToggle = (language) => {
    setSelectedLanguages((prev) =>
      prev.includes(language)
        ? prev.filter((item) => item !== language)
        : [...prev, language]
    );
  };

  const handleRatingSelect = (value) => {
    setSelectedMinRating((prev) => (prev === value ? null : value));
  };

  const handleLicenseToggle = (value) => {
    setSelectedLicenses((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const applyBotFilters = async () => {
    const trimmed = botQuery.trim();
    if (!trimmed) return;
    setBotLoading(true);
    setBotError('');
    let parsed = null;
    let source = 'llm';
    try {
      parsed = await parseSchoolQuery(trimmed);
      if (!parsed) {
        throw new Error('Empty LLM response');
      }
    } catch (error) {
      parsed = parseBotQuery(trimmed);
      source = 'local';
      setBotError(t('schools.bot.llmFallback'));
    } finally {
      setBotLoading(false);
    }
    const normalizedCityAreas = normalizeCityAreasSelection(parsed.cityAreas);
    const hasStructuredFilters =
      parsed.cities.length > 0 ||
      Object.keys(normalizedCityAreas).length > 0 ||
      parsed.types.length > 0 ||
      parsed.languages.length > 0 ||
      parsed.curricula.length > 0 ||
      parsed.subjects.length > 0 ||
      parsed.specialists.length > 0 ||
      parsed.services.length > 0 ||
      parsed.meals.length > 0 ||
      parsed.accreditations.length > 0 ||
      parsed.exam !== null ||
      parsed.rating !== null ||
      parsed.minClassSize > 0 ||
      parsed.minClubs > 0 ||
      parsed.priceRange[0] !== PRICE_MIN ||
      parsed.priceRange[1] !== PRICE_MAX ||
      parsed.useNearby;
    const parsedQueryValue = (parsed.query || '').trim();
    const parsedLower = parsedQueryValue.toLowerCase();
    const trimmedLower = trimmed.toLowerCase();
    let nextQuery = parsedQueryValue;
    if (!parsedQueryValue) {
      nextQuery = hasStructuredFilters ? '' : trimmed;
    } else if (hasStructuredFilters && parsedLower === trimmedLower) {
      nextQuery = '';
    }
    setSelectedCities(parsed.cities);
    setSelectedCityAreas(normalizedCityAreas);
    setSelectedTypes(parsed.types);
    setSelectedLanguages(parsed.languages);
    setSelectedCurricula(parsed.curricula);
    setSelectedSpecialists(parsed.specialists);
    setSelectedServices(parsed.services);
    setSelectedMeals(parsed.meals);
    setSelectedSubjects(parsed.subjects);
    setSelectedLicenses(parsed.accreditations);
    setSelectedMinRating(parsed.rating);
    setSelectedExam(parsed.exam);
    setMinClassSize(parsed.minClassSize);
    setMinClubs(parsed.minClubs);
    setPriceRange(parsed.priceRange);
    setSortOption(parsed.sortOption || 'relevance');
    setQuery(nextQuery);
    if (parsed.useNearby) {
      const ok = await requestLocation();
      setUseNearby(ok);
      if (!ok) setRadiusKm(5);
    } else {
      setUseNearby(false);
      setRadiusKm(5);
      setUserLocation(null);
      setLocationError(null);
    }
    setBotQueryApplied(trimmed);
    setBotSource(source);
    setBotModalVisible(false);
  };

  const clampPrice = (value) => Math.min(PRICE_MAX, Math.max(PRICE_MIN, value));

  const formatPrice = (value) =>
    `${Math.round(value).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US')} ₸`;
  const effectiveSliderWidth = Math.max(sliderWidth, 1);
  const earthRadiusKm = 6371;

  const toRad = (deg) => (deg * Math.PI) / 180;
  const calcDistanceKm = (a, b) => {
    if (!a || !b) return Infinity;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    return earthRadiusKm * c;
  };

  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError(t('schools.filters.locationDenied'));
        setUseNearby(false);
        return false;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      setLocationError(null);
      return true;
    } catch (error) {
      setLocationError(t('schools.filters.locationFailed'));
      setUseNearby(false);
      return false;
    }
  };

  const panResponderMin = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        startMinRef.current = priceRange[0];
      },
      onPanResponderMove: (_, gesture) => {
        if (!sliderWidth) return;
        const ratio = gesture.dx / sliderWidth;
        const delta = ratio * (PRICE_MAX - PRICE_MIN);
        setPriceRange((prev) => {
          const nextMin = clampPrice(startMinRef.current + delta);
          const boundedMin = Math.min(nextMin, prev[1]);
          return [boundedMin, prev[1]];
        });
      },
      onPanResponderRelease: () => {
        startMinRef.current = priceRange[0];
      },
    })
  ).current;

  const panResponderMax = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        startMaxRef.current = priceRange[1];
      },
      onPanResponderMove: (_, gesture) => {
        if (!sliderWidth) return;
        const ratio = gesture.dx / sliderWidth;
        const delta = ratio * (PRICE_MAX - PRICE_MIN);
        setPriceRange((prev) => {
          const nextMax = clampPrice(startMaxRef.current + delta);
          const boundedMax = Math.max(nextMax, prev[0]);
          return [prev[0], boundedMax];
        });
      },
      onPanResponderRelease: () => {
        startMaxRef.current = priceRange[1];
      },
    })
  ).current;

  const filteredSchools = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const filtered = schoolCards.filter((school) => {
      const haystack = [
        school.name,
        school.address,
        school.region,
        school.type,
        school.number,
        school.city,
        school.phone,
        school.languages,
        school.curricula,
        school.education?.advanced_subjects,
        school.advanced_subjects,
        school.specialists,
        school.meals,
        school.services?.clubs,
        school.clubs,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesQuery = trimmed ? haystack.includes(trimmed) : true;
      const matchesCity = selectedCities.length
        ? selectedCities.some((city) => {
            const keywords = (CITY_KEYWORDS[city] || [city]).map((c) => c.toLowerCase());
            const fields = [school.city, school.address].filter(Boolean);
            return fields.some((value) => {
              const hay = value.toLowerCase();
              return keywords.some((kw) => hay.includes(kw));
            });
          })
        : true;
      const matchesArea = activeAreas.length
        ? activeAreas.some((area) => {
            const lowered = area.toLowerCase();
            return [school.address, school.region]
              .filter(Boolean)
              .some((value) => value.toLowerCase().includes(lowered));
          })
        : true;
      const typeValue = (school.type || '').toLowerCase();
      const matchesType = selectedTypes.length
        ? selectedTypes.some((type) => {
            const key = type.toLowerCase();
            const keywords = TYPE_KEYWORDS[key] || [key];
            return keywords.some((kw) => typeValue.includes(kw));
          })
        : true;
      const languageValue = (school.languages || '').toLowerCase();
      const matchesLanguage = selectedLanguages.length
        ? selectedLanguages.some((lang) => {
            const key = lang.toLowerCase();
            const keywords = LANGUAGE_KEYWORDS[key] || [key];
            return keywords.some((kw) => languageValue.includes(kw));
          })
        : true;
      const curriculaValue = splitToList(school.curricula || '').map((c) =>
        c.toLowerCase()
      );
      const matchesCurricula = selectedCurricula.length
        ? selectedCurricula.every((item) =>
            curriculaValue.includes(item.toLowerCase())
          )
        : true;
      const subjectsValue = splitToList(school.education?.advanced_subjects || school.advanced_subjects || '').map((s) =>
        s.toLowerCase()
      );
      const matchesSubjects = selectedSubjects.length
        ? selectedSubjects.every((subject) =>
            subjectsValue.includes(subject.toLowerCase())
          )
        : true;
      const specialistsValue = splitToList(school.specialists || '').map((s) =>
        s.toLowerCase()
      );
      const matchesSpecialists = selectedSpecialists.length
        ? selectedSpecialists.every((item) =>
            specialistsValue.includes(item.toLowerCase())
          )
        : true;
      const servicesFlags = school.servicesFlags || {};
      const matchesServices = selectedServices.length
        ? selectedServices.every((key) => servicesFlags[key])
        : true;
      const mealsValue = (school.meals || '').toLowerCase();
      const matchesMeals = selectedMeals.length
        ? selectedMeals.some((meal) => mealsValue.includes(meal.toLowerCase()))
        : true;
      const ratingValue = Number(school.rating) || 0;
      const matchesRating =
        selectedMinRating !== null ? ratingValue >= selectedMinRating : true;
      const matchesAccreditation = selectedLicenses.length
        ? selectedLicenses.every((item) => {
            if (item === 'License') return Boolean(school.hasLicense);
            if (item === 'Certificates') return Boolean(school.hasCertificates);
            return true;
          })
        : true;
      const matchesExam =
        selectedExam === null
          ? true
          : selectedExam === 'Yes'
          ? Boolean(school.entranceExamRequired)
          : !school.entranceExamRequired;
      const avgClassSize = Number(school.education?.average_class_size || school.average_class_size);
      const matchesClassSize =
        minClassSize > 0 && Number.isFinite(avgClassSize)
          ? avgClassSize >= minClassSize
          : minClassSize === 0;
      const clubsCount = splitToList(school.services?.clubs || school.clubs || '').length;
      const matchesClubs =
        minClubs > 0 ? clubsCount >= minClubs : true;
      const priceValue = Number(school.monthlyFee);
      const matchesPrice =
        isPrivateSelected && (priceValue || priceValue === 0)
          ? priceValue >= priceRange[0] && priceValue <= priceRange[1]
          : true;
      const matchesNearby = useNearby
        ? (() => {
            if (!userLocation) return false;
            if (!school.coordinates) return false;
            const distance = calcDistanceKm(userLocation, school.coordinates);
            return Number.isFinite(distance) && distance <= radiusKm;
          })()
        : true;
      return (
        matchesQuery &&
        matchesCity &&
        matchesArea &&
        matchesType &&
        matchesLanguage &&
        matchesCurricula &&
        matchesSubjects &&
        matchesSpecialists &&
        matchesServices &&
        matchesMeals &&
        matchesRating &&
        matchesAccreditation &&
        matchesExam &&
        matchesClassSize &&
        matchesClubs &&
        matchesPrice &&
        matchesNearby
      );
    });

    const sorted = [...filtered];
    if (sortOption === 'rating_desc') {
      sorted.sort((a, b) => {
        const ar = Number(a.rating) || 0;
        const br = Number(b.rating) || 0;
        return br - ar;
      });
    } else if (sortOption === 'price_asc') {
      sorted.sort((a, b) => {
        const ap = Number.isFinite(Number(a.monthlyFee)) ? Number(a.monthlyFee) : Number.POSITIVE_INFINITY;
        const bp = Number.isFinite(Number(b.monthlyFee)) ? Number(b.monthlyFee) : Number.POSITIVE_INFINITY;
        return ap - bp;
      });
    } else if (sortOption === 'price_desc') {
      sorted.sort((a, b) => {
        const ap = Number.isFinite(Number(a.monthlyFee)) ? Number(a.monthlyFee) : Number.NEGATIVE_INFINITY;
        const bp = Number.isFinite(Number(b.monthlyFee)) ? Number(b.monthlyFee) : Number.NEGATIVE_INFINITY;
        return bp - ap;
      });
    } else if (sortOption === 'reviews_desc') {
      sorted.sort((a, b) => {
        const ac = Number(a.reviewsCount) || 0;
        const bc = Number(b.reviewsCount) || 0;
        return bc - ac;
      });
    } else if (sortOption === 'distance_asc') {
      sorted.sort((a, b) => {
        const distA =
          userLocation && a.coordinates
            ? calcDistanceKm(userLocation, a.coordinates)
            : Infinity;
        const distB =
          userLocation && b.coordinates
            ? calcDistanceKm(userLocation, b.coordinates)
            : Infinity;
        return distA - distB;
      });
    } else if (sortOption === 'updated_desc') {
      sorted.sort((a, b) => {
        const au = Number(a.updatedAt) || 0;
        const bu = Number(b.updatedAt) || 0;
        return bu - au;
      });
    } else if (sortOption === 'name_asc') {
      sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    return sorted;
  }, [
    query,
    schoolCards,
    selectedCities,
    activeAreas,
    selectedTypes,
    selectedLanguages,
    selectedCurricula,
    selectedSpecialists,
    selectedServices,
    selectedMeals,
    selectedMinRating,
    selectedLicenses,
    selectedExam,
    minClassSize,
    minClubs,
    isPrivateSelected,
    priceRange,
    useNearby,
    radiusKm,
    userLocation,
    sortOption,
  ]);

  const aiLabel =
    botSource === 'local' ? t('schools.ai.local') : t('schools.ai.label');
  const aiSummary = botQueryApplied
    ? `${aiLabel}: ${filteredSchools.length} ${t('schools.ai.summaryFor')} "${botQueryApplied}"`
    : '';

  const header = (
    <View className="px-6 pt-6">
      <Text
        className="text-white font-exoSemibold text-3xl mb-4"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {t('schools.title')}
      </Text>

      <View
        className="bg-bgPurple/10 border border-bgPurple/15 rounded-3xl mb-4"
        style={{ marginHorizontal: -24, padding: headerPadding }}
      >
        <View
          className="bg-white rounded-2xl py-3"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: searchPaddingX,
          }}
        >
          <TextInput
            style={{ flex: 1, fontFamily: 'exo', color: '#1f2933', fontSize: 16 }}
            placeholder={t('schools.search.placeholder')}
            placeholderTextColor="rgba(31,41,51,0.5)"
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              if (botQueryApplied) setBotQueryApplied('');
            }}
          />
        </View>
        <View className="flex-row items-center justify-between mt-4">
          <Pressable
            className="flex-row items-center rounded-2xl border border-white/60 bg-white/20"
            style={{
              paddingHorizontal: actionButtonPadding,
              paddingVertical: 10,
              marginRight: actionButtonGap,
            }}
            onPress={() => setSortModalVisible(true)}
          >
            <BarsArrowDownIcon color="#FFFFFF" size={18} />
            <Text
              className="text-white font-exoSemibold ml-2"
              numberOfLines={1}
              ellipsizeMode="tail"
              style={actionTextStyle}
            >
              {t(
                SORT_BUTTON_LABEL_KEYS[sortOption] ||
                  SORT_BUTTON_LABEL_KEYS.relevance
              )}
            </Text>
          </Pressable>
          <Pressable
            className="flex-row items-center rounded-2xl border border-white/60"
            style={{
              paddingHorizontal: actionButtonPadding,
              paddingVertical: 10,
              backgroundColor: isFilterActive ? '#FACC15' : 'rgba(255,255,255,0.125)',
              marginRight: actionButtonGap,
            }}
            onPress={() => setFilterModalVisible(true)}
          >
            <AdjustmentsHorizontalIcon color="#FFFFFF" size={18} />
            <Text
              className="text-white font-exoSemibold ml-2"
              numberOfLines={1}
              ellipsizeMode="tail"
              style={actionTextStyle}
            >
              {t('schools.filter.button')}
            </Text>
          </Pressable>
          <Pressable
            className="flex-row items-center rounded-2xl border border-white/60 bg-white/20"
            style={{ paddingHorizontal: actionButtonPadding, paddingVertical: 10 }}
            onPress={() => navigation.navigate('SchoolMap')}
          >
            <MapIcon color="#FFFFFF" size={18} />
            <Text
              className="text-white font-exoSemibold ml-2"
              numberOfLines={1}
              ellipsizeMode="tail"
              style={actionTextStyle}
            >
              {t('schools.map.button')}
            </Text>
          </Pressable>
        </View>
        <Pressable
          className="flex-row items-center justify-center rounded-2xl border border-white/60 bg-white/20 mt-3"
          style={aiButtonPadding}
          onPress={() => {
            setBotModalVisible(true);
            if (botError) setBotError('');
          }}
        >
          <SparklesIcon color="#FFFFFF" size={18} />
          <Text className="text-white font-exoSemibold ml-2" style={aiTextStyle}>
            {t('schools.ai.match')}
          </Text>
        </Pressable>
        <Pressable
          className="flex-row items-center justify-center rounded-2xl border border-white/60 bg-white/20 mt-3"
          style={aiButtonPadding}
          onPress={() => navigation.navigate('SchoolChat')}
        >
          <ChatBubbleLeftRightIcon color="#FFFFFF" size={18} />
          <Text className="text-white font-exoSemibold ml-2" style={aiTextStyle}>
            {t('schools.ai.chat')}
          </Text>
        </Pressable>
        {aiSummary ? (
          <View className="mt-3 rounded-2xl bg-white/90 px-4 py-3">
            <Text className="text-darkGrayText font-exoSemibold text-sm">
              {aiSummary}
            </Text>
            {botError ? (
              <Text className="text-darkGrayText/70 font-exo text-xs mt-1">
                {botError}
              </Text>
            ) : null}
            <Pressable onPress={clearAiSelection} className="mt-2">
              <Text className="text-bgPurple font-exoSemibold text-xs">
                {t('schools.ai.clear')}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#44C5F5' }}>
      <LinearGradient
        colors={['#44C5F5', '#7E73F4', '#44C5F5']}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ flex: 1 }}
      >
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
      <FlatList
        data={filteredSchools}
        keyExtractor={(item) =>
          item.id != null ? String(item.id) : `${item.name}-${item.address}`
        }
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 32, paddingHorizontal: 24 }}
        renderItem={({ item }) => (
          <SchoolCard
            item={item}
            t={t}
            onPress={() =>
              navigation.navigate('SchoolDetail', {
                schoolId: item.school_id || item.id,
              })
            }
          />
        )}
        ListEmptyComponent={
          <View className="px-6 mt-10">
            <Text className="font-exo text-darkGrayText">
              {t('schools.empty')}
            </Text>
          </View>
        }
      />
      )}
      </LinearGradient>
      <Modal
        visible={sortModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSortModalVisible(false)}
      >
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-3xl p-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-darkGrayText font-exoSemibold text-xl">
                {t('schools.sort.modal.title')}
              </Text>
              <Pressable onPress={() => setSortModalVisible(false)}>
                <Text className="text-bgPurple font-exoSemibold">
                  {t('schools.sort.modal.close')}
                </Text>
              </Pressable>
            </View>
            {[
              { key: 'relevance', label: t(SORT_MODAL_LABEL_KEYS.relevance) },
              { key: 'rating_desc', label: t(SORT_MODAL_LABEL_KEYS.rating_desc) },
              { key: 'reviews_desc', label: t(SORT_MODAL_LABEL_KEYS.reviews_desc) },
              { key: 'price_asc', label: t(SORT_MODAL_LABEL_KEYS.price_asc) },
              { key: 'price_desc', label: t(SORT_MODAL_LABEL_KEYS.price_desc) },
              { key: 'distance_asc', label: t(SORT_MODAL_LABEL_KEYS.distance_asc) },
              { key: 'name_asc', label: t(SORT_MODAL_LABEL_KEYS.name_asc) },
              { key: 'updated_desc', label: t(SORT_MODAL_LABEL_KEYS.updated_desc) },
            ].map((option) => (
              <Pressable
                key={option.key}
                className="py-3 border-b border-bgPurple/10"
                onPress={() => {
                  setSortOption(option.key);
                  setSortModalVisible(false);
                }}
              >
                <Text
                  className={`font-exo text-base ${
                    sortOption === option.key
                      ? 'text-bgPurple font-exoSemibold'
                      : 'text-darkGrayText'
                  }`}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <LinearGradient
          colors={['#44C5F5', '#7E73F4', '#44C5F5']}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <View
            className="bg-white rounded-t-[32px]"
            style={{ maxHeight: '92%' }}
          >
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 28 }}
              showsVerticalScrollIndicator={false}
            >
              <View className="flex-row items-center justify-between mb-4">
              <Pressable
                className="w-10 h-10 rounded-full bg-darkGrayText/10 items-center justify-center"
                onPress={() => setFilterModalVisible(false)}
              >
                <XMarkIcon color="#364356" size={20} />
              </Pressable>
              <Text className="text-darkGrayText font-exoSemibold text-xl">
                {t('schools.filters.title')}
              </Text>
              <Pressable
                onPress={resetFiltersState}
                className="py-2 px-4"
              >
              <Text className="text-bgPurple font-exoSemibold">
                {t('schools.filters.reset')}
              </Text>
              </Pressable>
            </View>
              <Text className="text-darkGrayText/70 font-exo text-sm">
              {t('schools.filters.cityHint')}
            </Text>
              <View className="mt-6">
              {CITY_OPTIONS.map((option) => {
                const isActive = selectedCities.includes(option.name);
                return (
                  <View key={option.name} className="mb-4">
                    <Pressable
                      className="flex-row items-center justify-between rounded-2xl px-4 py-3"
                      style={{
                        borderWidth: 1,
                        borderColor: isActive ? '#5667FD' : 'rgba(54,67,86,0.2)',
                        backgroundColor: isActive ? 'rgba(86,103,253,0.08)' : '#FFFFFF',
                      }}
                      onPress={() => handleCityToggle(option.name)}
                    >
                      <Text className="font-exoSemibold text-darkGrayText">
                        {getCityOptionLabel(option.name)}
                      </Text>
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: isActive ? '#5667FD' : 'rgba(86,103,253,0.4)',
                          backgroundColor: isActive ? '#5667FD' : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isActive ? (
                          <Text style={{ color: '#FFFFFF', fontSize: 14 }}>✓</Text>
                        ) : null}
                      </View>
                    </Pressable>

                    {isActive && option.areas?.length ? (
                      <View className="flex-row flex-wrap gap-2 mt-3">
                        {option.areas.map((area) => {
                          const cityAreas = selectedCityAreas[option.name] ?? [];
                          const areaActive = cityAreas.includes(area);
                          return (
                            <Pressable
                              key={`${option.name}-${area}`}
                              className="px-4 py-2 rounded-full border"
                              style={{
                                borderColor: areaActive ? '#5667FD' : 'rgba(54,67,86,0.25)',
                                backgroundColor: areaActive ? 'rgba(86,103,253,0.12)' : '#FFFFFF',
                              }}
                              onPress={() => handleAreaToggle(option.name, area)}
                            >
                              <Text
                                className="font-exo text-xs"
                                style={{
                                  color: areaActive ? '#364356' : 'rgba(54,67,86,0.8)',
                                }}
                              >
                                {getAreaOptionLabel(option.name, area)}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>

            <View className="mt-2">
              <Text className="text-darkGrayText font-exoSemibold text-base">
                {t('schools.filters.nearbyTitle')}
              </Text>
              <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
                {t('schools.filters.nearbyDesc')}
              </Text>
              <Pressable
                className="mt-3 px-4 py-3 rounded-2xl border flex-row items-center justify-between"
                style={{
                  borderColor: useNearby ? '#5667FD' : 'rgba(54,67,86,0.25)',
                  backgroundColor: useNearby ? 'rgba(86,103,253,0.1)' : '#FFFFFF',
                }}
                onPress={async () => {
                  if (useNearby) {
                    setUseNearby(false);
                    return;
                  }
                  const ok = await requestLocation();
                  if (ok) {
                    setUseNearby(true);
                  }
                }}
              >
                <Text
                  className="font-exoSemibold"
                  style={{ color: useNearby ? '#364356' : 'rgba(54,67,86,0.9)' }}
                >
                  {useNearby
                    ? t('schools.filters.locationEnabled')
                    : t('schools.filters.useLocation')}
                </Text>
                <Text style={{ color: '#5667FD', fontSize: 16 }}>
                  {useNearby ? '✓' : '→'}
                </Text>
              </Pressable>
              {locationError ? (
                <Text className="text-red-500 font-exo text-xs mt-1">{locationError}</Text>
              ) : null}
              {useNearby ? (
                <View className="flex-row items-center justify-between mt-3">
                  <Text className="font-exoSemibold text-base text-darkGrayText">
                    {t('schools.filters.radiusLabel')}
                  </Text>
                  <View className="flex-row items-center rounded-2xl border border-bgPurple/30 px-2 py-1">
                    <Pressable
                      className="px-3 py-2"
                      onPress={() => setRadiusKm((prev) => Math.max(1, prev - 1))}
                    >
                      <Text style={{ fontSize: 20, color: '#4F46E5' }}>−</Text>
                    </Pressable>
                    <Text className="font-exoSemibold text-lg text-darkGrayText px-2">
                      {radiusKm}
                    </Text>
                    <Pressable
                      className="px-3 py-2"
                      onPress={() => setRadiusKm((prev) => Math.min(50, prev + 1))}
                    >
                      <Text style={{ fontSize: 20, color: '#4F46E5' }}>+</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>

            <Text className="text-darkGrayText font-exoSemibold text-base mt-4">
              {t('schools.filters.typeTitle')}
            </Text>
            <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
              {t('schools.filters.typeDesc')}
            </Text>
            <View className="flex-row flex-wrap gap-2 mt-3">
              {TYPE_OPTIONS.map((type) => {
                const isActive = selectedTypes.includes(type);
                return (
                  <Pressable
                    key={type}
                    className="px-4 py-2 rounded-full border"
                    style={{
                      borderColor: isActive ? '#5667FD' : 'rgba(54,67,86,0.25)',
                      backgroundColor: isActive ? 'rgba(86,103,253,0.12)' : '#FFFFFF',
                    }}
                    onPress={() => handleTypeToggle(type)}
                  >
                    <Text
                      className="font-exo text-xs"
                      style={{
                        color: isActive ? '#364356' : 'rgba(54,67,86,0.8)',
                      }}
                    >
                      {getLabel(TYPE_LABEL_KEYS, type)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {isPrivateSelected ? (
              <>
                <Text className="text-darkGrayText font-exoSemibold text-base mt-4">
                  {t('schools.filters.monthlyFeeTitle')}
                </Text>
                <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
                  {t('schools.filters.priceRangeDesc')}
                </Text>
                <Text className="text-darkGrayText/70 font-exo text-sm mt-3">
                  {`${formatPrice(priceRange[0])} — ${formatPrice(priceRange[1])}`}
                </Text>
                <View
                  className="mt-2"
                  onLayout={(event) => setSliderWidth(event.nativeEvent.layout.width)}
                  style={{ paddingVertical: 12, width: '100%' }}
                >
                  <View style={{ height: 80, position: 'relative', justifyContent: 'flex-end', width: '100%' }}>
                    <View
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 16,
                        height: 8,
                        borderRadius: 999,
                        backgroundColor: 'rgba(86,103,253,0.15)',
                      }}
                    />
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: '100%' }}>
                      {PRICE_HISTOGRAM.map((value, idx) => {
                        const max = Math.max(...PRICE_HISTOGRAM);
                        const height = max ? (value / max) * 40 + 8 : 10;
                        const barWidth = `${100 / PRICE_HISTOGRAM.length}%`;
                        return (
                          <View
                            key={`hist-${idx}`}
                            style={{
                              width: barWidth,
                              height,
                              backgroundColor: 'rgba(54,67,86,0.12)',
                              marginHorizontal: 1,
                              borderRadius: 4,
                              marginBottom: 16,
                            }}
                          />
                        );
                      })}
                    </View>
                    <View
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 16,
                        height: 8,
                        borderRadius: 999,
                        backgroundColor: 'rgba(86,103,253,0.3)',
                      }}
                    />
                    {(() => {
                      const minRatio = (priceRange[0] - PRICE_MIN) / (PRICE_MAX - PRICE_MIN);
                      const maxRatio = (priceRange[1] - PRICE_MIN) / (PRICE_MAX - PRICE_MIN);
                      const minLeft = minRatio * effectiveSliderWidth;
                      const maxLeft = maxRatio * effectiveSliderWidth;
                      return (
                        <>
                          <View
                            style={{
                              position: 'absolute',
                              left: Math.min(minLeft, maxLeft),
                              width: Math.abs(maxLeft - minLeft),
                              bottom: 16,
                              height: 8,
                              backgroundColor: '#5667FD',
                              borderRadius: 999,
                            }}
                          />
                          <Pressable
                            {...panResponderMin.panHandlers}
                            hitSlop={10}
                            style={{
                              position: 'absolute',
                              left: minLeft - 14,
                              bottom: 10,
                              width: 28,
                              height: 28,
                              borderRadius: 999,
                              backgroundColor: '#2563EB',
                              borderWidth: 2,
                              borderColor: 'white',
                            }}
                          />
                          <Pressable
                            {...panResponderMax.panHandlers}
                            hitSlop={10}
                            style={{
                              position: 'absolute',
                              left: maxLeft - 14,
                              bottom: 10,
                              width: 28,
                              height: 28,
                              borderRadius: 999,
                              backgroundColor: '#2563EB',
                              borderWidth: 2,
                              borderColor: 'white',
                            }}
                          />
                        </>
                      );
                    })()}
                  </View>
                </View>
              </>
            ) : null}
            <Text className="text-darkGrayText font-exoSemibold text-base mt-4">
              {t('schools.filters.languageTitle')}
            </Text>
            <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
              {t('schools.filters.languageDesc')}
            </Text>
            <View className="flex-row flex-wrap gap-2 mt-3">
              {LANGUAGE_OPTIONS.map((lang) => {
                const isActive = selectedLanguages.includes(lang);
                return (
                  <Pressable
                    key={lang}
                    className="px-4 py-2 rounded-full border"
                    style={{
                      borderColor: isActive ? '#5667FD' : 'rgba(54,67,86,0.25)',
                      backgroundColor: isActive ? 'rgba(86,103,253,0.12)' : '#FFFFFF',
                    }}
                    onPress={() => handleLanguageToggle(lang)}
                  >
                    <Text
                      className="font-exo text-xs"
                      style={{
                        color: isActive ? '#364356' : 'rgba(54,67,86,0.8)',
                      }}
                    >
                      {getLabel(LANGUAGE_LABEL_KEYS, lang)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text className="text-darkGrayText font-exoSemibold text-base mt-4">
              {t('schools.filters.accreditationTitle')}
            </Text>
            <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
              {t('schools.filters.accreditationDesc')}
            </Text>
            <View className="flex-row flex-wrap gap-2 mt-3">
              {ACCREDITATION_OPTIONS.map((option) => {
                const isActive = selectedLicenses.includes(option);
                return (
                  <Pressable
                    key={option}
                    className="px-4 py-2 rounded-full border"
                    style={{
                      borderColor: isActive ? '#5667FD' : 'rgba(54,67,86,0.25)',
                      backgroundColor: isActive ? 'rgba(86,103,253,0.12)' : '#FFFFFF',
                    }}
                    onPress={() => handleLicenseToggle(option)}
                  >
                    <Text
                      className="font-exo text-xs"
                      style={{
                        color: isActive ? '#364356' : 'rgba(54,67,86,0.8)',
                      }}
                    >
                      {getLabel(ACCREDITATION_LABEL_KEYS, option)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text className="text-darkGrayText font-exoSemibold text-base mt-4">
              {t('schools.filters.curriculaTitle')}
            </Text>
            <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
              {t('schools.filters.curriculaDesc')}
            </Text>
            <View className="flex-row flex-wrap gap-2 mt-3">
              {CURRICULA_OPTIONS.map((item) => {
                const isActive = selectedCurricula.includes(item);
                return (
                  <Pressable
                    key={item}
                    className="px-4 py-2 rounded-full border"
                    style={{
                      borderColor: isActive ? '#5667FD' : 'rgba(54,67,86,0.25)',
                      backgroundColor: isActive ? 'rgba(86,103,253,0.12)' : '#FFFFFF',
                    }}
                    onPress={() =>
                      setSelectedCurricula((prev) =>
                        prev.includes(item)
                          ? prev.filter((v) => v !== item)
                          : [...prev, item]
                      )
                    }
                  >
                    <Text
                      className="font-exo text-xs"
                      style={{
                        color: isActive ? '#364356' : 'rgba(54,67,86,0.8)',
                      }}
                    >
                      {getLabel(CURRICULA_LABEL_KEYS, item)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text className="text-darkGrayText font-exoSemibold text-base mt-4">
              {t('schools.filters.servicesTitle')}
            </Text>
            <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
              {t('schools.filters.servicesDesc')}
            </Text>
            <View className="flex-row flex-wrap gap-2 mt-3">
              {SERVICE_FLAGS.map((service) => {
                const isActive = selectedServices.includes(service.key);
                return (
                  <Pressable
                    key={service.key}
                    className="px-4 py-2 rounded-full border"
                    style={{
                      borderColor: isActive ? '#5667FD' : 'rgba(54,67,86,0.25)',
                      backgroundColor: isActive ? 'rgba(86,103,253,0.12)' : '#FFFFFF',
                    }}
                    onPress={() =>
                      setSelectedServices((prev) =>
                        prev.includes(service.key)
                          ? prev.filter((item) => item !== service.key)
                          : [...prev, service.key]
                      )
                    }
                  >
                    <Text
                      className="font-exo text-xs"
                      style={{
                        color: isActive ? '#364356' : 'rgba(54,67,86,0.8)',
                      }}
                    >
                      {getServiceLabel(service)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text className="text-darkGrayText font-exoSemibold text-base mt-4">
              {t('schools.filters.mealsTitle')}
            </Text>
            <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
              {t('schools.filters.mealsDesc')}
            </Text>
            <View className="flex-row flex-wrap gap-2 mt-3">
              {MEAL_OPTIONS.map((meal) => {
                const isActive = selectedMeals.includes(meal);
                return (
                  <Pressable
                    key={meal}
                    className="px-4 py-2 rounded-full border"
                    style={{
                      borderColor: isActive ? '#5667FD' : 'rgba(54,67,86,0.25)',
                      backgroundColor: isActive ? 'rgba(86,103,253,0.12)' : '#FFFFFF',
                    }}
                    onPress={() =>
                      setSelectedMeals((prev) =>
                        prev.includes(meal)
                          ? prev.filter((item) => item !== meal)
                          : [...prev, meal]
                      )
                    }
                  >
                    <Text
                      className="font-exo text-xs"
                      style={{
                        color: isActive ? '#364356' : 'rgba(54,67,86,0.8)',
                      }}
                    >
                      {getLabel(MEAL_LABEL_KEYS, meal)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text className="text-darkGrayText font-exoSemibold text-base mt-4">
              {t('schools.filters.specialistsTitle')}
            </Text>
            <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
              {t('schools.filters.specialistsDesc')}
            </Text>
            <View className="flex-row flex-wrap gap-2 mt-3">
              {SPECIALISTS_OPTIONS.map((item) => {
                const isActive = selectedSpecialists.includes(item);
                return (
                  <Pressable
                    key={item}
                    className="px-4 py-2 rounded-full border"
                    style={{
                      borderColor: isActive ? '#5667FD' : 'rgba(54,67,86,0.25)',
                      backgroundColor: isActive ? 'rgba(86,103,253,0.12)' : '#FFFFFF',
                    }}
                    onPress={() =>
                      setSelectedSpecialists((prev) =>
                        prev.includes(item)
                          ? prev.filter((v) => v !== item)
                          : [...prev, item]
                      )
                    }
                  >
                    <Text
                      className="font-exo text-xs"
                      style={{
                        color: isActive ? '#364356' : 'rgba(54,67,86,0.8)',
                      }}
                    >
                      {getLabel(SPECIALIST_LABEL_KEYS, item)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text className="text-darkGrayText font-exoSemibold text-base mt-4">
              {t('schools.filters.examTitle')}
            </Text>
            <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
              {t('schools.filters.examDesc')}
            </Text>
            <View className="flex-row flex-wrap gap-2 mt-3">
              {['Yes', 'No'].map((option) => {
                const isActive = selectedExam === option;
                return (
                  <Pressable
                    key={option}
                    className="px-4 py-2 rounded-full border"
                    style={{
                      borderColor: isActive ? '#5667FD' : 'rgba(54,67,86,0.25)',
                      backgroundColor: isActive ? 'rgba(86,103,253,0.12)' : '#FFFFFF',
                    }}
                    onPress={() =>
                      setSelectedExam((prev) => (prev === option ? null : option))
                    }
                  >
                    <Text
                      className="font-exo text-xs"
                      style={{
                        color: isActive ? '#364356' : 'rgba(54,67,86,0.8)',
                      }}
                    >
                      {getLabel(EXAM_LABEL_KEYS, option)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text className="text-darkGrayText font-exoSemibold text-base mt-4">
              {t('schools.filters.subjectsTitle')}
            </Text>
            <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
              {t('schools.filters.subjectsDesc')}
            </Text>
            <View className="flex-row flex-wrap gap-2 mt-3">
              {SUBJECT_OPTIONS.map((subject) => {
                const isActive = selectedSubjects.includes(subject);
                return (
                  <Pressable
                    key={subject}
                    className="px-4 py-2 rounded-full border"
                    style={{
                      borderColor: isActive ? '#5667FD' : 'rgba(54,67,86,0.25)',
                      backgroundColor: isActive ? 'rgba(86,103,253,0.12)' : '#FFFFFF',
                    }}
                    onPress={() =>
                      setSelectedSubjects((prev) =>
                        prev.includes(subject)
                          ? prev.filter((item) => item !== subject)
                          : [...prev, subject]
                      )
                    }
                  >
                    <Text
                      className="font-exo text-xs"
                      style={{
                        color: isActive ? '#364356' : 'rgba(54,67,86,0.8)',
                      }}
                    >
                      {getLabel(SUBJECT_LABEL_KEYS, subject)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text className="text-darkGrayText font-exoSemibold text-base mt-4">
              {t('schools.filters.ratingTitle')}
            </Text>
            <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
              {t('schools.filters.ratingDesc')}
            </Text>
            <View className="flex-row flex-wrap gap-2 mt-3">
              {RATING_OPTIONS.map((value) => {
                const isActive = selectedMinRating === value;
                return (
                  <Pressable
                    key={value}
                    className="px-4 py-2 rounded-full border"
                    style={{
                      borderColor: isActive ? '#5667FD' : 'rgba(54,67,86,0.25)',
                      backgroundColor: isActive ? 'rgba(86,103,253,0.12)' : '#FFFFFF',
                    }}
                    onPress={() => handleRatingSelect(value)}
                  >
                    <Text
                      className="font-exo text-xs"
                      style={{
                        color: isActive ? '#364356' : 'rgba(54,67,86,0.8)',
                      }}
                    >
                      {value.toFixed(1)}+
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View className="mt-6">
              <Text className="text-darkGrayText font-exoSemibold text-base">
                {t('schools.filters.classSizeTitle')}
              </Text>
              <View className="flex-row items-center justify-between mt-2">
                <Text className="font-exoSemibold text-lg text-darkGrayText">
                  {minClassSize}
                </Text>
                <View className="flex-row items-center rounded-2xl border border-bgPurple/30 px-2 py-1">
                  <Pressable
                    className="px-3 py-2"
                    onPress={() => setMinClassSize((prev) => Math.max(0, prev - 1))}
                  >
                    <Text style={{ fontSize: 20, color: '#4F46E5' }}>−</Text>
                  </Pressable>
                  <Text className="font-exoSemibold text-lg text-darkGrayText px-2">
                    {minClassSize}
                  </Text>
                  <Pressable
                    className="px-3 py-2"
                    onPress={() => setMinClassSize((prev) => Math.min(60, prev + 1))}
                  >
                    <Text style={{ fontSize: 20, color: '#4F46E5' }}>+</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            <View className="mt-4">
              <Text className="text-darkGrayText font-exoSemibold text-base">
                {t('schools.filters.clubsTitle')}
              </Text>
              <View className="flex-row items-center justify-between mt-2">
                <Text className="font-exoSemibold text-lg text-darkGrayText">
                  {minClubs}
                </Text>
                <View className="flex-row items-center rounded-2xl border border-bgPurple/30 px-2 py-1">
                  <Pressable
                    className="px-3 py-2"
                    onPress={() => setMinClubs((prev) => Math.max(0, prev - 1))}
                  >
                    <Text style={{ fontSize: 20, color: '#4F46E5' }}>−</Text>
                  </Pressable>
                  <Text className="font-exoSemibold text-lg text-darkGrayText px-2">
                    {minClubs}
                  </Text>
                  <Pressable
                    className="px-3 py-2"
                    onPress={() => setMinClubs((prev) => Math.min(50, prev + 1))}
                  >
                    <Text style={{ fontSize: 20, color: '#4F46E5' }}>+</Text>
                  </Pressable>
                </View>
              </View>
            </View>
            <Pressable
              className="mt-4 rounded-2xl bg-bgPurple px-4 py-4 items-center"
              onPress={() => setFilterModalVisible(false)}
            >
              <Text className="text-white font-exoSemibold text-base">
                {t('schools.filters.showResults')}
              </Text>
            </Pressable>
          </ScrollView>
          </View>
        </LinearGradient>
      </Modal>
      <Modal
        visible={botModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBotModalVisible(false)}
      >
        <LinearGradient
          colors={['#44C5F5', '#7E73F4', '#44C5F5']}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <View className="bg-white rounded-t-[32px]" style={{ maxHeight: '88%' }}>
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 28 }}
              showsVerticalScrollIndicator={false}
            >
              <View className="flex-row items-center justify-between mb-4">
                <Pressable
                  className="w-10 h-10 rounded-full bg-darkGrayText/10 items-center justify-center"
                  onPress={() => setBotModalVisible(false)}
                >
                  <XMarkIcon color="#364356" size={20} />
                </Pressable>
                <Text className="text-darkGrayText font-exoSemibold text-xl">
                  {t('schools.bot.title')}
                </Text>
                <Pressable onPress={clearAiSelection} className="py-2 px-4">
                  <Text className="text-bgPurple font-exoSemibold">
                    {t('schools.bot.clear')}
                  </Text>
                </Pressable>
              </View>
              <Text className="text-darkGrayText/70 font-exo text-sm">
                {t('schools.bot.description')}
              </Text>
              <View className="mt-3 rounded-2xl bg-bgPurple/10 p-3">
                <TextInput
                  style={{ fontFamily: 'exo', color: '#1f2933', fontSize: 15, minHeight: 90 }}
                  placeholder={t('schools.bot.placeholder')}
                  placeholderTextColor="rgba(31,41,51,0.5)"
                  value={botQuery}
                  onChangeText={(text) => {
                    setBotQuery(text);
                    if (botError) setBotError('');
                  }}
                  multiline
                />
              </View>
              {botError ? (
                <Text className="text-red-500 font-exo text-xs mt-2">
                  {botError}
                </Text>
              ) : null}
              <View className="flex-row flex-wrap gap-2 mt-3">
                {botExamples.map((example) => (
                  <Pressable
                    key={example}
                    className="px-3 py-2 rounded-full border"
                    style={{ borderColor: 'rgba(54,67,86,0.2)', backgroundColor: '#FFFFFF' }}
                    onPress={() => setBotQuery(example)}
                  >
                    <Text className="font-exo text-xs text-darkGrayText/80">
                      {example}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View className="mt-4 rounded-2xl bg-bgPurple/5 px-4 py-3">
                <Text className="text-darkGrayText/70 font-exo text-xs">
                  {t('schools.bot.supported')}
                </Text>
              </View>
              <Pressable
                className="mt-4 rounded-2xl px-4 py-4 items-center"
                style={{
                  backgroundColor:
                    botQuery.trim() && !botLoading
                      ? '#5667FD'
                      : 'rgba(86,103,253,0.4)',
                }}
                onPress={applyBotFilters}
                disabled={!botQuery.trim() || botLoading}
              >
                <Text className="text-white font-exoSemibold text-base">
                  {botLoading ? t('schools.bot.matching') : t('schools.bot.apply')}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </LinearGradient>
      </Modal>
    </SafeAreaView>
  );
}
