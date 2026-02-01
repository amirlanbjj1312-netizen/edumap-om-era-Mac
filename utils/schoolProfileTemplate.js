export const createFinanceDefaults = () => ({
  monthly_fee: '',
  payment_system: '',
  grants_discounts: '',
  free_places: false,
});

const deepMerge = (target, overrides) => {
  const result = Array.isArray(target) ? [...target] : { ...target };

  Object.entries(overrides || {}).forEach(([key, value]) => {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], value);
    } else {
      result[key] = value;
    }
  });

  return result;
};

export const createEmptySchoolProfile = (overrides = {}) => {
  const base = {
    school_id: '',
    basic_info: {
      name: { ru: '', en: '' },
      display_name: { ru: '', en: '' },
      type: '',
      city: '',
      district: '',
      address: { ru: '', en: '' },
      description: { ru: '', en: '' },
      coordinates: {
        latitude: '',
        longitude: '',
      },
      phone: '',
      whatsapp_phone: '',
      email: '',
      website: '',
      founded_year: '',
      license_details: {
        number: '',
        issued_at: '',
        valid_until: '',
      },
      license_accreditation: '',
    },
    education: {
      languages: '',
      languages_other: { ru: '', en: '' },
      grades: '',
      programs: { ru: '', en: '' },
      curricula: {
        national: [],
        international: [],
        additional: [],
        other: { ru: '', en: '' },
      },
      advanced_subjects: '',
      advanced_subjects_other: { ru: '', en: '' },
      average_class_size: '',
      entrance_exam: {
        required: false,
        type: '',
        format: '',
      },
    },
    services: {
      after_school: false,
      meals: '',
      transport: false,
      inclusive_education: false,
      specialists: '',
      specialists_other: { ru: '', en: '' },
      clubs: '',
      clubs_other: {
        ru: {
          sports: '',
          arts: '',
          stem: '',
          language: '',
          leadership: '',
          other: '',
        },
        en: {
          sports: '',
          arts: '',
          stem: '',
          language: '',
          leadership: '',
          other: '',
        },
      },
      safety: {
        security: false,
        cameras: false,
        access_control: false,
      },
      medical_office: false,
    },
    finance: createFinanceDefaults(),
    media: {
      photos: '',
      videos: '',
      logo: '',
      logo_local_uri: '',
      certificates: '',
    },
    location: {
      nearest_metro_stop: '',
      nearest_bus_stop: '',
      distance_to_metro_km: '',
      service_area: '',
    },
    system: {
      created_at: '',
      updated_at: '',
      views_count: '',
      popularity_score: '',
    },
    reviews: {
      average_rating: null,
      count: 0,
      highlight: '',
      items: [],
    },
  };

  return deepMerge(base, overrides);
};
