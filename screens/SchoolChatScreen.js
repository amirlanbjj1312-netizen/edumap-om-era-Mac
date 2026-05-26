import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import {
  ArrowLeftIcon,
  PaperAirplaneIcon,
} from 'react-native-heroicons/solid';
import { useSchools } from '../context/SchoolsContext';
import { useAuth } from '../context/AuthContext';
import { askSchoolChat } from '../services/aiSchoolChat';
import { useLocale } from '../context/LocaleContext';
import { consumeFeatureUsage } from '../services/subscriptionAccess';

const MAX_SCHOOLS = 30;
const CHAT_UI = {
  ru: {
    title: 'AI чат',
    welcome:
      'Привет! Помогу подобрать школу. Спросите про город, бюджет, язык обучения или программы.',
    placeholder: 'Напишите ваш запрос...',
    emptyTitle: 'Попробуйте спросить:',
    prompts: [
      'Подбери частные школы в Алматы до 250000 ₸',
      'Какие школы в Астане с английским языком обучения?',
      'Где есть робототехника и сильная математика?',
      'Покажи школы рядом и без вступительных экзаменов',
    ],
    noResponse: 'Не удалось получить ответ. Попробуйте еще раз.',
    noResponseLater: 'Не удалось получить ответ. Попробуйте позже.',
    localIntro: 'Показываю ближайшие совпадения по данным приложения:',
    localNoMatches: 'Не нашел явных совпадений. Попробуйте уточнить город, бюджет, язык или программу.',
  },
  en: {
    title: 'AI Chat',
    welcome:
      'Hi! I can help you choose a school. Ask about city, budget, language of instruction, or programs.',
    placeholder: 'Type your request...',
    emptyTitle: 'Try asking:',
    prompts: [
      'Find private schools in Almaty up to 250000 ₸',
      'Which schools in Astana teach in English?',
      'Where can I find robotics and strong math?',
      'Show nearby schools without entrance exams',
    ],
    noResponse: "Couldn't get a response. Please try again.",
    noResponseLater: "Couldn't get a response. Please try again later.",
    localIntro: 'Here are the closest matches from the app data:',
    localNoMatches: 'I could not find clear matches. Try refining the city, budget, language, or program.',
  },
  kk: {
    title: 'AI чат',
    welcome:
      'Сәлем! Мектеп таңдауға көмектесемін. Қала, бюджет, оқу тілі немесе бағдарламалар туралы сұраңыз.',
    placeholder: 'Сұрағыңызды жазыңыз...',
    emptyTitle: 'Мына сұрақтарды көріңіз:',
    prompts: [
      'Алматыда 250000 ₸ дейінгі жекеменшік мектептерді көрсет',
      'Астанада ағылшын тілінде оқытатын мектептер қандай?',
      'Робототехника және мықты математика қай мектептерде бар?',
      'Жақын маңдағы, емтихансыз мектептерді көрсет',
    ],
    noResponse: 'Жауап алу мүмкін болмады. Қайта көріңіз.',
    noResponseLater: 'Жауап алу мүмкін болмады. Кейінірек қайталап көріңіз.',
    localIntro: 'Қолданба деректері бойынша ең жақын сәйкестіктер:',
    localNoMatches: 'Нақты сәйкестік табылмады. Қала, бюджет, оқу тілі немесе бағдарламаны нақтылап көріңіз.',
  },
};

const extractText = (value) => {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    const parts = [];
    if (typeof value.ru === 'string') parts.push(value.ru);
    if (typeof value.en === 'string') parts.push(value.en);
    return parts.join(' ');
  }
  return '';
};

const toTokens = (value) =>
  extractText(value)
    .toLowerCase()
    .replace(/[^a-zа-я0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter(Boolean);

const buildSchoolText = (school) =>
  [
    school.name,
    school.city,
    school.address,
    school.type,
    school.languages,
    school.curricula,
    school.advancedSubjects,
    school.clubs,
    school.meals,
    school.specialists,
    school.region,
  ]
    .map(extractText)
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const rankSchools = (cards, message) => {
  const tokens = toTokens(message);
  if (!tokens.length) return cards.slice(0, MAX_SCHOOLS);
  const scored = cards.map((card) => {
    const haystack = buildSchoolText(card);
    let score = 0;
    tokens.forEach((token) => {
      if (haystack.includes(token)) {
        score += token.length;
      }
    });
    return { card, score };
  });
  const sorted = scored.sort((a, b) => b.score - a.score);
  return sorted.map((entry) => entry.card).slice(0, MAX_SCHOOLS);
};

const formatMoney = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return '';
  return `${Math.round(amount).toLocaleString('ru-RU')} ₸`;
};

const getSchoolName = (card) =>
  extractText(card?.name) ||
  extractText(card?.basic_info?.display_name) ||
  extractText(card?.basic_info?.brand_name) ||
  extractText(card?.basic_info?.short_name) ||
  'School';

const getSchoolCity = (card) =>
  extractText(card?.city) ||
  extractText(card?.basic_info?.city);

const getSchoolFee = (card) => {
  const raw =
    card?.monthlyFee ??
    card?.finance?.monthly_fee ??
    card?.finance?.tuition_monthly ??
    card?.finance?.price_monthly;
  const text = extractText(raw);
  if (!text) return '';
  const numeric = Number(String(text).replace(/[^\d.,]/g, '').replace(',', '.'));
  return formatMoney(numeric) || text;
};

const buildLocalReply = (cards, locale, chatUi) => {
  const top = cards.slice(0, 3);
  if (!top.length) {
    return { text: chatUi.localNoMatches, recommendedSchoolIds: [] };
  }

  const lines = [chatUi.localIntro];
  top.forEach((card, index) => {
    const name = getSchoolName(card);
    const city = getSchoolCity(card);
    const fee = getSchoolFee(card);
    const parts = [city, fee].filter(Boolean);
    lines.push(`${index + 1}. ${name}${parts.length ? ` — ${parts.join(' • ')}` : ''}`);
  });

  return {
    text: lines.join('\n'),
    recommendedSchoolIds: top
      .map((card) => card.school_id || String(card.id || ''))
      .filter(Boolean),
  };
};

export default function SchoolChatScreen() {
  const navigation = useNavigation();
  const { schoolCards } = useSchools();
  const { account } = useAuth();
  const { locale } = useLocale();
  const chatUi = CHAT_UI[locale] || CHAT_UI.ru;
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState(() => [
    {
      id: 'welcome',
      role: 'assistant',
      text: chatUi.welcome,
    },
  ]);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    setMessages((prev) => {
      const hasOnlyWelcome = prev.length === 1 && prev[0]?.id === 'welcome';
      if (!hasOnlyWelcome) return prev;
      return [{ id: 'welcome', role: 'assistant', text: chatUi.welcome }];
    });
  }, [chatUi.welcome]);

  const cardsById = useMemo(() => {
    const map = new Map();
    schoolCards.forEach((card) => {
      const id = card.school_id || String(card.id || '');
      if (id) map.set(id, card);
    });
    return map;
  }, [schoolCards]);

  const appendMessage = useCallback((message) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  useEffect(() => {
    if (!listRef.current) return;
    requestAnimationFrame(() => {
      listRef.current.scrollToEnd({ animated: true });
    });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    const usage = await consumeFeatureUsage({
      userKey: account?.id || account?.email || 'guest',
      feature: 'ai_chat',
    });
    if (!usage.ok) {
      const windowRu = usage.window === 'day' ? 'в день' : 'за период';
      const windowEn = usage.window === 'day' ? 'per day' : 'per period';
      const windowKk = usage.window === 'day' ? 'күніне' : 'кезеңге';
      const limitText =
        locale === 'en'
          ? `AI chat limit reached (${usage.limit} ${windowEn}).`
          : locale === 'kk'
          ? `AI чат лимиті аяқталды (${usage.limit} ${windowKk}).`
          : `Лимит AI-чата исчерпан (${usage.limit} ${windowRu}).`;
      appendMessage({
        id: `assistant-limit-${Date.now()}`,
        role: 'assistant',
        text: limitText,
      });
      return;
    }
    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
    };
    appendMessage(userMessage);
    setInput('');
    setSending(true);

    const ranked = rankSchools(schoolCards, text);
    const schoolIds = ranked
      .map((card) => card.school_id || String(card.id || ''))
      .filter(Boolean);

    try {
      const result = await askSchoolChat(text, schoolIds);
      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: result?.reply || chatUi.noResponse,
        recommendedSchoolIds: result?.recommendedSchoolIds || [],
      };
      appendMessage(assistantMessage);
    } catch (error) {
      const fallback = buildLocalReply(ranked, locale, chatUi);
      appendMessage({
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: fallback.text || chatUi.noResponseLater,
        recommendedSchoolIds: fallback.recommendedSchoolIds || [],
      });
    } finally {
      setSending(false);
    }
  }, [
    account?.email,
    account?.id,
    appendMessage,
    input,
    locale,
    schoolCards,
    sending,
    chatUi.noResponse,
    chatUi.noResponseLater,
  ]);

  const handlePromptPress = useCallback((prompt) => {
    setInput(prompt);
  }, []);

  const renderRecommendations = (ids = []) => {
    if (!ids.length) return null;
    return (
      <View className="mt-3">
        {ids
          .map((id) => cardsById.get(id))
          .filter(Boolean)
          .map((card) => (
            <Pressable
              key={card.school_id || card.id}
              className="bg-white/90 rounded-2xl px-4 py-3 mb-2"
              onPress={() =>
                navigation.navigate('SchoolDetail', {
                  schoolId: card.school_id || card.id,
                })
              }
            >
              <Text className="font-exoSemibold text-darkGrayText">
                {card.name}
              </Text>
              {card.address ? (
                <Text className="font-exo text-darkGrayText/70 text-xs mt-1">
                  {card.address}
                </Text>
              ) : null}
            </Pressable>
          ))}
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#E9EEF6' }}>
      <LinearGradient
        colors={['#E9EEF6', '#E9EEF6', '#E9EEF6']}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ flex: 1 }}
      >
        <KeyboardAvoidingView className="flex-1" behavior="padding">
          <View className="px-6 pt-6 pb-4">
            <Pressable
              className="w-10 h-10 rounded-full bg-white/80 items-center justify-center"
              onPress={() => navigation.goBack()}
            >
              <ArrowLeftIcon color="#364356" size={20} />
            </Pressable>
            <Text className="text-darkGrayText font-exoSemibold text-3xl mt-4">
              {chatUi.title}
            </Text>
          </View>

          {!input.trim() && messages.length <= 1 ? (
            <View className="px-6 pb-4">
              <Text className="text-darkGrayText/80 font-exoSemibold text-sm mb-2">
                {chatUi.emptyTitle}
              </Text>
              <View className="flex-row flex-wrap">
                {chatUi.prompts.map((prompt) => (
                  <Pressable
                    key={prompt}
                    className="rounded-2xl border border-darkGrayText/20 bg-white px-3 py-2 mr-2 mb-2"
                    onPress={() => handlePromptPress(prompt)}
                  >
                    <Text className="font-exo text-darkGrayText text-xs">{prompt}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 20 }}
            renderItem={({ item }) => (
              <View
                className={`mb-3 ${
                  item.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <View
                  className={`rounded-2xl px-4 py-3 ${
                    item.role === 'user'
                      ? 'bg-white/90'
                      : 'bg-bgPurple/20'
                  }`}
                  style={{ maxWidth: '85%' }}
                >
                  <Text
                    className={`font-exo text-sm ${
                      item.role === 'user'
                        ? 'text-darkGrayText'
                        : 'text-white'
                    }`}
                  >
                    {item.text}
                  </Text>
                </View>
                {item.role === 'assistant'
                  ? renderRecommendations(item.recommendedSchoolIds)
                  : null}
              </View>
            )}
            ListFooterComponent={
              sending ? (
                <View className="items-start mb-3">
                  <View className="bg-bgPurple/20 rounded-2xl px-4 py-3">
                    <ActivityIndicator color="#FFFFFF" />
                  </View>
                </View>
              ) : null
            }
          />

          <View className="px-6 pb-6">
            <View className="flex-row items-center bg-white rounded-2xl px-4 py-2">
              <TextInput
                className="flex-1 font-exo text-darkGrayText"
                placeholder={chatUi.placeholder}
                placeholderTextColor="rgba(31,41,51,0.4)"
                value={input}
                onChangeText={setInput}
                multiline
              />
              <Pressable
                className="ml-3 w-10 h-10 rounded-full bg-bgPurple items-center justify-center"
                onPress={handleSend}
                disabled={sending || !input.trim()}
                style={{
                  opacity: sending || !input.trim() ? 0.6 : 1,
                }}
              >
                <PaperAirplaneIcon color="#FFFFFF" size={18} />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}
