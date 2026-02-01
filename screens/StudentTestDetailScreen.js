import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeftIcon } from 'react-native-heroicons/outline';
import { useTests } from '../context/TestsContext';

export default function StudentTestDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { subjectId, testId, subjectTitle } = route.params || {};
  const { getTestsForSubject, isTestCompleted, markTestCompleted } = useTests();

  const tests = useMemo(
    () => getTestsForSubject(subjectId) || [],
    [getTestsForSubject, subjectId]
  );
  const test = tests.find((t) => t.id === testId);
  const [answers, setAnswers] = useState({});

  const allAnswered = useMemo(() => {
    if (!test?.questions?.length) return false;
    return test.questions.every((q) => answers[q.id] !== undefined);
  }, [answers, test]);

  const completed = isTestCompleted(subjectId, testId);

  useEffect(() => {
    if (!test || completed || !allAnswered) return;
    markTestCompleted(subjectId, testId);
  }, [allAnswered, completed, markTestCompleted, subjectId, testId, test]);

  if (!test) return null;

  const handleSelect = (questionId, optionIndex) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  return (
    <SafeAreaView className="flex-1 bg-bgWhite">
      <View className="flex-row items-center px-4 pt-4 pb-2">
        <Pressable
          className="w-10 h-10 rounded-full bg-bgPurple/10 items-center justify-center"
          onPress={() => navigation.goBack()}
        >
          <ArrowLeftIcon size={20} color="#7E73F4" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-center text-darkGrayText font-exoSemibold text-lg">
            {test.title}
          </Text>
          <Text className="text-center text-darkGrayText/60 font-exo text-xs">
            {subjectTitle} · Grade {test.grade}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        className="px-6"
        contentContainerStyle={{ paddingBottom: 32, paddingTop: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {test.questions?.map((q, idx) => {
          const selected = answers[q.id];
          const isCorrect = selected === q.correctIndex;
          return (
            <View
              key={q.id}
              className="bg-white border border-bgPurple/15 rounded-2xl p-4 mb-4 shadow-sm shadow-black/5"
            >
              <Text className="text-darkGrayText/60 font-exo text-xs mb-1">
                Question {idx + 1}
              </Text>
              <Text className="text-darkGrayText font-exoSemibold text-base mb-3">
                {q.text}
              </Text>
              <View className="space-y-2">
                {q.options?.map((opt, optIdx) => {
                  const selectedStyle = selected === optIdx;
                  const correctStyle =
                    selected !== undefined && q.correctIndex === optIdx;
                  return (
                    <Pressable
                      key={`${q.id}-opt-${optIdx}`}
                      className={`rounded-xl border px-3 py-3 ${
                        selectedStyle
                          ? 'border-bgPurple bg-bgPurple/10'
                          : 'border-bgPurple/15 bg-bgPurple/5'
                      }`}
                      onPress={() => handleSelect(q.id, optIdx)}
                    >
                      <Text
                        className={`font-exo text-base ${
                          correctStyle
                            ? 'text-bgPurple font-exoSemibold'
                            : 'text-darkGrayText'
                        }`}
                      >
                        {String.fromCharCode(65 + optIdx)}. {opt}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {selected !== undefined ? (
                <Text
                  className={`mt-3 font-exoSemibold text-sm ${
                    isCorrect ? 'text-green-600' : 'text-red-500'
                  }`}
                >
                  {isCorrect ? 'Correct' : 'Try again'}
                </Text>
              ) : null}
              {q.video ? (
                <Text className="text-bgPurple font-exo text-xs mt-2">
                  Video: {q.video}
                </Text>
              ) : null}
              {q.image ? (
                <Text className="text-bgPurple font-exo text-xs mt-1">
                  Image: {q.image}
                </Text>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
