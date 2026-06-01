'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  deleteCourseTest,
  loadCourseTests,
  upsertCourseQuestion,
  upsertCourseTest,
} from '@/lib/api';
import { useAdminLocale } from '@/lib/adminLocale';
import { supabaseAuth as supabase } from '@/lib/supabaseAuth';

const SUBJECTS = [
  {
    id: 'math',
    title: { ru: 'Математика', en: 'Mathematics', kk: 'Математика' },
  },
  {
    id: 'reading',
    title: { ru: 'Чтение и язык', en: 'Reading & Language', kk: 'Оқу және тіл' },
  },
  {
    id: 'science',
    title: { ru: 'Основы науки', en: 'Science Basics', kk: 'Ғылым негіздері' },
  },
  {
    id: 'art',
    title: { ru: 'Искусство и творчество', en: 'Art & Creativity', kk: 'Өнер және шығармашылық' },
  },
];

const LOCALE_FIELDS: Array<{ key: 'ru' | 'en' | 'kk'; label: string }> = [
  { key: 'ru', label: 'RU' },
  { key: 'en', label: 'EN' },
  { key: 'kk', label: 'KK' },
];

const createEmptyLocalized = () => ({ ru: '', en: '', kk: '' });
const createEmptyOptions = () => [
  createEmptyLocalized(),
  createEmptyLocalized(),
  createEmptyLocalized(),
  createEmptyLocalized(),
];

const extractLocalizedLeaf = (value: any, seen = new WeakSet()): string => {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value !== 'object' || Array.isArray(value)) return '';
  if (seen.has(value)) return '';
  seen.add(value);
  return (
    extractLocalizedLeaf(value?.ru, seen) ||
    extractLocalizedLeaf(value?.kk, seen) ||
    extractLocalizedLeaf(value?.en, seen) ||
    ''
  );
};

const normalizeLocalized = (value: any) => ({
  ru:
    typeof value === 'string'
      ? value.trim()
      : extractLocalizedLeaf(value?.ru) || extractLocalizedLeaf(value),
  en: extractLocalizedLeaf(value?.en),
  kk: extractLocalizedLeaf(value?.kk),
});

const toLocaleText = (value: any, locale: 'ru' | 'en' | 'kk') => {
  const normalized = normalizeLocalized(value);
  return normalized[locale] || normalized.ru || normalized.kk || normalized.en || '';
};

const trimLocalized = (value: any) => {
  const normalized = normalizeLocalized(value);
  return {
    ru: normalized.ru.trim(),
    en: normalized.en.trim(),
    kk: normalized.kk.trim(),
  };
};

const normalizeQuestionEntity = (question: any) => ({
  ...question,
  text: normalizeLocalized(question?.text),
  options: Array.isArray(question?.options)
    ? question.options.map((item: any) => normalizeLocalized(item))
    : [],
});

const normalizeTestEntity = (test: any) => ({
  ...test,
  title: normalizeLocalized(test?.title),
  questions: Array.isArray(test?.questions)
    ? test.questions.map((item: any) => normalizeQuestionEntity(item))
    : [],
});

const normalizeTestsMap = (value: Record<string, any[]> | null | undefined) => {
  const next: Record<string, any[]> = {};
  Object.entries(value || {}).forEach(([subjectId, tests]) => {
    next[subjectId] = Array.isArray(tests) ? tests.map((item) => normalizeTestEntity(item)) : [];
  });
  return next;
};

const isModerator = (role: string) => role === 'moderator' || role === 'superadmin';

export default function AdminCoursesPage() {
  const { t, locale } = useAdminLocale();
  const ui =
    locale === 'en'
      ? {
          subject: 'Subject',
          grade: 'Grade',
          testTitle: 'Test title',
          autofillHint: 'If empty, the field is auto-filled from RU on first open.',
          addTest: 'Add test',
          tests: 'Tests',
          questionsCount: 'Questions',
          addQuestionTo: 'Add question to',
          questionText: 'Question text',
          option: 'Option',
          correct: 'Correct',
          addQuestion: 'Add question',
          testFallback: 'Test',
        }
      : locale === 'kk'
      ? {
          subject: 'Пән',
          grade: 'Сынып',
          testTitle: 'Тест атауы',
          autofillHint: 'Егер бос болса, өріс алғаш ашылғанда RU тілінен автоматты толтырылады.',
          addTest: 'Тест қосу',
          tests: 'Тесттер',
          questionsCount: 'Сұрақтар',
          addQuestionTo: 'Сұрақты қосу',
          questionText: 'Сұрақ мәтіні',
          option: 'Нұсқа',
          correct: 'Дұрыс',
          addQuestion: 'Сұрақ қосу',
          testFallback: 'Тест',
        }
      : {
          subject: 'Предмет',
          grade: 'Класс',
          testTitle: 'Название теста',
          autofillHint: 'Если пусто, поле автоматически заполнится из RU при первом открытии.',
          addTest: 'Добавить тест',
          tests: 'Тесты',
          questionsCount: 'Вопросы',
          addQuestionTo: 'Добавить вопрос в',
          questionText: 'Текст вопроса',
          option: 'Вариант',
          correct: 'Правильный',
          addQuestion: 'Добавить вопрос',
          testFallback: 'Тест',
        };
  const [authReady, setAuthReady] = useState(false);
  const [token, setToken] = useState('');
  const [actorRole, setActorRole] = useState('user');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [testsBySubject, setTestsBySubject] = useState<Record<string, any[]>>({});
  const [subjectId, setSubjectId] = useState(SUBJECTS[0].id);
  const [testTitle, setTestTitle] = useState(createEmptyLocalized());
  const [testGrade, setTestGrade] = useState('1');
  const [selectedTestId, setSelectedTestId] = useState('');
  const [questionText, setQuestionText] = useState(createEmptyLocalized());
  const [questionOptions, setQuestionOptions] = useState(createEmptyOptions());
  const [correctIndex, setCorrectIndex] = useState(0);
  const [editingLocale, setEditingLocale] = useState<'ru' | 'en' | 'kk'>('ru');

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const session = data?.session;
      setToken(session?.access_token || '');
      setActorRole(
        session?.user?.user_metadata?.role || session?.user?.app_metadata?.role || 'user'
      );
      setAuthReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const result = await loadCourseTests();
      setTestsBySubject(normalizeTestsMap(result?.data || {}));
    } catch (error) {
      setMessage((error as Error)?.message || t('saveError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    reload();
  }, [reload]);

  const currentTests = useMemo(
    () => (Array.isArray(testsBySubject?.[subjectId]) ? testsBySubject[subjectId] : []),
    [testsBySubject, subjectId]
  );

  const selectedTest = useMemo(
    () => currentTests.find((item) => item.id === selectedTestId) || null,
    [currentTests, selectedTestId]
  );

  const ensureLocaleSeededFromRu = useCallback(
    (nextLocale: 'ru' | 'en' | 'kk') => {
      if (nextLocale === 'ru') {
        setEditingLocale('ru');
        return;
      }

      setTestTitle((prev) => {
        if (String(prev?.[nextLocale] || '').trim() || !String(prev?.ru || '').trim()) return prev;
        return { ...prev, [nextLocale]: prev.ru };
      });

      setQuestionText((prev) => {
        if (String(prev?.[nextLocale] || '').trim() || !String(prev?.ru || '').trim()) return prev;
        return { ...prev, [nextLocale]: prev.ru };
      });

      setQuestionOptions((prev) =>
        prev.map((item) => {
          if (String(item?.[nextLocale] || '').trim() || !String(item?.ru || '').trim()) {
            return item;
          }
          return { ...item, [nextLocale]: item.ru };
        })
      );

      setEditingLocale(nextLocale);
    },
    []
  );

  const resetQuestionForm = () => {
    setQuestionText(createEmptyLocalized());
    setQuestionOptions(createEmptyOptions());
    setCorrectIndex(0);
  };

  const submitTest = useCallback(async () => {
    if (!token || !isModerator(actorRole)) return;
    if (!toLocaleText(testTitle, locale).trim()) {
      setMessage('Test title is required');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const id = selectedTestId || `${subjectId}-${Date.now()}`;
      const payload = {
        subjectId,
        test: {
          id,
          title: trimLocalized(testTitle),
          grade: testGrade.trim(),
          questions: selectedTest?.questions || [],
        },
      };
      const result = await upsertCourseTest(token, payload);
      const saved = normalizeTestEntity(result?.data);
      setTestsBySubject((prev) => {
        const list = Array.isArray(prev?.[subjectId]) ? [...prev[subjectId]] : [];
        const index = list.findIndex((item) => item.id === saved.id);
        if (index === -1) list.push(saved);
        else list[index] = saved;
        return { ...prev, [subjectId]: list };
      });
      setSelectedTestId(saved.id);
      setMessage(t('saved'));
    } catch (error) {
      setMessage((error as Error)?.message || t('saveError'));
    } finally {
      setSaving(false);
    }
  }, [actorRole, locale, selectedTest, selectedTestId, subjectId, t, testGrade, testTitle, token]);

  const submitQuestion = useCallback(async () => {
    if (!token || !isModerator(actorRole) || !selectedTest) return;
    if (
      !toLocaleText(questionText, locale).trim() ||
      questionOptions.some((item) => !toLocaleText(item, locale).trim())
    ) {
      setMessage('Question and all options are required');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const question = {
        id: `${selectedTest.id}-q-${Date.now()}`,
        text: trimLocalized(questionText),
        options: questionOptions.map((item) => trimLocalized(item)),
        correctIndex,
        video: '',
        image: '',
      };
      await upsertCourseQuestion(token, {
        subjectId,
        testId: selectedTest.id,
        question,
      });
      setTestsBySubject((prev) => {
        const list = Array.isArray(prev?.[subjectId]) ? [...prev[subjectId]] : [];
        const testIndex = list.findIndex((item) => item.id === selectedTest.id);
        if (testIndex === -1) return prev;
        const target = { ...list[testIndex] };
        const questions = Array.isArray(target.questions) ? [...target.questions] : [];
        questions.push(normalizeQuestionEntity(question));
        target.questions = questions;
        list[testIndex] = target;
        return { ...prev, [subjectId]: list };
      });
      resetQuestionForm();
      setMessage(t('saved'));
    } catch (error) {
      setMessage((error as Error)?.message || t('saveError'));
    } finally {
      setSaving(false);
    }
  }, [actorRole, correctIndex, locale, questionOptions, questionText, selectedTest, subjectId, t, token]);

  const removeTest = useCallback(
    async (testId: string) => {
      if (!token || !isModerator(actorRole)) return;
      setSaving(true);
      setMessage('');
      try {
        await deleteCourseTest(token, subjectId, testId);
        setTestsBySubject((prev) => ({
          ...prev,
          [subjectId]: (prev?.[subjectId] || []).filter((item: any) => item.id !== testId),
        }));
        if (selectedTestId === testId) {
          setSelectedTestId('');
          setTestTitle(createEmptyLocalized());
          setTestGrade('1');
        }
      } catch (error) {
        setMessage((error as Error)?.message || t('saveError'));
      } finally {
        setSaving(false);
      }
    },
    [actorRole, selectedTestId, subjectId, t, token]
  );

  const onSelectTest = (test: any) => {
    setSelectedTestId(test.id);
    setTestTitle(normalizeLocalized(test.title));
    setTestGrade(test.grade || '1');
  };

  if (!authReady) {
    return <div className="card">{t('checkingSession')}</div>;
  }

  if (!isModerator(actorRole)) {
    return <div className="card">{t('coursesAdminForbidden')}</div>;
  }

  return (
    <div className="card">
      <div className="requests-head">
        <h2>{t('coursesAdminTitle')}</h2>
        <button type="button" className="button secondary" onClick={reload}>
          {t('usersRefresh')}
        </button>
      </div>
      <p className="muted">{t('coursesAdminHint')}</p>

      <div className="form-row">
        <label className="field">
          <span>{ui.subject}</span>
          <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
            {SUBJECTS.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {toLocaleText(subject.title, locale)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{ui.grade}</span>
          <input value={testGrade} onChange={(event) => setTestGrade(event.target.value)} />
        </label>
      </div>

      <div
        style={{
          display: 'inline-flex',
          gap: 8,
          marginBottom: 16,
          padding: 6,
          borderRadius: 999,
          background: '#f4f7ff',
          border: '1px solid rgba(120,106,255,0.18)',
        }}
      >
        {LOCALE_FIELDS.map((field) => {
          const active = editingLocale === field.key;
          return (
            <button
              key={field.key}
              type="button"
              className={active ? 'button' : 'button secondary'}
              onClick={() => ensureLocaleSeededFromRu(field.key)}
              style={{
                minWidth: 64,
                borderRadius: 999,
                opacity: active ? 1 : 0.88,
              }}
            >
              {field.label}
            </button>
          );
        })}
      </div>

      <div className="field">
        <span>{`${ui.testTitle} (${editingLocale.toUpperCase()})`}</span>
        <input
          value={testTitle[editingLocale]}
          onChange={(event) =>
            setTestTitle((prev) => ({ ...prev, [editingLocale]: event.target.value }))
          }
        />
        {editingLocale !== 'ru' ? (
          <p className="muted" style={{ marginTop: 6 }}>
            {ui.autofillHint}
          </p>
        ) : null}
      </div>

      <div className="actions">
        <button type="button" className="primary" disabled={saving} onClick={submitTest}>
          {saving ? t('saving') : selectedTestId ? t('newsAdminUpdate') : ui.addTest}
        </button>
        {selectedTestId ? (
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setSelectedTestId('');
              setTestTitle(createEmptyLocalized());
              setTestGrade('1');
            }}
          >
            {t('newsAdminCancel')}
          </button>
        ) : null}
        {message ? <span className="status">{message}</span> : null}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>{ui.tests}</h3>
        {loading ? (
          <p className="muted">{t('usersLoading')}</p>
        ) : currentTests.length ? (
          <div className="schools-admin-list">
            {currentTests.map((test) => (
              <div key={test.id} className="schools-admin-card">
                <p className="request-title">{toLocaleText(test.title, locale) || ui.testFallback}</p>
                <p className="muted">{ui.grade}: {test.grade || '—'}</p>
                <p className="muted">
                  {ui.questionsCount}: {Array.isArray(test.questions) ? test.questions.length : 0}
                </p>
                <div className="schools-admin-actions">
                  <button type="button" className="button secondary" onClick={() => onSelectTest(test)}>
                    {t('newsAdminEdit')}
                  </button>
                  <button type="button" className="button secondary" onClick={() => removeTest(test.id)}>
                    {t('newsAdminDelete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">{t('newsAdminEmpty')}</p>
        )}
      </div>

      {selectedTest ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>
            {ui.addQuestionTo}: {toLocaleText(selectedTest.title, locale) || ui.testFallback}
          </h3>
          <div className="field">
            <span>{`${ui.questionText} (${editingLocale.toUpperCase()})`}</span>
            <textarea
              value={questionText[editingLocale]}
              rows={3}
              onChange={(event) =>
                setQuestionText((prev) => ({ ...prev, [editingLocale]: event.target.value }))
              }
            />
          </div>
          {['A', 'B', 'C', 'D'].map((label, idx) => (
            <label key={label} className="field">
              <span>{`${ui.option} ${label}${correctIndex === idx ? ` (${ui.correct})` : ''} (${editingLocale.toUpperCase()})`}</span>
              <input
                value={questionOptions[idx]?.[editingLocale] || ''}
                onChange={(event) =>
                  setQuestionOptions((prev) => {
                    const next = [...prev];
                    next[idx] = { ...next[idx], [editingLocale]: event.target.value };
                    return next;
                  })
                }
                onFocus={() => setCorrectIndex(idx)}
              />
            </label>
          ))}
          <div className="actions">
            <button type="button" className="primary" disabled={saving} onClick={submitQuestion}>
              {saving ? t('saving') : ui.addQuestion}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
