import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  EnvelopeIcon,
  LockClosedIcon,
  UserIcon,
} from 'react-native-heroicons/outline';
import { images } from '../assets';
import { ROLES, useRole } from '../context/RoleContext';
import { useLocale } from '../context/LocaleContext';
import { supabase } from '../services/supabaseClient';
import Constants from 'expo-constants';
import rawSchools from '../assets/data/schools.json';

const gradientColors = ['#786AFF', '#4FCCFF'];
const placeholderColor = 'rgba(255,255,255,0.75)';
const DEFAULT_SCHEME = 'edumap';

const MODERATOR_ACCOUNTS = [
  {
    email: 'moderator@edumap.com',
    password: 'moderator123',
    pin: '4321',
  },
  {
    email: 'moderator2@edumap.com',
    password: 'modpass456',
    pin: '9876',
  },
];

const normalizeEmail = (value) => (value ? value.trim().toLowerCase() : '');

const normalizeRegistryValue = (value = '') =>
  value
    .toLowerCase()
    .replace(/[^a-zа-я0-9ё]/gi, '')
    .trim();

const collectRegistryNames = (school) => {
  if (!school) return [];
  const names = [
    school.name,
    school.name_ru,
    school.name_en,
  ].filter(Boolean);
  if (Array.isArray(school.aliases)) {
    names.push(...school.aliases);
  }
  return names;
};

const registryNames = Array.from(
  new Set(
    rawSchools
      .flatMap((school) => collectRegistryNames(school))
      .map((name) => normalizeRegistryValue(name))
      .filter(Boolean)
  )
);

const isSchoolInRegistry = (organization) => {
  const normalized = normalizeRegistryValue(organization);
  if (!normalized) return false;
  return registryNames.some(
    (name) => name.includes(normalized) || normalized.includes(name)
  );
};

const formatDateInput = (value = '') => {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
};

const extractDigits = (value = '') => value.replace(/\D/g, '');

const isValidDateString = (value = '') => {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
  const [yearStr, monthStr, dayStr] = trimmed.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!Number.isFinite(year) || year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const compareDates = (fromValue, toValue) => {
  if (!fromValue || !toValue) return true;
  const from = new Date(`${fromValue}T00:00:00Z`);
  const to = new Date(`${toValue}T00:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return true;
  return to.getTime() >= from.getTime();
};

const TabButton = ({ label, active, onPress }) => (
  <Pressable
    onPress={onPress}
    style={[
      styles.tabButton,
      active ? styles.tabButtonActive : styles.tabButtonInactive,
    ]}
  >
    <Text
      style={[
        styles.tabLabel,
        active ? styles.tabLabelActive : styles.tabLabelInactive,
      ]}
    >
      {label}
    </Text>
  </Pressable>
);

const AuthInput = ({
  icon: Icon,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize = 'none',
  keyboardType = 'default',
}) => (
  <View style={styles.inputWrapper}>
    <View style={styles.inputField}>
      {Icon ? <Icon size={20} color={placeholderColor} style={styles.inputIcon} /> : null}
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
      />
    </View>
  </View>
);

const PrimaryButton = ({ label, onPress, disabled, loading }) => (
  <Pressable
    onPress={onPress}
    style={[styles.primaryButton, disabled && styles.primaryButtonDisabled]}
    disabled={disabled}
  >
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.primaryButtonGradient}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={styles.primaryButtonLabel}>{label}</Text>
      )}
    </LinearGradient>
  </Pressable>
);

export default function AuthScreen({ initialMode = 'login' }) {
  const navigation = useNavigation();
  const [mode, setMode] = useState(initialMode);
  const { role, setRole, setGuest } = useRole();
  const { t } = useLocale();
  const [formMessage, setFormMessage] = useState('');
  const [formMessageTone, setFormMessageTone] = useState('error');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const appScheme = Constants?.expoConfig?.scheme ?? DEFAULT_SCHEME;
  const schoolRedirectUrl = 'https://ed-kappa-one.vercel.app/school-registration';
  const emailRedirectTo =
    role === ROLES.ADMIN ? schoolRedirectUrl : `${appScheme}://auth-callback`;

  useEffect(() => {
    setMode(initialMode);
    setFormMessage('');
  }, [initialMode]);

  const [loginValues, setLoginValues] = useState({
    email: '',
    password: '',
  });
  const [signupValues, setSignupValues] = useState({
    name: '',
    lastName: '',
    email: '',
    password: '',
    organization: '',
    bin: '',
    iin: '',
    licenseNumber: '',
    licenseIssuedAt: '',
    licenseExpiresAt: '',
    contactPhone: '',
    website: '',
  });

  const isLogin = mode === 'login';
  const autoVerified =
    role === ROLES.ADMIN && isSchoolInRegistry(signupValues.organization);

  const buildSignupMetadata = () => {
    const data = {
      role,
      firstName: signupValues.name || undefined,
      name: signupValues.name || undefined,
      lastName: signupValues.lastName || undefined,
    };

    if (role === ROLES.ADMIN) {
      return {
        ...data,
        organization: signupValues.organization || undefined,
        bin: signupValues.bin || undefined,
        iin: signupValues.iin || undefined,
        licenseNumber: signupValues.licenseNumber || undefined,
        licenseIssuedAt: signupValues.licenseIssuedAt || undefined,
        licenseExpiresAt: signupValues.licenseExpiresAt || undefined,
        contactPhone: signupValues.contactPhone || undefined,
        website: signupValues.website || undefined,
        schoolVerified: autoVerified,
        verificationStatus: autoVerified ? 'approved' : 'pending',
        verificationSource: autoVerified ? 'registry' : 'unknown',
      };
    }

    return data;
  };

  const handlePrimaryAction = async () => {
    setFormMessage('');
    const emailRaw = isLogin ? loginValues.email : signupValues.email;
    const emailInput = normalizeEmail(emailRaw);
    const passwordInput = isLogin
      ? loginValues.password
      : signupValues.password;

    if (!emailInput || !passwordInput) {
      setFormMessage(t('auth.errors.missingEmailPassword'));
      setFormMessageTone('error');
      return;
    }

    if (!isLogin && role === ROLES.ADMIN) {
      const trimmedIin = extractDigits(signupValues.iin);
      if (trimmedIin.startsWith('28')) {
        setFormMessage(t('auth.errors.iinStartsWith28'));
        setFormMessageTone('error');
        return;
      }
      if (trimmedIin && trimmedIin.length !== 12) {
        setFormMessage(t('auth.errors.iinLength'));
        setFormMessageTone('error');
        return;
      }
      const trimmedBin = extractDigits(signupValues.bin);
      if (trimmedBin && trimmedBin.length !== 12) {
        setFormMessage(t('auth.errors.binLength'));
        setFormMessageTone('error');
        return;
      }
      if (!isValidDateString(signupValues.licenseIssuedAt)) {
        setFormMessage(t('auth.errors.issueDateFormat'));
        setFormMessageTone('error');
        return;
      }
      if (!isValidDateString(signupValues.licenseExpiresAt)) {
        setFormMessage(t('auth.errors.expiryDateFormat'));
        setFormMessageTone('error');
        return;
      }
      if (
        signupValues.licenseIssuedAt &&
        signupValues.licenseExpiresAt &&
        !compareDates(signupValues.licenseIssuedAt, signupValues.licenseExpiresAt)
      ) {
        setFormMessage(t('auth.errors.expiryAfterIssue'));
        setFormMessageTone('error');
        return;
      }
    }

    const moderatorAccount = MODERATOR_ACCOUNTS.find(
      (account) =>
        account.email.toLowerCase() === emailInput &&
        account.password === passwordInput,
    );

    if (moderatorAccount) {
      setGuest(false);
      navigation.navigate('ModeratorPin', {
        expectedPin: moderatorAccount.pin,
      });
      return;
    }

    if (isLogin && role === ROLES.ADMIN) {
      if (!supabase) {
        setFormMessage(t('auth.errors.supabaseMissing'));
        setFormMessageTone('error');
        return;
      }

      setIsSubmitting(true);
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: emailInput,
          password: passwordInput,
        });
        if (error) {
          throw error;
        }

        const { data } = await supabase.auth.getUser();
        const metadata = data?.user?.user_metadata || {};
        const roleValue = (metadata.role || '').toLowerCase();
        if (roleValue !== ROLES.ADMIN) {
          await supabase.auth.signOut();
          setFormMessage(t('auth.errors.notSchoolAdmin'));
          setFormMessageTone('error');
          return;
        }

        const ecpStatus = (metadata.ecpStatus || '').toLowerCase();
        const verificationStatus = (metadata.verificationStatus || '').toLowerCase();
        if (ecpStatus !== 'uploaded' && verificationStatus !== 'approved') {
          await supabase.auth.signOut();
          setFormMessage(t('auth.errors.ecpRequired'));
          setFormMessageTone('error');
          return;
        }

        setGuest(false);
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      } catch (error) {
        setFormMessage(error?.message ?? t('auth.errors.generic'));
        setFormMessageTone('error');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!supabase) {
      setFormMessage(t('auth.errors.supabaseMissing'));
      setFormMessageTone('error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: emailInput,
          password: passwordInput,
        });
        if (error) throw error;

        setGuest(false);
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: emailInput,
        password: passwordInput,
        options: { data: buildSignupMetadata(), emailRedirectTo },
      });
      if (error) throw error;

      if (!data?.session) {
        const confirmMessage =
          role === ROLES.ADMIN
            ? t('auth.errors.confirmEmailSchool')
            : t('auth.errors.confirmEmailUser');
        setFormMessage(confirmMessage);
        setFormMessageTone('info');
        return;
      }

      setGuest(false);
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'WelcomeNewUser',
            params: {
              firstName: signupValues.name,
              lastName: signupValues.lastName,
            },
          },
        ],
      });
    } catch (error) {
      setFormMessage(error?.message ?? t('auth.errors.generic'));
      setFormMessageTone('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formInputs = useMemo(() => {
    if (isLogin) {
      const loginFields = [
        {
          key: 'email',
          placeholder:
            role === ROLES.ADMIN
              ? t('auth.placeholders.emailWork')
              : t('auth.placeholders.emailUser'),
          icon: EnvelopeIcon,
          value: loginValues.email,
          onChangeText: (text) =>
            setLoginValues((prev) => ({ ...prev, email: text })),
          keyboardType: 'email-address',
          autoCapitalize: 'none',
        },
        {
          key: 'password',
          placeholder: t('auth.placeholders.password'),
          icon: LockClosedIcon,
          value: loginValues.password,
          onChangeText: (text) =>
            setLoginValues((prev) => ({ ...prev, password: text })),
          secureTextEntry: true,
        },
      ];

      return loginFields;
    }

    const fields = [
      {
        key: 'name',
        placeholder:
          role === ROLES.ADMIN
            ? t('auth.placeholders.repName')
            : t('auth.placeholders.name'),
        icon: UserIcon,
        value: signupValues.name,
        onChangeText: (text) =>
          setSignupValues((prev) => ({ ...prev, name: text })),
        autoCapitalize: 'words',
      },
      {
        key: 'lastName',
        placeholder:
          role === ROLES.ADMIN
            ? t('auth.placeholders.repLastName')
            : t('auth.placeholders.lastName'),
        icon: UserIcon,
        value: signupValues.lastName,
        onChangeText: (text) =>
          setSignupValues((prev) => ({ ...prev, lastName: text })),
        autoCapitalize: 'words',
      },
      {
        key: 'email',
        placeholder: t('auth.placeholders.emailWork'),
        icon: EnvelopeIcon,
        value: signupValues.email,
        onChangeText: (text) =>
          setSignupValues((prev) => ({ ...prev, email: text })),
        keyboardType: 'email-address',
        autoCapitalize: 'none',
      },
      {
        key: 'password',
        placeholder: t('auth.placeholders.password'),
        icon: LockClosedIcon,
        value: signupValues.password,
        onChangeText: (text) =>
          setSignupValues((prev) => ({ ...prev, password: text })),
        secureTextEntry: true,
      },
    ];

    if (role === ROLES.ADMIN) {
      fields.push(
        {
          key: 'organization',
          placeholder: t('auth.placeholders.organization'),
          value: signupValues.organization,
          onChangeText: (text) =>
            setSignupValues((prev) => ({ ...prev, organization: text })),
          autoCapitalize: 'words',
        },
        {
          key: 'bin',
          placeholder: t('auth.placeholders.bin'),
          value: signupValues.bin,
          onChangeText: (text) =>
            setSignupValues((prev) => ({ ...prev, bin: text })),
          keyboardType: 'number-pad',
        },
        {
          key: 'iin',
          placeholder: t('auth.placeholders.iin'),
          value: signupValues.iin,
          onChangeText: (text) =>
            setSignupValues((prev) => ({ ...prev, iin: text })),
          keyboardType: 'number-pad',
        },
        {
          key: 'licenseNumber',
          placeholder: t('auth.placeholders.licenseNumber'),
          value: signupValues.licenseNumber,
          onChangeText: (text) =>
            setSignupValues((prev) => ({ ...prev, licenseNumber: text })),
        },
        {
          key: 'licenseIssuedAt',
          placeholder: t('auth.placeholders.licenseIssuedAt'),
          value: signupValues.licenseIssuedAt,
          onChangeText: (text) =>
            setSignupValues((prev) => ({
              ...prev,
              licenseIssuedAt: formatDateInput(text),
            })),
          keyboardType: 'numbers-and-punctuation',
        },
        {
          key: 'licenseExpiresAt',
          placeholder: t('auth.placeholders.licenseExpiresAt'),
          value: signupValues.licenseExpiresAt,
          onChangeText: (text) =>
            setSignupValues((prev) => ({
              ...prev,
              licenseExpiresAt: formatDateInput(text),
            })),
          keyboardType: 'numbers-and-punctuation',
        },
        {
          key: 'contactPhone',
          placeholder: t('auth.placeholders.contactPhone'),
          value: signupValues.contactPhone,
          onChangeText: (text) =>
            setSignupValues((prev) => ({ ...prev, contactPhone: text })),
          keyboardType: 'phone-pad',
        },
        {
          key: 'website',
          placeholder: t('auth.placeholders.website'),
          value: signupValues.website,
          onChangeText: (text) =>
            setSignupValues((prev) => ({ ...prev, website: text })),
          keyboardType: 'url',
          autoCapitalize: 'none',
        },
      );
    }

    return fields;
  }, [isLogin, loginValues, signupValues, role, t]);

  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Image source={images.authHero} style={styles.hero} resizeMode="contain" />

          <Pressable
            onPress={() => navigation.navigate('RoleSelect')}
            className="self-center mb-6"
          >
            <Text className="text-white/80 font-exo underline text-sm">
              {t('auth.changeRole')}
            </Text>
          </Pressable>

          <View style={styles.card}>
            <View style={styles.tabs}>
              <TabButton
                label={t('auth.logIn')}
                active={isLogin}
                onPress={() => setMode('login')}
              />
              <TabButton
                label={t('auth.signUp')}
                active={!isLogin}
                onPress={() => setMode('signup')}
              />
            </View>

            <View style={styles.form}>
              {formInputs.map(
                ({
                  key,
                  icon,
                  value,
                  onChangeText,
                  placeholder,
                  secureTextEntry,
                  autoCapitalize,
                  keyboardType,
                }) => (
                  <AuthInput
                    key={key}
                    icon={icon}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    secureTextEntry={secureTextEntry}
                    autoCapitalize={autoCapitalize}
                    keyboardType={keyboardType}
                  />
                ),
              )}
            </View>

            <PrimaryButton
              label={isLogin ? t('auth.logIn') : t('auth.register')}
              onPress={handlePrimaryAction}
              disabled={isSubmitting}
              loading={isSubmitting}
            />

            {formMessage ? (
              <Text
                style={[
                  styles.formMessage,
                  formMessageTone === 'error'
                    ? styles.formMessageError
                    : styles.formMessageInfo,
                ]}
              >
                {formMessage}
              </Text>
            ) : null}

            {role !== ROLES.ADMIN && (
              <>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>{t('auth.or')}</Text>
                  <View style={styles.dividerLine} />
                </View>

                <Pressable
                  onPress={() => {
                    setRole(ROLES.STUDENT);
                    setGuest(true);
                    navigation.reset({
                      index: 0,
                      routes: [{ name: 'Home' }],
                    });
                  }}
                  style={styles.guestLinkContainer}
                >
                  <Text style={styles.guestLink}>{t('auth.guest')}</Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  hero: {
    width: 220,
    height: 220,
    marginTop: 24,
    marginBottom: 24,
  },
  card: {
    width: '100%',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    padding: 4,
    marginBottom: 22,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  tabButtonInactive: {
    backgroundColor: 'transparent',
  },
  tabLabel: {
    fontSize: 16,
    fontFamily: 'exoSemibold',
  },
  tabLabelActive: {
    color: '#3D4BA0',
  },
  tabLabelInactive: {
    color: 'rgba(255,255,255,0.85)',
  },
  form: {
    marginBottom: 12,
  },
  inputWrapper: {
    marginBottom: 14,
  },
  inputField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    paddingHorizontal: 16,
    height: 52,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontFamily: 'exo',
    fontSize: 16,
    color: '#FFFFFF',
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  primaryButtonGradient: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonLabel: {
    fontFamily: 'exoSemibold',
    fontSize: 18,
    color: '#FFFFFF',
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  formMessage: {
    fontFamily: 'exo',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  formMessageError: {
    color: '#FDE68A',
  },
  formMessageInfo: {
    color: '#D1FAE5',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dividerText: {
    fontFamily: 'exo',
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginHorizontal: 12,
  },
  guestLinkContainer: {
    alignItems: 'center',
  },
  guestLink: {
    fontFamily: 'exoSemibold',
    fontSize: 16,
    color: '#FFFFFF',
    textDecorationLine: 'underline',
  },
});
