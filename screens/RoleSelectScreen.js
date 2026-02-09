import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ROLES, useRole } from '../context/RoleContext';
import { images } from '../assets';
import { useLocale } from '../context/LocaleContext';
import AuthLogo from '../components/AuthLogo';

const CARD_HORIZONTAL_MARGIN = 5; // spacing между карточками
const CARD_CONTAINER_PADDING = 48; // отступ от краёв экрана
const CARD_WIDTH = 180; // ширина карточки
const CARD_HEIGHT = 240; // высота карточки
const LABEL_HEIGHT = 60; // высота белого блока с подписью
const LABEL_RADIUS = 28; // радиус скругления белого блока
const ICON_SIZE = 112; // размер иконок

const RoleTile = ({ title, image, onPress }) => (
  <Pressable
    onPress={onPress}
    style={{
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      backgroundColor: 'transparent',
      shadowColor: '#3D4BA0',
      shadowOpacity: 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
      marginHorizontal: CARD_HORIZONTAL_MARGIN,
    }}
  >
    <View
      style={{
        width: '100%',
        flex: 1,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: 'white',
        backgroundColor: 'rgba(94, 139, 255, 0.15)',
        overflow: 'hidden',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 18,
        }}
      >
        <Image
          source={image}
          style={{ width: ICON_SIZE, height: ICON_SIZE }}
          resizeMode="contain"
        />
      </View>
      <View
        style={{
          backgroundColor: '#FFFFFF',
          width: '100%',
          height: LABEL_HEIGHT,
          borderTopLeftRadius: LABEL_RADIUS,
          borderTopRightRadius: LABEL_RADIUS,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 16,
        }}
      >
        <Text className="text-[#2870FF] text-center font-exoSemibold text-base">
          {title}
        </Text>
      </View>
    </View>
  </Pressable>
);

export default function RoleSelectScreen() {
  const navigation = useNavigation();
  const { setRole } = useRole();
  const { t, locale, setLocale } = useLocale();

  const handleSelect = (role) => {
    setRole(role);
    navigation.navigate('SignIn');
  };

  return (
    <LinearGradient
      colors={['#7B70FF', '#55C9FF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      className="flex-1"
    >
      <SafeAreaView className="flex-1 px-6 pt-2 pb-4">
        <View style={{ alignSelf: 'flex-end', marginBottom: 0, alignItems: 'flex-end' }}>
          <Text className="text-white/80 font-exo text-xs mb-2" style={{ textAlign: 'right' }}>
            {t('language.label')}
          </Text>
          <View style={{ flexDirection: 'column' }}>
            <Pressable
              onPress={() => setLocale('ru')}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor:
                  locale === 'ru' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.15)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.6)',
                marginBottom: 8,
              }}
            >
              <Text
                className="font-exoSemibold text-xs"
                style={{ color: locale === 'ru' ? '#2870FF' : '#FFFFFF' }}
              >
                RU
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setLocale('en')}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor:
                  locale === 'en' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.15)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.6)',
              }}
            >
              <Text
                className="font-exoSemibold text-xs"
                style={{ color: locale === 'en' ? '#2870FF' : '#FFFFFF' }}
              >
                EN
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setLocale('kk')}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor:
                  locale === 'kk' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.15)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.6)',
                marginTop: 8,
              }}
            >
              <Text
                className="font-exoSemibold text-xs"
                style={{ color: locale === 'kk' ? '#2870FF' : '#FFFFFF' }}
              >
                KZ
              </Text>
            </Pressable>
          </View>
        </View>
        <View className="items-center">
          <AuthLogo size={170} style={{ marginTop: -6 }} />
          <Text className="text-white font-exo text-2xl mt-1 text-center">
            {t('roleSelect.welcomePrefix')}
          </Text>
          <Text
            style={{
              fontFamily: 'italianno',
              fontSize: 30,
              color: '#FFFFFF',
              marginTop: 2,
              textAlign: 'center',
            }}
          >
            {t('roleSelect.appName')}
          </Text>

        <View className="border border-white rounded-full px-8 py-2 bg-white/10 mt-4">
          <Text className="text-white font-exoSemibold text-base">
            {t('roleSelect.prompt')}
          </Text>
        </View>
      </View>

        <View
          className="flex-1 w-full mt-6 flex-row justify-center"
          style={{ paddingHorizontal: CARD_CONTAINER_PADDING }}
        >
          <RoleTile
            title={t('roleSelect.studentRole')}
            image={images.roleStudent}
            onPress={() => handleSelect(ROLES.STUDENT)}
          />
          <RoleTile
            title={t('roleSelect.adminRole')}
            image={images.roleAdmin}
            onPress={() => handleSelect(ROLES.ADMIN)}
          />
        </View>

        <Text className="text-white text-center font-exo text-sm mt-4">
          {t('roleSelect.footer')}
        </Text>
      </SafeAreaView>
    </LinearGradient>
  );
}
