import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  loadSchoolsProfiles,
  upsertSchoolProfile,
  deleteSchoolProfile,
} from '../services/schoolsApi';
import { createEmptySchoolProfile } from '../utils/schoolProfileTemplate';
import { useLocale } from './LocaleContext';
import { getLocalizedText } from '../utils/localizedText';
import { splitToList } from '../utils/coordinates';
import {
  CITY_LABEL_KEYS,
  TYPE_LABEL_KEYS,
  translateLabel,
  DISTRICT_LABEL_KEYS,
} from '../utils/schoolLabels';

const SchoolsContext = createContext({
  profiles: [],
  schoolCards: [],
  loading: true,
  refresh: async () => {},
  saveProfile: async () => {},
  deleteProfile: async () => {},
});

const toNumberOrNull = (value) => {
  if (value === null || value === undefined) return null;
  const normalized =
    typeof value === 'string' ? value.trim().replace(',', '.') : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const toIntegerOrZero = (value) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};
const toTimestampOrNull = (value) => {
  if (!value) return null;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : null;
};

const getLocalizedMapText = (value, locale) => {
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

const toSchoolCard = (profile, locale, t) => {
  const safeProfile = profile || {};
  const basic_info = safeProfile.basic_info || {};
  const media = safeProfile.media || {};
  const school_id = safeProfile.school_id || '';
  const displayName =
    getLocalizedText(basic_info.display_name, locale).trim() ||
    getLocalizedText(basic_info.name, locale).trim() ||
    '';
  const serviceArea = safeProfile.location?.service_area;
  const region = getLocalizedMapText(serviceArea, locale);

  const ratingValue =
    toNumberOrNull(safeProfile.reviews?.average_rating) ??
    toNumberOrNull(safeProfile.system?.rating);
  const reviewsCountValue =
    toIntegerOrZero(safeProfile.reviews?.count) ??
    toIntegerOrZero(safeProfile.system?.reviews_count) ??
    0;
  const highlightReview =
    safeProfile.reviews?.highlight ||
    safeProfile.reviews?.items?.[0]?.text ||
    safeProfile.system?.highlight_review ||
    '';
  const licenseDetails = safeProfile.basic_info?.license_details || {};
  const hasLicense =
    Boolean(safeProfile.basic_info?.license_accreditation?.trim?.()) ||
    Boolean(licenseDetails?.number?.trim?.()) ||
    Boolean(licenseDetails?.issued_at?.trim?.()) ||
    Boolean(licenseDetails?.valid_until?.trim?.());
  const hasCertificates = Boolean(safeProfile.media?.certificates?.trim());
  const entranceExamRequired = Boolean(
    safeProfile.education?.entrance_exam?.format &&
      safeProfile.education?.entrance_exam?.format !== 'None'
  ) || Boolean(safeProfile.education?.entrance_exam?.required);
  const curricula = safeProfile.education?.curricula || {};
  const curriculaList = [
    ...(curricula.national || []),
    ...(curricula.international || []),
    ...(curricula.additional || []),
  ];
  const curriculaOtherText = getLocalizedText(curricula.other, locale);
  const curriculaValue = [
    ...curriculaList,
    curriculaOtherText,
  ]
    .filter(Boolean)
    .join(', ');
  const languagesValue = [
    safeProfile.education?.languages,
    getLocalizedText(safeProfile.education?.languages_other, locale),
  ]
    .filter(Boolean)
    .join(', ');
  const subjectsValue = [
    safeProfile.education?.advanced_subjects,
    getLocalizedText(safeProfile.education?.advanced_subjects_other, locale),
  ]
    .filter(Boolean)
    .join(', ');
  const specialistsValue = [
    safeProfile.services?.specialists,
    getLocalizedText(safeProfile.services?.specialists_other, locale),
  ]
    .filter(Boolean)
    .join(', ');
  const clubsValue = [
    safeProfile.services?.clubs,
    getLocalizedMapText(safeProfile.services?.clubs_other, locale),
  ]
    .filter(Boolean)
    .join(', ');
  const latitude = toNumberOrNull(safeProfile.basic_info?.coordinates?.latitude);
  const longitude = toNumberOrNull(safeProfile.basic_info?.coordinates?.longitude);
  const updatedAtRaw =
    safeProfile.system?.updated_at ||
    safeProfile.basic_info?.updated_at ||
    safeProfile.updated_at;
  const updatedAt = updatedAtRaw ? new Date(updatedAtRaw).getTime() : null;
  const monetization = safeProfile.monetization || {};
  const promotionStatus = String(monetization.subscription_status || 'inactive').toLowerCase();
  const promotionStartsAt = toTimestampOrNull(monetization.starts_at);
  const promotionEndsAt = toTimestampOrNull(monetization.ends_at);
  const now = Date.now();
  const promotionDateActive =
    (!promotionStartsAt || promotionStartsAt <= now) &&
    (!promotionEndsAt || promotionEndsAt >= now);
  const isPromotedActive =
    Boolean(monetization.is_promoted) &&
    promotionStatus === 'active' &&
    promotionDateActive;
  const promotionPriority = Number(monetization.priority_weight);

  const cityValue = basic_info.city || '';
  const districtValue = basic_info.district || '';
  const cityLabel = translateLabel(t, CITY_LABEL_KEYS, cityValue);
  const districtLabel =
    DISTRICT_LABEL_KEYS[cityValue] && districtValue
      ? translateLabel(t, DISTRICT_LABEL_KEYS[cityValue], districtValue)
      : districtValue;
  const typeLabel = translateLabel(t, TYPE_LABEL_KEYS, basic_info.type || '');

  const nameFallback = getLocalizedText(basic_info.name, locale);

  return {
    id: school_id || nameFallback || Math.random().toString(36),
    school_id: school_id || '',
    name: displayName || 'Без названия',
    city: cityLabel || '',
    district: districtLabel || '',
    address: getLocalizedText(basic_info.address, locale) || '',
    type: typeLabel || '',
    phone: basic_info.phone || '',
    logo: media.logo || media.logo_local_uri || '',
    region,
    coordinates: latitude != null && longitude != null ? { latitude, longitude } : null,
    languages: languagesValue,
    advancedSubjects: subjectsValue,
    averageClassSize: safeProfile.education?.average_class_size || '',
    clubs: clubsValue,
    curricula: curriculaValue,
    entranceExamRequired,
    rating: ratingValue,
    reviewsCount: reviewsCountValue,
    highlightReview,
    monthlyFee: toNumberOrNull(profile.finance?.monthly_fee),
    updatedAt,
    promotion: {
      isPromotedActive,
      status: promotionStatus,
      planName: typeof monetization.plan_name === 'string' ? monetization.plan_name : '',
      priorityWeight: Number.isFinite(promotionPriority) ? promotionPriority : 0,
      startsAt: monetization.starts_at || '',
      endsAt: monetization.ends_at || '',
    },
    hasLicense,
    hasCertificates,
    servicesFlags: {
      after_school: Boolean(profile.services?.after_school),
      transport: Boolean(profile.services?.transport),
      inclusive_education: Boolean(profile.services?.inclusive_education),
      security: Boolean(profile.services?.safety?.security),
      cameras: Boolean(profile.services?.safety?.cameras),
      access_control: Boolean(profile.services?.safety?.access_control),
      medical_office: Boolean(profile.services?.medical_office),
    },
    meals: profile.services?.meals_status || profile.services?.meals || '',
    specialists: specialistsValue,
  };
};

export const SchoolsProvider = ({ children }) => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const { locale, t } = useLocale();

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await loadSchoolsProfiles();
    setProfiles(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveProfile = useCallback(async (profile) => {
    if (!profile.school_id) {
      throw new Error('school_id is required to save a profile');
    }
    await upsertSchoolProfile(profile);
    setProfiles((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.school_id === profile.school_id
      );
      if (existingIndex === -1) {
        return [...prev, profile];
      }
      const next = [...prev];
      next[existingIndex] = profile;
      return next;
    });
  }, []);

  const deleteProfile = useCallback(async (schoolId) => {
    if (!schoolId) {
      throw new Error('schoolId is required to delete a profile');
    }
    const next = await deleteSchoolProfile(schoolId);
    setProfiles(next);
  }, []);

  const schoolCards = useMemo(
    () => profiles.map((profile) => toSchoolCard(profile, locale, t)),
    [profiles, locale, t]
  );

  const value = useMemo(
    () => ({
      profiles,
      schoolCards,
      loading,
      refresh,
      saveProfile,
      deleteProfile,
      createBlankProfile: (overrides) => createEmptySchoolProfile(overrides),
    }),
    [profiles, schoolCards, loading, refresh, saveProfile, deleteProfile]
  );

  return (
    <SchoolsContext.Provider value={value}>
      {children}
    </SchoolsContext.Provider>
  );
};

export const useSchools = () => useContext(SchoolsContext);
