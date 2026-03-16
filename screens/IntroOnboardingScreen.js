import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'react-native';
import { images } from '../assets';
import { useLocale } from '../context/LocaleContext';

const ONBOARDING_DONE_KEY = 'EDUMAP_ONBOARDING_DONE_V1';
const SPLASH_MS = 1900;

const COPY = {
  ru: {
    welcome: 'Добро пожаловать',
    appName: 'EDUMAP',
    skip: 'Пропустить',
    next: 'Далее',
    start: 'Начать',
    steps: [
      'Поиск школ по фильтрам',
      'Сравнение программ, цен и отзывов',
      'AI-подбор под ваш запрос',
      'Быстрый контакт со школой',
    ],
  },
  kk: {
    welcome: 'Қош келдіңіз',
    appName: 'EDUMAP',
    skip: 'Өткізу',
    next: 'Келесі',
    start: 'Бастау',
    steps: [
      'Мектептерді сүзгілер арқылы іздеу',
      'Бағдарлама, баға және пікірлерді салыстыру',
      'Сұраныс бойынша AI іріктеу',
      'Мектеппен жылдам байланыс',
    ],
  },
  en: {
    welcome: 'Welcome',
    appName: 'EDUMAP',
    skip: 'Skip',
    next: 'Next',
    start: 'Start',
    steps: [
      'Find schools with filters',
      'Compare programs, prices, and reviews',
      'AI matching for your request',
      'Fast contact with schools',
    ],
  },
};

export default function IntroOnboardingScreen() {
  const navigation = useNavigation();
  const { locale } = useLocale();
  const lang = useMemo(
    () => (locale === 'kk' || locale === 'en' ? locale : 'ru'),
    [locale]
  );
  const text = COPY[lang];

  const [phase, setPhase] = useState('splash');
  const [step, setStep] = useState(0);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;
  const onboardingOpacity = useRef(new Animated.Value(0)).current;
  const stepOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let mounted = true;
    (async () => {
      const seen = await AsyncStorage.getItem(ONBOARDING_DONE_KEY);
      if (!mounted) return;
      if (seen === 'true') {
        navigation.replace('SignIn');
        return;
      }

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      setTimeout(() => {
        if (!mounted) return;
        setPhase('onboarding');
        Animated.timing(onboardingOpacity, {
          toValue: 1,
          duration: 360,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }, SPLASH_MS);
    })();

    return () => {
      mounted = false;
    };
  }, [navigation, onboardingOpacity, opacity, scale]);

  const completeOnboarding = async () => {
    await AsyncStorage.setItem(ONBOARDING_DONE_KEY, 'true');
    navigation.replace('SignIn');
  };

  const goNext = () => {
    if (step >= text.steps.length - 1) {
      completeOnboarding();
      return;
    }
    Animated.timing(stepOpacity, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start(() => {
      setStep((prev) => prev + 1);
      stepOpacity.setValue(0);
      Animated.timing(stepOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#E9EEF6' }}>
      {phase === 'splash' ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Animated.View style={{ opacity, transform: [{ scale }] }}>
            <Image source={images.authLogo} style={{ width: 180, height: 180, alignSelf: 'center' }} resizeMode="contain" />
            <Text
              style={{
                fontFamily: 'exoSemibold',
                color: '#111827',
                fontSize: 34,
                textAlign: 'center',
                marginTop: 10,
              }}
            >
              {text.welcome}
            </Text>
            <Text
              style={{
                fontFamily: 'exoSemibold',
                color: '#2563EB',
                fontSize: 24,
                textAlign: 'center',
                marginTop: 4,
              }}
            >
              {text.appName}
            </Text>
          </Animated.View>
        </View>
      ) : (
        <Animated.View style={{ flex: 1, opacity: onboardingOpacity, paddingHorizontal: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 8 }}>
            <Pressable onPress={completeOnboarding}>
              <Text style={{ fontFamily: 'exoSemibold', color: '#374151', fontSize: 14 }}>{text.skip}</Text>
            </Pressable>
          </View>

          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              borderRadius: 28,
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: 'rgba(17,24,39,0.08)',
              paddingHorizontal: 20,
              marginVertical: 24,
            }}
          >
            <Animated.View style={{ opacity: stepOpacity, width: '100%' }}>
              <Text
                style={{
                  fontFamily: 'exoSemibold',
                  color: '#2563EB',
                  fontSize: 14,
                  textAlign: 'center',
                  marginBottom: 10,
                }}
              >
                {`${step + 1}/4`}
              </Text>
              <Text
                style={{
                  fontFamily: 'exoSemibold',
                  color: '#111827',
                  fontSize: 28,
                  lineHeight: 36,
                  textAlign: 'center',
                }}
              >
                {text.steps[step]}
              </Text>
            </Animated.View>
          </View>

          <View style={{ paddingBottom: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 16 }}>
              {text.steps.map((_, idx) => (
                <View
                  key={`dot-${idx}`}
                  style={{
                    width: idx === step ? 18 : 8,
                    height: 8,
                    borderRadius: 999,
                    marginHorizontal: 4,
                    backgroundColor: idx === step ? '#2563EB' : 'rgba(17,24,39,0.2)',
                  }}
                />
              ))}
            </View>
            <Pressable
              onPress={goNext}
              style={{
                height: 54,
                borderRadius: 16,
                backgroundColor: '#FFFFFF',
                borderWidth: 1,
                borderColor: 'rgba(17,24,39,0.12)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontFamily: 'exoSemibold', color: '#111827', fontSize: 18 }}>
                {step === text.steps.length - 1 ? text.start : text.next}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

