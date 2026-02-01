import React, { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTests } from '../context/TestsContext';
import { LinearGradient } from 'expo-linear-gradient';

const SUBJECTS = [
  {
    id: 'math',
    title: 'Mathematics',
    grades: ['1', '2', '3', '4'],
    tests: 5,
  },
  {
    id: 'reading',
    title: 'Reading & Language',
    grades: ['1', '2', '3', '4'],
    tests: 3,
  },
  {
    id: 'science',
    title: 'Science Basics',
    grades: ['3', '4'],
    tests: 2,
  },
  {
    id: 'art',
    title: 'Art & Creativity',
    grades: ['1', '2', '3', '4'],
    tests: 1,
  },
];

export default function ModeratorCoursesScreen() {
  const navigation = useNavigation();
  const { getTestsForSubject } = useTests();
  const subjects = useMemo(
    () =>
      SUBJECTS.map((subject) => ({
        ...subject,
        testsCount: getTestsForSubject(subject.id).length,
      })),
    [getTestsForSubject]
  );

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#44C5F5' }}>
      <LinearGradient
        colors={['#44C5F5', '#7E73F4', '#44C5F5']}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 }}
          className="px-6 pt-6"
        >
          <Text className="text-white font-exoSemibold text-3xl mb-4">
            Course library
          </Text>
          {subjects.map((subject) => (
            <View
              key={subject.id}
              className="bg-white rounded-2xl border border-bgPurple/15 p-4 mb-4"
            >
              <Text className="text-darkGrayText font-exoSemibold text-lg mb-1">
                {subject.title}
              </Text>
              <Text className="text-darkGrayText/70 font-exo text-sm mb-2">
                Grades: {subject.grades.join(', ')}
              </Text>
              <Text className="text-darkGrayText/70 font-exo text-sm mb-3">
                Tests: {subject.tests}
              </Text>
              <Pressable
                className="bg-bgPurple rounded-full py-2 px-4 self-start"
                onPress={() =>
                  navigation.navigate('ModeratorCourseDetail', { subject })
                }
              >
                <Text className="text-white font-exoSemibold text-sm">
                  Manage tests
                </Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}
