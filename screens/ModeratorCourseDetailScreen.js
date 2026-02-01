import React, { useMemo, useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ScrollView,
  Text,
  View,
  Pressable,
  TextInput,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ArrowLeftIcon } from 'react-native-heroicons/outline';
import { useTests } from '../context/TestsContext';

export default function ModeratorCourseDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const subject = route.params?.subject;
  const { getTestsForSubject, addTest, upsertQuestion } = useTests();

  const tests = getTestsForSubject(subject?.id) || [];
  const [title, setTitle] = useState('');
  const [grade, setGrade] = useState(subject?.grades?.[0] || '1');
  const [selectedTestId, setSelectedTestId] = useState(null);
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [questionVideo, setQuestionVideo] = useState('');
  const [questionImage, setQuestionImage] = useState('');
  const [editQuestionId, setEditQuestionId] = useState(null);

  useEffect(() => {
    if (!selectedTestId && tests.length) {
      setSelectedTestId(tests[0].id);
    }
  }, [tests, selectedTestId]);

  if (!subject) return null;

  const selectedTest = tests.find((t) => t.id === selectedTestId) || null;

  const resetQuestionForm = () => {
    setQuestionText('');
    setOptions(['', '', '', '']);
    setCorrectIndex(0);
    setQuestionVideo('');
    setQuestionImage('');
    setEditQuestionId(null);
  };

  const handleAddTest = () => {
    if (!title.trim()) return;
    const newId = addTest(subject.id, {
      title: title.trim(),
      grade: grade.trim(),
    });
    setSelectedTestId(newId);
    setTitle('');
  };

  const addQuestion = () => {
    if (!selectedTest || !questionText.trim()) return;
    const trimmedOptions = options.map((opt) => opt.trim());
    if (trimmedOptions.some((opt) => !opt) || trimmedOptions.length < 2) return;
    const nextQuestion = {
      id: editQuestionId || `${selectedTest.id}-q-${Date.now()}`,
      text: questionText.trim(),
      options: trimmedOptions,
      correctIndex,
      video: questionVideo.trim(),
      image: questionImage.trim(),
    };
    upsertQuestion({
      subjectId: subject.id,
      testId: selectedTest.id,
      question: nextQuestion,
    });
    resetQuestionForm();
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
        <Text className="flex-1 text-center text-darkGrayText font-exoSemibold text-lg">
          {subject?.title || 'Course'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingBottom: 32, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="bg-white rounded-2xl border border-bgPurple/15 p-4 mb-4">
          <Text className="text-darkGrayText font-exoSemibold text-base mb-2">
            Add test
          </Text>
          <View className="bg-bgPurple/5 rounded-xl px-4 py-3 mb-3">
            <TextInput
              placeholder="Test title"
              placeholderTextColor="#94A3B8"
              value={title}
              onChangeText={setTitle}
              className="font-exo text-darkGrayText"
            />
          </View>
          <View className="bg-bgPurple/5 rounded-xl px-4 py-3 mb-3">
            <TextInput
              placeholder="Grade"
              placeholderTextColor="#94A3B8"
              value={grade}
              onChangeText={setGrade}
              className="font-exo text-darkGrayText"
            />
          </View>
          <Pressable
            className="bg-bgPurple rounded-full py-3 items-center"
            onPress={handleAddTest}
            style={{ opacity: title.trim() ? 1 : 0.5 }}
            disabled={!title.trim()}
          >
            <Text className="text-white font-exoSemibold">Add test</Text>
          </Pressable>
        </View>

        <Text className="text-darkGrayText font-exoSemibold text-xl mb-3">
          Tests
        </Text>
        {tests.map((test) => (
          <View
            key={test.id}
            className="bg-white rounded-2xl border border-bgPurple/15 p-4 mb-3"
          >
            <Text className="text-darkGrayText font-exoSemibold text-base mb-1">
              {test.title}
            </Text>
            <Text className="text-darkGrayText/70 font-exo text-sm">
              Grade: {test.grade}
            </Text>
            <Pressable
              className="mt-2 bg-bgPurple/10 rounded-full px-3 py-2 self-start"
              onPress={() => setSelectedTestId(test.id)}
            >
              <Text className="text-bgPurple font-exoSemibold text-sm">
                Manage questions
              </Text>
            </Pressable>
          </View>
        ))}
        {tests.length === 0 ? (
          <Text className="text-darkGrayText/70 font-exo">
            No tests yet. Add the first one.
          </Text>
        ) : null}

        {selectedTest ? (
          <View className="bg-white rounded-2xl border border-bgPurple/15 p-4 mt-2">
            <Text className="text-darkGrayText font-exoSemibold text-lg mb-2">
              Questions for {selectedTest.title}
            </Text>
            {!editQuestionId ? (
              <>
                <View className="bg-bgPurple/5 rounded-xl px-4 py-3 mb-3">
                  <TextInput
                    placeholder="Question text"
                    placeholderTextColor="#94A3B8"
                    value={questionText}
                    onChangeText={setQuestionText}
                    className="font-exo text-darkGrayText"
                    multiline
                  />
                </View>
                <Text className="text-darkGrayText font-exoSemibold mb-1">
                  Options (choose correct)
                </Text>
                {['A', 'B', 'C', 'D'].map((label, idx) => (
                  <Pressable
                    key={label}
                    className="bg-bgPurple/5 rounded-xl px-4 py-3 mb-2 flex-row items-center"
                    onPress={() => setCorrectIndex(idx)}
                  >
                    <View
                      className={`w-4 h-4 rounded-full mr-3 ${
                        correctIndex === idx ? 'bg-bgPurple' : 'border border-bgPurple'
                      }`}
                    />
                    <TextInput
                      placeholder={`Option ${label}`}
                      placeholderTextColor="#94A3B8"
                      value={options[idx]}
                      onChangeText={(text) =>
                        setOptions((prev) => {
                          const next = [...prev];
                          next[idx] = text;
                          return next;
                        })
                      }
                      className="font-exo text-darkGrayText flex-1"
                    />
                  </Pressable>
                ))}
                <View className="bg-bgPurple/5 rounded-xl px-4 py-3 mb-3">
                  <TextInput
                    placeholder="Video link (optional)"
                    placeholderTextColor="#94A3B8"
                    value={questionVideo}
                    onChangeText={setQuestionVideo}
                    className="font-exo text-darkGrayText"
                  />
                </View>
                <View className="bg-bgPurple/5 rounded-xl px-4 py-3 mb-3">
                  <TextInput
                    placeholder="Image link (optional)"
                    placeholderTextColor="#94A3B8"
                    value={questionImage}
                    onChangeText={setQuestionImage}
                    className="font-exo text-darkGrayText"
                  />
                </View>
                <Pressable
                  className="bg-bgPurple rounded-full py-3 items-center mb-4"
                  onPress={addQuestion}
                  disabled={
                    !questionText.trim() ||
                    options.some((opt) => !opt.trim())
                  }
                  style={{
                    opacity:
                      questionText.trim() && options.every((opt) => opt.trim()) ? 1 : 0.5,
                  }}
                >
                  <Text className="text-white font-exoSemibold">Add question</Text>
                </Pressable>
              </>
            ) : null}

            <Text className="text-darkGrayText font-exoSemibold text-base mb-2">
              Existing
            </Text>
            {selectedTest.questions?.map((q) => (
              <View
                key={q.id}
                className="bg-bgPurple/5 rounded-xl px-4 py-3 mb-2"
              >
                <Text className="text-darkGrayText font-exoSemibold">
                  {q.text}
                </Text>
                <View className="mt-2">
                  {q.options?.map((opt, idx) => (
                    <Text
                      key={`${q.id}-opt-${idx}`}
                      className={`font-exo text-sm mb-1 ${
                        q.correctIndex === idx
                          ? 'text-bgPurple font-exoSemibold'
                          : 'text-darkGrayText/80'
                      }`}
                    >
                      {String.fromCharCode(65 + idx)}. {opt}
                    </Text>
                  ))}
                </View>
                {q.video ? (
                  <Text className="text-bgPurple font-exo text-xs mt-1">
                    Video: {q.video}
                  </Text>
                ) : null}
                {q.image ? (
                  <Text className="text-bgPurple font-exo text-xs mt-1">
                    Image: {q.image}
                  </Text>
                ) : null}
                {editQuestionId === q.id ? (
                  <View className="mt-3 bg-white rounded-xl border border-bgPurple/20 p-3">
                    <Text className="text-darkGrayText font-exoSemibold mb-2">
                      Edit question
                    </Text>
                    <View className="bg-bgPurple/5 rounded-xl px-3 py-2 mb-2">
                      <TextInput
                        placeholder="Question text"
                        placeholderTextColor="#94A3B8"
                        value={questionText}
                        onChangeText={setQuestionText}
                        className="font-exo text-darkGrayText"
                        multiline
                      />
                    </View>
                    <Text className="text-darkGrayText font-exoSemibold mb-1">
                      Options
                    </Text>
                    {['A', 'B', 'C', 'D'].map((label, idx) => (
                      <Pressable
                        key={`${q.id}-${label}`}
                        className="bg-bgPurple/5 rounded-xl px-3 py-2 mb-2 flex-row items-center"
                        onPress={() => setCorrectIndex(idx)}
                      >
                        <View
                          className={`w-4 h-4 rounded-full mr-3 ${
                            correctIndex === idx ? 'bg-bgPurple' : 'border border-bgPurple'
                          }`}
                        />
                        <TextInput
                          placeholder={`Option ${label}`}
                          placeholderTextColor="#94A3B8"
                          value={options[idx]}
                          onChangeText={(text) =>
                            setOptions((prev) => {
                              const next = [...prev];
                              next[idx] = text;
                              return next;
                            })
                          }
                          className="font-exo text-darkGrayText flex-1"
                        />
                      </Pressable>
                    ))}
                    <View className="bg-bgPurple/5 rounded-xl px-3 py-2 mb-2">
                      <TextInput
                        placeholder="Video link (optional)"
                        placeholderTextColor="#94A3B8"
                        value={questionVideo}
                        onChangeText={setQuestionVideo}
                        className="font-exo text-darkGrayText"
                      />
                    </View>
                    <View className="bg-bgPurple/5 rounded-xl px-3 py-2 mb-3">
                      <TextInput
                        placeholder="Image link (optional)"
                        placeholderTextColor="#94A3B8"
                        value={questionImage}
                        onChangeText={setQuestionImage}
                        className="font-exo text-darkGrayText"
                      />
                    </View>
                    <View className="flex-row">
                      <Pressable
                        className="flex-1 bg-bgPurple rounded-full py-3 items-center mr-2"
                        onPress={addQuestion}
                        disabled={
                          !questionText.trim() ||
                          options.some((opt) => !opt.trim())
                        }
                        style={{
                          opacity:
                            questionText.trim() && options.every((opt) => opt.trim())
                              ? 1
                              : 0.5,
                        }}
                      >
                        <Text className="text-white font-exoSemibold">Save</Text>
                      </Pressable>
                      <Pressable
                        className="flex-1 bg-white border border-bgPurple/20 rounded-full py-3 items-center"
                        onPress={resetQuestionForm}
                      >
                        <Text className="text-bgPurple font-exoSemibold">Cancel</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    className="mt-2 bg-white rounded-full px-3 py-1 self-start border border-bgPurple/20"
                    onPress={() => {
                      setEditQuestionId(q.id);
                      setQuestionText(q.text);
                      setOptions(q.options || ['', '', '', '']);
                      setCorrectIndex(q.correctIndex || 0);
                      setQuestionVideo(q.video || '');
                      setQuestionImage(q.image || '');
                    }}
                  >
                    <Text className="text-bgPurple font-exoSemibold text-sm">Edit</Text>
                  </Pressable>
                )}
              </View>
            ))}
            {selectedTest.questions?.length === 0 ? (
              <Text className="text-darkGrayText/60 font-exo">
                No questions yet.
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
