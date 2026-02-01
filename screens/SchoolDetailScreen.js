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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as RNImage } from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSchools } from '../context/SchoolsContext';
import { TiledMapView } from '../components/map';
import { XMarkIcon, StarIcon as OutlineStarIcon } from 'react-native-heroicons/outline';
import { StarIcon as FilledStarIcon } from 'react-native-heroicons/solid';
import { addConsultationRequest } from '../services/consultationRequests';
import Rating from '../components/home/rating';
import { useAuth } from '../context/AuthContext';
import { recordVisit } from '../services/visitHistory';
import { useLocale } from '../context/LocaleContext';
import { getLocalizedText } from '../utils/localizedText';
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

const CONSULTATION_TYPES = [
  'First meeting',
  'Transfer from another school',
  'Question about learning',
  'Other',
];

const GRADE_CHOICES = ['Pre-K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

const initialConsultForm = {
  parentName: '',
  parentPhone: '',
  parentEmail: '',
  childName: '',
  childGrade: '',
  consultationType: CONSULTATION_TYPES[0],
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

const toEnglishType = (value) => {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'частная') return 'Private';
  if (normalized === 'государственная') return 'State';
  if (normalized === 'международная') return 'International';
  return value || '—';
};

const toEnglishPayment = (value) => {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'по месяцам') return 'Per month';
  if (normalized === 'по семестру' || normalized === 'по семестрам') return 'Per semester';
  if (normalized === 'по году' || normalized === 'по годам') return 'Per year';
  return value || '—';
};

const toEnglishCity = (value) => {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'алматы') return 'Almaty';
  if (normalized === 'астана') return 'Astana';
  if (normalized === 'караганда' || normalized === 'карагaнда') return 'Karaganda';
  return value || '—';
};

const toEnglishDistrict = (city, district) => {
  const cityKey = (city || '').trim().toLowerCase();
  const distKey = (district || '').trim().toLowerCase();
  if (cityKey === 'алматы') {
    const map = {
      'алмалы': 'Almaly',
      'ауэзовский': 'Auezov',
      'бостандыкский район': 'Bostandyk',
      'бостандыкский': 'Bostandyk',
      'жетысуский': 'Zhetysu',
      'медеуский': 'Medeu',
      'наурызбайский': 'Nauryzbay',
    };
    return map[distKey] || district || '—';
  }
  if (cityKey === 'астана') {
    const map = {
      'алматы': 'Almaty District',
      'байқоныр': 'Baikonyr',
      'байконур': 'Baikonyr',
      'есиль': 'Yesil',
      'сарыарка': 'Saryarka',
      'нура': 'Nura',
    };
    return map[distKey] || district || '—';
  }
  if (cityKey === 'караганда' || cityKey === 'карагaнда') {
    const map = {
      'город': 'City',
      'майкудук': 'Maikuduk',
      'юго-восток': 'Yugo-Vostok',
      'пришахтинск': 'Prishakhtinsk',
      'сортировка': 'Sortirovka',
    };
    return map[distKey] || district || '—';
  }
  return district || '—';
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

const DetailRow = ({ label, value, labelColor }) => {
  if (!value) return null;

  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, labelColor ? { color: labelColor } : null]}>
        {label}
      </Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
};

const ExpandableSection = ({ icon, title, isOpen, onToggle, children }) => (
  <View style={styles.expandableSection}>
    <Pressable style={styles.expandableHeader} onPress={onToggle}>
      <Text style={styles.expandableHeaderText}>
        {icon} {title}
      </Text>
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

export default function SchoolDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { profiles, saveProfile } = useSchools();
  const { account } = useAuth();
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
    services: false,
    reviews: false,
  });
  const [isMapExpanded, setMapExpanded] = useState(false);
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [mapFocusedMarker, setMapFocusedMarker] = useState(null);
  const [showConsultationModal, setShowConsultationModal] = useState(false);
  const [isSubmittingConsult, setSubmittingConsult] = useState(false);
  const [consultForm, setConsultForm] = useState(initialConsultForm);
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
  const [isSubmittingReview, setSubmittingReview] = useState(false);
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

  const { basic_info, education, services, finance, media, location } =
    profile;

  const languages = [
    ...translateList(
      t,
      LANGUAGE_LABEL_KEYS,
      splitToList(education.languages)
    ),
    getLocalizedText(education.languages_other, locale),
  ].filter(Boolean);
  const programs = splitToList(getLocalizedText(education.programs, locale));
  const curricula = education.curricula || {};
  const curriculaList = [
    ...(curricula.national || []),
    ...(curricula.international || []),
    ...(curricula.additional || []),
  ];
  const curriculaLocalized = [
    ...translateList(t, CURRICULA_LABEL_KEYS, curriculaList),
    getLocalizedText(curricula.other, locale),
  ].filter(Boolean);
  const subjects = [
    ...translateList(
      t,
      SUBJECT_LABEL_KEYS,
      splitToList(education.advanced_subjects)
    ),
    getLocalizedText(education.advanced_subjects_other, locale),
  ].filter(Boolean);
  const specialists = [
    ...translateList(
      t,
      SPECIALIST_LABEL_KEYS,
      splitToList(services.specialists)
    ),
    getLocalizedText(services.specialists_other, locale),
  ].filter(Boolean);
  const clubs = [
    ...translateList(t, CLUB_LABEL_KEYS, splitToList(services.clubs)),
    getLocalizedMapText(services.clubs_other),
  ].filter(Boolean);
  const photos = splitToList(media.photos).filter(isValidRemoteImage);
  const serviceArea = Array.isArray(location.service_area)
    ? location.service_area.join(', ')
    : location.service_area;

  const rawLatitude = parseFloat(basic_info.coordinates?.latitude);
  const rawLongitude = parseFloat(basic_info.coordinates?.longitude);
  const displayType = translateLabel(t, TYPE_LABEL_KEYS, basic_info.type) || basic_info.type || '—';
  const displayPayment = translateLabel(
    t,
    PAYMENT_LABEL_KEYS,
    finance?.payment_system
  );
  const displayCity = translateLabel(t, CITY_LABEL_KEYS, basic_info.city) || basic_info.city || '—';
  const displayDistrict =
    DISTRICT_LABEL_KEYS[basic_info.city] && basic_info.district
      ? translateLabel(
          t,
          DISTRICT_LABEL_KEYS[basic_info.city],
          basic_info.district
        )
      : basic_info.district || '—';
  const displayAddress = getLocalizedText(basic_info.address, locale) || '—';

  const allMarkers = useMemo(() => {
    return profiles
      .map((item) => {
        const lat = parseFloat(item.basic_info.coordinates?.latitude);
        const lon = parseFloat(item.basic_info.coordinates?.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          return null;
        }
        return {
          id: item.school_id || item.basic_info.name,
          name:
            item.basic_info.display_name?.trim?.() ||
            item.basic_info.name,
          address: item.basic_info.address,
          latitude: lat,
          longitude: lon,
        };
      })
      .filter(Boolean);
  }, [profiles]);

  const currentMarker = useMemo(() => {
    if (!profile) {
      return null;
    }
    return (
      allMarkers.find(
        (marker) => marker.id === (profile.school_id || profile.basic_info.name)
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

  const quickStats = [
    { icon: '🏫', label: 'Type', value: displayType },
    {
      icon: '💰',
      label: 'Price',
      value:
        finance?.monthly_fee && finance?.payment_system
          ? `${finance.monthly_fee}/${toEnglishPayment(finance.payment_system)}`
          : finance?.monthly_fee
          ? `${finance.monthly_fee}`
          : '—',
    },
    {
      icon: '📍',
      label: 'Address',
      value: basic_info.address || '—',
    },
    {
      icon: '🏙️',
      label: 'City',
      value: toEnglishCity(basic_info.city),
    },
    {
      icon: '🗺️',
      label: 'District',
      value: toEnglishDistrict(basic_info.city, basic_info.district),
    },
  ];

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

  const handleCloseVideo = () => {
    setVideoModal({ visible: false, url: '' });
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

  const handleConsultSubmit = async () => {
    if (!isConsultValid || isSubmittingConsult) {
      Alert.alert('Fill required fields', 'Parent name, phone and child details are required.');
      return;
    }
    setSubmittingConsult(true);
    Keyboard.dismiss();
    try {
      await addConsultationRequest({
        schoolId: profile.school_id || basic_info.name,
        schoolName:
          basic_info.display_name?.trim?.() || basic_info.name,
        parentName: consultForm.parentName.trim(),
        parentPhone: consultForm.parentPhone.trim(),
        parentEmail: consultForm.parentEmail.trim(),
        childName: consultForm.childName.trim(),
        childGrade: consultForm.childGrade.trim(),
        consultationType: consultForm.consultationType,
        comment: consultForm.comment.trim(),
        whatsappPhone: schoolWhatsApp ? schoolWhatsApp.replace(/\s+/g, '') : '',
      });
      setConsultForm(initialConsultForm);
      setShowConsultationModal(false);
      Alert.alert('Request sent', 'Thanks! Our team will contact you soon.');
    } catch (error) {
      console.warn('consultation submit error', error);
      Alert.alert('Failed to send', 'Please try again later.');
    } finally {
      setSubmittingConsult(false);
    }
  };

  const reviewCountLabel = localReviews.length
    ? `${localReviews.length} review${localReviews.length === 1 ? '' : 's'}`
    : 'No reviews yet';

  const resetReviewForm = () => {
    setReviewForm({ ...initialReviewForm });
  };

  const handleOpenReviewModal = () => {
    resetReviewForm();
    setReviewModalVisible(true);
  };

  const handleCloseReviewModal = () => {
    setReviewModalVisible(false);
    resetReviewForm();
  };

  const updateReviewField = (key, value) => {
    setReviewForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmitReview = async () => {
    const trimmedText = reviewForm.text.trim();
    if (!trimmedText.length) {
      Alert.alert('Write a review', 'Please share a short message about your experience.');
      return;
    }
    const normalizedRating = Math.max(1, Math.min(5, Number(reviewForm.rating) || 5));
    setSubmittingReview(true);
    Keyboard.dismiss();
    const newReview = {
      id: `rev-${Date.now()}`,
      author: reviewForm.author.trim() || 'Anonymous parent',
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
      Alert.alert('Failed to save', 'Please try again later.');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <LinearGradient
      colors={['#7E73F4', '#44C5F5']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{ flex: 1 }}
    >
      <SafeAreaView className="flex-1">
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>{'‹'} Back</Text>
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
                    {(basic_info.display_name || basic_info.name)
                      ?.charAt(0)
                      ?.toUpperCase() || 'S'}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.summaryType}>
              {basic_info.type || 'School'}
            </Text>
            <Text style={styles.summaryTitle}>
              {basic_info.display_name || basic_info.name}
            </Text>
            <Text style={styles.summaryCity}>
              {basic_info.city || 'City not specified'}
            </Text>
          </View>

          <View style={styles.quickStats}>
            {quickStats.map(({ icon, label, value }) => (
          <View key={label} style={styles.statItem}>
            <Text style={styles.statIcon}>{icon}</Text>
            <Text style={styles.statText}>{label}</Text>
            <Text style={styles.statValue}>{value}</Text>
          </View>
        ))}
      </View>

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
                  <Text style={styles.mapPreviewText}>Tap to expand map</Text>
                </View>
              </Pressable>
            ) : (
              <Pressable
                style={styles.mapPlaceholder}
                onPress={() =>
                  openMaps(basic_info.address, rawLatitude, rawLongitude)
                }
              >
                <Text style={styles.mapPlaceholderText}>Open in Maps</Text>
              </Pressable>
            )}
          </View>

          <ExpandableSection
            icon="👩‍🏫"
            title="Studying process"
            isOpen={expanded.studying}
            onToggle={() => toggle('studying')}
          >
            <DetailRow label="Languages" value={languages.join(', ')} labelColor="#2563EB" />
            <DetailRow label="Programs" value={programs.join(', ')} labelColor="#2563EB" />
            {curriculaList.length ? (
              <DetailRow label="Curricula" value={curriculaList.join(', ')} labelColor="#2563EB" />
            ) : null}
            <DetailRow
              label="Advanced subjects"
              value={subjects.join(', ')}
              labelColor="#2563EB"
            />
            <DetailRow
              label="Average class size"
              value={education.average_class_size}
              labelColor="#2563EB"
            />
          </ExpandableSection>

          <ExpandableSection
          icon="ℹ️"
          title="Contact information"
          isOpen={expanded.contacts}
          onToggle={() => toggle('contacts')}
        >
          <DetailRow label="Phone 📞" value={basic_info.phone} labelColor="#2563EB" />
          <DetailRow label="WhatsApp 💬" value={basic_info.whatsapp_phone} labelColor="#2563EB" />
            <DetailRow label="Email ✉️" value={basic_info.email} labelColor="#2563EB" />
            <DetailRow label="Website 🌐" value={basic_info.website} labelColor="#2563EB" />
            <DetailRow label="Address 📍" value={basic_info.address} labelColor="#2563EB" />
            <DetailRow label="District 🗺️" value={basic_info.district} labelColor="#2563EB" />
          </ExpandableSection>

          <ExpandableSection
            icon="✅"
            title="Service & Security"
            isOpen={expanded.services}
            onToggle={() => toggle('services')}
          >
            <DetailRow
              label="After school"
              value={services.after_school ? 'Available' : 'Not available'}
              labelColor="#2563EB"
            />
            <DetailRow label="Meals" value={services.meals} labelColor="#2563EB" />
            <DetailRow
              label="Transport"
              value={services.transport ? 'Available' : 'Not available'}
              labelColor="#2563EB"
            />
            <DetailRow
              label="Inclusive education"
              value={
                services.inclusive_education ? 'Supported' : 'Not supported'
              }
              labelColor="#2563EB"
            />
            <DetailRow
              label="Specialists"
              value={specialists.join(', ')}
              labelColor="#2563EB"
            />
            <DetailRow label="Clubs" value={clubs.join(', ')} labelColor="#2563EB" />
            <DetailRow
              label="Security"
              value={services.safety?.security ? 'Yes' : 'No'}
              labelColor="#2563EB"
            />
            <DetailRow
              label="Cameras"
              value={services.safety?.cameras ? 'Yes' : 'No'}
              labelColor="#2563EB"
            />
            <DetailRow
              label="Access control"
              value={services.safety?.access_control ? 'Yes' : 'No'}
              labelColor="#2563EB"
            />
            <DetailRow
              label="Medical office"
              value={services.medical_office ? 'Available' : 'Not available'}
              labelColor="#2563EB"
            />
          </ExpandableSection>

          <ExpandableSection
            icon="💬"
            title="Reviews"
            isOpen={expanded.reviews}
            onToggle={() => toggle('reviews')}
          >
            <View style={styles.reviewsHeader}>
              <Text style={styles.reviewSummary}>{reviewCountLabel}</Text>
              <Pressable style={styles.reviewButton} onPress={handleOpenReviewModal}>
                <Text style={styles.reviewButtonText}>Write a review</Text>
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
                        {review.author || 'Anonymous parent'}
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
                Be the first to share your experience with this school.
              </Text>
            )}
          </ExpandableSection>

          {photos.length ? (
            <View style={styles.mediaSection}>
              <Text style={styles.mediaSectionTitle}>Photos</Text>
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
              <Text style={styles.mediaSectionTitle}>Videos</Text>
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
                            <Text style={styles.mediaFallbackText}>Video</Text>
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
            <Text style={styles.descriptionTitle}>Description</Text>
            <Text style={styles.descriptionText}>
              {basic_info?.description?.trim?.() ||
                profile.system?.description ||
                'Administrators can add a description of the school here: mission, values, achievements and other important details.'}
            </Text>
          </View>

          <Pressable
            style={styles.primaryButton}
            onPress={() => setShowConsultationModal(true)}
          >
            <Text style={styles.primaryButtonText}>
              Request a consultation
            </Text>
          </Pressable>

          <View style={{ height: 24 }} />
        </ScrollView>
      </SafeAreaView>
      <Modal
        visible={isReviewModalVisible}
        animationType="fade"
        transparent
        onRequestClose={handleCloseReviewModal}
      >
        <View style={styles.reviewModalBackdrop}>
          <View style={styles.reviewModalCard}>
            <View style={styles.reviewModalHeader}>
              <Text style={styles.reviewModalTitle}>Write a review</Text>
              <Pressable
                style={styles.reviewModalClose}
                onPress={handleCloseReviewModal}
              >
                <XMarkIcon color="#0F172A" size={20} />
              </Pressable>
            </View>
            <View style={styles.reviewModalField}>
              <Text style={styles.reviewModalLabel}>Your name</Text>
              <TextInput
                style={styles.reviewModalInput}
                placeholder="Parent full name"
                placeholderTextColor="rgba(71,85,105,0.6)"
                value={reviewForm.author}
                onChangeText={(text) => updateReviewField('author', text)}
              />
            </View>
            <View style={styles.reviewModalField}>
              <Text style={styles.reviewModalLabel}>Rating</Text>
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
              <Text style={styles.reviewModalLabel}>Your feedback *</Text>
              <TextInput
                style={[styles.reviewModalInput, styles.reviewModalTextarea]}
                placeholder="What do you like about this school?"
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
                <Text style={styles.reviewModalSecondaryText}>Cancel</Text>
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
                  {isSubmittingReview ? 'Sending…' : 'Submit'}
                </Text>
              </Pressable>
            </View>
          </View>
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
                    placeholder="Search by name or address"
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
                      {`No schools found for "${mapSearchQuery.trim()}"`}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </SafeAreaView>
        </Modal>
      ) : null}

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
              <Text style={styles.videoModalCloseText}>Close</Text>
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
        visible={showConsultationModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowConsultationModal(false)}
      >
        <View style={styles.consultModalBackdrop}>
          <View style={styles.consultModalCard}>
            <View style={styles.consultHeader}>
              <Text style={styles.consultTitle}>Request a consultation</Text>
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
                <Text style={styles.consultSectionTitle}>Parent</Text>
                <View style={styles.consultField}>
                  <Text style={styles.consultLabel}>Parent name *</Text>
                  <TextInput
                    style={styles.consultInput}
                    value={consultForm.parentName}
                    onChangeText={(text) => updateConsultField('parentName', text)}
                    placeholder="Full name"
                  />
                </View>
                <View style={styles.consultField}>
                  <Text style={styles.consultLabel}>Phone *</Text>
                  <TextInput
                    style={styles.consultInput}
                    value={consultForm.parentPhone}
                    onChangeText={(text) => updateConsultField('parentPhone', text)}
                    placeholder="+7 (___) ___-__-__"
                    keyboardType="phone-pad"
                  />
                </View>
                <View style={styles.consultField}>
                  <Text style={styles.consultLabel}>Email (optional)</Text>
                  <TextInput
                    style={styles.consultInput}
                    value={consultForm.parentEmail}
                    onChangeText={(text) => updateConsultField('parentEmail', text)}
                    placeholder="name@example.com"
                    keyboardType="email-address"
                  />
                </View>
              </View>

              <View style={styles.consultSection}>
                <Text style={styles.consultSectionTitle}>Child</Text>
                <View style={styles.consultField}>
                  <Text style={styles.consultLabel}>Child name *</Text>
                  <TextInput
                    style={styles.consultInput}
                    value={consultForm.childName}
                    onChangeText={(text) => updateConsultField('childName', text)}
                    placeholder="Full name"
                  />
                </View>
                <View style={styles.consultField}>
                  <Text style={styles.consultLabel}>Grade *</Text>
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
                <Text style={styles.consultSectionTitle}>Extra</Text>
                <View style={styles.consultField}>
                  <Text style={styles.consultLabel}>Consultation type</Text>
                  <View style={styles.consultChipsContainer}>
                    {CONSULTATION_TYPES.map((type) => (
                      <Pressable
                        key={type}
                        style={[
                          styles.consultChip,
                          consultForm.consultationType === type && styles.consultChipActive,
                        ]}
                        onPress={() => updateConsultField('consultationType', type)}
                      >
                        <Text
                          style={[
                            styles.consultChipLabel,
                            consultForm.consultationType === type && styles.consultChipLabelActive,
                          ]}
                        >
                          {type}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={styles.consultField}>
                  <Text style={styles.consultLabel}>Comment</Text>
                  <TextInput
                    style={[styles.consultInput, styles.consultTextarea]}
                    value={consultForm.comment}
                    onChangeText={(text) => updateConsultField('comment', text)}
                    placeholder="Tell us more about your request"
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
                {isSubmittingConsult ? 'Sending…' : 'Send request'}
              </Text>
            </Pressable>
          </View>
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
    color: '#FFFFFF',
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
    paddingVertical: 4,
  },
  statIcon: {
    fontSize: 18,
  },
  statText: {
    flex: 1,
    marginLeft: 8,
    fontFamily: 'exoSemibold',
    fontSize: 13,
    color: '#0F172A',
  },
  statValue: {
    fontFamily: 'exo',
    fontSize: 13,
    color: '#0F172A',
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
    fontFamily: 'exoSemibold',
    fontSize: 12,
    textTransform: 'uppercase',
    color: '#475569',
  },
  detailValue: {
    fontFamily: 'exo',
    fontSize: 14,
    color: '#1F2937',
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
    color: '#1F2937',
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
