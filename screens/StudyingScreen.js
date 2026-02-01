import React, { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useTests } from '../context/TestsContext';
import Svg, { Circle, G } from 'react-native-svg';

const SUBJECTS = [
  {
    id: 'math',
    title: 'Mathematics',
    description: 'Practice sums, time & money problems, plus addition/subtraction drills.',
  },
  {
    id: 'reading',
    title: 'Reading comprehension',
    description: 'Short texts with comprehension questions and multiple-choice answers.',
  },
  {
    id: 'science',
    title: 'Science basics',
    description: 'Living things, organs, plants, and other core science concepts.',
  },
  {
    id: 'art',
    title: 'Art & creativity',
    description: 'Colors, shapes, materials, and simple creative techniques.',
  },
];

const SubjectCard = ({ title, description, testsCount, onPress }) => (
  <Pressable
    className="bg-white p-4 mb-4 shadow-sm shadow-black/10"
    style={{ width: '48%', aspectRatio: 1, borderRadius: 20 }}
    onPress={onPress}
  >
    <Text className="text-darkGrayText font-exoSemibold text-base mb-2">
      {title}
    </Text>
    <Text
      className="text-darkGrayText/70 font-exo text-xs mb-3"
      numberOfLines={2}
    >
      {description}
    </Text>
    <View className="mt-auto">
      <Text className="text-bgPurple font-exoSemibold text-sm">
        {testsCount} tests
      </Text>
      <Text className="text-bgPurple font-exo text-xs mt-1">Open →</Text>
    </View>
  </Pressable>
);

const StatCard = ({ label, value }) => (
  <View className="bg-white rounded-2xl p-4 mb-4" style={{ width: '48%' }}>
    <Text className="text-darkGrayText/70 font-exo text-xs">{label}</Text>
    <Text className="text-darkGrayText font-exoSemibold text-2xl mt-1">
      {value}
    </Text>
  </View>
);

const ChartCard = ({ title, data }) => {
  const maxValue = data.reduce((max, item) => Math.max(max, item.value), 0);
  const chartHeight = 90;

  return (
    <View className="bg-white rounded-2xl p-4 mb-4">
      <Text className="text-darkGrayText font-exoSemibold text-sm mb-3">
        {title}
      </Text>
      {maxValue === 0 ? (
        <Text className="text-darkGrayText/60 font-exo text-xs">
          No data yet.
        </Text>
      ) : (
        <View className="flex-row items-end" style={{ height: 140 }}>
          {data.map((item) => {
            const height = Math.max(
              8,
              Math.round((item.value / maxValue) * chartHeight)
            );
            return (
              <View key={item.label} className="flex-1 items-center">
                <Text className="text-darkGrayText/60 font-exo text-[10px] mb-2">
                  {item.value}
                </Text>
                <View
                  className="w-6 rounded-t-lg bg-[#1FA6FF]"
                  style={{ height }}
                />
                <Text
                  className="text-darkGrayText/70 font-exo text-[10px] mt-2"
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const PIE_COLORS = ['#1FA6FF', '#7E73F4', '#34D399', '#F59E0B', '#EF4444'];

const PieChartCard = ({ title, data }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const size = 140;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <View className="bg-white rounded-2xl p-4 mb-4">
      <Text className="text-darkGrayText font-exoSemibold text-sm mb-3">
        {title}
      </Text>
      {total === 0 ? (
        <Text className="text-darkGrayText/60 font-exo text-xs">
          No data yet.
        </Text>
      ) : (
        <View className="flex-row items-center">
          <Svg width={size} height={size}>
            <G rotation="-90" originX={size / 2} originY={size / 2}>
              {data.map((item, index) => {
                const length = (item.value / total) * circumference;
                const dasharray = `${length} ${circumference - length}`;
                const dashoffset = -offset;
                offset += length;
                return (
                  <Circle
                    key={item.label}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={PIE_COLORS[index % PIE_COLORS.length]}
                    strokeWidth={strokeWidth}
                    strokeDasharray={dasharray}
                    strokeDashoffset={dashoffset}
                    fill="transparent"
                  />
                );
              })}
            </G>
          </Svg>
          <View className="flex-1 ml-4">
            {data.map((item, index) => (
              <View key={item.label} className="flex-row items-center mb-2">
                <View
                  className="w-2 h-2 rounded-full mr-2"
                  style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                />
                <Text className="text-darkGrayText/70 font-exo text-xs flex-1">
                  {item.label}
                </Text>
                <Text className="text-darkGrayText font-exoSemibold text-xs">
                  {Math.round((item.value / total) * 100)}%
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

export default function StudyingScreen() {
  const navigation = useNavigation();
  const { testsBySubject, completedTests } = useTests();

  const subjects = useMemo(
    () =>
      SUBJECTS.map((s) => ({
        ...s,
        testsCount: (testsBySubject[s.id] || []).length,
      })),
    [testsBySubject]
  );

  const stats = useMemo(() => {
    const tests = Object.values(testsBySubject || {}).flat();
    const totalTests = tests.length;
    const totalQuestions = tests.reduce(
      (sum, test) => sum + (test.questions?.length || 0),
      0
    );
    const avgQuestions = totalTests
      ? (totalQuestions / totalTests).toFixed(1)
      : '0';
    const completedCount = Object.values(completedTests || {}).reduce(
      (sum, subject) => sum + Object.keys(subject || {}).length,
      0
    );
    const completedRatio = totalTests
      ? `${completedCount}/${totalTests}`
      : '0';
    const gradeMap = tests.reduce((acc, test) => {
      const grade = (test.grade || '').trim();
      const key = grade || 'Other';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const gradeEntries = Object.entries(gradeMap).sort(([a], [b]) => {
      const aNum = Number.parseInt(a, 10);
      const bNum = Number.parseInt(b, 10);
      if (Number.isNaN(aNum) && Number.isNaN(bNum)) {
        return a.localeCompare(b);
      }
      if (Number.isNaN(aNum)) return 1;
    if (Number.isNaN(bNum)) return -1;
    return aNum - bNum;
  });
    const subjectsData = SUBJECTS.map((subject) => {
      const tests = testsBySubject[subject.id] || [];
      const questions = tests.reduce(
        (sum, test) => sum + (test.questions?.length || 0),
        0
      );
      const shortLabel = subject.title.split(' ')[0];
      return {
        id: subject.id,
        label: shortLabel,
        testsCount: tests.length,
        questionsCount: questions,
      };
    });
    return {
      subjectsCount: SUBJECTS.length,
      totalTests,
      totalQuestions,
      avgQuestions,
      completedCount,
      completedRatio,
      gradeEntries,
      testsBySubjectData: subjectsData.map((item) => ({
        label: item.label,
        value: item.testsCount,
      })),
      questionsBySubjectData: subjectsData.map((item) => ({
        label: item.label,
        value: item.questionsCount,
      })),
      testsByGradeData: gradeEntries.map(([grade, count]) => ({
        label: Number.isNaN(Number.parseInt(grade, 10)) ? grade : `G${grade}`,
        value: count,
      })),
    };
  }, [testsBySubject, completedTests]);

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
          contentContainerStyle={{ paddingBottom: 32, paddingHorizontal: 24, paddingTop: 24 }}
          showsVerticalScrollIndicator={false}
        >
          <Text className="text-white font-exoSemibold text-3xl mb-2">
            Studying Hub
          </Text>
          <Text className="text-white/80 font-exo mb-6">
            Courses and quizzes for grades 1–4: pick a subject and start learning.
          </Text>

          <Text className="text-white font-exoSemibold text-xl mb-3">
            Subjects
          </Text>
          <View className="flex-row flex-wrap justify-between">
            {subjects.map((s) => (
              <SubjectCard
                key={s.id}
                title={s.title}
                description={s.description}
                testsCount={s.testsCount}
                onPress={() => navigation.navigate('StudentTests', { subject: s })}
              />
            ))}
          </View>

          <View className="mb-6">
            <Text className="text-white font-exoSemibold text-xl mb-3">
              Statistics
            </Text>
            <View className="flex-row flex-wrap justify-between">
              <StatCard label="Subjects" value={stats.subjectsCount} />
              <StatCard label="Tests" value={stats.totalTests} />
              <StatCard label="Completed tests" value={stats.completedRatio} />
              <StatCard label="Questions" value={stats.totalQuestions} />
              <StatCard label="Avg questions/test" value={stats.avgQuestions} />
            </View>
            <View className="bg-white rounded-2xl p-4">
              <Text className="text-darkGrayText font-exoSemibold text-sm mb-2">
                Tests by grade
              </Text>
              <View className="flex-row flex-wrap">
                {stats.gradeEntries.map(([grade, count]) => (
                  <View
                    key={grade}
                    className="px-3 py-1 bg-bgPurple/10 rounded-full mr-2 mb-2"
                  >
                    <Text className="text-bgPurple font-exoSemibold text-xs">
                      {Number.isNaN(Number.parseInt(grade, 10))
                        ? grade
                        : `Grade ${grade}`}
                      : {count}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <ChartCard
            title="Tests per subject"
            data={stats.testsBySubjectData}
          />
          <ChartCard
            title="Questions per subject"
            data={stats.questionsBySubjectData}
          />
          <PieChartCard title="Tests by grade" data={stats.testsByGradeData} />
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}
