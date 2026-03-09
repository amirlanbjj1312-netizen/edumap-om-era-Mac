import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useLocale } from '../context/LocaleContext';

const PLAN_COPY = {
  ru: {
    title: 'Выберите план для родителя',
    subtitle: 'После регистрации откройте больше возможностей EDUMAP',
    standard: 'Standard',
    pro: 'Pro',
    month: 'Один месяц',
    year: 'Один год',
    purchase: 'Купить',
    skip: 'Пропустить пока',
    terms: 'Нажимая «Купить», вы принимаете Terms и Privacy Policy.',
    purchased: 'Тестовый режим: оплата пока не подключена.',
    features: {
      standard: ['100 AI кредитов в месяц', 'AI templates', 'Базовые подсказки'],
      pro: ['1200 AI кредитов в месяц', 'AI editing', 'Enhance quality'],
    },
  },
  en: {
    title: 'Choose a parent plan',
    subtitle: 'Unlock more EDUMAP features right after signup',
    standard: 'Standard',
    pro: 'Pro',
    month: 'One month',
    year: 'One year',
    purchase: 'Purchase',
    skip: 'Skip for now',
    terms: 'By tapping "Purchase", you agree to Terms and Privacy Policy.',
    purchased: 'Test mode: payments are not enabled yet.',
    features: {
      standard: ['100 monthly AI credits', 'AI templates', 'Basic hints'],
      pro: ['1200 monthly AI credits', 'AI editing', 'Enhance quality'],
    },
  },
  kk: {
    title: 'Ата-ана жоспарын таңдаңыз',
    subtitle: 'Тіркелгеннен кейін EDUMAP мүмкіндіктерін кеңейтіңіз',
    standard: 'Standard',
    pro: 'Pro',
    month: 'Бір ай',
    year: 'Бір жыл',
    purchase: 'Сатып алу',
    skip: 'Қазір өткізіп жіберу',
    terms: '"Сатып алу" түймесін басу арқылы Terms пен Privacy Policy қабылдайсыз.',
    purchased: 'Тест режимі: төлем әзірге қосылмаған.',
    features: {
      standard: ['Айына 100 AI кредит', 'AI templates', 'Базалық кеңестер'],
      pro: ['Айына 1200 AI кредит', 'AI editing', 'Enhance quality'],
    },
  },
};

const PRICES = {
  standard: {
    month: 1490,
    year: 9990,
  },
  pro: {
    month: 5990,
    year: 39990,
  },
};

const formatKzt = (value) =>
  `₸ ${Number(value || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ParentSubscriptionScreen() {
  const navigation = useNavigation();
  const { locale } = useLocale();
  const [plan, setPlan] = useState('standard');
  const [period, setPeriod] = useState('year');
  const copy = PLAN_COPY[locale] || PLAN_COPY.ru;

  const currentPrice = useMemo(() => {
    const selected = PRICES[plan] || PRICES.standard;
    return period === 'year' ? selected.year : selected.month;
  }, [period, plan]);

  const goHome = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  return (
    <LinearGradient
      colors={['#DDE4F2', '#EDF2FA']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.headerTabs}>
          <Pressable
            style={[styles.topTab, plan === 'standard' && styles.topTabActive]}
            onPress={() => setPlan('standard')}
          >
            <Text style={[styles.topTabText, plan === 'standard' && styles.topTabTextActive]}>
              {copy.standard}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.topTab, plan === 'pro' && styles.topTabActive]}
            onPress={() => setPlan('pro')}
          >
            <Text style={[styles.topTabText, plan === 'pro' && styles.topTabTextActive]}>
              {copy.pro}
            </Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.subtitle}>{copy.subtitle}</Text>

          <View style={styles.chipsRow}>
            {(plan === 'standard' ? copy.features.standard : copy.features.pro).map((item) => (
              <View key={item} style={styles.featureChip}>
                <Text style={styles.featureChipText}>{item}</Text>
              </View>
            ))}
          </View>

          <View style={styles.periodRow}>
            <Pressable
              style={[styles.periodCard, period === 'year' && styles.periodCardActive]}
              onPress={() => setPeriod('year')}
            >
              <Text style={styles.periodLabel}>{copy.year}</Text>
              <Text style={styles.periodPrice}>
                {formatKzt(plan === 'standard' ? PRICES.standard.year : PRICES.pro.year)}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.periodCard, period === 'month' && styles.periodCardActive]}
              onPress={() => setPeriod('month')}
            >
              <Text style={styles.periodLabel}>{copy.month}</Text>
              <Text style={styles.periodPrice}>
                {formatKzt(plan === 'standard' ? PRICES.standard.month : PRICES.pro.month)}
              </Text>
            </Pressable>
          </View>

          <Pressable
            style={styles.purchaseBtn}
            onPress={() => {
              Alert.alert(copy.purchase, `${copy.purchased}\n${formatKzt(currentPrice)}`);
              goHome();
            }}
          >
            <Text style={styles.purchaseBtnText}>{copy.purchase}</Text>
          </Pressable>

          <Pressable style={styles.skipBtn} onPress={goHome}>
            <Text style={styles.skipBtnText}>{copy.skip}</Text>
          </Pressable>

          <Text style={styles.terms}>{copy.terms}</Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  headerTabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginTop: 6,
    marginBottom: 10,
  },
  topTab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  topTabActive: {
    backgroundColor: 'rgba(63,90,173,0.14)',
  },
  topTabText: {
    fontFamily: 'exoSemibold',
    color: 'rgba(31,42,68,0.52)',
    fontSize: 24,
  },
  topTabTextActive: {
    color: '#1F2A44',
  },
  card: {
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(175,190,220,0.55)',
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  title: {
    fontFamily: 'exoSemibold',
    color: '#1F2A44',
    fontSize: 26,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 6,
    fontFamily: 'exo',
    color: '#5D6881',
    fontSize: 16,
    textAlign: 'center',
  },
  chipsRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  featureChip: {
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 11,
    backgroundColor: '#EDF2FC',
    borderWidth: 1,
    borderColor: '#D8E2F6',
  },
  featureChipText: {
    fontFamily: 'exoSemibold',
    fontSize: 13,
    color: '#243152',
  },
  periodRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  periodCard: {
    flex: 1,
    minHeight: 122,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D4DDED',
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  periodCardActive: {
    borderColor: '#43D0EA',
    shadowColor: '#67C4FF',
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  periodLabel: {
    fontFamily: 'exo',
    color: '#1F2A44',
    fontSize: 24,
  },
  periodPrice: {
    fontFamily: 'exoSemibold',
    color: '#141E35',
    fontSize: 40,
  },
  purchaseBtn: {
    marginTop: 14,
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: '#29BFE6',
  },
  purchaseBtnText: {
    fontFamily: 'exoSemibold',
    color: '#041B2E',
    fontSize: 28,
  },
  skipBtn: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C8D5EE',
    backgroundColor: '#F5F8FF',
  },
  skipBtnText: {
    fontFamily: 'exoSemibold',
    color: '#2A3A60',
    fontSize: 18,
  },
  terms: {
    marginTop: 10,
    textAlign: 'center',
    fontFamily: 'exo',
    fontSize: 13,
    color: 'rgba(53,63,87,0.72)',
  },
});
