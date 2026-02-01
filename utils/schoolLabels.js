export const TYPE_LABEL_KEYS = {
  State: 'schools.type.state',
  Private: 'schools.type.private',
  International: 'schools.type.international',
};

export const LANGUAGE_LABEL_KEYS = {
  English: 'schools.language.english',
  Russian: 'schools.language.russian',
  Kazakh: 'schools.language.kazakh',
  Chinese: 'schools.language.chinese',
  French: 'schools.language.french',
  German: 'schools.language.german',
};

export const MEAL_LABEL_KEYS = {
  Free: 'schools.meals.free',
  Paid: 'schools.meals.paid',
  'No meals': 'schools.meals.none',
};

export const PAYMENT_LABEL_KEYS = {
  'Per month': 'schools.payment.per_month',
  'Per semester': 'schools.payment.per_semester',
  'Per year': 'schools.payment.per_year',
};

export const CITY_LABEL_KEYS = {
  Almaty: 'schools.city.almaty',
  Astana: 'schools.city.astana',
  Karaganda: 'schools.city.karaganda',
};

export const DISTRICT_LABEL_KEYS = {
  Almaty: {
    Almaly: 'schools.area.almaty.almaly',
    Auezov: 'schools.area.almaty.auezov',
    Bostandyk: 'schools.area.almaty.bostandyk',
    Zhetysu: 'schools.area.almaty.zhetysu',
    Medeu: 'schools.area.almaty.medeu',
    Nauryzbay: 'schools.area.almaty.nauryzbay',
  },
  Astana: {
    'Almaty District': 'schools.area.astana.almaty_district',
    Baikonyr: 'schools.area.astana.baikonur',
    Yesil: 'schools.area.astana.yesil',
    Saryarka: 'schools.area.astana.saryarka',
    Nura: 'schools.area.astana.nura',
  },
  Karaganda: {
    City: 'schools.area.karaganda.city',
    Maikuduk: 'schools.area.karaganda.maikudyk',
    'Yugo-Vostok': 'schools.area.karaganda.south_east',
    'South-East': 'schools.area.karaganda.south_east',
    Prishakhtinsk: 'schools.area.karaganda.prishakhtinsk',
    Sortirovka: 'schools.area.karaganda.sortirovka',
  },
};

export const CURRICULA_LABEL_KEYS = {
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

export const SUBJECT_LABEL_KEYS = {
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

export const SPECIALIST_LABEL_KEYS = {
  Psychologist: 'schools.specialist.psychologist',
  'Speech therapist': 'schools.specialist.speech_therapist',
  'Social worker': 'schools.specialist.social_worker',
  Tutor: 'schools.specialist.tutor',
  'Special education teacher': 'schools.specialist.special_education_teacher',
  Nurse: 'schools.specialist.nurse',
  Defectologist: 'schools.specialist.defectologist',
};

export const CLUB_GROUP_LABEL_KEYS = {
  sports: 'schools.clubGroup.sports',
  arts: 'schools.clubGroup.arts',
  stem: 'schools.clubGroup.stem',
  language: 'schools.clubGroup.language',
  leadership: 'schools.clubGroup.leadership',
};

export const CLUB_LABEL_KEYS = {
  Football: 'schools.club.football',
  Basketball: 'schools.club.basketball',
  Volleyball: 'schools.club.volleyball',
  Swimming: 'schools.club.swimming',
  Athletics: 'schools.club.athletics',
  Gymnastics: 'schools.club.gymnastics',
  Taekwondo: 'schools.club.taekwondo',
  'Table tennis': 'schools.club.table_tennis',
  Chess: 'schools.club.chess',
  Art: 'schools.club.art',
  Music: 'schools.club.music',
  Choir: 'schools.club.choir',
  Theater: 'schools.club.theater',
  Dance: 'schools.club.dance',
  Photography: 'schools.club.photography',
  Design: 'schools.club.design',
  Robotics: 'schools.club.robotics',
  Programming: 'schools.club.programming',
  '3D modeling': 'schools.club.modeling_3d',
  'Science club': 'schools.club.science',
  'Math club': 'schools.club.math',
  Engineering: 'schools.club.engineering',
  'English club': 'schools.club.english',
  Debate: 'schools.club.debate',
  'Public speaking': 'schools.club.public_speaking',
  Literature: 'schools.club.literature',
  Volunteering: 'schools.club.volunteering',
  Entrepreneurship: 'schools.club.entrepreneurship',
  'Student council': 'schools.club.student_council',
};

export const translateLabel = (t, map, value) =>
  map?.[value] ? t(map[value]) : value;

export const translateList = (t, map, list) =>
  list
    .map((item) => translateLabel(t, map, item))
    .filter((item) => item && item.trim().length);
