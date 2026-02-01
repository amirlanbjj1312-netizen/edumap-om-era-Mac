import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TESTS_SEED } from '../data/testsSeed';

const COMPLETIONS_STORAGE_KEY = 'EDUMAP_TEST_COMPLETIONS_V1';

const TestsContext = createContext({
  testsBySubject: {},
  getTestsForSubject: () => [],
  addTest: () => {},
  upsertQuestion: () => {},
  completedTests: {},
  markTestCompleted: () => {},
  isTestCompleted: () => false,
});

export const TestsProvider = ({ children }) => {
  const [testsBySubject, setTestsBySubject] = useState(TESTS_SEED);
  const [completedTests, setCompletedTests] = useState({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(COMPLETIONS_STORAGE_KEY);
        if (!isMounted) return;
        if (raw) {
          const parsed = JSON.parse(raw);
          const safeParsed = parsed && typeof parsed === 'object' ? parsed : {};
          setCompletedTests((prev) => {
            const merged = { ...safeParsed };
            Object.entries(prev || {}).forEach(([subjectId, tests]) => {
              merged[subjectId] = { ...(safeParsed?.[subjectId] || {}), ...tests };
            });
            return merged;
          });
        }
      } catch (error) {
        console.warn('[TestsProvider] Failed to load completions', error);
        if (isMounted) {
          setCompletedTests({});
        }
      } finally {
        if (isMounted) setHydrated(true);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    (async () => {
      try {
        await AsyncStorage.setItem(
          COMPLETIONS_STORAGE_KEY,
          JSON.stringify(completedTests)
        );
      } catch (error) {
        console.warn('[TestsProvider] Failed to persist completions', error);
      }
    })();
  }, [completedTests, hydrated]);

  const getTestsForSubject = (subjectId) => testsBySubject[subjectId] || [];

  const addTest = (subjectId, payload) => {
    const newTest = {
      id: payload.id || `${subjectId}-${Date.now()}`,
      title: payload.title?.trim() || 'Untitled',
      grade: payload.grade?.trim() || '',
      questions: [],
    };
    setTestsBySubject((prev) => {
      const current = prev[subjectId] || [];
      return { ...prev, [subjectId]: [...current, newTest] };
    });
    return newTest.id;
  };

  const upsertQuestion = ({
    subjectId,
    testId,
    question,
  }) => {
    setTestsBySubject((prev) => {
      const tests = prev[subjectId] || [];
      const updatedTests = tests.map((t) => {
        if (t.id !== testId) return t;
        const existing = t.questions || [];
        const has = existing.find((q) => q.id === question.id);
        const nextQuestions = has
          ? existing.map((q) => (q.id === question.id ? question : q))
          : [...existing, question];
        return { ...t, questions: nextQuestions };
      });
      return { ...prev, [subjectId]: updatedTests };
    });
  };

  const markTestCompleted = (subjectId, testId) => {
    if (!subjectId || !testId) return;
    setCompletedTests((prev) => {
      const subject = prev[subjectId] || {};
      if (subject[testId]) return prev;
      return {
        ...prev,
        [subjectId]: {
          ...subject,
          [testId]: true,
        },
      };
    });
  };

  const isTestCompleted = (subjectId, testId) =>
    Boolean(completedTests?.[subjectId]?.[testId]);

  const value = useMemo(
    () => ({
      testsBySubject,
      getTestsForSubject,
      addTest,
      upsertQuestion,
      completedTests,
      markTestCompleted,
      isTestCompleted,
    }),
    [testsBySubject, completedTests]
  );

  return <TestsContext.Provider value={value}>{children}</TestsContext.Provider>;
};

export const useTests = () => useContext(TestsContext);
