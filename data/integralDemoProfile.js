import { createEmptySchoolProfile } from '../utils/schoolProfileTemplate';

export const integralDemoProfile = createEmptySchoolProfile({
  school_id: 'SCH-ALM-001',
  basic_info: {
    name: 'Private School «Integral»',
    type: 'Private',
    city: 'Almaty',
    district: 'Bostandyk',
    address: 'Arman street 168, Almaty',
    description:
      'Современная частная школа с уклоном на математику, английский и цифровые навыки.',
    coordinates: {
      latitude: '43.2194',
      longitude: '76.9025',
    },
    phone: '+7 (727) 317-84-77',
    whatsapp_phone: '+7 (701) 000-00-00',
    email: 'info@integral.kz',
    website: 'https://integral.kz',
    founded_year: '2006',
    license_details: {
      number: 'KZ43LAA00012345',
      issued_at: '2024-03-12',
      valid_until: '2028-06-01',
    },
    license_accreditation:
      'Лицензия №KZ43LAA00012345, выдана 12.03.2024, действует до 01.06.2028',
  },
  education: {
    languages: 'Казахский, Русский, Английский',
    grades: '1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11',
    programs: 'State program, Cambridge IGCSE, STEAM',
    curricula: {
      national: [
        'State program (Kazakhstan)',
        'Updated content',
      ],
      international: ['Cambridge IGCSE'],
      additional: ['STEAM'],
      other: '',
    },
    advanced_subjects: 'Математика, Информатика, Английский язык, Физика',
    average_class_size: '18',
    entrance_exam: {
      required: true,
      type: 'Math + English',
      format: 'Written test + interview',
    },
  },
  services: {
    after_school: true,
    meals: 'Платное',
    transport: true,
    inclusive_education: true,
    specialists: 'Психолог, Логопед, Соц.педагог, Тьютор',
    clubs: 'Спорт, Музыка, Робототехника, Дебаты, Театр',
    safety: {
      security: true,
      cameras: true,
      access_control: true,
    },
    medical_office: true,
  },
  finance: {
    monthly_fee: '180000',
    payment_system: 'По месяцам',
    grants_discounts:
      'Скидка 10% второй ребёнок, гранты для победителей олимпиад',
    free_places: false,
  },
  media: {
    photos:
      'https://example.com/integral/photo1.jpg, https://example.com/integral/photo2.jpg',
    videos: 'https://example.com/integral/tour.mp4',
    logo: 'https://example.com/integral/logo.png',
    certificates:
      'https://example.com/integral/certificate-steam.pdf, https://example.com/integral/cambridge-accreditation.pdf',
  },
  location: {
    nearest_metro_stop: 'Станция Сайран',
    nearest_bus_stop: 'Остановка «Улица Арман»',
    distance_to_metro_km: '1.2',
    service_area: 'Бостандыкский район, Алмалы, Ауэзовский район',
  },
  system: {
    created_at: '2025-01-12T09:30',
    updated_at: '2025-01-26T14:05',
    views_count: '1240',
    popularity_score: '86',
    rating: '4.8',
    reviews_count: '2',
    highlight_review:
      'Учителя действительно заинтересованы в успехах детей, а обратная связь с родителями очень быстрая.',
  },
  reviews: {
    average_rating: 4.8,
    count: 2,
    highlight:
      'Учителя действительно заинтересованы в успехах детей, а обратная связь с родителями очень быстрая.',
    items: [
      {
        id: 'rev-integral-1',
        author: 'Айгерим Ж.',
        rating: 5,
        text: 'Учителя действительно заинтересованы в успехах детей, а обратная связь с родителями очень быстрая.',
        created_at: '2024-12-10T08:30:00Z',
      },
      {
        id: 'rev-integral-2',
        author: 'Данил К.',
        rating: 4.5,
        text: 'Школа дала сильную базу по английскому и математике. Хотелось бы больше экскурсий.',
        created_at: '2025-01-05T11:15:00Z',
      },
    ],
  },
});

export const internationalSchoolAlmatyProfile = createEmptySchoolProfile({
  school_id: 'SCH-ALM-ISA',
  basic_info: {
    name: 'International School Almaty',
    type: 'Международная',
    city: 'Алматы',
    address: 'микрорайон Мамыр-4, 11/2, Алматы',
    coordinates: {
      latitude: '43.2001',
      longitude: '76.8920',
    },
    whatsapp_phone: '+7 (708) 111-11-11',
  },
});

export const almatyLyceum134Profile = createEmptySchoolProfile({
  school_id: 'SCH-ALM-L134',
  basic_info: {
    name: 'Алматы Лицей №134',
    type: 'Государственная',
    city: 'Алматы',
    address: 'улица Жарокова 28, Алматы',
    coordinates: {
      latitude: '43.2383',
      longitude: '76.9236',
    },
    whatsapp_phone: '+7 (702) 222-22-22',
  },
});

export const astanaFutureSchoolProfile = createEmptySchoolProfile({
  school_id: 'SCH-AST-001',
  basic_info: {
    name: 'Astana Future School',
    type: 'Private',
    city: 'Астана',
    district: 'Есиль',
    address: 'проспект Кабанбай батыра 15, Астана',
    coordinates: {
      latitude: '51.1325',
      longitude: '71.4035',
    },
    phone: '+7 (7172) 500-100',
    whatsapp_phone: '+7 (701) 555-10-10',
    email: 'info@astanafutureschool.kz',
    website: 'https://astanafutureschool.kz',
  },
  location: {
    service_area: 'Есиль, Байқоныр',
  },
});

export const astanaDigitalLyceumProfile = createEmptySchoolProfile({
  school_id: 'SCH-AST-002',
  basic_info: {
    name: 'Astana Digital Lyceum',
    type: 'International',
    city: 'Астана',
    district: 'Алматы',
    address: 'улица Туркестан 8, Астана',
    coordinates: {
      latitude: '51.1282',
      longitude: '71.4301',
    },
    phone: '+7 (7172) 550-220',
    email: 'hello@adl.edu.kz',
    website: 'https://adl.edu.kz',
  },
  education: {
    programs: 'IB, Cambridge',
  },
  location: {
    service_area: 'Алматы, Есиль',
  },
});

export const astanaScienceGymnasiumProfile = createEmptySchoolProfile({
  school_id: 'SCH-AST-003',
  basic_info: {
    name: 'Гимназия «Science Capital»',
    type: 'State',
    city: 'Астана',
    district: 'Сарыарка',
    address: 'проспект Бухар Жырау 25, Астана',
    coordinates: {
      latitude: '51.1775',
      longitude: '71.4172',
    },
    phone: '+7 (7172) 625-777',
  },
  location: {
    service_area: 'Сарыарка, Нура',
  },
});

export const karagandaSmartSchoolProfile = createEmptySchoolProfile({
  school_id: 'SCH-KRG-001',
  basic_info: {
    name: 'Smart School Karaganda',
    type: 'Private',
    city: 'Караганда',
    district: 'Юго-Восток',
    address: 'проспект Республики 12/2, Караганда',
    coordinates: {
      latitude: '49.8243',
      longitude: '73.1046',
    },
    phone: '+7 (7212) 910-303',
    email: 'contact@smartschoolkrg.kz',
  },
  location: {
    service_area: 'Юго-Восток, Город',
  },
});

export const karagandaTechLyceumProfile = createEmptySchoolProfile({
  school_id: 'SCH-KRG-002',
  basic_info: {
    name: 'Карагандинский Tech Лицей',
    type: 'State',
    city: 'Караганда',
    district: 'Город',
    address: 'улица Ержанова 45, Караганда',
    coordinates: {
      latitude: '49.8078',
      longitude: '73.1021',
    },
    phone: '+7 (7212) 777-818',
  },
  education: {
    advanced_subjects: 'Информатика, Математика',
  },
  location: {
    service_area: 'Город, Сортировка',
  },
});

export const karagandaMinedSchoolProfile = createEmptySchoolProfile({
  school_id: 'SCH-KRG-003',
  basic_info: {
    name: 'Karaganda STEM Academy',
    type: 'Private',
    city: 'Караганда',
    district: 'Майкудук',
    address: 'микрорайон Майкудук 15/1, Караганда',
    coordinates: {
      latitude: '49.8690',
      longitude: '73.1881',
    },
    phone: '+7 (7212) 680-950',
  },
  education: {
    programs: 'STEM, робототехника',
  },
  location: {
    service_area: 'Майкудук, Пришахтинск',
  },
});
