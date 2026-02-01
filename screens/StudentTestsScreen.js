import React, { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeftIcon } from 'react-native-heroicons/outline';
import { useTests } from '../context/TestsContext';

export default function StudentTestsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const subject = route.params?.subject;
  const { getTestsForSubject } = useTests();

  const tests = useMemo(
    () => getTestsForSubject(subject?.id) || [],
    [getTestsForSubject, subject]
  );

  if (!subject) return null;

  return (
    <SafeAreaView className="flex-1 bg-bgWhite">
      <View className="flex-row items-center px-4 pt-4 pb-2">
        <Pressable
          className="w-10 h-10 rounded-full bg-bgPurple/10 items-center justify-center"
          onPress={() => navigation.goBack()}
        >
          <ArrowLeftIcon size={20} color="#7E73F4" />
        </Pressable>
        <Text className="flex-1 text-center text-darkGrayText font-exoSemibold text-lg">
          {subject?.title || 'Tests'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        className="px-6"
        contentContainerStyle={{ paddingBottom: 32, paddingTop: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {tests.map((test) => (
          <Pressable
            key={test.id}
            className="bg-white border border-bgPurple/15 rounded-2xl p-4 mb-4 shadow-sm shadow-black/5"
            onPress={() =>
              navigation.navigate('StudentTestDetail', {
                subjectId: subject.id,
                testId: test.id,
                subjectTitle: subject.title,
              })
            }
          >
            <Text className="text-darkGrayText font-exoSemibold text-lg mb-1">
              {test.title}
            </Text>
            <Text className="text-darkGrayText/70 font-exo text-sm mb-2">
              Grade: {test.grade}
            </Text>
            <Text className="text-bgPurple font-exo text-sm">
              {test.questions?.length || 0} questions
            </Text>
          </Pressable>
        ))}

        {tests.length === 0 ? (
          <Text className="text-darkGrayText/70 font-exo text-base">
            No tests yet for this subject.
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
