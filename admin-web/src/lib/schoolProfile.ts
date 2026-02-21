export const createFinanceDefaults = () => ({
  monthly_fee: '',
  payment_system: '',
  grants_discounts: '',
  free_places: false,
  funding_state: false,
  funding_self: false,
});

export const createEmptySchoolProfile = (overrides: any = {}) => {
  const base = {
    school_id: '',
    basic_info: {
      name: { ru: '', en: '', kk: '' },
      display_name: { ru: '', en: '', kk: '' },
      type: '',
      city: '',
      district: '',
      address: { ru: '', en: '', kk: '' },
      description: { ru: '', en: '', kk: '' },
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
      languages_other: { ru: '', en: '', kk: '' },
      grades: '',
      programs: { ru: '', en: '', kk: '' },
      curricula: {
        national: [],
        international: [],
        additional: [],
        other: { ru: '', en: '', kk: '' },
      },
      advanced_subjects: '',
      advanced_subjects_other: { ru: '', en: '', kk: '' },
      average_class_size: '',
      entrance_exam: {
        required: false,
        format: '',
        format_other: { ru: '', en: '', kk: '' },
        subjects: '',
        subjects_other: { ru: '', en: '', kk: '' },
        stages: { ru: '', en: '', kk: '' },
      },
    },
    services: {
      after_school: false,
      meals: '',
      meals_status: '',
      meals_times_per_day: '',
      meals_free_until_grade: '',
      meals_notes: { ru: '', en: '', kk: '' },
      foreign_teachers: false,
      foreign_teachers_notes: { ru: '', en: '', kk: '' },
      teaching_staff: {
        photo: '',
        description: { ru: '', en: '', kk: '' },
        members: [],
      },
      transport: false,
      inclusive_education: false,
      specialists: '',
      specialists_other: { ru: '', en: '', kk: '' },
      clubs: '',
      clubs_catalog: [],
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
        kk: {
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
      social_links: {
        instagram: '',
        tiktok: '',
        youtube: '',
        facebook: '',
        vk: '',
        telegram: '',
      },
    },
    location: {
      nearest_metro_stop: { ru: '', en: '', kk: '' },
      nearest_bus_stop: { ru: '', en: '', kk: '' },
      distance_to_metro_km: '',
      service_area: { ru: '', en: '', kk: '' },
    },
    system: {
      reviews_count: 0,
      rating: 0,
      updated_at: '',
      created_at: '',
      is_active: true,
      hidden_from_users: false,
      audit_log: [],
      notifications: [],
    },
  };

  return mergeDeep(base, overrides);
};

const mergeDeep = (target: any, source: any) => {
  const output = { ...target };
  if (!source || typeof source !== 'object') return output;
  Object.keys(source).forEach((key) => {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key])
    ) {
      output[key] = mergeDeep(target[key] || {}, source[key]);
    } else {
      output[key] = source[key];
    }
  });
  return output;
};
