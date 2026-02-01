import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Alert,
  Modal,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
  Pressable,
  StyleSheet,
  Linking,
  Platform,
  Image as RNImage,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';

import { useSchools } from '../context/SchoolsContext';
import {
  createEmptySchoolProfile,
  createFinanceDefaults,
} from '../utils/schoolProfileTemplate';
import { integralDemoProfile } from '../data/integralDemoProfile';
import { useAuth } from '../context/AuthContext';
import {
  finalizeLocalizedText,
  getLocalizedText,
  normalizeLocalizedText,
  setLocalizedText,
} from '../utils/localizedText';
import { DEFAULT_LOCALE, translate } from '../utils/i18n';
import {
  CLUB_GROUP_LABEL_KEYS,
  CLUB_LABEL_KEYS,
  CURRICULA_LABEL_KEYS,
  DISTRICT_LABEL_KEYS,
  LANGUAGE_LABEL_KEYS,
  MEAL_LABEL_KEYS,
  PAYMENT_LABEL_KEYS,
  SPECIALIST_LABEL_KEYS,
  SUBJECT_LABEL_KEYS,
  TYPE_LABEL_KEYS,
  CITY_LABEL_KEYS,
  translateLabel,
} from '../utils/schoolLabels';

const SCHOOL_TYPES = ['State', 'Private', 'International'];
const GRADIENT_COLORS = ['#786AFF', '#4FCCFF'];
const CITY_OPTIONS = [
  {
    name: 'Almaty',
    districts: [
      'Almaly',
      'Auezov',
      'Bostandyk',
      'Zhetysu',
      'Medeu',
      'Nauryzbay',
    ],
  },
  {
    name: 'Astana',
    districts: ['Almaty District', 'Baikonyr', 'Yesil', 'Saryarka', 'Nura'],
  },
  {
    name: 'Karaganda',
    districts: ['City', 'Maikuduk', 'Yugo-Vostok', 'Prishakhtinsk', 'Sortirovka'],
  },
];
const CITY_NAMES = CITY_OPTIONS.map((option) => option.name);
const MEAL_OPTIONS = ['Free', 'Paid', 'No meals'];
const PAYMENT_SYSTEM_OPTIONS = ['Per month', 'Per semester', 'Per year'];
const RU_TO_EN_CITY = {
  'алматы': 'Almaty',
  'астана': 'Astana',
  'карагaнда': 'Karaganda',
  'караганда': 'Karaganda',
};
const RU_TO_EN_DISTRICT = {
  almaty: {
    'алмалы': 'Almaly',
    'ауэзовский': 'Auezov',
    'бостандыкский': 'Bostandyk',
    'жетысуский': 'Zhetysu',
    'медеуский': 'Medeu',
    'наурызбайский': 'Nauryzbay',
  },
  astana: {
    'алматы': 'Almaty District',
    'байқоныр': 'Baikonyr',
    'байконур': 'Baikonyr',
    'есиль': 'Yesil',
    'сарыарка': 'Saryarka',
    'нура': 'Nura',
  },
  karaganda: {
    'город': 'City',
    'майкудук': 'Maikuduk',
    'юго-восток': 'Yugo-Vostok',
    'пришахтинск': 'Prishakhtinsk',
    'сортировка': 'Sortirovka',
  },
};

const AdminLocaleContext = React.createContext({
  t: (key) => key,
});

const useAdminLocale = () => React.useContext(AdminLocaleContext);

const buildFallbackSchoolId = (value) => {
  const base = (value || 'school')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `local-${base || 'school'}`;
};
const GRADE_OPTIONS = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
];
const TEACHING_LANGUAGE_OPTIONS = [
  'Kazakh',
  'Russian',
  'English',
  'Chinese',
  'French',
  'German',
];
const ADVANCED_SUBJECT_OPTIONS = [
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
const CLUB_GROUPS = {
  sports: {
    label: 'Sports',
    items: [
      'Football',
      'Basketball',
      'Volleyball',
      'Swimming',
      'Athletics',
      'Gymnastics',
      'Taekwondo',
      'Table tennis',
      'Chess',
    ],
  },
  arts: {
    label: 'Arts & creativity',
    items: [
      'Art',
      'Music',
      'Choir',
      'Theater',
      'Dance',
      'Photography',
      'Design',
    ],
  },
  stem: {
    label: 'STEM & tech',
    items: [
      'Robotics',
      'Programming',
      '3D modeling',
      'Science club',
      'Math club',
      'Engineering',
    ],
  },
  language: {
    label: 'Language & debate',
    items: ['English club', 'Debate', 'Public speaking', 'Literature'],
  },
  leadership: {
    label: 'Leadership & community',
    items: ['Volunteering', 'Entrepreneurship', 'Student council'],
  },
};
const CLASS_SIZE_OPTIONS = [
  '10',
  '12',
  '15',
  '18',
  '20',
  '22',
  '24',
  '26',
  '30',
  '35+',
];
const CURRICULA_GROUPS = {
  national: {
    labelKey: 'adminSchool.curriculaGroup.national',
    items: [
      'State program (Kazakhstan)',
      'Updated content',
      'NIS Integrated Program',
      'Cambridge Primary',
      'Cambridge Lower Secondary',
      'Cambridge IGCSE',
      'Cambridge A-Level',
    ],
  },
  international: {
    labelKey: 'adminSchool.curriculaGroup.international',
    items: [
      'IB PYP',
      'STEAM',
      'STEM',
      'Montessori',
      'Waldorf',
      'American Curriculum',
      'British National Curriculum',
    ],
  },
  additional: {
    labelKey: 'adminSchool.curriculaGroup.additional',
    items: ['Bilingual Program', 'Author program'],
  },
};
const CLUB_OTHER_KEYS = [...Object.keys(CLUB_GROUPS), 'other'];

let MapView = null;
let Marker = null;
try {
  // Lazy-load native maps; the screen still works if the module is not installed
  const MapsModule = require('react-native-maps');
  MapView = MapsModule.default;
  Marker = MapsModule.Marker;
} catch (error) {
  MapView = null;
  Marker = null;
}


const generateSchoolId = () =>
  `SCH-${Date.now().toString(36).toUpperCase()}-${Math.floor(
    Math.random() * 1000
  )
    .toString(36)
    .toUpperCase()
    .padStart(3, '0')}`;

const SectionCard = ({ title, description, children }) => (
  <View className="bg-white rounded-2xl border border-bgPurple/15 px-4 py-5 mb-6">
    <Text style={styles.sectionTitle}>{title}</Text>
    {description ? (
      <Text style={styles.sectionDescription}>{description}</Text>
    ) : null}
    <View style={styles.sectionContent}>{children}</View>
  </View>
);

const FormField = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  multiline = false,
}) => (
  <View style={styles.fieldWrapper}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#9CA3AF"
      keyboardType={keyboardType}
      multiline={multiline}
      style={[
        styles.input,
        multiline ? styles.inputMultiline : undefined,
      ]}
    />
  </View>
);

const StaticField = ({ label, value }) => (
  <View style={styles.fieldWrapper}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <View style={styles.staticValue}>
      <Text style={styles.staticValueText}>{value}</Text>
    </View>
  </View>
);

const SelectField = ({
  label,
  value,
  onSelect,
  placeholder,
  options,
  disabled = false,
  getOptionLabel,
}) => {
  const { t } = useAdminLocale();
  const [visible, setVisible] = useState(false);

  const renderOption = (option) =>
    getOptionLabel ? getOptionLabel(option) : option;

  const handleSelect = (option) => {
    onSelect(option);
    setVisible(false);
  };

  const openModal = () => {
    if (disabled) return;
    setVisible(true);
  };

  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        onPress={openModal}
        style={[
          styles.selectContainer,
          disabled ? styles.selectDisabled : undefined,
        ]}
      >
        <Text
          style={[
            styles.selectValue,
            !value ? styles.selectPlaceholder : undefined,
          ]}
          numberOfLines={1}
        >
          {value ? renderOption(value) : placeholder}
        </Text>
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{label}</Text>
            <ScrollView style={styles.modalOptions}>
              {options.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => handleSelect(option)}
                  style={[
                    styles.optionButton,
                    option === value ? styles.optionButtonActive : undefined,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      option === value ? styles.optionTextActive : undefined,
                    ]}
                  >
                    {renderOption(option)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              onPress={() => setVisible(false)}
              style={styles.modalCloseButton}
            >
              <Text style={styles.modalCloseText}>
                {t('adminSchool.action.close')}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const DatePickerField = ({
  label,
  value,
  onChange,
  placeholder,
}) => {
  const { t } = useAdminLocale();
  const [visible, setVisible] = useState(false);
  const parsedValue = parseDateInput(value) || new Date();
  const displayPlaceholder =
    placeholder || t('adminSchool.placeholder.selectDate');

  const handleChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setVisible(false);
    }
    if (event?.type === 'dismissed') {
      return;
    }
    const normalized = normalizeDateValue(selectedDate || parsedValue);
    onChange(normalized);
  };

  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        onPress={() => setVisible((prev) => !prev)}
        style={styles.selectContainer}
      >
        <Text
          style={[
            styles.selectValue,
            !value ? styles.selectPlaceholder : undefined,
          ]}
          numberOfLines={1}
        >
          {value ? formatDateDisplay(value) : displayPlaceholder}
        </Text>
      </Pressable>

      {visible ? (
        <View style={styles.pickerInline}>
          <DateTimePicker
            value={parsedValue}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
            onChange={handleChange}
            style={{ alignSelf: 'flex-start' }}
          />
          {Platform.OS === 'ios' ? (
            <View style={styles.pickerToolbar}>
              <Pressable
                onPress={() => setVisible(false)}
                style={styles.pickerDoneButton}
              >
                <Text style={styles.pickerDoneText}>
                  {t('adminSchool.action.done')}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const CurriculaSelector = ({ value, onChange, locale, getLabel }) => {
  const { t } = useAdminLocale();
  const current = value || {
    national: [],
    international: [],
    additional: [],
    other: { ru: '', en: '' },
  };
  const [expanded, setExpanded] = useState({
    national: true,
    international: true,
    additional: true,
    other: true,
  });

  const toggleItem = (groupKey, item) => {
    const existing = new Set(current[groupKey] || []);
    if (existing.has(item)) {
      existing.delete(item);
    } else {
      existing.add(item);
    }
    onChange({
      ...current,
      [groupKey]: Array.from(existing),
    });
  };

  const toggleGroup = (key) => {
    setExpanded((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <View style={styles.fieldWrapper}>
      {Object.entries(CURRICULA_GROUPS).map(([groupKey, config]) => (
        <View key={groupKey} style={styles.curriculaGroup}>
          <Pressable
            style={styles.curriculaHeaderRow}
            onPress={() => toggleGroup(groupKey)}
          >
            <Text style={styles.curriculaLabel}>
              {config.labelKey ? t(config.labelKey) : config.label}
            </Text>
            <Text style={styles.curriculaArrow}>
              {expanded[groupKey] ? '▲' : '▼'}
            </Text>
          </Pressable>
          {expanded[groupKey]
            ? config.items.map((item) => {
                const selected = current[groupKey]?.includes(item);
                return (
                  <Pressable
                    key={item}
                    onPress={() => toggleItem(groupKey, item)}
                    style={styles.checkboxRow}
                  >
                    <View
                      style={[
                        styles.checkboxBox,
                        selected ? styles.checkboxBoxSelected : undefined,
                      ]}
                    >
                      {selected ? (
                        <Text style={styles.checkboxTick}>✓</Text>
                      ) : null}
                    </View>
                    <Text style={styles.checkboxLabel}>
                      {getLabel ? getLabel(CURRICULA_LABEL_KEYS, item) : item}
                    </Text>
                  </Pressable>
                );
              })
            : null}
        </View>
      ))}
      <View style={styles.curriculaGroup}>
        <Pressable
          style={styles.curriculaHeaderRow}
          onPress={() => toggleGroup('other')}
        >
          <Text style={styles.curriculaLabel}>
            {t('adminSchool.label.otherText')}
          </Text>
          <Text style={styles.curriculaArrow}>
            {expanded.other ? '▲' : '▼'}
          </Text>
        </Pressable>
        {expanded.other ? (
          <TextInput
            value={getLocalizedText(current.other, locale)}
            onChangeText={(text) =>
              onChange({
                ...current,
                other: setLocalizedText(current.other, locale, text),
              })
            }
            placeholder={t('adminSchool.placeholder.otherPrograms')}
            placeholderTextColor="#9CA3AF"
            style={[styles.input, styles.inputMultiline, { minHeight: 64 }]}
            multiline
          />
        ) : null}
      </View>
    </View>
  );
};

const LanguagesSelector = ({
  value,
  otherValue,
  onChange,
  onOtherChange,
  getLabel,
}) => {
  const { t } = useAdminLocale();
  const [otherLanguages, setOtherLanguages] = useState(otherValue || '');

  const toggle = (lang) => {
    const parsed = new Set(
      splitList(value).filter((item) => TEACHING_LANGUAGE_OPTIONS.includes(item))
    );
    if (parsed.has(lang)) {
      parsed.delete(lang);
    } else {
      parsed.add(lang);
    }
    onChange(Array.from(parsed).join(', '));
  };

  const handleOtherChange = (text) => {
    setOtherLanguages(text);
    onOtherChange(text);
  };

  const selectedSet = new Set(
    splitList(value).filter((item) => TEACHING_LANGUAGE_OPTIONS.includes(item))
  );

  useEffect(() => {
    setOtherLanguages(otherValue || '');
  }, [otherValue]);

  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>
        {t('adminSchool.field.teachingLanguages')}
      </Text>
      <View style={styles.curriculaGroup}>
        {TEACHING_LANGUAGE_OPTIONS.map((lang) => {
          const selected = selectedSet.has(lang);
          return (
            <Pressable
              key={lang}
              onPress={() => toggle(lang)}
              style={styles.checkboxRow}
            >
              <View
                style={[
                  styles.checkboxBox,
                  selected ? styles.checkboxBoxSelected : undefined,
                ]}
              >
                {selected ? <Text style={styles.checkboxTick}>✓</Text> : null}
              </View>
              <Text style={styles.checkboxLabel}>
                {getLabel ? getLabel(LANGUAGE_LABEL_KEYS, lang) : lang}
              </Text>
            </Pressable>
          );
        })}
        <Text style={[styles.fieldLabel, { marginTop: 10 }]}>
          {t('adminSchool.label.other')}
        </Text>
        <TextInput
          value={otherLanguages}
          onChangeText={handleOtherChange}
          placeholder={t('adminSchool.placeholder.otherLanguages')}
          placeholderTextColor="#9CA3AF"
          style={[styles.input, styles.inputMultiline, { minHeight: 64 }]}
          multiline
        />
      </View>
    </View>
  );
};

const AdvancedSubjectsSelector = ({
  value,
  otherValue,
  onChange,
  onOtherChange,
  getLabel,
}) => {
  const { t } = useAdminLocale();
  const [otherSubjects, setOtherSubjects] = useState(otherValue || '');
  const [expanded, setExpanded] = useState(true);

  const toggle = (subject) => {
    const parsed = new Set(
      splitList(value).filter((item) =>
        ADVANCED_SUBJECT_OPTIONS.includes(item)
      )
    );
    if (parsed.has(subject)) {
      parsed.delete(subject);
    } else {
      parsed.add(subject);
    }
    onChange(Array.from(parsed).join(', '));
  };

  const handleOtherChange = (text) => {
    setOtherSubjects(text);
    onOtherChange(text);
  };

  const selectedSet = new Set(
    splitList(value).filter((item) =>
      ADVANCED_SUBJECT_OPTIONS.includes(item)
    )
  );

  useEffect(() => {
    setOtherSubjects(otherValue || '');
  }, [otherValue]);

  return (
    <View style={styles.fieldWrapper}>
      <Pressable
        style={styles.curriculaHeaderRow}
        onPress={() => setExpanded((prev) => !prev)}
      >
        <Text style={styles.fieldLabel}>
          {t('adminSchool.field.advancedSubjects')}
        </Text>
        <Text style={styles.curriculaArrow}>{expanded ? '▲' : '▼'}</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.curriculaGroup}>
          {ADVANCED_SUBJECT_OPTIONS.map((subject) => {
            const selected = selectedSet.has(subject);
            return (
              <Pressable
                key={subject}
                onPress={() => toggle(subject)}
                style={styles.checkboxRow}
              >
                <View
                  style={[
                    styles.checkboxBox,
                    selected ? styles.checkboxBoxSelected : undefined,
                  ]}
                >
                {selected ? <Text style={styles.checkboxTick}>✓</Text> : null}
              </View>
              <Text style={styles.checkboxLabel}>
                {getLabel ? getLabel(SUBJECT_LABEL_KEYS, subject) : subject}
              </Text>
            </Pressable>
          );
        })}
          <Text style={[styles.fieldLabel, { marginTop: 10 }]}>
            {t('adminSchool.label.other')}
          </Text>
          <TextInput
            value={otherSubjects}
            onChangeText={handleOtherChange}
            placeholder={t('adminSchool.placeholder.otherSubjects')}
            placeholderTextColor="#9CA3AF"
            style={[styles.input, styles.inputMultiline, { minHeight: 64 }]}
            multiline
          />
        </View>
      ) : null}
    </View>
  );
};

const SpecialistsSelector = ({
  value,
  otherValue,
  onChange,
  onOtherChange,
  getLabel,
}) => {
  const { t } = useAdminLocale();
  const [otherSpecialists, setOtherSpecialists] = useState(otherValue || '');
  const [expanded, setExpanded] = useState(true);
  const selectedSet = useMemo(
    () =>
      new Set(
        splitList(value).filter((item) =>
          SPECIALISTS_OPTIONS.includes(item)
        )
      ),
    [value]
  );

  const toggle = (item) => {
    const next = new Set(selectedSet);
    if (next.has(item)) {
      next.delete(item);
    } else {
      next.add(item);
    }
    onChange(Array.from(next).join(', '));
  };

  const handleOtherChange = (text) => {
    setOtherSpecialists(text);
    onOtherChange(text);
  };

  useEffect(() => {
    setOtherSpecialists(otherValue || '');
  }, [otherValue]);

  return (
    <View style={styles.fieldWrapper}>
      <Pressable
        style={styles.curriculaHeaderRow}
        onPress={() => setExpanded((prev) => !prev)}
      >
        <Text style={styles.fieldLabel}>
          {t('adminSchool.field.specialists')}
        </Text>
        <Text style={styles.curriculaArrow}>{expanded ? '▲' : '▼'}</Text>
      </Pressable>
      {expanded ? (
        <View style={styles.curriculaGroup}>
          {SPECIALISTS_OPTIONS.map((item) => {
            const selected = selectedSet.has(item);
            return (
              <Pressable
                key={item}
                onPress={() => toggle(item)}
                style={styles.checkboxRow}
              >
                <View
                  style={[
                    styles.checkboxBox,
                    selected ? styles.checkboxBoxSelected : undefined,
                  ]}
                >
                {selected ? <Text style={styles.checkboxTick}>✓</Text> : null}
              </View>
              <Text style={styles.checkboxLabel}>
                {getLabel ? getLabel(SPECIALIST_LABEL_KEYS, item) : item}
              </Text>
            </Pressable>
          );
        })}
          <Text style={[styles.fieldLabel, { marginTop: 10 }]}>
            {t('adminSchool.label.other')}
          </Text>
          <TextInput
            value={otherSpecialists}
            onChangeText={handleOtherChange}
            placeholder={t('adminSchool.placeholder.otherSpecialists')}
            placeholderTextColor="#9CA3AF"
            style={[styles.input, styles.inputMultiline, { minHeight: 64 }]}
            multiline
          />
        </View>
      ) : null}
    </View>
  );
};

const ClubsSelector = ({
  value,
  otherMap,
  onChange,
  onOtherMapChange,
  getLabel,
  getGroupLabel,
}) => {
  const { t } = useAdminLocale();
  const [expandedGroups, setExpandedGroups] = useState(() =>
    Object.keys(CLUB_GROUPS).reduce((acc, key) => ({ ...acc, [key]: true }), {})
  );
  const knownItems = useMemo(
    () => Object.values(CLUB_GROUPS).flatMap((group) => group.items),
    []
  );
  const selectedSet = useMemo(
    () => new Set(splitList(value).filter((item) => knownItems.includes(item))),
    [value, knownItems]
  );

  const normalizedOtherMap = useMemo(() => {
    const base = buildEmptyClubsOtherMap();
    if (!otherMap || typeof otherMap !== 'object') return base;
    return CLUB_OTHER_KEYS.reduce(
      (acc, key) => ({ ...acc, [key]: otherMap[key] || '' }),
      base
    );
  }, [otherMap]);

  const toggle = (item) => {
    const next = new Set(selectedSet);
    if (next.has(item)) {
      next.delete(item);
    } else {
      next.add(item);
    }
    onChange(Array.from(next).join(', '));
  };

  const handleOtherChange = (text) => {
    onOtherMapChange({ ...normalizedOtherMap, other: text });
  };

  const handleGroupOtherChange = (groupKey, text) => {
    onOtherMapChange({ ...normalizedOtherMap, [groupKey]: text });
  };

  const toggleGroupExpand = (groupKey) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  const renderGroup = (groupKey, group) => (
    <View key={groupKey} style={styles.curriculaGroup}>
      <Pressable
        style={styles.curriculaHeaderRow}
        onPress={() => toggleGroupExpand(groupKey)}
      >
        <Text style={styles.curriculaLabel}>
          {getGroupLabel ? getGroupLabel(groupKey, group.label) : group.label}
        </Text>
        <Text style={styles.curriculaArrow}>
          {expandedGroups[groupKey] ? '▲' : '▼'}
        </Text>
      </Pressable>
      {expandedGroups[groupKey] ? (
        <>
          {group.items.map((item) => {
            const selected = selectedSet.has(item);
            return (
              <Pressable
                key={item}
                onPress={() => toggle(item)}
                style={styles.checkboxRow}
              >
                <View
                  style={[
                    styles.checkboxBox,
                    selected ? styles.checkboxBoxSelected : undefined,
                  ]}
                >
                  {selected ? <Text style={styles.checkboxTick}>✓</Text> : null}
                </View>
                <Text style={styles.checkboxLabel}>
                  {getLabel ? getLabel(CLUB_LABEL_KEYS, item) : item}
                </Text>
              </Pressable>
            );
          })}
          <Text style={[styles.fieldLabel, { marginTop: 10 }]}>
            {t('adminSchool.label.other')}
          </Text>
          <TextInput
            value={normalizedOtherMap[groupKey] || ''}
            onChangeText={(text) => handleGroupOtherChange(groupKey, text)}
            placeholder={t('adminSchool.placeholder.otherClubsCategory')}
            placeholderTextColor="#9CA3AF"
            style={[styles.input, styles.inputMultiline, { minHeight: 64 }]}
            multiline
          />
        </>
      ) : null}
    </View>
  );

  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{t('adminSchool.field.clubs')}</Text>
      {Object.entries(CLUB_GROUPS).map(([key, group]) =>
        renderGroup(key, group)
      )}
      <View style={styles.curriculaGroup}>
        <Text style={styles.fieldLabel}>{t('adminSchool.label.other')}</Text>
        <TextInput
          value={normalizedOtherMap.other || ''}
          onChangeText={handleOtherChange}
          placeholder={t('adminSchool.placeholder.otherClubs')}
          placeholderTextColor="#9CA3AF"
          style={[styles.input, styles.inputMultiline, { minHeight: 64 }]}
          multiline
        />
      </View>
    </View>
  );
};

const PhotosSelector = ({ value, onChange }) => {
  const { t } = useAdminLocale();
  const [input, setInput] = useState('');
  const list = splitList(value).filter(isValidRemoteImage);

  const handleAdd = () => {
    const trimmed = input.trim();
    if (!isValidRemoteImage(trimmed)) return;
    const next = Array.from(new Set([...list, trimmed])).slice(0, 10);
    onChange(next.join(', '));
    setInput('');
  };

  const handleRemove = (uri) => {
    const next = list.filter((item) => item !== uri);
    onChange(next.join(', '));
  };

  return (
    <View style={[styles.fieldWrapper, { marginTop: 12 }]}>
      <Text style={styles.fieldLabel}>{t('adminSchool.field.photos')}</Text>
      <View style={[styles.row, { alignItems: 'center', marginBottom: 12, marginTop: 4 }]}>
        <View style={[styles.rowItem, styles.rowItemWithSpacing]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={t('adminSchool.placeholder.photoUrl')}
            placeholderTextColor="#9CA3AF"
            style={[styles.input, { height: 50 }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <Pressable style={styles.addButton} onPress={handleAdd}>
          <Text style={styles.addButtonText}>{t('adminSchool.action.add')}</Text>
        </Pressable>
      </View>
      {list.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingVertical: 10 }}
        >
          {list.map((uri) => (
            <View key={uri} style={styles.mediaCard}>
              <RNImage
                source={{ uri }}
                style={styles.mediaThumb}
                resizeMode="cover"
              />
              <Text style={styles.mediaLinkText} numberOfLines={1}>
                {uri}
              </Text>
              <Pressable
                onPress={() => handleRemove(uri)}
                style={styles.mediaRemove}
              >
                <Text style={styles.mediaRemoveText}>
                  {t('adminSchool.action.remove')}
                </Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : (
        <Text style={[styles.fieldLabel, { fontFamily: 'exo', color: '#6B7280' }]}>
          {t('adminSchool.message.photosHint')}
        </Text>
      )}
    </View>
  );
};

const EntranceExamSection = ({ value, onChange }) => {
  const { t } = useAdminLocale();
  const required = Boolean(value?.required);
  const yesLabel = t('schools.exam.yes');
  const noLabel = t('schools.exam.no');
  const displayValue = required
    ? yesLabel
    : value?.required === false
    ? noLabel
    : '';

  const handleSelect = (option) => {
    const nextRequired = option === yesLabel;
    onChange({
      ...value,
      required: nextRequired,
      type: nextRequired ? value?.type || '' : '',
      format: nextRequired ? value?.format || '' : '',
    });
  };

  return (
    <View style={styles.fieldWrapper}>
      <SelectField
        label={t('adminSchool.field.entranceExam')}
        value={displayValue}
        onSelect={handleSelect}
        placeholder={t('adminSchool.placeholder.entranceExamOption')}
        options={[yesLabel, noLabel]}
      />
      {required ? (
        <View style={[styles.curriculaGroup, { marginTop: 8 }]}>
          <FormField
            label={t('adminSchool.field.entranceExamType')}
            value={value?.type || ''}
            onChangeText={(text) =>
              onChange({
                ...value,
                required: true,
                type: text,
              })
            }
            placeholder={t('adminSchool.placeholder.entranceExamType')}
            multiline
          />
          <FormField
            label={t('adminSchool.field.entranceExamFormat')}
            value={value?.format || ''}
            onChangeText={(text) =>
              onChange({
                ...value,
                required: true,
                format: text,
              })
            }
            placeholder={t('adminSchool.placeholder.entranceExamFormat')}
            multiline
          />
        </View>
      ) : null}
    </View>
  );
};

const VideosSelector = ({ value, onChange }) => {
  const { t } = useAdminLocale();
  const [input, setInput] = useState('');
  const list = splitList(value).filter(Boolean);

  const handleAdd = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const next = Array.from(new Set([...list, trimmed])).slice(0, 10);
    onChange(next.join(', '));
    setInput('');
  };

  const handleRemove = (url) => {
    const next = list.filter((item) => item !== url);
    onChange(next.join(', '));
  };

  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{t('adminSchool.field.videos')}</Text>
      <View style={[styles.row, { alignItems: 'center', marginBottom: 12, marginTop: 4 }]}>
        <View style={[styles.rowItem, styles.rowItemWithSpacing]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={t('adminSchool.placeholder.videoUrl')}
            placeholderTextColor="#9CA3AF"
            style={[styles.input, { height: 50 }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <Pressable style={styles.addButton} onPress={handleAdd}>
          <Text style={styles.addButtonText}>{t('adminSchool.action.add')}</Text>
        </Pressable>
      </View>
      {list.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingVertical: 6 }}
        >
          {list.slice(0, 10).map((url) => {
            const thumb = getYoutubeThumbnail(url);
            return (
              <View key={url} style={styles.mediaCard}>
                {thumb ? (
                  <RNImage
                    source={{ uri: thumb }}
                    style={styles.mediaThumb}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.mediaThumb, styles.mediaThumbFallback]}>
                    <Text style={styles.mediaFallbackText}>
                      {t('adminSchool.media.videoLabel')}
                    </Text>
                  </View>
                )}
                <Text style={styles.mediaLinkText} numberOfLines={1}>
                  {url}
                </Text>
                <Pressable
                  onPress={() =>
                    Linking.openURL(url).catch(() =>
                      Alert.alert(
                        t('adminSchool.alert.openVideoTitle'),
                        t('adminSchool.alert.openVideoBody')
                      )
                    )
                  }
                  style={styles.mediaOpen}
                >
                  <Text style={styles.mediaOpenText}>
                    {t('adminSchool.action.open')}
                  </Text>
                </Pressable>
                <Pressable onPress={() => handleRemove(url)} style={styles.mediaRemove}>
                  <Text style={styles.mediaRemoveText}>
                    {t('adminSchool.action.remove')}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <Text style={[styles.fieldLabel, { fontFamily: 'exo', color: '#6B7280' }]}>
          {t('adminSchool.message.videosHint')}
        </Text>
      )}
    </View>
  );
};

const MapPreview = ({ latitude, longitude, address }) => {
  const { t } = useAdminLocale();
  const lat = parseCoordinate(latitude);
  const lng = parseCoordinate(longitude);
  const hasNativeMaps = Boolean(MapView && Marker);
  const addressText = typeof address === 'string' ? address : '';
  const hasCoords =
    lat !== null &&
    lng !== null &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180;
  const hasAddress = Boolean(addressText.trim().length);

  const handleOpenMaps = () => {
    if (!hasCoords && !hasAddress) {
      return;
    }
    const query = hasCoords ? `${lat},${lng}` : addressText.trim();
    const encoded = encodeURIComponent(query);
    const url = Platform.select({
      ios: hasCoords
        ? `http://maps.apple.com/?ll=${lat},${lng}&q=${encoded}`
        : `http://maps.apple.com/?q=${encoded}`,
      android: hasCoords
        ? `geo:${lat},${lng}?q=${encoded}`
        : `geo:0,0?q=${encoded}`,
      default: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
    });

    if (!url) {
      return;
    }

    Linking.openURL(url).catch(() =>
      Alert.alert(
        t('adminSchool.alert.openMapsTitle'),
        t('adminSchool.alert.openMapsBody')
      )
    );
  };

  return (
    <View style={styles.mapWrapper}>
      <Text style={styles.mapTitle}>{t('adminSchool.field.mapPreview')}</Text>
      <View style={styles.mapContainer}>
        {hasCoords && hasNativeMaps ? (
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: lat,
              longitude: lng,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            showsPointsOfInterest={false}
            showsCompass={false}
          >
            <Marker coordinate={{ latitude: lat, longitude: lng }} />
          </MapView>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Text style={styles.mapPlaceholderText}>
              {hasCoords
                ? t('adminSchool.message.mapInstall')
                : t('adminSchool.message.mapAddCoords')}
            </Text>
          </View>
        )}
      </View>
      {hasCoords ? (
        <Pressable
          onPress={handleOpenMaps}
          style={[styles.mapActionButton, { alignSelf: 'flex-start', marginTop: 12 }]}
        >
          <Text style={styles.mapActionText}>{t('adminSchool.action.openMaps')}</Text>
        </Pressable>
      ) : null}
      {!hasNativeMaps && hasCoords ? (
        <Text style={styles.mapHint}>
          {t('adminSchool.message.mapInstallDependency')}
        </Text>
      ) : null}
      {!hasCoords && hasAddress ? (
        <Text style={styles.mapHint}>
          {t('adminSchool.message.mapAddressOnly')}
        </Text>
      ) : null}
    </View>
  );
};

const GradesSelector = ({ label, value, onChange }) => {
  const { t } = useAdminLocale();
  const selected = value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length)
    : [];

  const toggleOption = (option) => {
    const next = new Set(selected);
    if (next.has(option)) {
      next.delete(option);
    } else {
      next.add(option);
    }
    const sorted = Array.from(next).sort(
      (a, b) => Number(a) - Number(b)
    );
    onChange(sorted.join(', '));
  };

  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.checkboxList}>
        {GRADE_OPTIONS.map((option) => {
          const isSelected = selected.includes(option);
          return (
            <Pressable
              key={option}
              style={styles.checkboxRow}
              onPress={() => toggleOption(option)}
            >
              <View
                style={[
                  styles.checkboxBox,
                  isSelected ? styles.checkboxBoxSelected : undefined,
                ]}
              >
                {isSelected ? (
                  <Text style={styles.checkboxTick}>✓</Text>
                ) : null}
              </View>
              <Text style={styles.checkboxLabel}>
                {t('adminSchool.label.grade')} {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.checkboxHint}>
        {t('adminSchool.message.gradesHint')}
      </Text>
    </View>
  );
};

const SwitchField = ({ label, value, onValueChange }) => (
  <View style={styles.switchRow}>
    <Text style={styles.switchLabel}>{label}</Text>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: '#D1D5DB', true: '#4FCCFF' }}
      thumbColor={value ? '#2563EB' : '#F9FAFB'}
    />
  </View>
);

const parseCoordinate = (value) => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim().replace(',', '.');
  if (!trimmed.length) {
    return null;
  }
  const parsed = parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const toIsoDateString = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateInput = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const dotted = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (dotted) {
      const [, day, month, year] = dotted;
      const parsed = new Date(
        Number(year),
        Number(month) - 1,
        Number(day)
      );
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const dashed = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (dashed) {
      const [, year, month, day] = dashed;
      const parsed = new Date(
        Number(year),
        Number(month) - 1,
        Number(day)
      );
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

const formatDateDisplay = (value) => {
  const parsed = parseDateInput(value);
  if (!parsed) return '';
  const day = `${parsed.getDate()}`.padStart(2, '0');
  const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
  const year = parsed.getFullYear();
  return `${day}.${month}.${year}`;
};

const normalizeDateValue = (value) => {
  const parsed = parseDateInput(value);
  if (!parsed) return '';
  return toIsoDateString(parsed);
};

const splitList = (value) => {
  if (!value || typeof value !== 'string') return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length);
};

const buildLicenseSummary = (details, fallbackText = '') => {
  const number = details?.number?.trim?.() || '';
  const issued = formatDateDisplay(details?.issued_at);
  const valid = formatDateDisplay(details?.valid_until);
  const parts = [];
  if (number) parts.push(`License number: ${number}`);
  if (issued) parts.push(`Issued: ${issued}`);
  if (valid) parts.push(`Valid until: ${valid}`);
  const summary = parts.join(' · ');
  return summary || fallbackText?.trim?.() || '';
};

const splitKnownExtras = (value, knownItems) => {
  const parsed = splitList(value);
  const knownSet = new Set(knownItems);
  const selected = parsed.filter((item) => knownSet.has(item));
  const extras = parsed.filter((item) => !knownSet.has(item));
  return { selected, extras };
};

const hasLocalizedContent = (value) => {
  const normalized = normalizeLocalizedText(value);
  return Boolean(normalized.ru.trim() || normalized.en.trim());
};

const buildEmptyClubsOtherMap = () =>
  CLUB_OTHER_KEYS.reduce((acc, key) => ({ ...acc, [key]: '' }), {});

const normalizeClubsOther = (value) => {
  if (!value) {
    return { ru: buildEmptyClubsOtherMap(), en: buildEmptyClubsOtherMap() };
  }
  if (typeof value === 'string') {
    return {
      ru: { ...buildEmptyClubsOtherMap(), other: value },
      en: { ...buildEmptyClubsOtherMap(), other: value },
    };
  }
  const normalizeLocale = (map) => {
    if (!map || typeof map !== 'object') return buildEmptyClubsOtherMap();
    return CLUB_OTHER_KEYS.reduce(
      (acc, key) => ({
        ...acc,
        [key]: typeof map[key] === 'string' ? map[key] : '',
      }),
      {}
    );
  };
  return {
    ru: normalizeLocale(value.ru),
    en: normalizeLocale(value.en),
  };
};

const finalizeClubsOther = (value, primaryLocale) => {
  const normalized = normalizeClubsOther(value);
  const trimLocale = (map) =>
    CLUB_OTHER_KEYS.reduce(
      (acc, key) => ({
        ...acc,
        [key]: (map[key] || '').trim(),
      }),
      {}
    );
  const trimmed = {
    ru: trimLocale(normalized.ru),
    en: trimLocale(normalized.en),
  };
  const otherLocale = primaryLocale === 'en' ? 'ru' : 'en';
  const hasOther = CLUB_OTHER_KEYS.some(
    (key) => trimmed[otherLocale][key]
  );
  if (!hasOther) {
    trimmed[otherLocale] = { ...trimmed[primaryLocale] };
  }
  return trimmed;
};

export default function AdminSchoolInfoScreen() {
  const { profiles, saveProfile } = useSchools();
  const { account } = useAuth();
  const [contentLocale, setContentLocale] = useState(DEFAULT_LOCALE);
  const t = useMemo(() => (key) => translate(contentLocale, key), [contentLocale]);

  const getLabel = (map, value) => translateLabel(t, map, value);
  const getCityLabel = (value) => getLabel(CITY_LABEL_KEYS, value);
  const getDistrictLabel = (city, value) =>
    DISTRICT_LABEL_KEYS[city]
      ? getLabel(DISTRICT_LABEL_KEYS[city], value)
      : value;
  const targetSchoolId =
    account?.school_id ||
    buildFallbackSchoolId(account?.email || account?.organization);

  const derivedProfile = useMemo(() => {
    if (profiles.length === 0) {
      return createEmptySchoolProfile({
        ...integralDemoProfile,
        school_id: targetSchoolId,
        basic_info: {
          ...integralDemoProfile.basic_info,
          name: normalizeLocalizedText(
            account?.organization || integralDemoProfile.basic_info.name
          ),
          display_name: normalizeLocalizedText(
            integralDemoProfile.basic_info.display_name || ''
          ),
        },
      });
    }
    const existing = profiles.find(
      (item) => item.school_id === targetSchoolId
    );
    if (existing) {
      return createEmptySchoolProfile(existing);
    }
    return createEmptySchoolProfile({
      school_id: targetSchoolId,
      basic_info: {
        name: normalizeLocalizedText(account?.organization || ''),
        display_name: normalizeLocalizedText(''),
      },
    });
  }, [profiles, targetSchoolId, account?.organization]);

  const normalizeProfile = (profile) => {
    const next = createEmptySchoolProfile(profile || {});
    next.basic_info = {
      ...next.basic_info,
      name: normalizeLocalizedText(next.basic_info.name),
      display_name: normalizeLocalizedText(next.basic_info.display_name),
      address: normalizeLocalizedText(next.basic_info.address),
      description: normalizeLocalizedText(next.basic_info.description),
    };
    next.education = {
      ...next.education,
      programs: normalizeLocalizedText(next.education.programs),
      languages_other: normalizeLocalizedText(next.education.languages_other),
      advanced_subjects_other: normalizeLocalizedText(
        next.education.advanced_subjects_other
      ),
      curricula: {
        ...next.education.curricula,
        other: normalizeLocalizedText(next.education.curricula?.other),
      },
    };
    next.services = {
      ...next.services,
      specialists_other: normalizeLocalizedText(next.services.specialists_other),
      clubs_other: normalizeClubsOther(next.services.clubs_other),
    };

    const languageSplit = splitKnownExtras(
      next.education.languages,
      TEACHING_LANGUAGE_OPTIONS
    );
    next.education.languages = languageSplit.selected.join(', ');
    if (!hasLocalizedContent(next.education.languages_other) && languageSplit.extras.length) {
      const extraText = languageSplit.extras.join(', ');
      next.education.languages_other = { ru: extraText, en: extraText };
    }

    const subjectSplit = splitKnownExtras(
      next.education.advanced_subjects,
      ADVANCED_SUBJECT_OPTIONS
    );
    next.education.advanced_subjects = subjectSplit.selected.join(', ');
    if (
      !hasLocalizedContent(next.education.advanced_subjects_other) &&
      subjectSplit.extras.length
    ) {
      const extraText = subjectSplit.extras.join(', ');
      next.education.advanced_subjects_other = { ru: extraText, en: extraText };
    }

    const specialistsSplit = splitKnownExtras(
      next.services.specialists,
      SPECIALISTS_OPTIONS
    );
    next.services.specialists = specialistsSplit.selected.join(', ');
    if (
      !hasLocalizedContent(next.services.specialists_other) &&
      specialistsSplit.extras.length
    ) {
      const extraText = specialistsSplit.extras.join(', ');
      next.services.specialists_other = { ru: extraText, en: extraText };
    }

    const clubOptions = Object.values(CLUB_GROUPS).flatMap(
      (group) => group.items
    );
    const clubsSplit = splitKnownExtras(next.services.clubs, clubOptions);
    next.services.clubs = clubsSplit.selected.join(', ');
    const clubsOtherHasContent = CLUB_OTHER_KEYS.some(
      (key) => next.services.clubs_other?.ru?.[key] || next.services.clubs_other?.en?.[key]
    );
    if (!clubsOtherHasContent && clubsSplit.extras.length) {
      const extraText = clubsSplit.extras.join(', ');
      next.services.clubs_other = normalizeClubsOther(extraText);
    }

    return next;
  };

  const [form, setForm] = useState(() =>
    normalizeProfile(derivedProfile || createEmptySchoolProfile({}))
  );
  const isPrivateSchool = useMemo(() => {
    const normalized = (form.basic_info.type || '').trim().toLowerCase();
    return normalized === 'private' || normalized === 'частная';
  }, [form.basic_info.type]);
  const licenseDetails = form.basic_info.license_details || {};
  const availableDistricts = useMemo(() => {
    const match = CITY_OPTIONS.find(
      (option) => option.name === form.basic_info.city
    );
    return match ? match.districts : [];
  }, [form.basic_info.city]);

  const handleCitySelect = (value) => {
    setForm((prev) => ({
      ...prev,
      basic_info: {
        ...prev.basic_info,
        city: value,
        district: '',
      },
    }));
  };

  useEffect(() => {
    if (derivedProfile) {
      const normalizedProfile = normalizeProfile(derivedProfile);
      const normalizedCity = RU_TO_EN_CITY[derivedProfile.basic_info.city?.trim?.().toLowerCase?.()] || derivedProfile.basic_info.city;
      const cityKey = normalizedCity?.toLowerCase?.();
      const distMap = cityKey ? RU_TO_EN_DISTRICT[cityKey] : null;
      const normalizedDistrict =
        distMap?.[derivedProfile.basic_info.district?.trim?.().toLowerCase?.()] ||
        derivedProfile.basic_info.district;

      setForm(
        normalizeProfile({
          ...normalizedProfile,
          basic_info: {
            ...normalizedProfile.basic_info,
            city: normalizedCity || normalizedProfile.basic_info.city,
            district: normalizedDistrict || normalizedProfile.basic_info.district,
          },
        })
      );
    }
  }, [derivedProfile]);

  useEffect(() => {
    if (!form.school_id && targetSchoolId) {
      setForm((prev) => ({
        ...prev,
        school_id: targetSchoolId,
      }));
    }
  }, [form.school_id, targetSchoolId]);

  const handleTypeSelect = (value) => {
    setForm((prev) => ({
      ...prev,
      basic_info: {
        ...prev.basic_info,
        type: value,
      },
      finance:
        value === 'Private' ? prev.finance : createFinanceDefaults(),
    }));
  };

  const updateRootField = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const updateSectionField = (section, key, value) => {
    setForm((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
  };

  const updateLocalizedSectionField = (section, key, value) => {
    setForm((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: setLocalizedText(prev[section][key], contentLocale, value),
      },
    }));
  };

  const updateNestedSectionField = (section, nestedSection, key, value) => {
    setForm((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [nestedSection]: {
          ...prev[section][nestedSection],
          [key]: value,
        },
      },
    }));
  };

  const updateLocalizedNestedSectionField = (
    section,
    nestedSection,
    key,
    value
  ) => {
    setForm((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [nestedSection]: {
          ...prev[section][nestedSection],
          [key]: setLocalizedText(
            prev[section][nestedSection][key],
            contentLocale,
            value
          ),
        },
      },
    }));
  };

  const updateClubsOther = (nextMap) => {
    setForm((prev) => {
      const normalized = normalizeClubsOther(prev.services?.clubs_other);
      return {
        ...prev,
        services: {
          ...prev.services,
          clubs_other: {
            ...normalized,
            [contentLocale]: {
              ...normalized[contentLocale],
              ...nextMap,
            },
          },
        },
      };
    });
  };

  const handleSave = async () => {
    const ensuredId = form.school_id.trim() || generateSchoolId();
    const normalizedLicenseDetails = {
      number: form.basic_info.license_details?.number?.trim?.() || '',
      issued_at: normalizeDateValue(form.basic_info.license_details?.issued_at),
      valid_until: normalizeDateValue(
        form.basic_info.license_details?.valid_until
      ),
    };
    const licenseSummary = buildLicenseSummary(
      normalizedLicenseDetails,
      form.basic_info.license_accreditation
    );

    const safeProfile = createEmptySchoolProfile({
      ...form,
      school_id: ensuredId,
      basic_info: {
        ...form.basic_info,
        name: finalizeLocalizedText(form.basic_info.name, contentLocale),
        display_name: finalizeLocalizedText(
          form.basic_info.display_name,
          contentLocale
        ),
        type: form.basic_info.type.trim(),
        city: form.basic_info.city.trim(),
        district: form.basic_info.district.trim(),
        address: finalizeLocalizedText(form.basic_info.address, contentLocale),
        description: finalizeLocalizedText(
          form.basic_info.description,
          contentLocale
        ),
        coordinates: {
          latitude: form.basic_info.coordinates.latitude.trim(),
          longitude: form.basic_info.coordinates.longitude.trim(),
        },
        phone: form.basic_info.phone.trim(),
        email: form.basic_info.email.trim(),
        website: form.basic_info.website.trim(),
        founded_year: form.basic_info.founded_year.trim(),
        license_details: normalizedLicenseDetails,
        license_accreditation: licenseSummary,
      },
      education: {
        ...form.education,
        languages: form.education.languages.trim(),
        grades: form.education.grades.trim(),
        programs: finalizeLocalizedText(form.education.programs, contentLocale),
        languages_other: finalizeLocalizedText(
          form.education.languages_other,
          contentLocale
        ),
        curricula: {
          national: form.education.curricula?.national || [],
          international: form.education.curricula?.international || [],
          additional: form.education.curricula?.additional || [],
          other: finalizeLocalizedText(
            form.education.curricula?.other,
            contentLocale
          ),
        },
        advanced_subjects: form.education.advanced_subjects.trim(),
        advanced_subjects_other: finalizeLocalizedText(
          form.education.advanced_subjects_other,
          contentLocale
        ),
        average_class_size: form.education.average_class_size.trim(),
        entrance_exam: {
          required: Boolean(form.education.entrance_exam?.required),
          type: form.education.entrance_exam?.type?.trim?.() || '',
          format: form.education.entrance_exam?.format?.trim?.() || '',
        },
      },
      services: {
        ...form.services,
        meals: form.services.meals.trim(),
        specialists: form.services.specialists.trim(),
        specialists_other: finalizeLocalizedText(
          form.services.specialists_other,
          contentLocale
        ),
        clubs: form.services.clubs.trim(),
        clubs_other: finalizeClubsOther(form.services.clubs_other, contentLocale),
      },
      finance: {
        ...form.finance,
        monthly_fee: form.finance.monthly_fee.trim(),
        payment_system: form.finance.payment_system.trim(),
        grants_discounts: form.finance.grants_discounts.trim(),
        free_places: Boolean(form.finance.free_places),
      },
      media: {
        ...form.media,
        photos: form.media.photos.trim(),
        videos: form.media.videos.trim(),
        logo: form.media.logo.trim(),
        logo_local_uri: form.media.logo_local_uri?.trim?.() || form.media.logo_local_uri,
        certificates: form.media.certificates.trim(),
      },
      location: {
        ...form.location,
        nearest_metro_stop: form.location.nearest_metro_stop.trim(),
        nearest_bus_stop: form.location.nearest_bus_stop.trim(),
        distance_to_metro_km: form.location.distance_to_metro_km.trim(),
        service_area: form.location.service_area.trim(),
      },
      system: {
        ...form.system,
        created_at: form.system.created_at.trim(),
        updated_at:
          form.system.updated_at.trim() || new Date().toISOString(),
        views_count: form.system.views_count.trim(),
        popularity_score: form.system.popularity_score.trim(),
      },
    });

    try {
      await saveProfile(safeProfile);
      setForm(safeProfile);
      Alert.alert(
        t('adminSchool.alert.saveSuccessTitle'),
        t('adminSchool.alert.saveSuccessBody')
      );
    } catch (error) {
      console.warn('Failed to save school profile', error);
      Alert.alert(
        t('adminSchool.alert.saveErrorTitle'),
        t('adminSchool.alert.saveErrorBody')
      );
    }
  };

  return (
    <AdminLocaleContext.Provider value={{ t }}>
      <View style={styles.screen}>
        <LinearGradient
          colors={GRADIENT_COLORS}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.gradient}
        />
        <SafeAreaView style={styles.safeArea}>
          <ScrollView
            className="px-6 pt-6"
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            <Text className="text-white font-exoSemibold text-3xl mb-4">
              {t('adminSchool.title')}
            </Text>
        <View style={styles.localeToggle}>
          {['ru', 'en'].map((lang) => {
            const isActive = contentLocale === lang;
            return (
              <Pressable
                key={lang}
                onPress={() => setContentLocale(lang)}
                style={[
                  styles.localeChip,
                  isActive ? styles.localeChipActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.localeChipText,
                    isActive ? styles.localeChipTextActive : null,
                  ]}
                >
                  {lang.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <SectionCard
          title={t('adminSchool.section.identifier.title')}
          description={t('adminSchool.section.identifier.description')}
        >
          <StaticField
            label={t('adminSchool.field.schoolId')}
            value={form.school_id || '—'}
          />
        </SectionCard>

        <SectionCard
          title={t('adminSchool.section.basic.title')}
          description={t('adminSchool.section.basic.description')}
        >
          <FormField
            label={t('adminSchool.field.name')}
            value={getLocalizedText(form.basic_info.name, contentLocale)}
            onChangeText={(value) =>
              updateLocalizedSectionField('basic_info', 'name', value)
            }
            placeholder={t('adminSchool.placeholder.name')}
          />
          <FormField
            label={t('adminSchool.field.displayName')}
            value={getLocalizedText(form.basic_info.display_name, contentLocale)}
            onChangeText={(value) =>
              updateLocalizedSectionField('basic_info', 'display_name', value)
            }
            placeholder={t('adminSchool.placeholder.displayName')}
          />
          <SelectField
            label={t('adminSchool.field.type')}
            value={form.basic_info.type}
            onSelect={handleTypeSelect}
            placeholder={t('adminSchool.placeholder.selectType')}
            options={SCHOOL_TYPES}
            getOptionLabel={(option) =>
              getLabel(TYPE_LABEL_KEYS, option) || option
            }
          />
          <View style={styles.curriculaGroup}>
            <Text style={styles.fieldLabel}>
              {t('adminSchool.label.tuition')}
            </Text>
            <FormField
              label={t('adminSchool.field.monthlyFee')}
              value={form.finance.monthly_fee}
              onChangeText={(value) =>
                updateSectionField('finance', 'monthly_fee', value)
              }
              placeholder={t('adminSchool.placeholder.monthlyFee')}
              keyboardType="number-pad"
            />
            <SelectField
              label={t('adminSchool.field.paymentSystem')}
              value={form.finance.payment_system}
              onSelect={(value) =>
                updateSectionField('finance', 'payment_system', value)
              }
              placeholder={t('adminSchool.placeholder.selectPayment')}
              options={PAYMENT_SYSTEM_OPTIONS}
              getOptionLabel={(option) =>
                getLabel(PAYMENT_LABEL_KEYS, option) || option
              }
            />
            <FormField
              label={t('adminSchool.field.grants')}
              value={form.finance.grants_discounts}
              onChangeText={(value) =>
                updateSectionField('finance', 'grants_discounts', value)
              }
              placeholder={t('adminSchool.placeholder.grants')}
              multiline
            />
            <SwitchField
              label={t('adminSchool.field.freePlaces')}
              value={form.finance.free_places}
              onValueChange={(value) =>
                updateSectionField('finance', 'free_places', value)
              }
            />
          </View>
          <SelectField
            label={t('adminSchool.field.city')}
            value={form.basic_info.city}
            onSelect={handleCitySelect}
            placeholder={t('adminSchool.placeholder.selectCity')}
            options={CITY_NAMES}
            getOptionLabel={(option) => getCityLabel(option) || option}
          />
          <SelectField
            label={t('adminSchool.field.district')}
            value={form.basic_info.district}
            onSelect={(value) =>
              updateSectionField('basic_info', 'district', value)
            }
            placeholder={
              availableDistricts.length
                ? t('adminSchool.placeholder.selectDistrict')
                : form.basic_info.city
                ? t('adminSchool.placeholder.noDistricts')
                : t('adminSchool.placeholder.selectCityFirst')
            }
            options={availableDistricts}
            disabled={!availableDistricts.length}
            getOptionLabel={(option) =>
              getDistrictLabel(form.basic_info.city, option) || option
            }
          />
          <FormField
            label={t('adminSchool.field.address')}
            value={getLocalizedText(form.basic_info.address, contentLocale)}
            onChangeText={(value) =>
              updateLocalizedSectionField('basic_info', 'address', value)
            }
            placeholder={t('adminSchool.placeholder.address')}
            multiline
          />
          <FormField
            label={t('adminSchool.field.description')}
            value={getLocalizedText(form.basic_info.description, contentLocale)}
            onChangeText={(value) =>
              updateLocalizedSectionField('basic_info', 'description', value)
            }
            placeholder={t('adminSchool.placeholder.description')}
            multiline
          />
          <View style={styles.row}>
            <View style={[styles.rowItem, styles.rowItemWithSpacing]}>
              <FormField
                label={t('adminSchool.field.latitude')}
                value={form.basic_info.coordinates.latitude}
                onChangeText={(value) =>
                  updateNestedSectionField(
                    'basic_info',
                    'coordinates',
                    'latitude',
                    value
                  )
                }
                placeholder={t('adminSchool.placeholder.latitude')}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.rowItem}>
              <FormField
                label={t('adminSchool.field.longitude')}
                value={form.basic_info.coordinates.longitude}
                onChangeText={(value) =>
                  updateNestedSectionField(
                    'basic_info',
                    'coordinates',
                    'longitude',
                    value
                  )
                }
                placeholder={t('adminSchool.placeholder.longitude')}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
          <MapPreview
            latitude={form.basic_info.coordinates.latitude}
            longitude={form.basic_info.coordinates.longitude}
            address={getLocalizedText(form.basic_info.address, contentLocale)}
          />
          <FormField
            label={t('adminSchool.field.phone')}
            value={form.basic_info.phone}
            onChangeText={(value) => updateSectionField('basic_info', 'phone', value)}
            placeholder={t('adminSchool.placeholder.phone')}
            keyboardType="phone-pad"
          />
          <FormField
            label={t('adminSchool.field.whatsapp')}
            value={form.basic_info.whatsapp_phone}
            onChangeText={(value) =>
              updateSectionField('basic_info', 'whatsapp_phone', value)
            }
            placeholder={t('adminSchool.placeholder.whatsapp')}
            keyboardType="phone-pad"
          />
          <FormField
            label={t('adminSchool.field.email')}
            value={form.basic_info.email}
            onChangeText={(value) => updateSectionField('basic_info', 'email', value)}
            placeholder={t('adminSchool.placeholder.email')}
            keyboardType="email-address"
          />
          <FormField
            label={t('adminSchool.field.website')}
            value={form.basic_info.website}
            onChangeText={(value) =>
              updateSectionField('basic_info', 'website', value)
            }
            placeholder={t('adminSchool.placeholder.website')}
            keyboardType="url"
          />
          <FormField
            label={t('adminSchool.field.foundedYear')}
            value={form.basic_info.founded_year}
            onChangeText={(value) =>
              updateSectionField('basic_info', 'founded_year', value)
            }
            placeholder={t('adminSchool.placeholder.foundedYear')}
            keyboardType="number-pad"
          />
          <FormField
            label={t('adminSchool.field.licenseNumber')}
            value={licenseDetails.number}
            onChangeText={(value) =>
              updateNestedSectionField(
                'basic_info',
                'license_details',
                'number',
                value
              )
            }
            placeholder={t('adminSchool.placeholder.licenseNumber')}
          />
          <DatePickerField
            label={t('adminSchool.field.licenseIssued')}
            value={licenseDetails.issued_at}
            onChange={(value) =>
              updateNestedSectionField(
                'basic_info',
                'license_details',
                'issued_at',
                value
              )
            }
            placeholder={t('adminSchool.placeholder.selectIssueDate')}
          />
          <DatePickerField
            label={t('adminSchool.field.licenseValidUntil')}
            value={licenseDetails.valid_until}
            onChange={(value) =>
              updateNestedSectionField(
                'basic_info',
                'license_details',
                'valid_until',
                value
              )
            }
            placeholder={t('adminSchool.placeholder.selectExpiryDate')}
          />
          <View style={styles.licensePreview}>
            <Text style={styles.licensePreviewTitle}>
              {t('adminSchool.field.accreditation')}
            </Text>
            <Text style={styles.licensePreviewLine}>
              {t('adminSchool.field.licenseNumberLabel')}{' '}
              {licenseDetails.number?.trim?.() || '—'}
            </Text>
            <Text style={styles.licensePreviewLine}>
              {t('adminSchool.field.licenseIssuedLabel')}{' '}
              {formatDateDisplay(licenseDetails.issued_at) || '—'}
            </Text>
            <Text style={styles.licensePreviewLine}>
              {t('adminSchool.field.licenseValidLabel')}{' '}
              {formatDateDisplay(licenseDetails.valid_until) || '—'}
            </Text>
          </View>
        </SectionCard>

        <SectionCard
          title={t('adminSchool.section.education.title')}
          description={t('adminSchool.section.education.description')}
        >
          <CurriculaSelector
            value={form.education.curricula}
            onChange={(value) =>
              updateSectionField('education', 'curricula', value)
            }
            locale={contentLocale}
            getLabel={getLabel}
          />
          <LanguagesSelector
            value={form.education.languages}
            otherValue={getLocalizedText(
              form.education.languages_other,
              contentLocale
            )}
            onChange={(value) => updateSectionField('education', 'languages', value)}
            onOtherChange={(value) =>
              updateLocalizedSectionField('education', 'languages_other', value)
            }
            getLabel={getLabel}
          />
          <GradesSelector
            label={t('adminSchool.field.grades')}
            value={form.education.grades}
            onChange={(value) =>
              updateSectionField('education', 'grades', value)
            }
          />
          <SelectField
            label={t('adminSchool.field.averageClassSize')}
            value={form.education.average_class_size}
            onSelect={(value) =>
              updateSectionField('education', 'average_class_size', value)
            }
            placeholder={t('adminSchool.placeholder.selectAverageSize')}
            options={CLASS_SIZE_OPTIONS}
          />
          <EntranceExamSection
            value={form.education.entrance_exam}
            onChange={(value) =>
              updateSectionField('education', 'entrance_exam', value)
            }
          />
          <AdvancedSubjectsSelector
            value={form.education.advanced_subjects}
            otherValue={getLocalizedText(
              form.education.advanced_subjects_other,
              contentLocale
            )}
            onChange={(value) =>
              updateSectionField('education', 'advanced_subjects', value)
            }
            onOtherChange={(value) =>
              updateLocalizedSectionField(
                'education',
                'advanced_subjects_other',
                value
              )
            }
            getLabel={getLabel}
          />
        </SectionCard>

        <SectionCard
          title={t('adminSchool.section.services.title')}
          description={t('adminSchool.section.services.description')}
        >
          <SwitchField
            label={t('adminSchool.field.afterSchool')}
            value={form.services.after_school}
            onValueChange={(value) =>
              updateSectionField('services', 'after_school', value)
            }
          />
          <SelectField
            label={t('adminSchool.field.meals')}
            value={form.services.meals}
            onSelect={(value) => updateSectionField('services', 'meals', value)}
            placeholder={t('adminSchool.placeholder.selectOption')}
            options={MEAL_OPTIONS}
            getOptionLabel={(option) =>
              getLabel(MEAL_LABEL_KEYS, option) || option
            }
          />
          <SwitchField
            label={t('adminSchool.field.transport')}
            value={form.services.transport}
            onValueChange={(value) =>
              updateSectionField('services', 'transport', value)
            }
          />
          <SwitchField
            label={t('adminSchool.field.inclusiveEducation')}
            value={form.services.inclusive_education}
            onValueChange={(value) =>
              updateSectionField('services', 'inclusive_education', value)
            }
          />
          <SpecialistsSelector
            value={form.services.specialists}
            otherValue={getLocalizedText(
              form.services.specialists_other,
              contentLocale
            )}
            onChange={(value) =>
              updateSectionField('services', 'specialists', value)
            }
            onOtherChange={(value) =>
              updateLocalizedSectionField('services', 'specialists_other', value)
            }
            getLabel={getLabel}
          />
          <ClubsSelector
            value={form.services.clubs}
            otherMap={normalizeClubsOther(form.services.clubs_other)[contentLocale]}
            onChange={(value) => updateSectionField('services', 'clubs', value)}
            onOtherMapChange={updateClubsOther}
            getLabel={getLabel}
            getGroupLabel={(key, fallback) =>
              getLabel(CLUB_GROUP_LABEL_KEYS, key) || fallback
            }
          />
          <SwitchField
            label={t('adminSchool.field.security')}
            value={form.services.safety.security}
            onValueChange={(value) =>
              updateNestedSectionField('services', 'safety', 'security', value)
            }
          />
          <SwitchField
            label={t('adminSchool.field.cctv')}
            value={form.services.safety.cameras}
            onValueChange={(value) =>
              updateNestedSectionField('services', 'safety', 'cameras', value)
            }
          />
          <SwitchField
            label={t('adminSchool.field.accessControl')}
            value={form.services.safety.access_control}
            onValueChange={(value) =>
              updateNestedSectionField('services', 'safety', 'access_control', value)
            }
          />
          <SwitchField
            label={t('adminSchool.field.medicalOffice')}
            value={form.services.medical_office}
            onValueChange={(value) =>
              updateSectionField('services', 'medical_office', value)
            }
          />
        </SectionCard>

        <SectionCard
          title={t('adminSchool.section.media.title')}
          description={t('adminSchool.section.media.description')}
        >
          <FormField
            label={t('adminSchool.field.logo')}
            value={form.media.logo}
            onChangeText={(value) =>
              setForm((prev) => ({
                ...prev,
                media: {
                  ...prev.media,
                  logo: value,
                  logo_local_uri: '',
                },
              }))
            }
            placeholder={t('adminSchool.placeholder.logoUrl')}
            multiline
          />
          {isValidRemoteImage(form.media.logo) ? (
            <View className="bg-white border border-bgPurple/15 rounded-2xl p-3 items-center mt-2">
              <Text className="font-exo text-darkGrayText mb-2">
                {t('adminSchool.field.logoPreview')}
              </Text>
              <RNImage
                source={{ uri: form.media.logo.trim() }}
                style={{ width: 120, height: 120, borderRadius: 24 }}
                resizeMode="cover"
              />
            </View>
          ) : (
            <Text className="font-exo text-darkGrayText/60 mt-2">
              {t('adminSchool.message.logoHint')}
            </Text>
          )}
          <PhotosSelector
            value={form.media.photos}
            onChange={(value) => updateSectionField('media', 'photos', value)}
          />
          <VideosSelector
            value={form.media.videos}
            onChange={(value) => updateSectionField('media', 'videos', value)}
          />
          <FormField
            label={t('adminSchool.field.certificates')}
            value={form.media.certificates}
            onChangeText={(value) =>
              updateSectionField('media', 'certificates', value)
            }
            placeholder={t('adminSchool.placeholder.certificateUrl')}
            multiline
          />
          {splitList(form.media.certificates).filter(Boolean).length ? (
            <View className="mt-3">
              <Text style={styles.fieldLabel}>
                {t('adminSchool.field.certificatesPreview')}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingVertical: 6 }}
              >
                {splitList(form.media.certificates)
                  .filter(Boolean)
                  .slice(0, 6)
                  .map((url) => (
                    <Pressable
                      key={url}
                      onPress={() =>
                        Linking.openURL(url).catch(() =>
                          Alert.alert(
                            t('adminSchool.alert.openCertTitle'),
                            t('adminSchool.alert.openCertBody')
                          )
                        )
                      }
                      style={styles.mediaCard}
                    >
                      <View style={[styles.mediaThumb, styles.mediaThumbFallback]}>
                        <Text style={styles.mediaFallbackText}>
                          {t('adminSchool.media.documentLabel')}
                        </Text>
                      </View>
                      <Text style={styles.mediaLinkText} numberOfLines={1}>
                        {url}
                      </Text>
                    </Pressable>
                  ))}
              </ScrollView>
            </View>
          ) : null}
        </SectionCard>

        <SectionCard
          title={t('adminSchool.section.location.title')}
          description={t('adminSchool.section.location.description')}
        >
          <FormField
            label={t('adminSchool.field.location.metro')}
            value={form.location.nearest_metro_stop}
            onChangeText={(value) =>
              updateSectionField('location', 'nearest_metro_stop', value)
            }
            placeholder={t('adminSchool.placeholder.metro')}
          />
          <FormField
            label={t('adminSchool.field.location.busStop')}
            value={form.location.nearest_bus_stop}
            onChangeText={(value) =>
              updateSectionField('location', 'nearest_bus_stop', value)
            }
            placeholder={t('adminSchool.placeholder.busStop')}
          />
          <FormField
            label={t('adminSchool.field.location.distanceToMetro')}
            value={form.location.distance_to_metro_km}
            onChangeText={(value) =>
              updateSectionField('location', 'distance_to_metro_km', value)
            }
            placeholder={t('adminSchool.placeholder.distanceToMetro')}
            keyboardType="decimal-pad"
          />
          <FormField
            label={t('adminSchool.field.location.serviceArea')}
            value={form.location.service_area}
            onChangeText={(value) =>
              updateSectionField('location', 'service_area', value)
            }
            placeholder={t('adminSchool.placeholder.serviceArea')}
            multiline
          />
        </SectionCard>

        <SectionCard
          title={t('adminSchool.section.system.title')}
          description={t('adminSchool.section.system.description')}
        >
          <FormField
            label={t('adminSchool.field.system.createdAt')}
            value={form.system.created_at}
            onChangeText={(value) =>
              updateSectionField('system', 'created_at', value)
            }
            placeholder={t('adminSchool.placeholder.system.createdAt')}
          />
          <FormField
            label={t('adminSchool.field.system.updatedAt')}
            value={form.system.updated_at}
            onChangeText={(value) =>
              updateSectionField('system', 'updated_at', value)
            }
            placeholder={t('adminSchool.placeholder.system.updatedAt')}
          />
        </SectionCard>

        <Pressable
          className="bg-bgPurple rounded-2xl py-4 items-center mt-2 mb-6"
          onPress={handleSave}
        >
          <Text className="text-white font-exoSemibold text-lg">
            {t('adminSchool.action.save')}
          </Text>
        </Pressable>
          </ScrollView>
        </SafeAreaView>
      </View>
    </AdminLocaleContext.Provider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GRADIENT_COLORS[0],
  },
  safeArea: {
    flex: 1,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  mediaCard: {
    width: 120,
    padding: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(94, 139, 255, 0.2)',
    backgroundColor: '#FFFFFF',
  },
  mediaThumb: {
    width: '100%',
    height: 72,
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
  mediaOpen: {
    marginTop: 6,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  mediaOpenText: {
    fontFamily: 'exoSemibold',
    fontSize: 12,
    color: '#FFFFFF',
  },
  sectionTitle: {
    fontFamily: 'exoSemibold',
    fontSize: 20,
    lineHeight: 26,
    color: '#1F2937',
  },
  localeToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  localeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(86,103,253,0.4)',
    backgroundColor: '#FFFFFF',
  },
  localeChipActive: {
    backgroundColor: '#5667FD',
    borderColor: '#5667FD',
  },
  localeChipText: {
    fontFamily: 'exoSemibold',
    fontSize: 12,
    color: '#5667FD',
  },
  localeChipTextActive: {
    color: '#FFFFFF',
  },
  sectionDescription: {
    marginTop: 8,
    fontFamily: 'exo',
    fontSize: 13,
    lineHeight: 20,
    color: '#6B7280',
  },
  sectionContent: {
    marginTop: 16,
  },
  fieldWrapper: {
    marginBottom: 16,
  },
  fieldLabel: {
    marginBottom: 6,
    fontFamily: 'exoSemibold',
    fontSize: 14,
    lineHeight: 20,
    color: '#1F2937',
  },
  input: {
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(94, 139, 255, 0.2)',
    paddingHorizontal: 16,
    fontFamily: 'exo',
    fontSize: 15,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  inputMultiline: {
    height: undefined,
    minHeight: 112,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: 'top',
  },
  staticValue: {
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(94, 139, 255, 0.2)',
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  staticValueText: {
    fontFamily: 'exoSemibold',
    fontSize: 15,
    color: '#1F2937',
  },
  licensePreview: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(94, 139, 255, 0.15)',
    backgroundColor: '#F9FAFB',
    padding: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  licensePreviewTitle: {
    fontFamily: 'exoSemibold',
    fontSize: 13,
    color: '#2563EB',
    marginBottom: 6,
  },
  licensePreviewLine: {
    fontFamily: 'exo',
    fontSize: 13,
    lineHeight: 18,
    color: '#1F2937',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  switchLabel: {
    flex: 1,
    fontFamily: 'exoSemibold',
    fontSize: 14,
    lineHeight: 20,
    color: '#1F2937',
    paddingRight: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  rowItem: {
    flex: 1,
  },
  rowItemWithSpacing: {
    marginRight: 16,
  },
  selectContainer: {
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(94, 139, 255, 0.2)',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  selectDisabled: {
    opacity: 0.6,
  },
  selectValue: {
    fontFamily: 'exo',
    fontSize: 15,
    color: '#1F2937',
  },
  selectPlaceholder: {
    color: '#9CA3AF',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  modalTitle: {
    fontFamily: 'exoSemibold',
    fontSize: 18,
    color: '#1F2937',
    textAlign: 'center',
  },
  modalOptions: {
    maxHeight: 320,
    marginTop: 12,
    marginBottom: 16,
  },
  optionButton: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(94, 139, 255, 0.15)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  optionButtonActive: {
    backgroundColor: 'rgba(76, 204, 255, 0.15)',
    borderColor: '#4FCCFF',
  },
  optionText: {
    fontFamily: 'exo',
    fontSize: 15,
    color: '#1F2937',
    textAlign: 'center',
  },
  optionTextActive: {
    fontFamily: 'exoSemibold',
    color: '#2563EB',
  },
  modalCloseButton: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 999,
    backgroundColor: '#2563EB',
  },
  modalCloseText: {
    fontFamily: 'exoSemibold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  pickerInline: {
    marginTop: 10,
    marginBottom: 4,
  },
  pickerToolbar: {
    alignItems: 'flex-end',
    marginTop: 8,
  },
  pickerDoneButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#2563EB',
  },
  pickerDoneText: {
    fontFamily: 'exoSemibold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  mapWrapper: {
    marginTop: 8,
  },
  curriculaGroup: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(94, 139, 255, 0.15)',
    backgroundColor: '#F9FAFB',
    padding: 12,
    marginBottom: 12,
  },
  curriculaHeader: {
    marginBottom: 6,
  },
  curriculaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(94, 139, 255, 0.25)',
    backgroundColor: '#F8FAFF',
    marginBottom: 8,
  },
  curriculaLabel: {
    fontFamily: 'exoSemibold',
    fontSize: 14,
    color: '#1F2937',
  },
  curriculaArrow: {
    fontFamily: 'exoSemibold',
    fontSize: 16,
    color: '#4B5563',
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  mapTitle: {
    fontFamily: 'exoSemibold',
    fontSize: 14,
    color: '#1F2937',
  },
  mapActionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#2563EB',
  },
  mapActionButtonDisabled: {
    backgroundColor: '#A5B4FC',
  },
  mapActionText: {
    fontFamily: 'exoSemibold',
    fontSize: 13,
    color: '#FFFFFF',
  },
  mapContainer: {
    height: 180,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(94, 139, 255, 0.2)',
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  mapPlaceholderText: {
    fontFamily: 'exo',
    fontSize: 14,
    lineHeight: 20,
    color: '#6B7280',
    textAlign: 'center',
  },
  mapHint: {
    marginTop: 8,
    fontFamily: 'exo',
    fontSize: 12,
    lineHeight: 18,
    color: '#6B7280',
  },
  checkboxList: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(94, 139, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(37, 99, 235, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: '#FFFFFF',
  },
  checkboxBoxSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  checkboxTick: {
    fontFamily: 'exoSemibold',
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 18,
  },
  checkboxLabel: {
    fontFamily: 'exo',
    fontSize: 15,
    color: '#1F2937',
  },
  checkboxHint: {
    marginTop: 8,
    fontFamily: 'exo',
    fontSize: 12,
    lineHeight: 18,
    color: '#6B7280',
  },
});
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
