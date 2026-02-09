import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronRightIcon,
  GlobeAltIcon,
  InformationCircleIcon,
  PencilSquareIcon,
  CameraIcon,
  UserCircleIcon,
} from 'react-native-heroicons/outline';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRole, ROLES } from '../context/RoleContext';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { images } from '../assets';
import { useLocale } from '../context/LocaleContext';

const GRADIENT_COLORS = ['#786AFF', '#4FCCFF'];
const AVATAR_KEY_PREFIX = 'EDUMAP_AVATAR_URI';

const Section = ({ title, children }) => (
  <View className="mb-7">
    <Text style={styles.sectionTitle}>{title}</Text>
    <View className="bg-white rounded-2xl border border-bgPurple/15 p-4 gap-3">
      {children}
    </View>
  </View>
);

const SettingRow = ({ label, actionText, onPress, icon: Icon, showChevron }) => (
  <Pressable
    className="flex-row items-center justify-between py-3 border-b border-bgPurple/10 last:border-b-0"
    onPress={onPress}
    disabled={!onPress}
  >
    <View className="flex-row items-center gap-3">
      {Icon ? <Icon size={20} color="#364356" /> : null}
      <Text className="text-darkGrayText font-exo text-base">{label}</Text>
    </View>
    <View className="flex-row items-center gap-2">
      {actionText ? (
        <Text className="text-bgPurple font-exo">{actionText}</Text>
      ) : null}
      {showChevron ? <ChevronRightIcon size={18} color="#94A3B8" /> : null}
    </View>
  </Pressable>
);

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { setRole, isGuest, setGuest } = useRole();
  const { account } = useAuth();
  const { t, locale, setLocale } = useLocale();
  const fullName = [account?.firstName, account?.lastName]
    .filter(Boolean)
    .join(' ');
  const displayName = isGuest
    ? ''
    : fullName || account?.organization || t('profile.defaultName');
  const subtitle = isGuest
    ? ''
    : account?.email || (account?.organization && fullName ? account.organization : '');
  const avatarStorageKey = useMemo(() => {
    const identity = account?.id || account?.email || 'guest';
    return `${AVATAR_KEY_PREFIX}_${identity}`;
  }, [account?.id, account?.email]);
  const [avatarUri, setAvatarUri] = useState(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(avatarStorageKey);
        if (isMounted) {
          setAvatarUri(stored || null);
        }
      } catch (error) {
        console.warn('[ProfileScreen] Failed to load avatar', error);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [avatarStorageKey]);

  const saveAvatarUri = async (uri) => {
    setAvatarUri(uri);
    try {
      if (uri) {
        await AsyncStorage.setItem(avatarStorageKey, uri);
      } else {
        await AsyncStorage.removeItem(avatarStorageKey);
      }
    } catch (error) {
      console.warn('[ProfileScreen] Failed to save avatar', error);
    }
  };

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('profile.permissionRequired'), t('profile.permissionPhotos'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.length) {
      await saveAvatarUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('profile.permissionRequired'), t('profile.permissionCamera'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.length) {
      await saveAvatarUri(result.assets[0].uri);
    }
  };

  const pickFromFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.type === 'cancel') return;
      if (result.uri) {
        await saveAvatarUri(result.uri);
      }
    } catch (error) {
      console.warn('[ProfileScreen] Failed to pick file', error);
    }
  };

  const handleAvatarPress = () => {
    Alert.alert(t('profile.changePhotoTitle'), t('profile.changePhotoPrompt'), [
      { text: t('profile.camera'), onPress: takePhoto },
      { text: t('profile.photoLibrary'), onPress: pickFromLibrary },
      { text: t('profile.files'), onPress: pickFromFiles },
      { text: t('profile.cancel'), style: 'cancel' },
    ]);
  };

  const handleLanguagePress = () => {
    Alert.alert(t('language.select'), '', [
      { text: t('language.ru'), onPress: () => setLocale('ru') },
      { text: t('language.en'), onPress: () => setLocale('en') },
      { text: t('language.kk'), onPress: () => setLocale('kk') },
      { text: t('profile.cancel'), style: 'cancel' },
    ]);
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }

    setGuest(false);
    setRole(ROLES.STUDENT);
    navigation.reset({
      index: 0,
      routes: [{ name: 'RoleSelect' }],
    });
  };

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={GRADIENT_COLORS}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradient}
      />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Pressable
              style={styles.avatarWrap}
              onPress={isGuest ? undefined : handleAvatarPress}
              disabled={isGuest}
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <UserCircleIcon size={86} color="#D7DBE6" />
              )}
            </Pressable>
            {isGuest ? (
              <Text style={styles.guestLabel}>{t('profile.guestName')}</Text>
            ) : null}
            {!isGuest ? (
              <Pressable style={styles.changeButton} onPress={handleAvatarPress}>
                <CameraIcon size={16} color="#FFFFFF" />
                <Text style={styles.changeButtonText}>{t('profile.change')}</Text>
              </Pressable>
            ) : null}
            {displayName ? <Text style={styles.name}>{displayName}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>

          <View style={styles.body}>
            {isGuest ? (
              <View className="bg-white rounded-2xl border border-bgPurple/15 p-4 mb-6">
                <Text className="text-darkGrayText font-exoSemibold text-lg mb-2">
                  {t('profile.guestTitle')}
                </Text>
                <Text className="text-darkGrayText font-exo mb-4">
                  {t('profile.guestText')}
                </Text>
                <View style={styles.guestLangRow}>
                  <Pressable
                    onPress={() => setLocale('ru')}
                    style={[
                      styles.guestLangButton,
                      locale === 'ru' && styles.guestLangButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.guestLangText,
                        locale === 'ru' && styles.guestLangTextActive,
                      ]}
                    >
                      RU
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setLocale('en')}
                    style={[
                      styles.guestLangButton,
                      locale === 'en' && styles.guestLangButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.guestLangText,
                        locale === 'en' && styles.guestLangTextActive,
                      ]}
                    >
                      EN
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setLocale('kk')}
                    style={[
                      styles.guestLangButton,
                      locale === 'kk' && styles.guestLangButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.guestLangText,
                        locale === 'kk' && styles.guestLangTextActive,
                      ]}
                    >
                      KK
                    </Text>
                  </Pressable>
                </View>
                <Pressable
                  className="w-full bg-bgPurple rounded-full py-3 items-center mb-3"
                  onPress={() => navigation.navigate('SignUp')}
                >
                  <Text className="text-white font-exoSemibold text-base">
                    {t('profile.createAccount')}
                  </Text>
                </Pressable>
                <Pressable
                  className="w-full border border-bgPurple rounded-full py-3 items-center"
                  onPress={() => navigation.navigate('SignIn')}
                >
                  <Text className="text-bgPurple font-exoSemibold text-base">
                    {t('profile.logIn')}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Section title={t('profile.account')}>
                  <SettingRow
                    label={t('profile.language')}
                    actionText={
                      locale === 'ru'
                        ? t('language.ru')
                        : locale === 'kk'
                        ? t('language.kk')
                        : t('language.en')
                    }
                    icon={GlobeAltIcon}
                    onPress={handleLanguagePress}
                  />
                  <SettingRow
                    label={t('profile.editProfile')}
                    icon={PencilSquareIcon}
                    showChevron
                    onPress={() => navigation.navigate('EditProfile')}
                  />
                  <SettingRow
                    label={t('profile.aboutApp')}
                    icon={InformationCircleIcon}
                    showChevron
                    onPress={() => navigation.navigate('AboutApp')}
                  />
                </Section>

                <Section title={t('profile.statistics')}>
                  <Text className="font-exo text-darkGrayText">
                    {t('profile.statsPlaceholder')}
                  </Text>
                </Section>

                <Section title={t('profile.administration')}>
                  <Text className="font-exo text-darkGrayText">
                    {t('profile.adminPlaceholder')}
                  </Text>
                </Section>

                <Pressable
                  className="w-full bg-bgPurple rounded-full py-3 items-center mt-4"
                  onPress={handleLogout}
                >
                  <Text className="text-white font-exoSemibold text-base">
                    {t('profile.logout')}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GRADIENT_COLORS[0],
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 22,
    paddingHorizontal: 24,
  },
  avatarWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
  },
  changeButton: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  changeButtonText: {
    fontFamily: 'exoSemibold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  name: {
    fontFamily: 'exoSemibold',
    fontSize: 22,
    color: '#FFFFFF',
    marginTop: 12,
    textAlign: 'center',
  },
  guestLabel: {
    fontFamily: 'exoSemibold',
    fontSize: 18,
    color: '#FFFFFF',
    marginTop: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'exo',
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  guestLangRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  guestLangButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(88, 99, 242, 0.35)',
    backgroundColor: 'rgba(88, 99, 242, 0.08)',
  },
  guestLangButtonActive: {
    backgroundColor: '#5A63F2',
    borderColor: '#5A63F2',
  },
  guestLangText: {
    fontFamily: 'exoSemibold',
    fontSize: 12,
    color: '#5A63F2',
  },
  guestLangTextActive: {
    color: '#FFFFFF',
  },
  sectionTitle: {
    fontFamily: 'exoSemibold',
    fontSize: 20,
    color: '#FFFFFF',
    marginBottom: 12,
  },
});
