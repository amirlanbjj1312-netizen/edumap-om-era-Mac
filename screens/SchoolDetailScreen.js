import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  StyleSheet,
  Linking,
  Modal,
  TextInput,
  Keyboard,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { Image as RNImage } from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSchools } from '../context/SchoolsContext';
import { TiledMapView } from '../components/map';
import { XMarkIcon, StarIcon as OutlineStarIcon } from 'react-native-heroicons/outline';
import { StarIcon as FilledStarIcon, ChatBubbleLeftRightIcon } from 'react-native-heroicons/solid';
import { addConsultationRequest } from '../services/consultationRequests';
import { getActivePlan } from '../services/subscriptionAccess';
import Rating from '../components/home/rating';
import { useAuth } from '../context/AuthContext';
import { recordVisit } from '../services/visitHistory';
import { trackProgramInfoEvent } from '../services/programInfoAnalytics';
import { useLocale } from '../context/LocaleContext';
import { useRole } from '../context/RoleContext';
import { getLocalizedText } from '../utils/localizedText';
import { mapUnifiedToDisplay } from '../utils/clubsSchedule';
import { parseCoordinate } from '../utils/coordinates';
import { getCurriculaInfo } from '../utils/curriculaInfo';
import {
  CITY_LABEL_KEYS,
  CLUB_LABEL_KEYS,
  CURRICULA_LABEL_KEYS,
  DISTRICT_LABEL_KEYS,
  LANGUAGE_LABEL_KEYS,
  MEAL_LABEL_KEYS,
  PAYMENT_LABEL_KEYS,
  SPECIALIST_LABEL_KEYS,
  SUBJECT_LABEL_KEYS,
  TYPE_LABEL_KEYS,
  translateLabel,
  translateList,
} from '../utils/schoolLabels';

const CONSULTATION_TYPE_KEYS = [
  'schoolDetail.consultation.firstMeeting',
  'schoolDetail.consultation.transfer',
  'schoolDetail.consultation.learningQuestion',
  'schoolDetail.consultation.other',
];

const GRADE_CHOICES = ['Pre-K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const SOCIAL_ICON_MAP = {
  instagram: { name: 'instagram', color: '#E4405F' },
  tiktok: { name: 'tiktok', color: '#111827' },
  youtube: { name: 'youtube', color: '#FF0000' },
  facebook: { name: 'facebook', color: '#1877F2' },
  vk: { name: 'vk', color: '#2787F5' },
  telegram: { name: 'telegram', color: '#2AABEE' },
  whatsapp: { name: 'whatsapp', color: '#25D366' },
};

const initialConsultForm = {
  parentName: '',
  parentPhone: '',
  parentEmail: '',
  childName: '',
  childGrade: '',
  consultationType: '',
  comment: '',
};

const initialReviewForm = {
  author: '',
  rating: 5,
  text: '',
};

const splitToList = (value) =>
  (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length);

const isValidRemoteImage = (value) => {
  if (!value) return false;
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) || trimmed.startsWith('file://');
};

const getYoutubeThumbnail = (url) => {
  if (!url) return null;
  const match =
    url.match(
      /(?:youtube\.com\/.*v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/
    ) || [];
  const id = match[1];
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
};

const normalizeDisplayValue = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value?.ru || value?.en || '';
};

const clampRatingValue = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(5, Math.max(0, numeric));
};

const formatReviewDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const DetailRow = ({ label, value, rowStyle, labelStyle, valueStyle }) => {
  const normalizedValue = (() => {
    if (!value) return '';
    if (Array.isArray(value)) {
      return value.filter(Boolean).join(', ');
    }
    if (typeof value === 'object') {
      return value.ru || value.en || '';
    }
    return String(value);
  })();
  if (!normalizedValue) return null;

  return (
    <View style={[styles.detailRow, rowStyle]}>
      <Text style={[styles.detailLabel, labelStyle]}>
        {label}
      </Text>
      <Text style={[styles.detailValue, valueStyle]}>{normalizedValue}</Text>
    </View>
  );
};

const ProgramChipsRow = ({ label, items, hint, onPress }) => {
  if (!items.length) return null;
  return (
    <View style={styles.programsRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.programsChipWrap}>
        {items.map((item) => (
          <Pressable
            key={`${item.label}-${item.raw}`}
            style={[
              styles.programChip,
              item.hasInfo ? styles.programChipActive : styles.programChipPassive,
            ]}
            onPress={() => item.hasInfo && onPress(item)}
            disabled={!item.hasInfo}
          >
            <Text
              style={[
                styles.programChipText,
                item.hasInfo ? styles.programChipTextActive : styles.programChipTextPassive,
              ]}
            >
              {item.label}
            </Text>
            {item.hasInfo ? <Text style={styles.programChipHelp}>?</Text> : null}
          </Pressable>
        ))}
      </View>
      <Text style={styles.programHint}>{hint}</Text>
    </View>
  );
};

const ExpandableSection = ({ iconName, title, isOpen, onToggle, children }) => (
  <View style={styles.expandableSection}>
    <Pressable style={styles.expandableHeader} onPress={onToggle}>
      <View style={styles.expandableHeaderTitleWrap}>
        <View style={styles.sectionIconBadge}>
          <FontAwesome6
            name={iconName}
            size={13}
            color="#1D4ED8"
            iconStyle="solid"
          />
        </View>
        <Text style={styles.expandableHeaderText}>{title}</Text>
      </View>
      <Text style={styles.expandableHeaderChevron}>
        {isOpen ? '▲' : '▼'}
      </Text>
    </Pressable>
    {isOpen ? <View style={styles.expandableBody}>{children}</View> : null}
  </View>
);

const openMaps = (address, latitude, longitude) => {
  const hasCoords =
    typeof latitude === 'number' &&
    !Number.isNaN(latitude) &&
    typeof longitude === 'number' &&
    !Number.isNaN(longitude);

  const query = hasCoords
    ? `${latitude},${longitude}`
    : address?.trim()?.length
      ? address.trim()
      : null;

  if (!query) return;

  const encoded = encodeURIComponent(query);
  const url = hasCoords
    ? `http://maps.apple.com/?ll=${latitude},${longitude}&q=${encoded}`
    : `http://maps.apple.com/?q=${encoded}`;

  Linking.openURL(url).catch(() => {});
};

const openSocialLink = async (url) => {
  if (!url || typeof url !== 'string') return;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return;
  try {
    const canOpen = await Linking.canOpenURL(trimmed);
    if (canOpen) {
      await Linking.openURL(trimmed);
    }
  } catch (_) {
    // ignore
  }
};

const formatMealsTimes = (count, locale) => {
  if (!Number.isFinite(count)) return '';
  if (locale === 'ru') {
    const suffix = count === 1 ? 'раз' : count >= 2 && count <= 4 ? 'раза' : 'раз';
    return `${count} ${suffix} в день`;
  }
  return `${count} times/day`;
};

const formatMealsFreeUntil = (grade, locale) => {
  if (!Number.isFinite(grade)) return '';
  return locale === 'ru' ? `бесплатно до ${grade} класса` : `free until grade ${grade}`;
};

const formatClubPrice = (value, locale) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    if (locale === 'ru') return 'Бесплатно';
    if (locale === 'kk') return 'Тегін';
    return 'Free';
  }
  const localized = Math.round(numeric).toLocaleString(
    locale === 'ru' || locale === 'kk' ? 'ru-RU' : 'en-US'
  );
  if (locale === 'ru') return `${localized} ₸ / месяц`;
  if (locale === 'kk') return `${localized} ₸ / ай`;
  return `${localized} ₸ / month`;
};

const parseCsvList = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const buildWhatsAppUrl = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return `https://wa.me/${digits}`;
};

const matchesExperienceFilter = (value, filter) => {
  const years = Number(value);
  if (!filter || filter === 'all') return true;
  if (!Number.isFinite(years)) return false;
  if (filter === '0-3') return years >= 0 && years <= 3;
  if (filter === '3-7') return years > 3 && years <= 7;
  if (filter === '7-15') return years > 7 && years <= 15;
  if (filter === '15+') return years > 15;
  return true;
};

export default function SchoolDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { profiles, saveProfile } = useSchools();
  const { account } = useAuth();
  const { isGuest } = useRole();
  const { t, locale } = useLocale();

  const getLocalizedMapText = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    const localized = value?.[locale];
    if (typeof localized === 'string') return localized;
    if (localized && typeof localized === 'object') {
      return Object.values(localized).filter(Boolean).join(', ');
    }
    const fallback = value?.ru || value?.en;
    if (typeof fallback === 'string') return fallback;
    if (fallback && typeof fallback === 'object') {
      return Object.values(fallback).filter(Boolean).join(', ');
    }
    return '';
  };

  const profile = useMemo(() => {
    if (!profiles.length) return null;
    const requestedId = route.params?.schoolId;
    const matchesName = (item) => {
      const displayName = getLocalizedText(item.basic_info.display_name, locale);
      const name = getLocalizedText(item.basic_info.name, locale);
      return displayName === requestedId || name === requestedId;
    };
    return (
      profiles.find((item) => item.school_id === requestedId) ||
      profiles.find(matchesName) ||
      profiles[0]
    );
  }, [profiles, route.params, locale]);

  const [expanded, setExpanded] = useState({
    studying: true,
    contacts: false,
    socials: false,
    services: false,
    staff: false,
    reviews: false,
  });
  const [isMapExpanded, setMapExpanded] = useState(false);
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [mapFocusedMarker, setMapFocusedMarker] = useState(null);
  const [showConsultationModal, setShowConsultationModal] = useState(false);
  const [isSubmittingConsult, setSubmittingConsult] = useState(false);
  const [consultForm, setConsultForm] = useState(() => ({
    ...initialConsultForm,
    consultationType: CONSULTATION_TYPE_KEYS[0],
  }));
  const [localReviews, setLocalReviews] = useState([]);
  const [isReviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewForm, setReviewForm] = useState(initialReviewForm);
  const [photoModal, setPhotoModal] = useState({
    visible: false,
    index: 0,
  });
  const [videoModal, setVideoModal] = useState({
    visible: false,
    url: '',
  });
  const [teacherModal, setTeacherModal] = useState({
    visible: false,
    member: null,
  });
  const [staffSubjectFilter, setStaffSubjectFilter] = useState('all');
  const [staffExperienceFilter, setStaffExperienceFilter] = useState('all');
  const [staffLanguageFilter, setStaffLanguageFilter] = useState('all');
  const [staffExamOnly, setStaffExamOnly] = useState(false);
  const [isSubmittingReview, setSubmittingReview] = useState(false);
  const [programModal, setProgramModal] = useState({
    visible: false,
    label: '',
    info: null,
  });
  const [programModalExpanded, setProgramModalExpanded] = useState(false);
  const [isChatFabVisible, setChatFabVisible] = useState(true);
  const visitUserKey = useMemo(() => {
    if (account?.email) return account.email.toLowerCase();
    if (account?.organization) return account.organization.toLowerCase();
    if (account?.school_id) return account.school_id;
    return 'guest';
  }, [account]);

  useEffect(() => {
    const schoolId = profile?.school_id || profile?.basic_info?.name;
    if (!profile || !schoolId) return;
    recordVisit({
      userKey: visitUserKey,
      schoolId,
      schoolName: getLocalizedText(profile.basic_info?.name, locale),
      schoolCity:
        translateLabel(t, CITY_LABEL_KEYS, profile.basic_info?.city) ||
        profile.basic_info?.district,
    });
  }, [profile, visitUserKey, locale, t]);

  if (!profile) {
    return null;
  }

  const {
    basic_info = {},
    education = {},
    services = {},
    finance = {},
    media = {},
    location = {},
  } = profile || {};
  const currentSchoolId = profile?.school_id || basic_info?.name;
  const schoolWhatsApp = useMemo(() => {
    const candidates = [
      basic_info.whatsapp_phone,
      profile?.contact_info?.whatsapp,
    ];
    const match = candidates.find((value) =>
      typeof value === 'string' && value.trim().length
    );
    return match ? match.trim() : '';
  }, [basic_info.whatsapp_phone, profile?.contact_info?.whatsapp]);
  const whatsappChatUrl = buildWhatsAppUrl(schoolWhatsApp);
  const socialLinks = media?.social_links || {};
  const socialRows = [
    { key: 'instagram', labelKey: 'schoolDetail.field.social.instagram', symbol: 'IG', url: socialLinks.instagram },
    { key: 'tiktok', labelKey: 'schoolDetail.field.social.tiktok', symbol: 'TT', url: socialLinks.tiktok },
    { key: 'youtube', labelKey: 'schoolDetail.field.social.youtube', symbol: 'YT', url: socialLinks.youtube },
    { key: 'facebook', labelKey: 'schoolDetail.field.social.facebook', symbol: 'FB', url: socialLinks.facebook },
    { key: 'vk', labelKey: 'schoolDetail.field.social.vk', symbol: 'VK', url: socialLinks.vk },
    { key: 'telegram', labelKey: 'schoolDetail.field.social.telegram', symbol: 'TG', url: socialLinks.telegram },
    { key: 'whatsapp', labelKey: 'schoolDetail.field.social.whatsapp', symbol: 'WA', url: whatsappChatUrl },
  ].filter((item) => {
    const value = item.url;
    return value && typeof value === 'string' && /^https?:\/\//i.test(value.trim());
  });

  const dedupeList = (list) => Array.from(new Set(list.filter(Boolean)));
  const programsUiText = useMemo(() => {
    if (locale === 'en') {
      return {
        hint: 'Tap a program to see what it means.',
        whatIs: 'What is this',
        includes: 'What it includes',
        forWho: 'Who it is for',
        workload: 'Workload',
        outcome: 'Expected outcome',
        risks: 'What to watch',
        details: 'Read more',
        close: 'Close',
      };
    }
    if (locale === 'kk') {
      return {
        hint: 'Мағынасын көру үшін бағдарламаны басыңыз.',
        whatIs: 'Бұл не',
        includes: 'Нені қамтиды',
        forWho: 'Кімге лайық',
        workload: 'Жүктеме',
        outcome: 'Нәтиже',
        risks: 'Неге назар аудару керек',
        details: 'Толығырақ',
        close: 'Жабу',
      };
    }
    return {
      hint: 'Нажмите на программу, чтобы понять, что это значит.',
      whatIs: 'Что это',
      includes: 'Что включает',
      forWho: 'Кому подходит',
      workload: 'Нагрузка',
      outcome: 'Ожидаемый результат',
      risks: 'На что обратить внимание',
      details: 'Подробнее',
      close: 'Закрыть',
    };
  }, [locale]);

  const buildCurriculaItems = (values) => {
    const seen = new Set();
    return values.reduce((acc, rawValue) => {
      const raw = String(rawValue || '').trim();
      if (!raw) return acc;
      const label = translateLabel(t, CURRICULA_LABEL_KEYS, raw) || raw;
      const normalized = label.toLowerCase();
      if (seen.has(normalized)) return acc;
      seen.add(normalized);
      const info = getCurriculaInfo(raw, locale) || getCurriculaInfo(label, locale);
      acc.push({
        raw,
        label,
        hasInfo: Boolean(info),
        info,
      });
      return acc;
    }, []);
  };

  const languages = dedupeList([
    ...translateList(
      t,
      LANGUAGE_LABEL_KEYS,
      splitToList(education.languages)
    ),
    getLocalizedText(education.languages_other, locale),
  ]);
  const programsRaw = splitToList(getLocalizedText(education.programs, locale));
  const programItemsRaw = buildCurriculaItems(programsRaw);
  const curricula = education.curricula || {};
  const curriculaList = [
    ...(curricula.national || []),
    ...(curricula.international || []),
    ...(curricula.additional || []),
  ];
  const curriculaItemsBase = buildCurriculaItems(curriculaList);
  const curriculaOther = getLocalizedText(curricula.other, locale).trim();
  const curriculaItems = curriculaOther
    ? [
        ...curriculaItemsBase,
        {
          raw: curriculaOther,
          label: curriculaOther,
          hasInfo: false,
          info: null,
        },
      ]
    : curriculaItemsBase;
  const curriculaLabelsSet = new Set(curriculaItemsBase.map((item) => item.label));
  const programsToShow = programItemsRaw.filter(
    (item) => !curriculaLabelsSet.has(item.label)
  );
  const subjects = dedupeList([
    ...translateList(
      t,
      SUBJECT_LABEL_KEYS,
      splitToList(education.advanced_subjects)
    ),
    getLocalizedText(education.advanced_subjects_other, locale),
  ]);
  const specialists = dedupeList([
    ...translateList(
      t,
      SPECIALIST_LABEL_KEYS,
      splitToList(services.specialists)
    ),
    getLocalizedText(services.specialists_other, locale),
  ]);
  const clubs = dedupeList([
    ...translateList(t, CLUB_LABEL_KEYS, splitToList(services.clubs)),
    getLocalizedMapText(services.clubs_other),
  ]);
  const clubsCatalog = useMemo(() => {
    const normalized = mapUnifiedToDisplay(services, locale);
    return normalized.map((club, index) => ({
      id: club.id || `club-${index}`,
      name: club.name || t('schoolDetail.value.unknown'),
      description: club.description,
      schedule: club.schedule,
      teacherName: club.teacherName,
      grades: club.grades,
      priceLabel: formatClubPrice(club.priceMonthly, locale),
    }));
  }, [services, locale, t]);
  const photos = splitToList(media.photos).filter(isValidRemoteImage);
  const serviceArea = getLocalizedMapText(location.service_area);

  const rawLatitude = parseCoordinate(basic_info.coordinates?.latitude);
  const rawLongitude = parseCoordinate(basic_info.coordinates?.longitude);
  const displayType =
    translateLabel(t, TYPE_LABEL_KEYS, basic_info.type) ||
    normalizeDisplayValue(basic_info.type) ||
    t('schoolDetail.value.unknown');
  const displayPayment = translateLabel(
    t,
    PAYMENT_LABEL_KEYS,
    finance?.payment_system
  );
  const displayCity =
    translateLabel(t, CITY_LABEL_KEYS, basic_info.city) ||
    normalizeDisplayValue(basic_info.city) ||
    t('schoolDetail.value.unknown');
  const displayDistrict =
    DISTRICT_LABEL_KEYS[basic_info.city] && basic_info.district
      ? translateLabel(
          t,
          DISTRICT_LABEL_KEYS[basic_info.city],
          basic_info.district
        )
      : normalizeDisplayValue(basic_info.district) || t('schoolDetail.value.unknown');
  const displayAddress =
    getLocalizedText(basic_info.address, locale) ||
    t('schoolDetail.value.unknown');
  const displayPaymentLabel =
    displayPayment || normalizeDisplayValue(finance?.payment_system);
  const mealsStatus = services.meals_status || services.meals;
  const mealsBaseLabel =
    translateLabel(t, MEAL_LABEL_KEYS, mealsStatus) ||
    normalizeDisplayValue(mealsStatus) ||
    '';
  const mealsDetails = [];
  const mealsTimes = Number(services.meals_times_per_day);
  const mealsFreeUntil = Number(services.meals_free_until_grade);
  if (Number.isFinite(mealsTimes) && mealsTimes > 0) {
    mealsDetails.push(formatMealsTimes(mealsTimes, locale));
  }
  if (Number.isFinite(mealsFreeUntil) && mealsFreeUntil > 0) {
    mealsDetails.push(formatMealsFreeUntil(mealsFreeUntil, locale));
  }
  const mealsNotes = getLocalizedText(services.meals_notes, locale);
  if (mealsNotes) {
    mealsDetails.push(mealsNotes);
  }
  const mealsLabel = mealsBaseLabel
    ? mealsDetails.length
      ? `${mealsBaseLabel} • ${mealsDetails.join(' • ')}`
      : mealsBaseLabel
    : t('schoolDetail.value.unknown');
  const foreignTeachersNotes = getLocalizedText(
    services.foreign_teachers_notes,
    locale
  );
  const foreignTeachersLabel = services.foreign_teachers
    ? foreignTeachersNotes
      ? `${t('schoolDetail.value.yes')} • ${foreignTeachersNotes}`
      : t('schoolDetail.value.yes')
    : t('schoolDetail.value.no');
  const staffMembers = useMemo(() => {
    const members = Array.isArray(services?.teaching_staff?.members)
      ? services.teaching_staff.members
      : [];
    if (members.length) {
      return members.filter((member) => member && (member.full_name || member.subjects || member.position || member.photo_url || getLocalizedText(member.bio, locale)));
    }
    const legacyPhoto = services?.teaching_staff?.photo;
    const legacyBio = getLocalizedText(services?.teaching_staff?.description, locale);
    if (legacyPhoto || legacyBio) {
      return [
        {
          id: 'legacy-member',
          full_name: t('schoolDetail.staff.defaultName'),
          position: '',
          subjects: '',
          experience_years: '',
          photo_url: legacyPhoto || '',
          bio: services?.teaching_staff?.description || {},
        },
      ];
    }
    return [];
  }, [services, locale, t]);
  const staffSubjectOptions = useMemo(() => {
    const options = new Set();
    staffMembers.forEach((member) => {
      parseCsvList(member?.subjects).forEach((item) => options.add(item));
    });
    return ['all', ...Array.from(options)];
  }, [staffMembers]);
  const staffLanguageOptions = useMemo(() => {
    const options = new Set();
    staffMembers.forEach((member) => {
      parseCsvList(member?.teaching_languages).forEach((item) => options.add(item));
    });
    return ['all', ...Array.from(options)];
  }, [staffMembers]);
  const filteredStaffMembers = useMemo(
    () =>
      staffMembers.filter((member) => {
        const subjects = parseCsvList(member?.subjects);
        const langs = parseCsvList(member?.teaching_languages);
        const examPrep = String(member?.exam_prep || '').trim();
        const subjectOk =
          staffSubjectFilter === 'all' || subjects.includes(staffSubjectFilter);
        const languageOk =
          staffLanguageFilter === 'all' || langs.includes(staffLanguageFilter);
        const experienceOk = matchesExperienceFilter(
          member?.experience_years,
          staffExperienceFilter
        );
        const examOk = !staffExamOnly || Boolean(examPrep);
        return subjectOk && languageOk && experienceOk && examOk;
      }),
    [
      staffMembers,
      staffSubjectFilter,
      staffLanguageFilter,
      staffExperienceFilter,
      staffExamOnly,
    ]
  );

  const allMarkers = useMemo(() => {
    return profiles
      .map((item) => {
        const basicInfo = item?.basic_info || {};
        const lat = parseCoordinate(basicInfo.coordinates?.latitude);
        const lon = parseCoordinate(basicInfo.coordinates?.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          return null;
        }
        const markerName =
          getLocalizedText(basicInfo.display_name, locale) ||
          getLocalizedText(basicInfo.name, locale) ||
          '';
        const markerAddress = getLocalizedText(basicInfo.address, locale);
        return {
          id: item.school_id || basicInfo.name,
          name: markerName,
          address: markerAddress,
          latitude: lat,
          longitude: lon,
        };
      })
      .filter(Boolean);
  }, [profiles, locale]);

  const currentMarker = useMemo(() => {
    if (!profile) {
      return null;
    }
    const markerId = profile.school_id || profile.basic_info?.name;
    return (
      allMarkers.find(
        (marker) => marker.id === markerId
      ) || null
    );
  }, [allMarkers, profile]);

  useEffect(() => {
    if (currentMarker) {
      setMapFocusedMarker(currentMarker);
    }
  }, [currentMarker]);

  useEffect(() => {
    if (profile?.reviews?.items?.length) {
      setLocalReviews(profile.reviews.items);
    } else {
      setLocalReviews([]);
    }
  }, [profile]);

  const normalizedMapQuery = mapSearchQuery.trim().toLowerCase();

  const mapFilteredMarkers = useMemo(() => {
    if (!normalizedMapQuery) {
      return allMarkers;
    }
    return allMarkers.filter((marker) => {
      const searchable = [marker.name, marker.address]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchable.includes(normalizedMapQuery);
    });
  }, [normalizedMapQuery, allMarkers]);

  const mapHasQuery = normalizedMapQuery.length > 0;
  const mapSuggestions = mapHasQuery ? mapFilteredMarkers.slice(0, 5) : [];
  const mapNoMatches = mapHasQuery && mapFilteredMarkers.length === 0;

  const mapFocusPoint =
    mapFocusedMarker ||
    mapFilteredMarkers[0] ||
    currentMarker ||
    allMarkers[0] ||
    null;
  const logoUri = media.logo || media.logo_local_uri;
  const hasLogo = Boolean(logoUri);
  const addressText = getLocalizedText(basic_info.address, locale).trim();
  const normalizedType = (basic_info.type || '').trim().toLowerCase();
  const isAutonomousSchool =
    normalizedType === 'autonomous' || normalizedType === 'автономная';
  const isStateSchool =
    normalizedType === 'state' ||
    normalizedType === 'public' ||
    normalizedType === 'гос' ||
    normalizedType === 'государственная' ||
    normalizedType === 'государственное';
  const fundingState = Boolean(finance?.funding_state);
  const fundingSelf = Boolean(finance?.funding_self);
  const fundingLabel = (() => {
    const parts = [];
    if (fundingState) parts.push(t('schoolDetail.funding.state'));
    if (fundingSelf) parts.push(t('schoolDetail.funding.self'));
    return parts.length ? parts.join(', ') : t('schoolDetail.value.unknown');
  })();
  const shouldShowPrice =
    !isStateSchool && (!isAutonomousSchool || fundingSelf);

  const quickStats = [
    {
      key: 'type',
      iconName: 'school',
      label: t('schoolDetail.quick.type'),
      value: displayType,
    },
    isAutonomousSchool && {
      key: 'funding',
      iconName: 'building-columns',
      label: t('schoolDetail.quick.funding'),
      value: fundingLabel,
    },
    shouldShowPrice && {
      key: 'price',
      iconName: 'coins',
      label: t('schoolDetail.quick.price'),
      value:
        finance?.monthly_fee && displayPaymentLabel
          ? `${finance.monthly_fee}/${displayPaymentLabel}`
          : finance?.monthly_fee
          ? `${finance.monthly_fee}`
          : t('schoolDetail.value.unknown'),
    },
    {
      key: 'address',
      iconName: 'location-dot',
      label: t('schoolDetail.quick.address'),
      value: addressText || t('schoolDetail.value.unknown'),
    },
    {
      key: 'city',
      iconName: 'city',
      label: t('schoolDetail.quick.city'),
      value: displayCity,
    },
    {
      key: 'district',
      iconName: 'map',
      label: t('schoolDetail.quick.district'),
      value: displayDistrict,
    },
  ].filter(Boolean);

  const toggle = (key) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleMapSearchChange = (value) => {
    setMapSearchQuery(value);
    if (!value.trim() && currentMarker) {
      setMapFocusedMarker(currentMarker);
    }
  };

  const handleMapSuggestionPress = (marker) => {
    setMapSearchQuery(marker.name || '');
    setMapFocusedMarker(marker);
    Keyboard.dismiss();
  };

  const handleOpenPhoto = (uri, index = 0) => {
    if (!uri) return;
    setPhotoModal({ visible: true, index });
  };

  const handleClosePhoto = () => {
    setPhotoModal({ visible: false, index: 0 });
  };

  const handleOpenVideo = (url) => {
    if (!url) return;
    setVideoModal({ visible: true, url });
  };
  const handleOpenTeacher = (member) => {
    setTeacherModal({
      visible: true,
      member,
    });
  };

  const handleCloseTeacher = () => {
    setTeacherModal({
      visible: false,
      member: null,
    });
  };

  const handleCloseVideo = () => {
    setVideoModal({ visible: false, url: '' });
  };

  const handleOpenProgramInfo = (item) => {
    if (!item?.info) return;
    setProgramModalExpanded(false);
    setProgramModal({
      visible: true,
      label: item.label,
      info: item.info,
    });
    trackProgramInfoEvent({
      schoolId: profile?.school_id || basic_info?.name,
      programName: item.raw || item.label,
      eventType: 'open',
      locale,
      expanded: false,
    });
  };

  const handleCloseProgramInfo = () => {
    if (programModal?.label) {
      trackProgramInfoEvent({
        schoolId: profile?.school_id || basic_info?.name,
        programName: programModal.label,
        eventType: 'close',
        locale,
        expanded: programModalExpanded,
      });
    }
    setProgramModalExpanded(false);
    setProgramModal({
      visible: false,
      label: '',
      info: null,
    });
  };

  const handlePhotoNext = () => {
    if (!photos.length) return;
    setPhotoModal((prev) => ({
      ...prev,
      index: (prev.index + 1) % photos.length,
    }));
  };

  const handlePhotoPrev = () => {
    if (!photos.length) return;
    setPhotoModal((prev) => ({
      ...prev,
      index: (prev.index - 1 + photos.length) % photos.length,
    }));
  };

  const handleMapSearchSubmit = () => {
    if (!mapFilteredMarkers.length) {
      Keyboard.dismiss();
      return;
    }
    setMapFocusedMarker(mapFilteredMarkers[0]);
    Keyboard.dismiss();
  };

  const updateConsultField = (key, value) => {
    setConsultForm((prev) => ({ ...prev, [key]: value }));
  };

  const isConsultValid = useMemo(() => {
    return (
      consultForm.parentName.trim() &&
      consultForm.parentPhone.trim() &&
      consultForm.childName.trim() &&
      consultForm.childGrade.trim()
    );
  }, [consultForm]);

  const handleConsultSubmit = async () => {
    if (isGuest) {
      Alert.alert(
        t('schoolDetail.consult.guestTitle'),
        t('schoolDetail.consult.guestBody')
      );
      return;
    }
    if (!isConsultValid || isSubmittingConsult) {
      Alert.alert(
        t('schoolDetail.consult.alertMissingTitle'),
        t('schoolDetail.consult.alertMissingBody')
      );
      return;
    }
    setSubmittingConsult(true);
    Keyboard.dismiss();
    try {
      const emailValue = consultForm.parentEmail.trim();
      const normalizedEmail = /.+@.+\..+/.test(emailValue) ? emailValue : '';
      const schoolNameText =
        getLocalizedText(basic_info.display_name, locale).trim() ||
        getLocalizedText(basic_info.name, locale).trim() ||
        '';
      const requestBody = {
        schoolId: profile.school_id || basic_info.name,
        schoolName: schoolNameText,
        parentName: consultForm.parentName.trim(),
        parentPhone: consultForm.parentPhone.trim(),
        parentEmail: normalizedEmail,
        childName: consultForm.childName.trim(),
        childGrade: consultForm.childGrade.trim(),
        consultationType: consultForm.consultationType,
        consultationTypeLabel: t(consultForm.consultationType),
        comment: consultForm.comment.trim(),
        whatsappPhone: schoolWhatsApp ? schoolWhatsApp.replace(/\s+/g, '') : '',
      };
      console.log('[consultation] requestBody', requestBody);
      await addConsultationRequest(requestBody);
      setConsultForm({
        ...initialConsultForm,
        consultationType: CONSULTATION_TYPE_KEYS[0],
      });
      setShowConsultationModal(false);
      Alert.alert(
        t('schoolDetail.consult.alertSentTitle'),
        t('schoolDetail.consult.alertSentBody')
      );
    } catch (error) {
      console.warn('consultation submit error', error);
      const details = error?.message ? ` (${error.message})` : '';
      Alert.alert(
        t('schoolDetail.consult.alertFailTitle'),
        `${t('schoolDetail.consult.alertFailBody')}${details}`
      );
    } finally {
      setSubmittingConsult(false);
    }
  };

  const reviewCountLabel = localReviews.length
    ? `${localReviews.length} ${t('schoolDetail.reviews.count')}`
    : t('schoolDetail.reviews.emptyCount');

  const resetReviewForm = () => {
    setReviewForm({ ...initialReviewForm });
  };

  const handleOpenReviewModal = () => {
    if (isGuest) {
      Alert.alert(
        t('schoolDetail.consult.guestTitle'),
        t('schoolDetail.consult.guestBody')
      );
      return;
    }
    const checkAccess = async () => {
      const userKey = account?.id || account?.email || 'guest';
      const activePlan = await getActivePlan(userKey);
      if (activePlan?.planId === 'trial') {
        if (locale === 'en') {
          Alert.alert('Reviews', 'Writing reviews is available on Monthly and Pro plans.');
        } else if (locale === 'kk') {
          Alert.alert('Пікірлер', 'Пікір жазу Monthly және Pro тарифтерінде қолжетімді.');
        } else {
          Alert.alert('Отзывы', 'Написание отзывов доступно в тарифах Monthly и Pro.');
        }
        return;
      }
      resetReviewForm();
      setReviewModalVisible(true);
    };
    checkAccess();
  };

  const handleCloseReviewModal = () => {
    setReviewModalVisible(false);
    resetReviewForm();
  };

  const updateReviewField = (key, value) => {
    setReviewForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmitReview = async () => {
    const activePlan = await getActivePlan(account?.id || account?.email || 'guest');
    if (activePlan?.planId === 'trial') {
      if (locale === 'en') {
        Alert.alert('Reviews', 'Writing reviews is available on Monthly and Pro plans.');
      } else if (locale === 'kk') {
        Alert.alert('Пікірлер', 'Пікір жазу Monthly және Pro тарифтерінде қолжетімді.');
      } else {
        Alert.alert('Отзывы', 'Написание отзывов доступно в тарифах Monthly и Pro.');
      }
      return;
    }
    const trimmedText = reviewForm.text.trim();
    if (!trimmedText.length) {
      Alert.alert(
        t('schoolDetail.reviews.alertTitle'),
        t('schoolDetail.reviews.alertBody')
      );
      return;
    }
    const normalizedRating = Math.max(1, Math.min(5, Number(reviewForm.rating) || 5));
    setSubmittingReview(true);
    Keyboard.dismiss();
    const newReview = {
      id: `rev-${Date.now()}`,
      author: reviewForm.author.trim() || t('schoolDetail.reviews.anonymous'),
      rating: normalizedRating,
      text: trimmedText,
      created_at: new Date().toISOString(),
    };
    const nextReviews = [newReview, ...localReviews];
    const ratingSum = nextReviews.reduce(
      (sum, item) => sum + (Number(item.rating) || 0),
      0
    );
    const averageRating =
      nextReviews.length > 0 ? ratingSum / nextReviews.length : null;
    const highlightText = nextReviews[0]?.text || '';

    try {
      const updatedProfile = {
        ...profile,
        reviews: {
          ...(profile.reviews || {}),
          items: nextReviews,
          count: nextReviews.length,
          average_rating: averageRating,
          highlight: highlightText,
        },
        system: {
          ...(profile.system || {}),
          rating: averageRating,
          reviews_count: nextReviews.length,
          highlight_review: highlightText,
        },
      };
      await saveProfile(updatedProfile);
      setLocalReviews(nextReviews);
      setReviewModalVisible(false);
      resetReviewForm();
    } catch (error) {
      console.warn('review submit error', error);
      Alert.alert(
        t('schoolDetail.reviews.alertFailTitle'),
        t('schoolDetail.reviews.alertFailBody')
      );
    } finally {
      setSubmittingReview(false);
    }
  };

  const displayNameText =
    getLocalizedText(basic_info.display_name, locale).trim() ||
    getLocalizedText(basic_info.name, locale).trim() ||
    '';

  return (
    <LinearGradient
      colors={['#E9EEF6', '#E9EEF6']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{ flex: 1 }}
    >
      <SafeAreaView className="flex-1">
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>{'‹'} {t('schoolDetail.back')}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.summaryCard}>
            <View style={styles.logoContainer}>
              {hasLogo ? (
                <RNImage
                  source={{ uri: logoUri }}
                  style={styles.logo}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Text style={styles.logoPlaceholderText}>
                    {displayNameText.charAt(0)?.toUpperCase() || 'S'}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.summaryType}>{displayType}</Text>
            <Text style={styles.summaryTitle}>
              {displayNameText || t('schoolDetail.value.school')}
            </Text>
            <Text style={styles.summaryCity}>
              {displayCity || t('schoolDetail.value.cityUnknown')}
            </Text>
          </View>

          <View style={styles.quickStats}>
            {quickStats.map(({ key, iconName, label, value }) => {
              const important =
                key === 'type' ||
                key === 'funding' ||
                key === 'price' ||
                key === 'address' ||
                key === 'city' ||
                key === 'district';
              const funding = key === 'funding';
              return (
          <View key={key} style={[styles.statItem, important && styles.statItemImportant]}>
            <View style={styles.statIconBadge}>
              <FontAwesome6
                name={iconName}
                size={12}
                color="#1D4ED8"
                iconStyle="solid"
              />
            </View>
            <Text
              style={[
                styles.statText,
                important && styles.statTextImportant,
                funding && styles.statTextCompact,
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
            <Text
              style={[
                styles.statValue,
                important && styles.statValueImportant,
                funding && styles.statValueCompact,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit={funding}
              minimumFontScale={0.72}
            >
              {value}
            </Text>
          </View>
              );
            })}
      </View>

          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              if (isGuest) {
                Alert.alert(
                  t('schoolDetail.consult.guestTitle'),
                  t('schoolDetail.consult.guestBody')
                );
                return;
              }
              setShowConsultationModal(true);
            }}
          >
            <Text style={styles.primaryButtonText}>
              {t('schoolDetail.consult.request')}
            </Text>
          </Pressable>

          <View style={styles.mapCard}>
            {currentMarker ? (
              <Pressable
                style={styles.mapPreviewWrapper}
                onPress={() => setMapExpanded(true)}
              >
                <View pointerEvents="none" style={styles.mapPreview}>
                  <TiledMapView
                    markers={[currentMarker]}
                    style={StyleSheet.absoluteFill}
                    focusPoint={currentMarker}
                    highlightMarkerId={currentMarker.id}
                  />
                </View>
                <View style={styles.mapPreviewOverlay}>
                  <Text style={styles.mapPreviewText}>
                    {t('schoolDetail.map.tapToExpand')}
                  </Text>
                </View>
              </Pressable>
            ) : (
              <Pressable
                style={styles.mapPlaceholder}
                onPress={() =>
                  openMaps(basic_info.address, rawLatitude, rawLongitude)
                }
              >
                <Text style={styles.mapPlaceholderText}>
                  {t('schoolDetail.map.openInMaps')}
                </Text>
              </Pressable>
            )}
          </View>

          <ExpandableSection
            iconName="graduation-cap"
            title={t('schoolDetail.section.studying')}
            isOpen={expanded.studying}
            onToggle={() => toggle('studying')}
          >
            <View style={styles.studyingBlock}>
              <DetailRow
                label={t('schoolDetail.field.languages')}
                value={languages.join(', ')}
                valueStyle={styles.detailValuePrimary}
              />
            </View>

            <View style={styles.studyingDivider} />

            {programsToShow.length || curriculaItems.length ? (
              <View style={styles.studyingBlock}>
                {programsToShow.length ? (
                  <ProgramChipsRow
                    label={t('schoolDetail.field.programs')}
                    items={programsToShow}
                    hint={programsUiText.hint}
                    onPress={handleOpenProgramInfo}
                  />
                ) : null}
                {curriculaItems.length ? (
                  <ProgramChipsRow
                    label={t('schoolDetail.field.curricula')}
                    items={curriculaItems}
                    hint={programsUiText.hint}
                    onPress={handleOpenProgramInfo}
                  />
                ) : null}
              </View>
            ) : null}

            <View style={styles.studyingDivider} />

            <View style={styles.studyingBlock}>
              <DetailRow
                label={t('schoolDetail.field.advancedSubjects')}
                value={subjects.join(', ')}
                valueStyle={styles.detailValuePrimary}
              />
            </View>

            <View style={styles.studyingDivider} />

            {education.average_class_size ? (
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>
                  {t('schoolDetail.field.averageClassSize')}
                </Text>
                <Text style={styles.metricValue}>
                  {String(education.average_class_size)}
                </Text>
              </View>
            ) : null}
          </ExpandableSection>

          <ExpandableSection
            iconName="circle-info"
            title={t('schoolDetail.section.contacts')}
            isOpen={expanded.contacts}
            onToggle={() => toggle('contacts')}
          >
            <DetailRow
              label={t('schoolDetail.field.phone')}
              value={basic_info.phone}
              labelColor="#2563EB"
            />
            {schoolWhatsApp ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>
                  {t('schoolDetail.field.whatsapp')}
                </Text>
                <Pressable onPress={() => openSocialLink(whatsappChatUrl)}>
                  <Text style={styles.detailValueLink}>{schoolWhatsApp}</Text>
                </Pressable>
              </View>
            ) : null}
            <DetailRow
              label={t('schoolDetail.field.email')}
              value={basic_info.email}
              labelColor="#2563EB"
            />
            <DetailRow
              label={t('schoolDetail.field.website')}
              value={basic_info.website}
              labelColor="#2563EB"
            />
            <DetailRow
              label={t('schoolDetail.field.address')}
              value={displayAddress}
              labelColor="#2563EB"
            />
            <DetailRow
              label={t('schoolDetail.field.district')}
              value={displayDistrict}
              labelColor="#2563EB"
            />
          </ExpandableSection>

          {socialRows.length ? (
            <ExpandableSection
              iconName="globe"
              title={t('schoolDetail.section.socials')}
              isOpen={expanded.socials}
              onToggle={() => toggle('socials')}
            >
              <View style={styles.socialGrid}>
                {socialRows.map((item) => (
                  <Pressable
                    key={item.key}
                    style={styles.socialCard}
                    onPress={() => openSocialLink(item.url)}
                  >
                    <View style={styles.socialBadge}>
                      {SOCIAL_ICON_MAP[item.key] ? (
                        <FontAwesome6
                          name={SOCIAL_ICON_MAP[item.key].name}
                          iconStyle="brands"
                          size={18}
                          color={SOCIAL_ICON_MAP[item.key].color}
                        />
                      ) : (
                        <Text style={styles.socialBadgeText}>{item.symbol}</Text>
                      )}
                    </View>
                    <Text style={styles.socialLabel}>{t(item.labelKey)}</Text>
                  </Pressable>
                ))}
              </View>
            </ExpandableSection>
          ) : null}

          <ExpandableSection
            iconName="shield-halved"
            title={t('schoolDetail.section.services')}
            isOpen={expanded.services}
            onToggle={() => toggle('services')}
          >
            <DetailRow
              label={t('schoolDetail.field.afterSchool')}
              value={
                services.after_school
                  ? t('schoolDetail.value.available')
                  : t('schoolDetail.value.notAvailable')
              }
              labelColor="#2563EB"
            />
            <DetailRow
              label={t('schoolDetail.field.meals')}
              value={mealsLabel}
              labelColor="#2563EB"
            />
            <DetailRow
              label={t('schoolDetail.field.transport')}
              value={
                services.transport
                  ? t('schoolDetail.value.available')
                  : t('schoolDetail.value.notAvailable')
              }
              labelColor="#2563EB"
            />
            <DetailRow
              label={t('schoolDetail.field.inclusiveEducation')}
              value={
                services.inclusive_education
                  ? t('schoolDetail.value.supported')
                  : t('schoolDetail.value.notSupported')
              }
              labelColor="#2563EB"
            />
            <DetailRow
              label={t('schoolDetail.field.specialists')}
              value={specialists.join(', ')}
              labelColor="#2563EB"
            />
            {clubsCatalog.length ? (
              <View style={styles.clubCatalogWrap}>
                <Text style={styles.detailLabel}>
                  {t('schoolDetail.field.clubs')}
                </Text>
                <View style={styles.clubCatalogList}>
                  {clubsCatalog.slice(0, 4).map((club) => (
                    <Pressable
                      key={club.id}
                      style={styles.clubCatalogCard}
                      onPress={() =>
                        navigation.navigate('SchoolClubDetail', {
                          schoolId: currentSchoolId,
                          clubId: club.id,
                        })
                      }
                    >
                      <View style={styles.clubCatalogHeader}>
                        <View style={styles.clubCatalogHeaderMain}>
                          <Text style={styles.clubCatalogTitle}>{club.name}</Text>
                          <Text style={styles.clubCatalogHeaderPrice}>
                            {club.priceLabel}
                          </Text>
                        </View>
                        <Text style={styles.clubCatalogChevron}>›</Text>
                      </View>
                      {club.schedule ? (
                        <View style={styles.clubCatalogBody}>
                          <Text style={styles.clubCatalogMeta}>
                            {`${t('schoolDetail.club.schedule')}: ${club.schedule}`}
                          </Text>
                        </View>
                      ) : null}
                    </Pressable>
                  ))}
                  <Pressable
                    style={styles.clubCatalogMoreBtn}
                    onPress={() =>
                      navigation.navigate('SchoolClubs', {
                        schoolId: currentSchoolId,
                      })
                    }
                  >
                    <Text style={styles.clubCatalogMoreBtnText}>
                      {locale === 'ru'
                        ? 'Все кружки'
                        : locale === 'kk'
                          ? 'Барлық үйірмелер'
                          : 'All clubs'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
            {!clubsCatalog.length ? (
              <DetailRow
                label={t('schoolDetail.field.clubs')}
                value={clubs.join(', ')}
                labelColor="#2563EB"
              />
            ) : null}
            <DetailRow
              label={t('schoolDetail.field.foreignTeachers')}
              value={foreignTeachersLabel}
              labelColor="#2563EB"
            />
            <DetailRow
              label={t('schoolDetail.field.security')}
              value={
                services.safety?.security
                  ? t('schoolDetail.value.yes')
                  : t('schoolDetail.value.no')
              }
              labelColor="#2563EB"
            />
            <DetailRow
              label={t('schoolDetail.field.cameras')}
              value={
                services.safety?.cameras
                  ? t('schoolDetail.value.yes')
                  : t('schoolDetail.value.no')
              }
              labelColor="#2563EB"
            />
            <DetailRow
              label={t('schoolDetail.field.accessControl')}
              value={
                services.safety?.access_control
                  ? t('schoolDetail.value.yes')
                  : t('schoolDetail.value.no')
              }
              labelColor="#2563EB"
            />
            <DetailRow
              label={t('schoolDetail.field.medicalOffice')}
              value={
                services.medical_office
                  ? t('schoolDetail.value.available')
                  : t('schoolDetail.value.notAvailable')
              }
              labelColor="#2563EB"
            />
          </ExpandableSection>

          <ExpandableSection
            iconName="comments"
            title={t('schoolDetail.section.reviews')}
            isOpen={expanded.reviews}
            onToggle={() => toggle('reviews')}
          >
            <View style={styles.reviewsHeader}>
              <Text style={styles.reviewSummary}>{reviewCountLabel}</Text>
              <Pressable style={styles.reviewButton} onPress={handleOpenReviewModal}>
                <Text style={styles.reviewButtonText}>
                  {t('schoolDetail.reviews.write')}
                </Text>
              </Pressable>
            </View>
            {localReviews.length ? (
              localReviews.map((review, index) => {
                const normalizedRating = clampRatingValue(review.rating);
                return (
                  <View
                    key={review.id || review.created_at || `review-${index}`}
                    style={styles.reviewCard}
                  >
                    <View style={styles.reviewCardHeader}>
                      <Text style={styles.reviewAuthor}>
                        {review.author || t('schoolDetail.reviews.anonymous')}
                      </Text>
                      {review.created_at ? (
                        <Text style={styles.reviewDate}>
                          {formatReviewDate(review.created_at)}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.reviewRatingRow}>
                      <Rating rating={normalizedRating} size={14} />
                      {normalizedRating ? (
                        <Text style={styles.reviewRatingValue}>
                          {normalizedRating.toFixed(1)}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.reviewText}>{review.text}</Text>
                  </View>
                );
              })
            ) : (
              <Text style={styles.reviewEmptyText}>
                {t('schoolDetail.reviews.emptyText')}
              </Text>
            )}
          </ExpandableSection>

          {staffMembers.length ? (
            <ExpandableSection
              iconName="user-tie"
              title={t('schoolDetail.section.staff')}
              isOpen={expanded.staff}
              onToggle={() => toggle('staff')}
            >
              <View style={styles.staffFilters}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.staffFilterRow}>
                    {staffSubjectOptions.map((option) => (
                      <Pressable
                        key={`subject-${option}`}
                        style={[
                          styles.staffFilterChip,
                          staffSubjectFilter === option && styles.staffFilterChipActive,
                        ]}
                        onPress={() => setStaffSubjectFilter(option)}
                      >
                        <Text
                          style={[
                            styles.staffFilterChipText,
                            staffSubjectFilter === option && styles.staffFilterChipTextActive,
                          ]}
                        >
                          {option === 'all' ? t('schoolDetail.staff.filter.allSubjects') : option}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.staffFilterRow}>
                    {['all', '0-3', '3-7', '7-15', '15+'].map((option) => (
                      <Pressable
                        key={`exp-${option}`}
                        style={[
                          styles.staffFilterChip,
                          staffExperienceFilter === option && styles.staffFilterChipActive,
                        ]}
                        onPress={() => setStaffExperienceFilter(option)}
                      >
                        <Text
                          style={[
                            styles.staffFilterChipText,
                            staffExperienceFilter === option && styles.staffFilterChipTextActive,
                          ]}
                        >
                          {option === 'all' ? t('schoolDetail.staff.filter.allExperience') : option}
                        </Text>
                      </Pressable>
                    ))}
                    <Pressable
                      style={[
                        styles.staffFilterChip,
                        staffExamOnly && styles.staffFilterChipActive,
                      ]}
                      onPress={() => setStaffExamOnly((prev) => !prev)}
                    >
                      <Text
                        style={[
                          styles.staffFilterChipText,
                          staffExamOnly && styles.staffFilterChipTextActive,
                        ]}
                      >
                        {t('schoolDetail.staff.filter.examOnly')}
                      </Text>
                    </Pressable>
                  </View>
                </ScrollView>
                {staffLanguageOptions.length > 1 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.staffFilterRow}>
                      {staffLanguageOptions.map((option) => (
                        <Pressable
                          key={`lang-${option}`}
                          style={[
                            styles.staffFilterChip,
                            staffLanguageFilter === option && styles.staffFilterChipActive,
                          ]}
                          onPress={() => setStaffLanguageFilter(option)}
                        >
                          <Text
                            style={[
                              styles.staffFilterChipText,
                              staffLanguageFilter === option && styles.staffFilterChipTextActive,
                            ]}
                          >
                            {option === 'all' ? t('schoolDetail.staff.filter.allLanguages') : option}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                ) : null}
              </View>
              <View style={styles.staffGrid}>
                {filteredStaffMembers.map((member, index) => {
                  const name =
                    member?.full_name ||
                    getLocalizedText(member?.name, locale) ||
                    `${t('schoolDetail.staff.defaultName')} ${index + 1}`;
                  const subjects =
                    member?.subjects ||
                    getLocalizedText(member?.subjects_localized, locale) ||
                    t('schoolDetail.value.unknown');
                  const photoUrl = isValidRemoteImage(member?.photo_url)
                    ? member.photo_url
                    : null;
                  return (
                    <Pressable
                      key={member?.id || `${name}-${index}`}
                      style={styles.staffCard}
                      onPress={() => handleOpenTeacher(member)}
                    >
                      <View style={styles.staffPhotoWrap}>
                        {photoUrl ? (
                          <RNImage source={{ uri: photoUrl }} style={styles.staffPhoto} />
                        ) : (
                          <View style={styles.staffPhotoPlaceholder}>
                            <Text style={styles.staffPhotoPlaceholderText}>
                              {name.slice(0, 1).toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.staffName} numberOfLines={1}>
                        {name}
                      </Text>
                      <Text style={styles.staffSubject} numberOfLines={1}>
                        {subjects}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {!filteredStaffMembers.length ? (
                <Text style={styles.reviewEmptyText}>
                  {t('schoolDetail.staff.filter.empty')}
                </Text>
              ) : null}
            </ExpandableSection>
          ) : null}

          {photos.length ? (
            <View style={styles.mediaSection}>
              <Text style={styles.mediaSectionTitle}>
                {t('schoolDetail.media.photos')}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12 }}
              >
                {photos.slice(0, 12).map((uri, index) => (
                  <Pressable key={uri} onPress={() => handleOpenPhoto(uri, index)}>
                    <RNImage
                      source={{ uri }}
                      style={styles.mediaPhoto}
                      resizeMode="cover"
                    />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {media.videos ? (
            <View style={styles.mediaSection}>
              <Text style={styles.mediaSectionTitle}>
                {t('schoolDetail.media.videos')}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12 }}
              >
                {splitToList(media.videos)
                  .filter(Boolean)
                  .slice(0, 8)
                  .map((url) => {
                    const thumb = getYoutubeThumbnail(url);
                    return (
                      <Pressable
                        key={url}
                        onPress={() => handleOpenVideo(url)}
                        style={styles.mediaCard}
                      >
                        {thumb ? (
                          <RNImage
                            source={{ uri: thumb }}
                            style={styles.mediaThumb}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={[styles.mediaThumb, styles.mediaThumbFallback]}>
                            <Text style={styles.mediaFallbackText}>
                              {t('schoolDetail.media.video')}
                            </Text>
                          </View>
                        )}
                        <Text style={styles.mediaLinkText} numberOfLines={1}>
                          {url}
                        </Text>
                      </Pressable>
                    );
                  })}
              </ScrollView>
            </View>
          ) : null}

          <View style={styles.descriptionCard}>
            <Text style={styles.descriptionTitle}>
              {t('schoolDetail.description.title')}
            </Text>
            <Text style={styles.descriptionText}>
              {getLocalizedText(basic_info?.description, locale).trim() ||
                profile.system?.description ||
                t('schoolDetail.description.empty')}
            </Text>
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>
      </SafeAreaView>
      {isChatFabVisible ? (
        <View style={styles.floatingChatWrap}>
          <Pressable
            onPress={() => setChatFabVisible(false)}
            style={styles.floatingChatClose}
          >
            <XMarkIcon color="#FFFFFF" size={13} />
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('SchoolChat')}
            style={styles.floatingChatButton}
          >
            <ChatBubbleLeftRightIcon color="#FFFFFF" size={24} />
          </Pressable>
          <View style={styles.floatingChatLabel}>
            <Text style={styles.floatingChatLabelText}>AI чат</Text>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => setChatFabVisible(true)}
          style={styles.floatingChatRestore}
        >
          <ChatBubbleLeftRightIcon color="#2563EB" size={16} />
          <Text style={styles.floatingChatRestoreText}>AI чат</Text>
        </Pressable>
      )}
      <Modal
        visible={isReviewModalVisible}
        animationType="fade"
        transparent
        onRequestClose={handleCloseReviewModal}
      >
        <View style={styles.reviewModalBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={12}
            style={styles.modalKeyboardWrap}
          >
            <View style={styles.reviewModalCard}>
              <View style={styles.reviewModalHeader}>
                <Text style={styles.reviewModalTitle}>
                  {t('schoolDetail.reviews.write')}
                </Text>
                <Pressable
                  style={styles.reviewModalClose}
                  onPress={handleCloseReviewModal}
                >
                  <XMarkIcon color="#0F172A" size={20} />
                </Pressable>
              </View>
              <View style={styles.reviewModalField}>
                <Text style={styles.reviewModalLabel}>
                  {t('schoolDetail.reviews.modal.name')}
                </Text>
                <TextInput
                  style={styles.reviewModalInput}
                  placeholder={t('schoolDetail.reviews.modal.namePlaceholder')}
                  placeholderTextColor="rgba(71,85,105,0.6)"
                  value={reviewForm.author}
                  onChangeText={(text) => updateReviewField('author', text)}
                />
              </View>
              <View style={styles.reviewModalField}>
                <Text style={styles.reviewModalLabel}>
                  {t('schoolDetail.reviews.modal.rating')}
                </Text>
                <View style={styles.reviewStarsRow}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Pressable
                      key={value}
                      style={styles.reviewStarButton}
                      onPress={() => updateReviewField('rating', value)}
                    >
                      {value <= reviewForm.rating ? (
                        <FilledStarIcon color="#FBBF24" size={26} />
                      ) : (
                        <OutlineStarIcon color="#CBD5F5" size={26} />
                      )}
                    </Pressable>
                  ))}
                  <Text style={styles.reviewStarValue}>
                    {reviewForm.rating.toFixed ? reviewForm.rating.toFixed(1) : reviewForm.rating}
                  </Text>
                </View>
              </View>
              <View style={styles.reviewModalField}>
                <Text style={styles.reviewModalLabel}>
                  {t('schoolDetail.reviews.modal.feedback')}
                </Text>
                <TextInput
                  style={[styles.reviewModalInput, styles.reviewModalTextarea]}
                  placeholder={t('schoolDetail.reviews.modal.feedbackPlaceholder')}
                  placeholderTextColor="rgba(71,85,105,0.6)"
                  multiline
                  value={reviewForm.text}
                  onChangeText={(text) => updateReviewField('text', text)}
                />
              </View>
              <View style={styles.reviewModalActions}>
                <Pressable
                  style={styles.reviewModalSecondary}
                  onPress={handleCloseReviewModal}
                >
                  <Text style={styles.reviewModalSecondaryText}>
                    {t('schoolDetail.reviews.modal.cancel')}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.reviewModalPrimary,
                    isSubmittingReview && styles.reviewModalPrimaryDisabled,
                  ]}
                  onPress={handleSubmitReview}
                  disabled={isSubmittingReview}
                >
                  <Text style={styles.reviewModalPrimaryText}>
                    {isSubmittingReview
                      ? t('schoolDetail.reviews.modal.sending')
                      : t('schoolDetail.reviews.modal.submit')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        visible={photoModal.visible}
        transparent
        animationType="fade"
        onRequestClose={handleClosePhoto}
      >
        <View style={styles.photoModalBackdrop}>
          <Pressable style={styles.photoNavButton} onPress={handlePhotoPrev}>
            <Text style={styles.photoNavText}>{'‹'}</Text>
          </Pressable>
          <Pressable style={styles.photoNavButtonRight} onPress={handlePhotoNext}>
            <Text style={styles.photoNavText}>{'›'}</Text>
          </Pressable>
          <Pressable
            style={{ flex: 1, width: '100%' }}
            onPress={handleClosePhoto}
          >
            <RNImage
              source={{ uri: photos[photoModal.index] }}
              style={styles.photoModalImage}
              resizeMode="contain"
            />
          </Pressable>
        </View>
      </Modal>

      {allMarkers.length && currentMarker ? (
        <Modal
          visible={isMapExpanded}
          animationType="fade"
          transparent={false}
          onRequestClose={() => setMapExpanded(false)}
        >
          <SafeAreaView style={styles.fullMapSafeArea}>
            <View style={styles.fullMapContainer}>
              <TiledMapView
                markers={mapFilteredMarkers}
                style={styles.fullMap}
                focusPoint={mapFocusPoint}
                highlightMarkerId={mapFocusPoint?.id}
              />
              <View style={styles.fullMapTopOverlay} pointerEvents="box-none">
                <View style={styles.fullMapSearchContainer}>
                  <Pressable
                    style={styles.fullMapCloseButton}
                    onPress={() => setMapExpanded(false)}
                  >
                    <XMarkIcon color="#4F46E5" size={20} />
                  </Pressable>
                <TextInput
                  style={styles.fullMapSearchInput}
                  placeholder={t('schoolDetail.map.searchPlaceholder')}
                  placeholderTextColor="rgba(71,85,105,0.8)"
                  value={mapSearchQuery}
                  onChangeText={handleMapSearchChange}
                  autoCorrect={false}
                  returnKeyType="search"
                  onSubmitEditing={handleMapSearchSubmit}
                />
                  {mapSearchQuery.length ? (
                    <Pressable
                      style={styles.fullMapClearButton}
                      onPress={() => handleMapSearchChange('')}
                      hitSlop={8}
                    >
                      <XMarkIcon color="#94A3B8" size={18} />
                    </Pressable>
                  ) : null}
                </View>

                {mapHasQuery && mapSuggestions.length ? (
                  <ScrollView
                    keyboardShouldPersistTaps="handled"
                    style={styles.fullMapSuggestionsPanel}
                    contentContainerStyle={styles.fullMapSuggestionsContent}
                  >
                    {mapSuggestions.map((marker) => (
                      <Pressable
                        key={marker.id}
                        style={styles.fullMapSuggestionRow}
                        onPress={() => handleMapSuggestionPress(marker)}
                      >
                        <Text style={styles.fullMapSuggestionTitle}>
                          {marker.name}
                        </Text>
                        {marker.address ? (
                          <Text style={styles.fullMapSuggestionSubtitle}>
                            {marker.address}
                          </Text>
                        ) : null}
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : null}

                {mapNoMatches ? (
                  <View style={styles.fullMapNoResultsPill}>
                    <Text style={styles.fullMapNoResultsText}>
                      {`${t('schoolDetail.map.noResults')} "${mapSearchQuery.trim()}"`}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </SafeAreaView>
        </Modal>
      ) : null}

      <Modal
        visible={programModal.visible}
        animationType="fade"
        transparent
        onRequestClose={handleCloseProgramInfo}
      >
        <View style={styles.reviewModalBackdrop}>
          <View style={styles.programModalCard}>
            <View style={styles.reviewModalHeader}>
              <Text style={styles.reviewModalTitle}>
                {programModal.info?.title || programModal.label}
              </Text>
              <Pressable style={styles.reviewModalClose} onPress={handleCloseProgramInfo}>
                <XMarkIcon color="#0F172A" size={20} />
              </Pressable>
            </View>
            <View style={styles.programModalIntro}>
              <Text style={styles.programModalSectionLabel}>
                {programsUiText.whatIs}
              </Text>
              <Text style={styles.programModalText}>
                {programModal.info?.short || ''}
              </Text>
            </View>
            {programModalExpanded ? (
              <ScrollView style={styles.programModalScroll} contentContainerStyle={styles.programModalContent}>
                <DetailRow
                  label={programsUiText.includes}
                  value={programModal.info?.includes}
                  labelColor="#2563EB"
                />
                <DetailRow
                  label={programsUiText.forWho}
                  value={programModal.info?.forWho}
                  labelColor="#2563EB"
                />
                <DetailRow
                  label={programsUiText.workload}
                  value={programModal.info?.workload}
                  labelColor="#2563EB"
                />
                <DetailRow
                  label={programsUiText.outcome}
                  value={programModal.info?.outcome}
                  labelColor="#2563EB"
                />
                <DetailRow
                  label={programsUiText.risks}
                  value={programModal.info?.risks}
                  labelColor="#2563EB"
                />
              </ScrollView>
            ) : null}
            <View style={styles.programModalActions}>
              {!programModalExpanded ? (
                <Pressable
                  style={styles.programModalPrimary}
                  onPress={() => {
                    trackProgramInfoEvent({
                      schoolId: profile?.school_id || basic_info?.name,
                      programName: programModal.label,
                      eventType: 'read_more',
                      locale,
                      expanded: true,
                    });
                    setProgramModalExpanded(true);
                  }}
                >
                  <Text style={styles.programModalPrimaryText}>
                    {programsUiText.details}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                style={styles.programModalSecondary}
                onPress={handleCloseProgramInfo}
              >
                <Text style={styles.programModalSecondaryText}>
                  {programsUiText.close}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={videoModal.visible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseVideo}
      >
        <View style={styles.photoModalBackdrop}>
          <View style={styles.videoModalCard}>
            <Pressable
              style={styles.videoModalClose}
              onPress={handleCloseVideo}
            >
              <Text style={styles.videoModalCloseText}>
                {t('schoolDetail.close')}
              </Text>
            </Pressable>
            <WebView
              source={{ uri: videoModal.url }}
              style={styles.videoModalPlayer}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={teacherModal.visible}
        animationType="fade"
        transparent
        onRequestClose={handleCloseTeacher}
      >
        <View style={styles.reviewModalBackdrop}>
          <View style={styles.teacherModalCard}>
            <View style={styles.teacherModalHeader}>
              <View style={styles.teacherHeaderProfile}>
                {isValidRemoteImage(teacherModal.member?.photo_url) ? (
                  <RNImage
                    source={{ uri: teacherModal.member.photo_url }}
                    style={styles.teacherHeaderPhoto}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.teacherHeaderPhotoFallback}>
                    <Text style={styles.teacherHeaderPhotoFallbackText}>
                      {String(
                        teacherModal.member?.full_name ||
                          t('schoolDetail.staff.defaultName')
                      )
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={styles.teacherModalTitle} numberOfLines={3}>
                  {teacherModal.member?.full_name ||
                    t('schoolDetail.staff.defaultName')}
                </Text>
              </View>
              <Pressable style={styles.teacherModalClose} onPress={handleCloseTeacher}>
                <XMarkIcon color="#0F172A" size={20} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.teacherModalScroll}
              contentContainerStyle={styles.teacherModalContent}
              showsVerticalScrollIndicator
            >
              <View style={styles.teacherMetaList}>
              {teacherModal.member?.position ? (
                <DetailRow
                  label={t('schoolDetail.staff.position')}
                  value={teacherModal.member.position}
                  labelColor="#2563EB"
                />
              ) : null}
              {teacherModal.member?.category ? (
                <DetailRow
                  label={t('schoolDetail.staff.category')}
                  value={teacherModal.member.category}
                  labelColor="#2563EB"
                />
              ) : null}
              {teacherModal.member?.subjects ? (
                <DetailRow
                  label={t('schoolDetail.staff.subjects')}
                  value={teacherModal.member.subjects}
                  labelColor="#2563EB"
                />
              ) : null}
              {teacherModal.member?.teaching_languages ? (
                <DetailRow
                  label={t('schoolDetail.staff.languages')}
                  value={teacherModal.member.teaching_languages}
                  labelColor="#2563EB"
                />
              ) : null}
              {teacherModal.member?.exam_prep ? (
                <DetailRow
                  label={t('schoolDetail.staff.examPrep')}
                  value={teacherModal.member.exam_prep}
                  labelColor="#2563EB"
                />
              ) : null}
                {teacherModal.member?.experience_years ? (
                  <DetailRow
                    label={t('schoolDetail.staff.experience')}
                    value={`${teacherModal.member.experience_years}`}
                    labelColor="#2563EB"
                  />
                ) : null}
                {getLocalizedText(teacherModal.member?.bio, locale) ? (
                  <DetailRow
                    label={t('schoolDetail.staff.bio')}
                    value={getLocalizedText(teacherModal.member.bio, locale)}
                    rowStyle={styles.teacherBioRow}
                    valueStyle={styles.teacherBioValue}
                  />
                ) : null}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showConsultationModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowConsultationModal(false)}
      >
        <View style={styles.consultModalBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={12}
            style={styles.modalKeyboardWrap}
          >
            <View style={styles.consultModalCard}>
              <View style={styles.consultHeader}>
                <Text style={styles.consultTitle}>
                  {t('schoolDetail.consult.title')}
                </Text>
                <Pressable
                  style={styles.consultCloseButton}
                  onPress={() => setShowConsultationModal(false)}
                >
                  <XMarkIcon color="#0F172A" size={20} />
                </Pressable>
              </View>

            <ScrollView
              style={styles.consultScroll}
              contentContainerStyle={styles.consultContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.consultSection}>
                <Text style={styles.consultSectionTitle}>
                  {t('schoolDetail.consult.parentSection')}
                </Text>
                <View style={styles.consultField}>
                  <Text style={styles.consultLabel}>
                    {t('schoolDetail.consult.parentName')} *
                  </Text>
                  <TextInput
                    style={styles.consultInput}
                    value={consultForm.parentName}
                    onChangeText={(text) => updateConsultField('parentName', text)}
                    placeholder={t('schoolDetail.consult.fullName')}
                  />
                </View>
                <View style={styles.consultField}>
                  <Text style={styles.consultLabel}>
                    {t('schoolDetail.consult.phone')} *
                  </Text>
                  <TextInput
                    style={styles.consultInput}
                    value={consultForm.parentPhone}
                    onChangeText={(text) => updateConsultField('parentPhone', text)}
                    placeholder={t('schoolDetail.consult.phonePlaceholder')}
                    keyboardType="phone-pad"
                  />
                </View>
                <View style={styles.consultField}>
                  <Text style={styles.consultLabel}>
                    {t('schoolDetail.consult.emailOptional')}
                  </Text>
                  <TextInput
                    style={styles.consultInput}
                    value={consultForm.parentEmail}
                    onChangeText={(text) => updateConsultField('parentEmail', text)}
                    placeholder={t('schoolDetail.consult.emailPlaceholder')}
                    keyboardType="email-address"
                  />
                </View>
              </View>

              <View style={styles.consultSection}>
                <Text style={styles.consultSectionTitle}>
                  {t('schoolDetail.consult.childSection')}
                </Text>
                <View style={styles.consultField}>
                  <Text style={styles.consultLabel}>
                    {t('schoolDetail.consult.childName')} *
                  </Text>
                  <TextInput
                    style={styles.consultInput}
                    value={consultForm.childName}
                    onChangeText={(text) => updateConsultField('childName', text)}
                    placeholder={t('schoolDetail.consult.fullName')}
                  />
                </View>
                <View style={styles.consultField}>
                  <Text style={styles.consultLabel}>
                    {t('schoolDetail.consult.grade')} *
                  </Text>
                  <View style={styles.consultChipsContainer}>
                    {GRADE_CHOICES.map((grade) => (
                      <Pressable
                        key={grade}
                        style={[
                          styles.consultChip,
                          consultForm.childGrade === grade && styles.consultChipActive,
                        ]}
                        onPress={() => updateConsultField('childGrade', grade)}
                      >
                        <Text
                          style={[
                            styles.consultChipLabel,
                            consultForm.childGrade === grade && styles.consultChipLabelActive,
                          ]}
                        >
                          {grade}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              <View style={styles.consultSection}>
                <Text style={styles.consultSectionTitle}>
                  {t('schoolDetail.consult.extraSection')}
                </Text>
                <View style={styles.consultField}>
                  <Text style={styles.consultLabel}>
                    {t('schoolDetail.consult.type')}
                  </Text>
                  <View style={styles.consultChipsContainer}>
                    {CONSULTATION_TYPE_KEYS.map((typeKey) => (
                      <Pressable
                        key={typeKey}
                        style={[
                          styles.consultChip,
                          consultForm.consultationType === typeKey &&
                            styles.consultChipActive,
                        ]}
                        onPress={() =>
                          updateConsultField('consultationType', typeKey)
                        }
                      >
                        <Text
                          style={[
                            styles.consultChipLabel,
                            consultForm.consultationType === typeKey &&
                              styles.consultChipLabelActive,
                          ]}
                        >
                          {t(typeKey)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={styles.consultField}>
                  <Text style={styles.consultLabel}>
                    {t('schoolDetail.consult.comment')}
                  </Text>
                  <TextInput
                    style={[styles.consultInput, styles.consultTextarea]}
                    value={consultForm.comment}
                    onChangeText={(text) => updateConsultField('comment', text)}
                    placeholder={t('schoolDetail.consult.commentPlaceholder')}
                    multiline
                  />
                </View>
              </View>
            </ScrollView>

              <Pressable
                style={[
                  styles.consultSubmitButton,
                  (!isConsultValid || isSubmittingConsult) && styles.consultSubmitButtonDisabled,
                ]}
                disabled={!isConsultValid || isSubmittingConsult}
                onPress={handleConsultSubmit}
              >
                <Text style={styles.consultSubmitLabel}>
                  {isSubmittingConsult
                    ? t('schoolDetail.consult.sending')
                    : t('schoolDetail.consult.send')}
                </Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 4,
  },
  backText: {
    fontFamily: 'exoSemibold',
    fontSize: 18,
    color: '#111827',
  },
  floatingChatWrap: {
    position: 'absolute',
    right: 24,
    bottom: 96,
    alignItems: 'center',
    zIndex: 40,
  },
  floatingChatClose: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    zIndex: 41,
  },
  floatingChatButton: {
    width: 58,
    height: 58,
    borderRadius: 999,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    shadowColor: '#0F172A',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 7,
  },
  floatingChatLabel: {
    marginTop: 6,
    paddingHorizontal: 10,
    height: 24,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingChatLabelText: {
    fontFamily: 'exoSemibold',
    fontSize: 12,
    color: '#111827',
  },
  floatingChatRestore: {
    position: 'absolute',
    right: 24,
    bottom: 96,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.14)',
    shadowColor: '#0F172A',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
    zIndex: 40,
  },
  floatingChatRestoreText: {
    fontFamily: 'exoSemibold',
    fontSize: 12,
    color: '#111827',
    marginLeft: 8,
  },
  container: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 20,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#101828',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 6,
  },
  logoContainer: {
    width: 96,
    height: 96,
    borderRadius: 26,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  logoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPlaceholderText: {
    fontFamily: 'exoSemibold',
    fontSize: 40,
    color: '#2563EB',
  },
  summaryType: {
    fontFamily: 'exoSemibold',
    fontSize: 14,
    color: '#6366F1',
  },
  summaryTitle: {
    fontFamily: 'exoSemibold',
    fontSize: 22,
    color: '#1F2937',
    textAlign: 'center',
  },
  summaryCity: {
    fontFamily: 'exo',
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  quickStats: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.25)',
    shadowColor: '#101828',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 2,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  statItemImportant: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.28)',
  },
  statIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statText: {
    flex: 1,
    marginLeft: 8,
    fontFamily: 'exo',
    fontSize: 11,
    color: '#6B7280',
  },
  statTextImportant: {
    color: '#6B7280',
  },
  statValue: {
    fontFamily: 'exoSemibold',
    fontSize: 16,
    color: '#111827',
    flexShrink: 1,
    textAlign: 'right',
  },
  statValueImportant: {
    fontFamily: 'exoSemibold',
    color: '#111827',
  },
  statTextCompact: {
    fontSize: 10,
  },
  statValueCompact: {
    fontFamily: 'exoSemibold',
    fontSize: 13,
    color: '#111827',
  },
  mapCard: {
    borderRadius: 20,
    overflow: 'hidden',
    height: 180,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  mapPreviewWrapper: {
    flex: 1,
    height: '100%',
  },
  mapPreview: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  mapPreviewOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 16,
    right: 16,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.75)',
    alignItems: 'center',
  },
  mapPreviewText: {
    fontFamily: 'exo',
    fontSize: 12,
    color: '#F8FAFC',
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPlaceholderText: {
    fontFamily: 'exoSemibold',
    fontSize: 16,
    color: '#2563EB',
  },
  expandableSection: {
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.2)',
    shadowColor: '#101828',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 2,
  },
  expandableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  expandableHeaderTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionIconBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandableHeaderText: {
    fontFamily: 'exoSemibold',
    fontSize: 16,
    color: '#0F172A',
  },
  expandableHeaderChevron: {
    fontFamily: 'exoSemibold',
    fontSize: 14,
    color: '#0F172A',
  },
  expandableBody: {
    paddingHorizontal: 18,
    paddingBottom: 18,
    gap: 10,
  },
  detailRow: {
    gap: 4,
  },
  detailLabel: {
    fontFamily: 'exo',
    fontSize: 11,
    color: '#6B7280',
  },
  detailValue: {
    fontFamily: 'exoSemibold',
    fontSize: 16,
    color: '#111827',
  },
  detailValuePrimary: {
    fontSize: 17,
    color: '#0F172A',
  },
  detailValueLink: {
    fontFamily: 'exoSemibold',
    fontSize: 16,
    color: '#1D4ED8',
    textDecorationLine: 'underline',
  },
  studyingBlock: {
    gap: 8,
  },
  studyingDivider: {
    height: 1,
    backgroundColor: 'rgba(148,163,184,0.22)',
    marginVertical: 2,
  },
  metricCard: {
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.28)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 2,
  },
  metricLabel: {
    fontFamily: 'exo',
    fontSize: 11,
    color: '#6B7280',
  },
  metricValue: {
    fontFamily: 'exoSemibold',
    fontSize: 30,
    lineHeight: 34,
    color: '#111827',
  },
  programsRow: {
    gap: 6,
  },
  programsChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  programChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  programChipActive: {
    borderColor: 'rgba(148,163,184,0.22)',
    backgroundColor: '#EEF2FF',
  },
  programChipPassive: {
    borderColor: 'rgba(148,163,184,0.2)',
    backgroundColor: '#F8FAFC',
  },
  programChipText: {
    fontSize: 12,
  },
  programChipTextActive: {
    fontFamily: 'exoSemibold',
    color: '#1D4ED8',
  },
  programChipTextPassive: {
    fontFamily: 'exo',
    color: '#475569',
  },
  programChipHelp: {
    fontFamily: 'exoSemibold',
    fontSize: 11,
    color: '#2563EB',
    backgroundColor: 'rgba(37,99,235,0.12)',
    borderRadius: 999,
    width: 16,
    height: 16,
    textAlign: 'center',
    textAlignVertical: 'center',
    overflow: 'hidden',
  },
  programHint: {
    fontFamily: 'exo',
    fontSize: 11,
    color: '#94A3B8',
  },
  clubCatalogWrap: {
    gap: 8,
  },
  clubCatalogList: {
    gap: 10,
  },
  clubCatalogCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.2)',
    backgroundColor: '#F8FAFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  clubCatalogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  clubCatalogHeaderMain: {
    flex: 1,
    gap: 2,
  },
  clubCatalogHeaderPrice: {
    fontFamily: 'exoSemibold',
    fontSize: 12,
    color: '#1D4ED8',
  },
  clubCatalogChevron: {
    fontFamily: 'exoSemibold',
    fontSize: 12,
    color: '#475569',
  },
  clubCatalogBody: {
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.24)',
    paddingTop: 8,
  },
  clubCatalogTitle: {
    fontFamily: 'exoSemibold',
    fontSize: 14,
    color: '#0F172A',
  },
  clubCatalogText: {
    fontFamily: 'exo',
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  clubCatalogMeta: {
    fontFamily: 'exo',
    fontSize: 12,
    color: '#475569',
  },
  clubCatalogPrice: {
    fontFamily: 'exoSemibold',
    fontSize: 12,
    color: '#1D4ED8',
  },
  clubCatalogMoreBtn: {
    marginTop: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.32)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubCatalogMoreBtnText: {
    fontFamily: 'exoSemibold',
    fontSize: 13,
    color: '#1D4ED8',
  },
  descriptionCard: {
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: 18,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.2)',
    shadowColor: '#101828',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 2,
  },
  descriptionTitle: {
    fontFamily: 'exoSemibold',
    fontSize: 15,
    color: '#0F172A',
  },
  descriptionText: {
    fontFamily: 'exo',
    fontSize: 14,
    color: '#1F2937',
  },
  reviewsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  reviewSummary: {
    fontFamily: 'exoSemibold',
    fontSize: 14,
    color: '#0F172A',
  },
  reviewButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.2)',
  },
  reviewButtonText: {
    fontFamily: 'exoSemibold',
    fontSize: 13,
    color: '#2563EB',
  },
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.9)',
  },
  reviewCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewAuthor: {
    fontFamily: 'exoSemibold',
    fontSize: 14,
    color: '#0F172A',
  },
  reviewDate: {
    fontFamily: 'exo',
    fontSize: 12,
    color: '#94A3B8',
  },
  reviewRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  reviewRatingValue: {
    marginLeft: 8,
    fontFamily: 'exoSemibold',
    fontSize: 13,
    color: '#0F172A',
  },
  reviewText: {
    marginTop: 10,
    fontFamily: 'exo',
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
  },
  reviewEmptyText: {
    fontFamily: 'exo',
    fontSize: 14,
    color: '#475569',
  },
  staffGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  staffFilters: {
    gap: 8,
    marginBottom: 8,
  },
  staffFilterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 2,
  },
  staffFilterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.26)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  staffFilterChipActive: {
    backgroundColor: 'rgba(79,70,229,0.14)',
    borderColor: '#4F46E5',
  },
  staffFilterChipText: {
    fontFamily: 'exo',
    fontSize: 12,
    color: '#334155',
  },
  staffFilterChipTextActive: {
    fontFamily: 'exoSemibold',
    color: '#4338CA',
  },
  staffCard: {
    width: '48%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.2)',
    backgroundColor: '#F8FAFF',
    padding: 10,
    gap: 8,
  },
  staffPhotoWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  staffPhoto: {
    width: '100%',
    height: '100%',
  },
  staffPhotoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
  },
  staffPhotoPlaceholderText: {
    fontFamily: 'exoSemibold',
    fontSize: 28,
    color: '#4F46E5',
  },
  staffName: {
    fontFamily: 'exoSemibold',
    fontSize: 13,
    color: '#0F172A',
  },
  staffSubject: {
    fontFamily: 'exo',
    fontSize: 12,
    color: '#475569',
  },
  socialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  socialCard: {
    width: 86,
    height: 86,
    borderRadius: 16,
    backgroundColor: '#F8FAFF',
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  socialBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialBadgeText: {
    fontFamily: 'exoSemibold',
    fontSize: 13,
    color: '#4F46E5',
  },
  socialLabel: {
    fontFamily: 'exoSemibold',
    fontSize: 10,
    color: '#1F2937',
    textAlign: 'center',
  },
  primaryButton: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#101828',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 4,
  },
  primaryButtonText: {
    fontFamily: 'exoSemibold',
    fontSize: 16,
    color: '#2563EB',
  },
  consultModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  consultModalCard: {
    borderRadius: 28,
    backgroundColor: '#F8FAFC',
    maxHeight: '90%',
    paddingBottom: 20,
    overflow: 'hidden',
  },
  consultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
  },
  consultTitle: {
    fontFamily: 'exoSemibold',
    fontSize: 18,
    color: '#0F172A',
  },
  consultCloseButton: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.08)',
  },
  consultScroll: {
    paddingHorizontal: 24,
  },
  consultContent: {
    paddingBottom: 20,
    gap: 24,
  },
  consultSection: {
    gap: 12,
  },
  consultSectionTitle: {
    fontFamily: 'exoSemibold',
    fontSize: 16,
    color: '#1F2937',
  },
  consultField: {
    gap: 6,
  },
  consultLabel: {
    fontFamily: 'exo',
    fontSize: 13,
    color: '#475569',
  },
  consultInput: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.4)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'exo',
    fontSize: 15,
    color: '#0F172A',
  },
  consultTextarea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  consultChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  consultChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.4)',
    backgroundColor: '#FFFFFF',
  },
  consultChipActive: {
    borderColor: '#4F46E5',
    backgroundColor: 'rgba(79,70,229,0.12)',
  },
  consultChipLabel: {
    fontFamily: 'exo',
    fontSize: 13,
    color: '#475569',
  },
  consultChipLabelActive: {
    color: '#4F46E5',
    fontFamily: 'exoSemibold',
  },
  consultSubmitButton: {
    marginTop: 8,
    marginHorizontal: 24,
    borderRadius: 999,
    paddingVertical: 14,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
  },
  consultSubmitButtonDisabled: {
    backgroundColor: 'rgba(79,70,229,0.4)',
  },
  consultSubmitLabel: {
    fontFamily: 'exoSemibold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  mediaSection: {
    marginTop: 16,
    marginBottom: 12,
  },
  mediaSectionTitle: {
    fontFamily: 'exoSemibold',
    fontSize: 16,
    color: '#111827',
    marginBottom: 10,
  },
  mediaPhoto: {
    width: 140,
    height: 90,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(94, 139, 255, 0.2)',
    backgroundColor: '#E5E7EB',
  },
  photoModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  photoModalImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  photoNavButton: {
    position: 'absolute',
    left: 12,
    top: '50%',
    marginTop: -24,
    zIndex: 3,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoNavButtonRight: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -24,
    zIndex: 3,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoNavText: {
    fontFamily: 'exoSemibold',
    fontSize: 24,
    color: '#FFFFFF',
  },
  mediaCard: {
    width: 140,
    padding: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(94, 139, 255, 0.2)',
    backgroundColor: '#FFFFFF',
  },
  mediaThumb: {
    width: '100%',
    height: 90,
    borderRadius: 12,
  },
  mediaThumbFallback: {
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaFallbackText: {
    fontFamily: 'exoSemibold',
    fontSize: 12,
    color: '#4B5563',
  },
  mediaLinkText: {
    marginTop: 6,
    fontFamily: 'exo',
    fontSize: 11,
    color: '#374151',
  },
  videoModalCard: {
    width: '100%',
    height: '70%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  videoModalClose: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.7)',
  },
  videoModalCloseText: {
    fontFamily: 'exoSemibold',
    fontSize: 13,
    color: '#FFFFFF',
  },
  videoModalPlayer: {
    flex: 1,
  },
  reviewModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  reviewModalCard: {
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    padding: 24,
    gap: 16,
  },
  modalKeyboardWrap: {
    justifyContent: 'center',
  },
  teacherModalCard: {
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    paddingTop: 20,
    paddingHorizontal: 26,
    paddingBottom: 14,
    maxHeight: '88%',
    overflow: 'hidden',
  },
  teacherModalHeader: {
    position: 'relative',
    justifyContent: 'center',
    minHeight: 72,
    paddingRight: 44,
  },
  teacherHeaderProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 4,
  },
  teacherHeaderPhoto: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
  },
  teacherHeaderPhotoFallback: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teacherHeaderPhotoFallbackText: {
    fontFamily: 'exoSemibold',
    fontSize: 24,
    color: '#4F46E5',
  },
  teacherModalTitle: {
    fontFamily: 'exoSemibold',
    fontSize: 18,
    color: '#0F172A',
    lineHeight: 23,
    flex: 1,
  },
  teacherModalClose: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(148,163,184,0.2)',
  },
  teacherModalScroll: {
    marginTop: 10,
  },
  teacherModalContent: {
    paddingBottom: 14,
    gap: 10,
  },
  teacherMetaList: {
    gap: 12,
    width: '94%',
    alignSelf: 'center',
  },
  teacherBioRow: {
    marginTop: 4,
  },
  teacherBioValue: {
    fontFamily: 'exo',
    fontSize: 15,
    lineHeight: 23,
    color: '#111827',
  },
  programModalCard: {
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 14,
    maxHeight: '88%',
    overflow: 'hidden',
    gap: 12,
  },
  programModalIntro: {
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.18)',
    backgroundColor: '#F8FAFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  programModalSectionLabel: {
    fontFamily: 'exoSemibold',
    fontSize: 12,
    color: '#6B7280',
  },
  programModalText: {
    fontFamily: 'exo',
    fontSize: 14,
    lineHeight: 20,
    color: '#1F2937',
  },
  programModalScroll: {
    maxHeight: 320,
  },
  programModalContent: {
    gap: 10,
    paddingBottom: 6,
  },
  programModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  programModalPrimary: {
    borderRadius: 999,
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  programModalPrimaryText: {
    fontFamily: 'exoSemibold',
    fontSize: 13,
    color: '#FFFFFF',
  },
  programModalSecondary: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.35)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  programModalSecondaryText: {
    fontFamily: 'exoSemibold',
    fontSize: 13,
    color: '#2563EB',
  },
  reviewModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewModalTitle: {
    fontFamily: 'exoSemibold',
    fontSize: 18,
    color: '#0F172A',
  },
  reviewModalClose: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(148,163,184,0.2)',
  },
  reviewModalField: {
    gap: 8,
  },
  reviewModalLabel: {
    fontFamily: 'exo',
    fontSize: 13,
    color: '#475569',
  },
  reviewModalInput: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.4)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'exo',
    fontSize: 15,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  reviewModalTextarea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  reviewStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewStarButton: {
    padding: 4,
  },
  reviewStarValue: {
    marginLeft: 10,
    fontFamily: 'exoSemibold',
    fontSize: 14,
    color: '#0F172A',
  },
  reviewModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  reviewModalSecondary: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.4)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  reviewModalSecondaryText: {
    fontFamily: 'exoSemibold',
    fontSize: 15,
    color: '#2563EB',
  },
  reviewModalPrimary: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    alignItems: 'center',
  },
  reviewModalPrimaryDisabled: {
    opacity: 0.6,
  },
  reviewModalPrimaryText: {
    fontFamily: 'exoSemibold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  fullMapSafeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  fullMapContainer: {
    flex: 1,
  },
  fullMap: {
    flex: 1,
  },
  fullMapHeader: {
    position: 'absolute',
    top: 20,
    left: 16,
    right: 16,
  },
  fullMapTopOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 44,
    paddingHorizontal: 16,
  },
  fullMapCloseButton: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(79,70,229,0.08)',
  },
  fullMapSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    gap: 10,
  },
  fullMapSearchInput: {
    flex: 1,
    fontFamily: 'exo',
    fontSize: 16,
    color: '#0F172A',
  },
  fullMapClearButton: {
    padding: 4,
    borderRadius: 999,
  },
  fullMapSuggestionsPanel: {
    marginTop: 8,
    borderRadius: 22,
    backgroundColor: 'rgba(15,23,42,0.92)',
    maxHeight: 220,
  },
  fullMapSuggestionsContent: {
    paddingVertical: 4,
  },
  fullMapSuggestionRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  fullMapSuggestionTitle: {
    fontFamily: 'exoSemibold',
    fontSize: 15,
    color: '#F8FAFC',
  },
  fullMapSuggestionSubtitle: {
    marginTop: 2,
    fontFamily: 'exo',
    fontSize: 13,
    color: 'rgba(241,245,249,0.72)',
  },
  fullMapNoResultsPill: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  fullMapNoResultsText: {
    fontFamily: 'exo',
    fontSize: 13,
    color: '#0F172A',
  },
});
