import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeftIcon } from 'react-native-heroicons/solid';
import { useLocale } from '../context/LocaleContext';
import { useAuth } from '../context/AuthContext';
import { getActivePlan, getUsageStatus, setActivePlan } from '../services/subscriptionAccess';
import { getRoom } from '../services/chatApi';

const PLAN_COPY = {
  ru: {
    firstTitle: 'Выберите ваш тариф',
    firstSubtitle:
      'Пробный период и инструменты ИИ помогут найти лучшую школу для вашего ребенка.',
    close: 'Закрыть',
    title: 'Выберите план для родителя',
    subtitle: 'После регистрации откройте больше возможностей EDUMAP',
    standard: 'Standard',
    pro: 'Pro',
    standardDescription: 'Подписка - 30 дней',
    proDescription: 'Подписка - 90 дней',
    month: 'Один месяц',
    year: 'Один год',
    periodDescriptionMonth: 'Гибкий вариант, если хотите попробовать на короткий срок.',
    periodDescriptionYear: 'Самый выгодный вариант для регулярного использования.',
    purchase: 'Купить',
    skip: 'Пропустить пока',
    terms: 'Нажимая «Купить», вы принимаете Terms и Privacy Policy.',
    purchased: 'Тестовый режим: оплата пока не подключена.',
    socialProofTitle: '1 000+ родителей уже нашли школу через EDUMAP',
    socialProofChip: '1 000+ родителей уже нашли школу с EDUMAP',
    features: {
      standard: [
        'Полные карточки школ',
        'Сравнение: до 3 школ',
        'AI-чат: 3 вопроса/день',
        'AI-подбор: 5 запросов/день',
        'Все фильтры',
        'Отзывы: можно писать',
      ],
      pro: [
        'Полные карточки школ',
        'Сравнение: до 5 школ',
        'AI-чат: 10 вопросов/день',
        'AI-подбор: без лимита за период',
        'Все фильтры',
        'Отзывы: можно писать',
      ],
    },
  },
  en: {
    firstTitle: 'Choose your plan',
    firstSubtitle:
      'A trial period and AI tools will help you find the best school for your child.',
    close: 'Close',
    title: 'Choose a parent plan',
    subtitle: 'Unlock more EDUMAP features right after signup',
    standard: 'Standard',
    pro: 'Pro',
    standardDescription: 'Subscription - 30 days',
    proDescription: 'Subscription - 90 days',
    month: 'One month',
    year: 'One year',
    periodDescriptionMonth: 'Flexible option if you want to try for a short period.',
    periodDescriptionYear: 'Best value if you use EDUMAP regularly.',
    purchase: 'Purchase',
    skip: 'Skip for now',
    terms: 'By tapping "Purchase", you agree to Terms and Privacy Policy.',
    purchased: 'Test mode: payments are not enabled yet.',
    socialProofTitle: '1,000+ parents have already found a school with EDUMAP',
    socialProofChip: '1,000+ parents already found a school with EDUMAP',
    features: {
      standard: [
        'Full school card descriptions',
        'Compare button up to 3 schools',
        'Up to 3 AI chat questions per day',
        'Up to 5 AI match requests per day',
        'Full filters package',
        'Can write reviews',
      ],
      pro: [
        'Full school card descriptions',
        'Compare button up to 5 schools',
        'Up to 10 AI chat questions per day',
        'Unlimited AI match requests per period',
        'Full filters package',
        'Can write reviews',
      ],
    },
  },
  kk: {
    firstTitle: 'Тарифіңізді таңдаңыз',
    firstSubtitle:
      'Сынақ кезеңі мен AI құралдары балаңызға ең жақсы мектепті табуға көмектеседі.',
    close: 'Жабу',
    title: 'Ата-ана жоспарын таңдаңыз',
    subtitle: 'Тіркелгеннен кейін EDUMAP мүмкіндіктерін кеңейтіңіз',
    standard: 'Standard',
    pro: 'Pro',
    standardDescription: 'Жазылым - 30 күн',
    proDescription: 'Жазылым - 90 күн',
    month: 'Бір ай',
    year: 'Бір жыл',
    periodDescriptionMonth: 'Қысқа мерзімге қолданып көруге ыңғайлы нұсқа.',
    periodDescriptionYear: 'Тұрақты қолдануға ең тиімді нұсқа.',
    purchase: 'Сатып алу',
    skip: 'Қазір өткізіп жіберу',
    terms: '"Сатып алу" түймесін басу арқылы Terms пен Privacy Policy қабылдайсыз.',
    purchased: 'Тест режимі: төлем әзірге қосылмаған.',
    socialProofTitle: 'EDUMAP арқылы 1 000+ ата-ана мектеп тапты',
    socialProofChip: '1 000+ ата-ана EDUMAP-пен мектеп тапты',
    features: {
      standard: [
        'Мектеп карточкаларының толық сипаттамасы',
        '3 мектепке дейін салыстыру батырмасы',
        'Күніне 3 AI чат сұрағы',
        'Күніне 5 AI іріктеу сұрауы',
        'Фильтрлердің толық пакеті',
        'Пікір жаза алады',
      ],
      pro: [
        'Мектеп карточкаларының толық сипаттамасы',
        '5 мектепке дейін салыстыру батырмасы',
        'Күніне 10 AI чат сұрағы',
        'Кезең ішінде AI іріктеуге шексіз сұрау',
        'Фильтрлердің толық пакеті',
        'Пікір жаза алады',
      ],
    },
  },
};

export default function ParentSubscriptionScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { locale } = useLocale();
  const { width } = useWindowDimensions();
  const { account } = useAuth();
  const [openFaqId, setOpenFaqId] = useState(null);
  const [activePlan, setActivePlanState] = useState(null);
  const [usageStatus, setUsageStatus] = useState({
    ai_chat: null,
    ai_match: null,
    compare_table: null,
  });
  const [inlineMessage, setInlineMessage] = useState('');
  const [manageSheetVisible, setManageSheetVisible] = useState(false);
  const [autoRenewEnabled, setAutoRenewEnabled] = useState(true);
  const copy = PLAN_COPY[locale] || PLAN_COPY.ru;
  const isRequired = route.params?.required !== false;
  const compactTariffs = width < 430;
  const subscriptionUi = useMemo(() => {
    if (locale === 'en') {
      return {
        header: 'Subscription',
        currentPlanBadge: 'Current plan',
        remainLabel: 'Remaining',
        manageButton: 'Manage subscription',
        manageSoonTitle: 'Subscription',
        manageSoonBody: 'Subscription management is coming soon.',
        nextChargePrefix: 'Next charge',
        otherTitle: 'Other plans',
        period30: '30 days',
        discount: '-22%',
        standardButton: 'Choose',
        standardActivated: 'Monthly plan activated.',
        proButton: 'Switch to 90 days',
        proHint: 'Save 30%',
        proActivated: 'Pro plan activated.',
        bottomButton: 'Switch to 90 days',
        bottomHint: 'Save 30%',
        pointCompare3: 'Compare 3 schools',
        pointChat3: '3 AI questions/day',
        pointMatch5: '5 AI matches/day',
        pointCompare5: 'Compare 5 schools',
        pointChat10: '10 AI questions/day',
        pointMatchUnlimited: 'Unlimited AI matches',
        trialTitle: 'Trial period active',
        standardTitle: 'Monthly plan active',
        proTitle: 'Pro plan active',
        trialPrice: '2 990 ₸ / 30 days',
        standardPrice: '2 990 ₸ / 30 days',
        proPrice: '6 990 ₸ / 90 days',
        manageTrialButton: 'Switch to Monthly',
        managePaidButton: 'Manage subscription',
        usageTitle: 'Your limits now',
        usageWindowDay: 'day',
        usageWindowPeriod: 'period',
        usageChat: 'AI chat',
        usageMatch: 'AI match',
        usageCompare: 'Comparison',
        usageUnlimited: 'unlimited',
        trialReviewLock: 'Reviews: read-only on Trial',
        currentPlanInline: 'Current plan updated',
        compareDeltaPrefix: '+',
        compareDeltaSchools: 'schools for comparison',
        compareDeltaChat: 'AI questions/day',
        compareDeltaMatch: 'AI matches/day',
        compareDeltaMatchPeriod: 'AI matches/period',
        monthlyName: 'Monthly',
        proName: 'Pro',
        fullCards: 'Full school cards',
        pricePerDayLabel: 'per day',
        changesTitle: 'What will change',
        cancelAnytime: 'Cancel anytime',
        sheetTitle: 'Subscription management',
        sheetCurrent: 'Current plan',
        sheetNextCharge: 'Next charge',
        sheetSwitchToPro: 'Switch to Pro (90 days)',
        sheetSwitchToMonthly: 'Switch to Monthly (30 days)',
        sheetAutoRenew: 'Auto-renewal',
        sheetOn: 'On',
        sheetOff: 'Off',
        sheetCancel: 'Cancel subscription',
        sheetCancelHint: 'Access remains active until the end of the paid period.',
        sheetHistory: 'Payment history',
        sheetSupport: 'Contact support',
        sheetClose: 'Close',
        sheetCancelledTitle: 'Subscription',
        sheetCancelledBody: 'Auto-renewal disabled. Access remains until period end.',
        sheetSupportBody: 'Failed to open support chat.',
      };
    }
    if (locale === 'kk') {
      return {
        header: 'Жазылым',
        currentPlanBadge: 'Ағымдағы жоспар',
        remainLabel: 'Қалды',
        manageButton: 'Жазылымды басқару',
        manageSoonTitle: 'Жазылым',
        manageSoonBody: 'Жазылымды басқару жақында ашылады.',
        nextChargePrefix: 'Келесі төлем',
        otherTitle: 'Басқа тарифтер',
        period30: '30 күн',
        discount: '-22%',
        standardButton: 'Таңдау',
        standardActivated: 'Monthly тарифі қосылды.',
        proButton: '90 күнге ауысу',
        proHint: '30% үнемдеңіз',
        proActivated: 'Pro тарифі қосылды.',
        bottomButton: '90 күнге ауысу',
        bottomHint: '30% үнемдеңіз',
        pointCompare3: '3 мектепті салыстыру',
        pointChat3: 'AI чат: күніне 3 сұрақ',
        pointMatch5: 'AI іріктеу: күніне 5',
        pointCompare5: '5 мектепті салыстыру',
        pointChat10: 'AI чат: күніне 10 сұрақ',
        pointMatchUnlimited: 'AI іріктеу: шексіз',
        trialTitle: 'Сынақ кезеңі белсенді',
        standardTitle: 'Monthly тарифі белсенді',
        proTitle: 'Pro тарифі белсенді',
        trialPrice: '2 990 ₸ / 30 күн',
        standardPrice: '2 990 ₸ / 30 күн',
        proPrice: '6 990 ₸ / 90 күн',
        manageTrialButton: 'Monthly тарифіне өту',
        managePaidButton: 'Жазылымды басқару',
        usageTitle: 'Қолданыстағы лимиттер',
        usageWindowDay: 'күн',
        usageWindowPeriod: 'кезең',
        usageChat: 'AI чат',
        usageMatch: 'AI іріктеу',
        usageCompare: 'Салыстыру',
        usageUnlimited: 'шексіз',
        trialReviewLock: 'Пікірлер: Trial-де тек көру',
        currentPlanInline: 'Ағымдағы жоспар жаңартылды',
        compareDeltaPrefix: '+',
        compareDeltaSchools: 'мектепті салыстыру',
        compareDeltaChat: 'AI сұрақ/күн',
        compareDeltaMatch: 'AI іріктеу/күн',
        compareDeltaMatchPeriod: 'AI іріктеу/кезең',
        monthlyName: 'Monthly',
        proName: 'Pro',
        fullCards: 'Мектеп карточкалары толық',
        pricePerDayLabel: 'күніне',
        changesTitle: 'Не өзгереді',
        cancelAnytime: 'Кез келген уақытта тоқтату',
        sheetTitle: 'Жазылымды басқару',
        sheetCurrent: 'Ағымдағы жоспар',
        sheetNextCharge: 'Келесі төлем',
        sheetSwitchToPro: 'Pro-ға өту (90 күн)',
        sheetSwitchToMonthly: 'Monthly-ге өту (30 күн)',
        sheetAutoRenew: 'Автожаңарту',
        sheetOn: 'Қосулы',
        sheetOff: 'Өшірулі',
        sheetCancel: 'Жазылымды тоқтату',
        sheetCancelHint: 'Қолжетімділік төленген кезең соңына дейін сақталады.',
        sheetHistory: 'Төлем тарихы',
        sheetSupport: 'Қолдауға жазу',
        sheetClose: 'Жабу',
        sheetCancelledTitle: 'Жазылым',
        sheetCancelledBody: 'Автожаңарту өшірілді. Қолжетімділік кезең соңына дейін бар.',
        sheetSupportBody: 'Қолдау чатын ашу сәтсіз болды.',
      };
    }
    return {
      header: 'Подписка',
      currentPlanBadge: 'Текущий план',
      remainLabel: 'Осталось',
      manageButton: 'Управление подпиской',
      manageSoonTitle: 'Подписка',
      manageSoonBody: 'Управление подпиской скоро появится.',
      nextChargePrefix: 'Следующее списание',
      otherTitle: 'Другие тарифы',
      period30: '30 дней',
      discount: '-22%',
      standardButton: 'Выбрать',
      standardActivated: 'Тариф Monthly активирован.',
      proButton: 'Перейти на 90 дней',
      proHint: 'Сэкономить 30%',
      proActivated: 'Тариф Pro активирован.',
      bottomButton: 'Перейти на 90 дней',
      bottomHint: 'Сэкономить 30%',
      pointCompare3: 'Сравнение 3 школ',
      pointChat3: '3 вопроса ИИ',
      pointMatch5: '5 ИИ подборов',
      pointCompare5: 'Сравнение 5 школ',
      pointChat10: '10 ИИ вопросов',
      pointMatchUnlimited: 'Неограни. ИИ подбор',
      trialTitle: 'Пробный период активен',
      standardTitle: 'Тариф Monthly активен',
      proTitle: 'Тариф Pro активен',
      trialPrice: '2 990 ₸ / 30 дней',
      standardPrice: '2 990 ₸ / 30 дней',
      proPrice: '6 990 ₸ / 90 дней',
      manageTrialButton: 'Перейти на Monthly',
      managePaidButton: 'Управление подпиской',
      usageTitle: 'Ваши лимиты сейчас',
      usageWindowDay: 'день',
      usageWindowPeriod: 'период',
      usageChat: 'AI-чат',
      usageMatch: 'AI-подбор',
      usageCompare: 'Сравнение',
      usageUnlimited: 'без лимита',
      trialReviewLock: 'Отзывы: в Trial только просмотр',
      currentPlanInline: 'Текущий план обновлен',
      compareDeltaPrefix: '+',
      compareDeltaSchools: 'школ к сравнению',
      compareDeltaChat: 'вопроса AI/день',
      compareDeltaMatch: 'AI-подборов/день',
      compareDeltaMatchPeriod: 'AI-подборов/период',
      monthlyName: 'Monthly',
      proName: 'Pro',
      fullCards: 'Полные карточки школ',
      pricePerDayLabel: 'в день',
      changesTitle: 'Что изменится',
      cancelAnytime: 'Отмена в любой момент',
      sheetTitle: 'Управление подпиской',
      sheetCurrent: 'Текущий план',
      sheetNextCharge: 'Следующее списание',
      sheetSwitchToPro: 'Перейти на Pro (90 дней)',
      sheetSwitchToMonthly: 'Перейти на Monthly (30 дней)',
      sheetAutoRenew: 'Автопродление',
      sheetOn: 'Вкл',
      sheetOff: 'Выкл',
      sheetCancel: 'Отменить подписку',
      sheetCancelHint: 'Доступ сохранится до конца оплаченного периода.',
      sheetHistory: 'История платежей',
      sheetSupport: 'Написать в поддержку',
      sheetClose: 'Закрыть',
      sheetCancelledTitle: 'Подписка',
      sheetCancelledBody: 'Автопродление отключено. Доступ сохранится до конца периода.',
      sheetSupportBody: 'Не удалось открыть чат поддержки.',
    };
  }, [locale]);

  const requiredCards = useMemo(() => {
    const isRu = locale === 'ru';
    const isKk = locale === 'kk';
    return [
      {
        id: 'trial',
        title: 'Trial',
        subtitle: isRu ? '3 дня бесплатно' : isKk ? '3 күн тегін' : '3 days free',
        priceMain: isRu ? 'Бесплатно' : isKk ? 'Тегін' : 'Free',
        points: isRu
          ? [
              'Полные карточки школ',
              'Сравнение: до 2 школ (1 раз/день)',
              'AI-чат: 1 вопрос/день',
              'AI-подбор: 3 запроса за период',
              'Все фильтры',
              'Просмотр отзывов',
            ]
          : isKk
            ? ['Толық сипаттама', '2 мектепті салыстыру', '10 AI чат сұрағы', '30 AI іріктеу']
            : ['Full descriptions', 'Compare 2 schools', '10 AI chat questions', '30 AI matches'],
        cta: isRu ? 'Начать бесплатно' : isKk ? 'Тегін бастау' : 'Start free',
        footer1: isRu ? 'Затем 2 990 каждые 30 дней' : isKk ? 'Кейін ₸2 990 / 30 күн' : 'Then ₸2,990 / 30 days',
        footer2: isRu ? 'Отмена в любой момент' : isKk ? 'Кез келген уақытта тоқтату' : 'Cancel anytime',
      },
      {
        id: 'standard',
        title: 'Monthly',
        subtitle: isRu ? '₸2 990 / 30 дней' : isKk ? '₸2 990 / 30 күн' : '₸2,990 / 30 days',
        priceMain: '',
        points: isRu
          ? [
              'Полные карточки школ',
              'Сравнение: до 3 школ',
              'AI-чат: 3 вопроса/день',
              'AI-подбор: 5 запросов/день',
              'Все фильтры',
              'Отзывы: можно писать',
            ]
          : isKk
            ? ['Толық сипаттама', '3 мектепті салыстыру', 'Айына 30 сұрақ', '50 AI іріктеу']
            : ['Full descriptions', 'Compare 3 schools', '30 questions / month', '50 AI matches'],
        cta: isRu ? 'Выбрать' : isKk ? 'Таңдау' : 'Choose',
        footer1: isRu ? 'Оплата каждые 30 дней' : isKk ? 'Төлем әр 90 күн сайын,' : 'Billed every 90 days,',
        footer2: isRu ? 'Отмена в любой момент' : isKk ? 'кез келген уақытта тоқтату' : 'cancel anytime',
        topBadge: isRu ? 'Популярный выбор' : isKk ? 'Танымал таңдау' : 'Popular choice',
        middleBadge: isRu ? 'Превосходат!' : isKk ? 'Керемет!' : 'Excellent!',
      },
      {
        id: 'pro',
        title: 'Pro',
        subtitle: isRu ? '₸6 990 / 90 дней' : isKk ? '₸6 990 / 90 күн' : '₸6,990 / 90 days',
        priceMain: '',
        points: isRu
          ? [
              'Полные карточки школ',
              'Сравнение: до 5 школ',
              'AI-чат: 10 вопросов/день',
              'AI-подбор: без лимита за период',
              'Все фильтры',
              'Отзывы: можно писать',
            ]
          : isKk
            ? ['Толық сипаттама', '5 мектепті салыстыру', 'Шексіз AI чат', 'Шексіз AI іріктеу']
            : ['Full descriptions', 'Compare 5 schools', 'Unlimited AI chat', 'Unlimited AI matches'],
        cta: isRu ? 'Выбрать' : isKk ? 'Таңдау' : 'Choose',
        footer1: isRu ? 'Оплата каждые 90 дней' : isKk ? 'Төлем әр 90 күн сайын,' : 'Billed every 90 days,',
        footer2: isRu ? 'Отмена в любой момент' : isKk ? 'кез келген уақытта тоқтату' : 'cancel anytime',
        discountBadge: '-22%',
      },
    ];
  }, [locale]);
  const faqItems = useMemo(() => {
    if (locale === 'kk') {
      return [
        {
          id: 'faq-1',
          question: 'Тарифті қазір қоспасам, кейін қосуға бола ма?',
          answer: 'Иә, болады. Кез келген уақытта профильден тарифті қосып, мүмкіндіктерді кеңейте аласыз.',
        },
        {
          id: 'faq-2',
          question: 'Жазылымды қалай тоқтатамын?',
          answer: 'Жазылымды кез келген уақытта өшіре аласыз. Тоқтатылғаннан кейін кезең аяқталғанша қолжетімді болады.',
        },
        {
          id: 'faq-3',
          question: 'Pro тарифі не береді?',
          answer: 'Pro тарифінде мектептерді кеңірек салыстыру, AI чатқа көбірек қолжетімділік және AI іріктеудің жоғары лимиті бар.',
        },
      ];
    }
    if (locale === 'en') {
      return [
        {
          id: 'faq-1',
          question: 'Can I activate a plan later?',
          answer: 'Yes. You can activate a plan anytime from your profile and unlock more features.',
        },
        {
          id: 'faq-2',
          question: 'How can I cancel my subscription?',
          answer: 'You can cancel anytime. Access stays active until the end of the current billing period.',
        },
        {
          id: 'faq-3',
          question: 'What extra value does Pro give?',
          answer: 'Pro gives broader comparison, higher AI chat limits, and more AI matching capacity.',
        },
      ];
    }
    return [
      {
        id: 'faq-1',
        question: 'Можно ли подключить тариф позже?',
        answer: 'Да, можно. Вы в любой момент сможете подключить тариф из профиля и открыть больше возможностей.',
      },
      {
        id: 'faq-2',
        question: 'Как отменить подписку?',
        answer: 'Подписку можно отменить в любой момент. Доступ сохранится до конца оплаченного периода.',
      },
      {
        id: 'faq-3',
        question: 'Что дает Pro тариф?',
        answer: 'Pro дает расширенное сравнение школ, повышенные лимиты в AI-чате и больше возможностей AI-подбора.',
      },
    ];
  }, [locale]);

  const goHome = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  const loadPlanAndUsage = async () => {
    const userKey = account?.id || account?.email || 'guest';
    const plan = await getActivePlan(userKey);
    const [chat, match, compare] = await Promise.all([
      getUsageStatus(userKey, 'ai_chat'),
      getUsageStatus(userKey, 'ai_match'),
      getUsageStatus(userKey, 'compare_table'),
    ]);
    setActivePlanState(plan);
    setUsageStatus({
      ai_chat: chat,
      ai_match: match,
      compare_table: compare,
    });
  };

  const persistPlanSelection = async (planId) => {
    const userKey = account?.id || account?.email || 'guest';
    const saved = await setActivePlan(userKey, planId);
    setActivePlanState(saved);
    setInlineMessage(subscriptionUi.currentPlanInline);
    await loadPlanAndUsage();
  };

  useEffect(() => {
    if (isRequired) return;
    let mounted = true;
    (async () => {
      await loadPlanAndUsage();
      if (!mounted) return;
    })();
    return () => {
      mounted = false;
    };
  }, [account?.email, account?.id, isRequired]);

  useEffect(() => {
    if (!inlineMessage) return undefined;
    const t = setTimeout(() => setInlineMessage(''), 2400);
    return () => clearTimeout(t);
  }, [inlineMessage]);

  const planVisualMeta = useMemo(() => {
    const currentId = activePlan?.planId || 'trial';
    const map = {
      trial: { title: subscriptionUi.trialTitle, periodDays: 3, nextText: subscriptionUi.trialPrice },
      standard: { title: subscriptionUi.standardTitle, periodDays: 30, nextText: subscriptionUi.standardPrice },
      pro: { title: subscriptionUi.proTitle, periodDays: 90, nextText: subscriptionUi.proPrice },
    };
    return map[currentId] || map.trial;
  }, [activePlan?.planId, subscriptionUi.proPrice, subscriptionUi.proTitle, subscriptionUi.standardPrice, subscriptionUi.standardTitle, subscriptionUi.trialPrice, subscriptionUi.trialTitle]);

  const remainingDays = useMemo(() => {
    const expiresAt = activePlan?.expiresAt;
    const ts = new Date(expiresAt || '').getTime();
    if (!Number.isFinite(ts)) return 0;
    const diff = Math.ceil((ts - Date.now()) / (24 * 60 * 60 * 1000));
    return Math.max(0, diff);
  }, [activePlan?.expiresAt]);

  const nextChargeDateLabel = useMemo(() => {
    const ts = new Date(activePlan?.expiresAt || '').getTime();
    if (!Number.isFinite(ts)) return '';
    return new Date(ts).toLocaleDateString(
      locale === 'ru' ? 'ru-RU' : locale === 'kk' ? 'kk-KZ' : 'en-US',
      { day: 'numeric', month: 'long' }
    );
  }, [activePlan?.expiresAt, locale]);

  const progressRatio = useMemo(() => {
    const total = planVisualMeta.periodDays || 1;
    const used = Math.max(0, total - remainingDays);
    return Math.max(0.04, Math.min(1, used / total));
  }, [planVisualMeta.periodDays, remainingDays]);

  const currentPlanId = activePlan?.planId || 'trial';

  const renderUsageValue = (status) => {
    if (!status) return '...';
    if (status.limit == null) return subscriptionUi.usageUnlimited;
    const windowLabel =
      status.window === 'day' ? subscriptionUi.usageWindowDay : subscriptionUi.usageWindowPeriod;
    return `${status.used}/${status.limit} ${windowLabel}`;
  };

  const usageRows = useMemo(
    () => [
      { key: 'ai_chat', label: subscriptionUi.usageChat },
      { key: 'ai_match', label: subscriptionUi.usageMatch },
      { key: 'compare_table', label: subscriptionUi.usageCompare },
    ],
    [subscriptionUi.usageChat, subscriptionUi.usageCompare, subscriptionUi.usageMatch]
  );

  const comparisonHints = useMemo(() => {
    const byPlan = {
      trial: { compare: 2, chat: 1, match: 3, matchWindow: 'period' },
      standard: { compare: 3, chat: 3, match: 5, matchWindow: 'day' },
      pro: { compare: 5, chat: 10, match: null, matchWindow: 'period' },
    };
    const current = byPlan[currentPlanId] || byPlan.trial;
    const targets = ['standard', 'pro'];
    return targets.reduce((acc, target) => {
      const next = byPlan[target];
      const lines = [];
      if (!next || target === currentPlanId) {
        acc[target] = lines;
        return acc;
      }
      if (next.compare > current.compare) {
        lines.push(`${subscriptionUi.compareDeltaPrefix}${next.compare - current.compare} ${subscriptionUi.compareDeltaSchools}`);
      }
      if (next.chat > current.chat) {
        lines.push(`${subscriptionUi.compareDeltaPrefix}${next.chat - current.chat} ${subscriptionUi.compareDeltaChat}`);
      }
      if (next.match == null && current.match != null) {
        lines.push(subscriptionUi.pointMatchUnlimited);
      } else if (next.match != null && current.match != null && next.match > current.match) {
        const matchLabel =
          next.matchWindow === 'day'
            ? subscriptionUi.compareDeltaMatch
            : subscriptionUi.compareDeltaMatchPeriod;
        lines.push(`${subscriptionUi.compareDeltaPrefix}${next.match - current.match} ${matchLabel}`);
      }
      acc[target] = lines.slice(0, 3);
      return acc;
    }, {});
  }, [
    currentPlanId,
    subscriptionUi.compareDeltaChat,
    subscriptionUi.compareDeltaMatch,
    subscriptionUi.compareDeltaMatchPeriod,
    subscriptionUi.compareDeltaPrefix,
    subscriptionUi.compareDeltaSchools,
    subscriptionUi.pointMatchUnlimited,
  ]);

  const paymentHistory = useMemo(() => {
    const current = planVisualMeta.nextText;
    const dateLabel = nextChargeDateLabel || '—';
    return [
      `${dateLabel} • ${current} • OK`,
      locale === 'en'
        ? 'Previous period • paid'
        : locale === 'kk'
        ? 'Алдыңғы кезең • төленді'
        : 'Предыдущий период • оплачено',
    ];
  }, [locale, nextChargeDateLabel, planVisualMeta.nextText]);

  return (
    <LinearGradient
      colors={['#DDE4F2', '#EDF2FA']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safe}>
        {isRequired ? (
          <View style={{ flex: 1 }}>
            <Text style={styles.requiredTitle}>{copy.firstTitle}</Text>
            <Text style={styles.requiredSubtitle}>{copy.firstSubtitle}</Text>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.requiredScrollContent}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.requiredCardsRow}
              >
                {requiredCards.map((card) => (
                  <View key={card.id} style={[styles.requiredCard, card.id === 'standard' && styles.requiredCardFeatured]}>
                    <View style={styles.requiredHeaderRow}>
                      <Text style={styles.requiredCardTitle} numberOfLines={1}>
                        {card.title}
                      </Text>
                    </View>
                    {card.subtitle ? (
                      <View style={styles.requiredPeriodPill}>
                        <Text style={styles.requiredCardPeriod}>{card.subtitle}</Text>
                      </View>
                    ) : null}
                    <View style={styles.requiredMetaRow}>
                      {card.priceMain ? (
                        <Text style={styles.requiredCardPrice} numberOfLines={1}>
                          {card.priceMain}
                        </Text>
                      ) : null}
                      {card.topBadge ? (
                        <View style={styles.topBadge}>
                          <Text style={styles.topBadgeText} numberOfLines={1}>
                            {card.topBadge}
                          </Text>
                        </View>
                      ) : null}
                      {card.discountBadge ? (
                        <View style={styles.discountBadge}>
                          <Text style={styles.discountBadgeText} numberOfLines={1}>
                            {card.discountBadge}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.pointsWrap}>
                      {card.points.map((p) => (
                        <Text key={`${card.id}-${p}`} style={styles.requiredPoint} numberOfLines={2}>
                          {`✓ ${p}`}
                        </Text>
                      ))}
                    </View>
                    <Pressable
                      style={styles.requiredButton}
                      onPress={async () => {
                        await persistPlanSelection(card.id);
                        Alert.alert(copy.purchase, `${copy.purchased}`);
                        goHome();
                      }}
                    >
                      <Text style={styles.requiredButtonText} numberOfLines={1}>
                        {card.cta}
                      </Text>
                    </Pressable>
                    <Text style={styles.requiredFooterLine}>{card.footer1}</Text>
                    <Text style={styles.requiredFooterLine}>{card.footer2}</Text>
                  </View>
                ))}
              </ScrollView>

              <Text style={styles.socialProofTitle}>{copy.socialProofTitle}</Text>
              <View style={styles.faqWrap}>
                {faqItems.map((item) => {
                  const opened = openFaqId === item.id;
                  return (
                    <View key={item.id} style={styles.faqItem}>
                      <Pressable
                        style={styles.faqQuestionRow}
                        onPress={() =>
                          setOpenFaqId((prev) => (prev === item.id ? null : item.id))
                        }
                      >
                        <Text style={styles.faqQuestion}>{item.question}</Text>
                        <Text style={styles.faqChevron}>{opened ? '−' : '+'}</Text>
                      </Pressable>
                      {opened ? <Text style={styles.faqAnswer}>{item.answer}</Text> : null}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            <View style={styles.subHeaderRow}>
              <Pressable
                style={styles.backButton}
                onPress={() => (navigation.canGoBack() ? navigation.goBack() : goHome())}
              >
                <ArrowLeftIcon color="#2563EB" size={22} />
              </Pressable>
              <Text style={styles.subHeaderTitle}>{subscriptionUi.header}</Text>
              <View style={{ width: 40 }} />
            </View>

            <View style={styles.currentPlanCard}>
              <View style={styles.currentPlanHeader}>
                <Text style={styles.currentPlanTitle}>{planVisualMeta.title}</Text>
                <View style={styles.currentPlanBadge}>
                  <Text style={styles.currentPlanBadgeText}>{subscriptionUi.currentPlanBadge}</Text>
                </View>
              </View>
              {inlineMessage ? (
                <View style={styles.inlineSuccess}>
                  <Text style={styles.inlineSuccessText}>{inlineMessage}</Text>
                </View>
              ) : null}
              <Text style={styles.currentPlanRemainText}>{`${subscriptionUi.remainLabel}: ${remainingDays}`}</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
              </View>
              <View style={styles.usageCard}>
                <Text style={styles.usageTitle}>{subscriptionUi.usageTitle}</Text>
                {usageRows.map((row) => (
                  <View key={row.key} style={styles.usageRow}>
                    <Text style={styles.usageLabel}>{row.label}</Text>
                    <Text style={styles.usageValue}>{renderUsageValue(usageStatus[row.key])}</Text>
                  </View>
                ))}
              </View>
              {currentPlanId === 'trial' ? (
                <Text style={styles.trialReviewLock}>{subscriptionUi.trialReviewLock}</Text>
              ) : null}
              <Text style={styles.nextChargeText}>
                {`${subscriptionUi.nextChargePrefix} ${nextChargeDateLabel}:`}
              </Text>
              <Text style={styles.nextChargePrice}>{planVisualMeta.nextText}</Text>
              <Pressable
                style={styles.manageButton}
                onPress={async () => {
                  if (currentPlanId === 'trial') {
                    await persistPlanSelection('standard');
                    return;
                  }
                  setManageSheetVisible(true);
                }}
              >
                <Text style={styles.manageButtonText}>
                  {currentPlanId === 'trial' ? subscriptionUi.manageTrialButton : subscriptionUi.managePaidButton}
                </Text>
              </Pressable>
            </View>

            <Text style={styles.otherPlansTitle}>{subscriptionUi.otherTitle}</Text>
            <View style={styles.otherPlansCard}>
              <View style={[styles.offerRow, compactTariffs && styles.offerRowCompact]}>
                <View style={[styles.offerCol, compactTariffs && styles.offerColCompact, currentPlanId === 'standard' && styles.offerColCurrent]}>
                  <View style={styles.offerTopRow}>
                    <View style={styles.offerPlanBadge}>
                      <Text style={styles.offerPlanBadgeText}>{subscriptionUi.monthlyName}</Text>
                    </View>
                    {currentPlanId === 'standard' ? (
                      <View style={styles.offerCurrentChip}>
                        <Text style={styles.offerCurrentChipText}>{subscriptionUi.currentPlanBadge}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.offerPrice}>2 990 ₸</Text>
                  <Text style={styles.offerPerDay}>{`≈ 100 ₸ ${subscriptionUi.pricePerDayLabel}`}</Text>
                  <View style={styles.offerFeaturesWrap}>
                    <Text style={styles.offerItem}>{`✓ ${subscriptionUi.fullCards}`}</Text>
                    <Text style={styles.offerItem}>{`✓ ${subscriptionUi.pointCompare3}`}</Text>
                    <Text style={styles.offerItem}>{`✓ ${subscriptionUi.pointChat3}`}</Text>
                    <Text style={styles.offerItem}>{`✓ ${subscriptionUi.pointMatch5}`}</Text>
                  </View>
                  {comparisonHints.standard?.length ? (
                    <View style={styles.deltaWrap}>
                      <Text style={styles.deltaTitle}>{subscriptionUi.changesTitle}</Text>
                      {comparisonHints.standard.map((line) => (
                        <Text key={`standard-${line}`} style={styles.deltaText}>{line}</Text>
                      ))}
                    </View>
                  ) : null}
                  <View style={styles.offerBottomWrap}>
                    <Pressable
                      style={[
                        styles.offerPrimaryBtn,
                        currentPlanId === 'standard' && styles.offerButtonDisabled,
                      ]}
                      onPress={async () => {
                        if (currentPlanId === 'standard') return;
                        await persistPlanSelection('standard');
                      }}
                      disabled={currentPlanId === 'standard'}
                    >
                      <Text style={styles.offerPrimaryBtnText}>
                        {currentPlanId === 'standard' ? subscriptionUi.currentPlanBadge : subscriptionUi.standardButton}
                      </Text>
                    </Pressable>
                    <Text style={styles.offerMicrocopy}>{subscriptionUi.cancelAnytime}</Text>
                  </View>
                </View>

                {!compactTariffs ? <View style={styles.offerDivider} /> : null}

                <View style={[styles.offerCol, compactTariffs && styles.offerColCompact, styles.offerColPro, currentPlanId === 'pro' && styles.offerColCurrent]}>
                  <View style={styles.offerTopRow}>
                    <View style={styles.offerPlanBadge}>
                      <Text style={styles.offerPlanBadgeText}>{subscriptionUi.proName}</Text>
                    </View>
                    <View style={styles.minusBadge}>
                      <Text style={styles.minusBadgeText}>{subscriptionUi.discount}</Text>
                    </View>
                  </View>
                  {currentPlanId === 'pro' ? (
                    <View style={styles.offerCurrentInline}>
                      <Text style={styles.offerCurrentChipText}>{subscriptionUi.currentPlanBadge}</Text>
                    </View>
                  ) : null}
                  <View style={styles.proPriceRow}>
                    <Text style={styles.offerPrice}>6 990 ₸</Text>
                    <Text style={styles.oldPrice}>8 970 ₸</Text>
                  </View>
                  <Text style={styles.offerPerDay}>{`≈ 78 ₸ ${subscriptionUi.pricePerDayLabel}`}</Text>
                  <View style={styles.offerFeaturesWrap}>
                    <Text style={styles.offerItem}>{`✓ ${subscriptionUi.fullCards}`}</Text>
                    <Text style={styles.offerItem}>{`✓ ${subscriptionUi.pointCompare5}`}</Text>
                    <Text style={styles.offerItem}>{`✓ ${subscriptionUi.pointChat10}`}</Text>
                    <Text style={styles.offerItem}>{`✓ ${subscriptionUi.pointMatchUnlimited}`}</Text>
                  </View>
                  {comparisonHints.pro?.length ? (
                    <View style={styles.deltaWrap}>
                      <Text style={styles.deltaTitle}>{subscriptionUi.changesTitle}</Text>
                      {comparisonHints.pro.map((line) => (
                        <Text key={`pro-${line}`} style={styles.deltaText}>{line}</Text>
                      ))}
                    </View>
                  ) : null}
                  <View style={styles.offerBottomWrap}>
                    <Pressable
                      style={[
                        styles.offerPrimaryBtn,
                        currentPlanId === 'pro' && styles.offerButtonDisabled,
                      ]}
                      onPress={async () => {
                        if (currentPlanId === 'pro') return;
                        await persistPlanSelection('pro');
                      }}
                      disabled={currentPlanId === 'pro'}
                    >
                      <Text style={styles.offerPrimaryBtnText}>
                        {currentPlanId === 'pro' ? subscriptionUi.currentPlanBadge : subscriptionUi.proButton}
                      </Text>
                    </Pressable>
                    <Text style={styles.offerMicrocopy}>{subscriptionUi.cancelAnytime}</Text>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        )}

        <Modal
          transparent
          visible={manageSheetVisible}
          animationType="slide"
          onRequestClose={() => setManageSheetVisible(false)}
        >
          <View style={styles.sheetBackdrop}>
            <Pressable style={styles.sheetBackdropTouch} onPress={() => setManageSheetVisible(false)} />
            <View style={styles.sheetCard}>
              <Text style={styles.sheetTitle}>{subscriptionUi.sheetTitle}</Text>
              <Text style={styles.sheetCurrent}>
                {`${subscriptionUi.sheetCurrent}: ${planVisualMeta.title}`}
              </Text>
              <Text style={styles.sheetNext}>
                {`${subscriptionUi.sheetNextCharge}: ${nextChargeDateLabel} • ${planVisualMeta.nextText}`}
              </Text>

              <Pressable
                style={styles.sheetActionPrimary}
                onPress={async () => {
                  await persistPlanSelection(currentPlanId === 'pro' ? 'standard' : 'pro');
                  setManageSheetVisible(false);
                }}
              >
                <Text style={styles.sheetActionPrimaryText}>
                  {currentPlanId === 'pro' ? subscriptionUi.sheetSwitchToMonthly : subscriptionUi.sheetSwitchToPro}
                </Text>
              </Pressable>

              <View style={styles.sheetRow}>
                <Text style={styles.sheetRowLabel}>{subscriptionUi.sheetAutoRenew}</Text>
                <Pressable
                  style={[
                    styles.sheetToggle,
                    autoRenewEnabled ? styles.sheetToggleOn : styles.sheetToggleOff,
                  ]}
                  onPress={() => setAutoRenewEnabled((v) => !v)}
                >
                  <Text style={styles.sheetToggleText}>
                    {autoRenewEnabled ? subscriptionUi.sheetOn : subscriptionUi.sheetOff}
                  </Text>
                </Pressable>
              </View>

              <Pressable
                style={styles.sheetActionDanger}
                onPress={() => {
                  setAutoRenewEnabled(false);
                  Alert.alert(subscriptionUi.sheetCancelledTitle, subscriptionUi.sheetCancelledBody);
                }}
              >
                <Text style={styles.sheetActionDangerText}>{subscriptionUi.sheetCancel}</Text>
              </Pressable>
              <Text style={styles.sheetHint}>{subscriptionUi.sheetCancelHint}</Text>

              <Text style={styles.sheetSectionTitle}>{subscriptionUi.sheetHistory}</Text>
              {paymentHistory.map((line) => (
                <Text key={line} style={styles.sheetHistoryLine}>{`• ${line}`}</Text>
              ))}

              <Pressable
                style={styles.sheetSupport}
                onPress={async () => {
                  try {
                    const room = await getRoom('support');
                    const roomId = String(room?.roomId || 'support');
                    setManageSheetVisible(false);
                    navigation.navigate('ChatRoom', {
                      roomId,
                      title: subscriptionUi.sheetSupport,
                    });
                  } catch (_error) {
                    Alert.alert(subscriptionUi.sheetTitle, subscriptionUi.sheetSupportBody);
                  }
                }}
              >
                <Text style={styles.sheetSupportText}>{subscriptionUi.sheetSupport}</Text>
              </Pressable>

              <Pressable style={styles.sheetClose} onPress={() => setManageSheetVisible(false)}>
                <Text style={styles.sheetCloseText}>{subscriptionUi.sheetClose}</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  requiredScrollContent: {
    paddingVertical: 12,
    paddingBottom: 18,
  },
  requiredTitle: {
    marginTop: 12,
    textAlign: 'center',
    fontFamily: 'exoSemibold',
    fontSize: 24,
    color: '#1F2A44',
  },
  requiredSubtitle: {
    marginTop: 6,
    textAlign: 'center',
    fontFamily: 'exo',
    fontSize: 13,
    lineHeight: 18,
    color: '#5D6881',
    paddingHorizontal: 8,
  },
  requiredCardsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    alignItems: 'stretch',
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  requiredCard: {
    width: 214,
    flexShrink: 0,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: '#E2E9F6',
    padding: 9,
    minHeight: 360,
  },
  requiredCardFeatured: {
    backgroundColor: '#F4F8FF',
  },
  requiredCardTitle: {
    fontFamily: 'exoSemibold',
    fontSize: 20,
    color: '#1F2A44',
    textAlign: 'center',
  },
  requiredHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
  requiredCardPeriod: {
    fontFamily: 'exo',
    fontSize: 12,
    color: '#1E2A47',
    textAlign: 'center',
  },
  requiredPeriodPill: {
    marginTop: 4,
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#EEF3FF',
    borderWidth: 1,
    borderColor: '#D5E0FF',
    minHeight: 24,
    justifyContent: 'center',
  },
  requiredMetaRow: {
    marginTop: 6,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  requiredCardPrice: {
    fontFamily: 'exoSemibold',
    fontSize: 15,
    lineHeight: 18,
    color: '#0F3DA6',
    textAlign: 'center',
    minWidth: 122,
    height: 30,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  topBadge: {
    alignSelf: 'flex-start',
    minWidth: 122,
    height: 30,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#56C9B0',
    marginLeft: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBadgeText: {
    fontFamily: 'exoSemibold',
    fontSize: 10.5,
    lineHeight: 12,
    color: '#FFFFFF',
  },
  discountBadge: {
    minWidth: 56,
    height: 30,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: '#FFE99A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountBadgeText: {
    fontFamily: 'exoSemibold',
    fontSize: 11,
    color: '#6A5100',
  },
  pointsWrap: {
    marginTop: 6,
    minHeight: 132,
  },
  requiredPoint: {
    marginTop: 4,
    fontFamily: 'exo',
    fontSize: 11.5,
    color: '#23314F',
    lineHeight: 16,
  },
  requiredButton: {
    marginTop: 'auto',
    borderRadius: 12,
    backgroundColor: '#5667FD',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 6,
  },
  requiredButtonText: {
    fontFamily: 'exoSemibold',
    fontSize: 12,
    color: '#FFFFFF',
  },
  requiredFooterLine: {
    marginTop: 5,
    textAlign: 'center',
    fontFamily: 'exo',
    fontSize: 10.5,
    color: '#485571',
    lineHeight: 13,
  },
  socialProofTitle: {
    marginTop: 14,
    textAlign: 'center',
    fontFamily: 'exoSemibold',
    fontSize: 24,
    color: '#1F2A44',
    lineHeight: 32,
  },
  socialProofChip: {
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: '#D8E2F6',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  socialProofChipText: {
    textAlign: 'center',
    fontFamily: 'exoSemibold',
    fontSize: 16,
    color: '#1C4EA8',
    lineHeight: 22,
  },
  faqWrap: {
    marginTop: 12,
    gap: 8,
  },
  faqItem: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: '#D8E2F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  faqQuestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  faqQuestion: {
    flex: 1,
    fontFamily: 'exoSemibold',
    fontSize: 13,
    color: '#1F2A44',
    lineHeight: 18,
  },
  faqChevron: {
    fontFamily: 'exoSemibold',
    fontSize: 18,
    color: '#5667FD',
    marginTop: -2,
  },
  faqAnswer: {
    marginTop: 8,
    fontFamily: 'exo',
    fontSize: 12,
    lineHeight: 17,
    color: '#4C5A76',
  },
  subHeaderRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: '#D9E2F7',
  },
  subHeaderTitle: {
    fontFamily: 'exoSemibold',
    fontSize: 20,
    color: '#1F2A44',
  },
  currentPlanCard: {
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D9E2F7',
    padding: 14,
  },
  currentPlanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  currentPlanTitle: {
    flex: 1,
    fontFamily: 'exoSemibold',
    fontSize: 17,
    color: '#1F2A44',
  },
  currentPlanBadge: {
    backgroundColor: '#FFD65A',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  currentPlanBadgeText: {
    fontFamily: 'exoSemibold',
    color: '#5B4A00',
    fontSize: 13,
  },
  currentPlanRemainText: {
    marginTop: 10,
    fontFamily: 'exoSemibold',
    fontSize: 14,
    color: '#1F2A44',
  },
  inlineSuccess: {
    marginTop: 8,
    backgroundColor: '#E8F6EE',
    borderWidth: 1,
    borderColor: '#BEE5CC',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inlineSuccessText: {
    fontFamily: 'exoSemibold',
    fontSize: 12,
    color: '#256C49',
  },
  progressTrack: {
    marginTop: 10,
    height: 12,
    borderRadius: 999,
    backgroundColor: '#E8ECF8',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#3B82F6',
  },
  usageCard: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: '#F3F6FD',
    borderWidth: 1,
    borderColor: '#DBE5FA',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  usageTitle: {
    fontFamily: 'exoSemibold',
    fontSize: 12,
    color: '#23314F',
    marginBottom: 2,
  },
  usageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  usageLabel: {
    fontFamily: 'exo',
    fontSize: 12,
    color: '#3C4A68',
    flex: 1,
  },
  usageValue: {
    fontFamily: 'exoSemibold',
    fontSize: 12,
    color: '#1F2A44',
  },
  trialReviewLock: {
    marginTop: 8,
    fontFamily: 'exo',
    fontSize: 12,
    color: '#6B7280',
  },
  nextChargeText: {
    marginTop: 14,
    fontFamily: 'exo',
    color: '#3C4A68',
    fontSize: 13,
  },
  nextChargePrice: {
    marginTop: 4,
    fontFamily: 'exoSemibold',
    color: '#1F2A44',
    fontSize: 16,
  },
  manageButton: {
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: '#5667FD',
    paddingVertical: 12,
    alignItems: 'center',
  },
  manageButtonText: {
    fontFamily: 'exoSemibold',
    color: '#FFFFFF',
    fontSize: 16,
  },
  otherPlansTitle: {
    marginTop: 18,
    marginBottom: 8,
    fontFamily: 'exoSemibold',
    fontSize: 18,
    color: '#1F2A44',
  },
  otherPlansCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D9E2F7',
    padding: 12,
  },
  periodBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  daysBadge: {
    borderRadius: 12,
    backgroundColor: '#EEF3FF',
    borderWidth: 1,
    borderColor: '#D5E0FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  daysBadgeText: {
    fontFamily: 'exoSemibold',
    color: '#1B4FB1',
    fontSize: 14,
  },
  minusBadge: {
    borderRadius: 12,
    backgroundColor: '#FFD65A',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  minusBadgeText: {
    fontFamily: 'exoSemibold',
    color: '#6A5100',
    fontSize: 14,
  },
  offerRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  offerRowCompact: {
    flexDirection: 'column',
    gap: 10,
  },
  offerCol: {
    flex: 1,
    minHeight: 340,
    borderRadius: 14,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E3EAF8',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  offerColCompact: {
    minHeight: 0,
  },
  offerColPro: {
    backgroundColor: '#F4F8FF',
    borderColor: '#CBDCFF',
    shadowColor: '#7EA0E8',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  offerColCurrent: {
    borderColor: '#5667FD',
    borderWidth: 1.5,
  },
  offerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    minHeight: 28,
  },
  offerPlanBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#EEF3FF',
    borderWidth: 1,
    borderColor: '#D3DEFA',
  },
  offerPlanBadgeText: {
    fontFamily: 'exoSemibold',
    fontSize: 14,
    color: '#1B4FB1',
  },
  offerCurrentChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#E8ECFF',
    borderWidth: 1,
    borderColor: '#C8D3FF',
  },
  offerCurrentInline: {
    alignSelf: 'flex-start',
    marginBottom: 6,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#E8ECFF',
    borderWidth: 1,
    borderColor: '#C8D3FF',
  },
  offerCurrentChipText: {
    fontFamily: 'exoSemibold',
    fontSize: 11,
    color: '#3143AE',
  },
  offerPlanName: {
    fontFamily: 'exoSemibold',
    fontSize: 14,
    color: '#1B4FB1',
    marginBottom: 4,
  },
  offerDivider: {
    width: 1,
    backgroundColor: '#DFE6F7',
    marginHorizontal: 10,
  },
  offerPrice: {
    fontFamily: 'exoSemibold',
    fontSize: 24,
    color: '#1F2A44',
    marginBottom: 6,
  },
  proPriceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginBottom: 6,
  },
  oldPrice: {
    fontFamily: 'exo',
    fontSize: 14,
    color: '#7E8AA3',
    textDecorationLine: 'line-through',
    marginBottom: 4,
  },
  offerPerDay: {
    fontFamily: 'exoSemibold',
    fontSize: 12,
    color: '#4A5D95',
    marginBottom: 6,
  },
  offerFeaturesWrap: {
    minHeight: 112,
  },
  offerItem: {
    fontFamily: 'exo',
    fontSize: 14,
    color: '#23314F',
    marginBottom: 5,
  },
  deltaWrap: {
    marginTop: 4,
    marginBottom: 4,
    gap: 2,
    minHeight: 42,
  },
  deltaTitle: {
    fontFamily: 'exoSemibold',
    fontSize: 11.5,
    color: '#4C5A76',
  },
  deltaText: {
    fontFamily: 'exoSemibold',
    fontSize: 11.5,
    color: '#1B4FB1',
  },
  offerBottomWrap: {
    marginTop: 'auto',
  },
  offerPrimaryBtn: {
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: '#5667FD',
    alignItems: 'center',
    paddingVertical: 10,
  },
  offerPrimaryBtnText: {
    fontFamily: 'exoSemibold',
    color: '#FFFFFF',
    fontSize: 15,
  },
  offerMicrocopy: {
    fontFamily: 'exo',
    color: '#4C5A76',
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
  offerButtonDisabled: {
    opacity: 0.55,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(12,20,38,0.35)',
    justifyContent: 'flex-end',
  },
  sheetBackdropTouch: {
    flex: 1,
  },
  sheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderColor: '#D9E2F7',
  },
  sheetTitle: {
    fontFamily: 'exoSemibold',
    fontSize: 20,
    color: '#1F2A44',
  },
  sheetCurrent: {
    marginTop: 8,
    fontFamily: 'exoSemibold',
    fontSize: 14,
    color: '#1F2A44',
  },
  sheetNext: {
    marginTop: 4,
    fontFamily: 'exo',
    fontSize: 13,
    color: '#4C5A76',
  },
  sheetActionPrimary: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: '#5667FD',
    paddingVertical: 11,
    alignItems: 'center',
  },
  sheetActionPrimaryText: {
    fontFamily: 'exoSemibold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  sheetRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetRowLabel: {
    fontFamily: 'exoSemibold',
    fontSize: 14,
    color: '#1F2A44',
  },
  sheetToggle: {
    minWidth: 58,
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  sheetToggleOn: {
    backgroundColor: '#E2F7EA',
    borderWidth: 1,
    borderColor: '#BCE7CC',
  },
  sheetToggleOff: {
    backgroundColor: '#F2F4F8',
    borderWidth: 1,
    borderColor: '#D7DFEE',
  },
  sheetToggleText: {
    fontFamily: 'exoSemibold',
    fontSize: 12,
    color: '#2C3F6E',
  },
  sheetActionDanger: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: '#FFF2F2',
    borderWidth: 1,
    borderColor: '#FFD6D6',
    paddingVertical: 10,
    alignItems: 'center',
  },
  sheetActionDangerText: {
    fontFamily: 'exoSemibold',
    fontSize: 14,
    color: '#C53B3B',
  },
  sheetHint: {
    marginTop: 6,
    fontFamily: 'exo',
    fontSize: 12,
    color: '#5D6881',
  },
  sheetSectionTitle: {
    marginTop: 12,
    fontFamily: 'exoSemibold',
    fontSize: 14,
    color: '#1F2A44',
  },
  sheetHistoryLine: {
    marginTop: 4,
    fontFamily: 'exo',
    fontSize: 12,
    color: '#44506A',
  },
  sheetSupport: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: '#EEF3FF',
    borderWidth: 1,
    borderColor: '#D6E1FA',
    paddingVertical: 10,
    alignItems: 'center',
  },
  sheetSupportText: {
    fontFamily: 'exoSemibold',
    fontSize: 14,
    color: '#2F4FA8',
  },
  sheetClose: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: '#F3F5FA',
    paddingVertical: 10,
    alignItems: 'center',
  },
  sheetCloseText: {
    fontFamily: 'exoSemibold',
    fontSize: 14,
    color: '#33415E',
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(160,176,209,0.6)',
    marginBottom: 6,
  },
  closeButtonText: {
    fontFamily: 'exoSemibold',
    color: '#1F2A44',
    fontSize: 22,
    lineHeight: 24,
    marginTop: -1,
  },
  closeButtonDisabled: {
    color: 'rgba(31,42,68,0.25)',
  },
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
  planDescription: {
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'exo',
    fontSize: 14,
    color: '#5D6881',
    lineHeight: 20,
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
    minHeight: 160,
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
    fontSize: 18,
  },
  periodHint: {
    marginTop: 4,
    fontFamily: 'exo',
    fontSize: 12,
    lineHeight: 16,
    color: '#6C7892',
  },
  periodPrice: {
    fontFamily: 'exoSemibold',
    color: '#141E35',
    fontSize: 28,
    lineHeight: 34,
    flexShrink: 1,
    marginTop: 8,
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
