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
import { askSchoolChat } from '../services/aiSchoolChat';

const MAX_SCHOOLS = 30;

const toTokens = (value) =>
  value
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

const createChatSchoolPayload = (profile, fallbackCard) => {
  const id =
    profile?.school_id ||
    fallbackCard.school_id ||
    String(fallbackCard.id || '');
  const basicInfo = profile?.basic_info || {};
  const education = profile?.education || {};
  const services = profile?.services || {};
  const finance = profile?.finance || {};
  const system = profile?.system || {};
  const reviews = profile?.reviews || {};

  return {
    school_id: id,
    name: basicInfo.name || fallbackCard.name || '',
    type: basicInfo.type || fallbackCard.type || '',
    city: basicInfo.city || fallbackCard.city || '',
    district: basicInfo.district || '',
    address: basicInfo.address || fallbackCard.address || '',
    monthly_fee: finance.monthly_fee || fallbackCard.monthlyFee || '',
    languages: education.languages || fallbackCard.languages || '',
    programs: education.programs || '',
    curricula:
      education.curricula?.other ||
      education.curricula?.international?.join?.(', ') ||
      fallbackCard.curricula ||
      '',
    advanced_subjects:
      education.advanced_subjects || fallbackCard.advancedSubjects || '',
    clubs: services.clubs || fallbackCard.clubs || '',
    meals: services.meals || fallbackCard.meals || '',
    specialists: services.specialists || fallbackCard.specialists || '',
    rating:
      reviews.average_rating ??
      system.rating ??
      fallbackCard.rating ??
      '',
    reviews_count:
      reviews.count ??
      system.reviews_count ??
      fallbackCard.reviewsCount ??
      '',
  };
};

export default function SchoolChatScreen() {
  const navigation = useNavigation();
  const { schoolCards, profiles } = useSchools();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hi! I can help you find a school. Ask about city, budget, languages, or programs.',
    },
  ]);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const profilesById = useMemo(() => {
    const map = new Map();
    profiles.forEach((profile) => {
      if (profile.school_id) {
        map.set(profile.school_id, profile);
      }
    });
    return map;
  }, [profiles]);

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
    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
    };
    appendMessage(userMessage);
    setInput('');
    setSending(true);

    const ranked = rankSchools(schoolCards, text);
    const schoolsPayload = ranked.map((card) =>
      createChatSchoolPayload(profilesById.get(card.school_id), card)
    );

    try {
      const result = await askSchoolChat(text, schoolsPayload);
      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: result?.reply || "Couldn't get a response. Please try again.",
        recommendedSchoolIds: result?.recommendedSchoolIds || [],
      };
      appendMessage(assistantMessage);
    } catch (error) {
      const fallbackText =
        error?.message && error.message !== 'Request failed'
          ? error.message
          : "Couldn't get a response. Please try again later.";
      appendMessage({
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: fallbackText,
      });
    } finally {
      setSending(false);
    }
  }, [appendMessage, input, profilesById, schoolCards, sending]);

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
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#44C5F5' }}>
      <LinearGradient
        colors={['#44C5F5', '#7E73F4', '#44C5F5']}
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
            <Text className="text-white font-exoSemibold text-3xl mt-4">
              AI Chat
            </Text>
          </View>

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
                placeholder="Type your request..."
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
