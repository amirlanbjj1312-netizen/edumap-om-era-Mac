'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  deleteCourseTest,
  loadCourseTests,
  upsertCourseQuestion,
  upsertCourseTest,
} from '@/lib/api';
import { useAdminLocale } from '@/lib/adminLocale';
import { supabase } from '@/lib/supabaseClient';

const SUBJECTS = [
  { id: 'math', title: 'Mathematics' },
  { id: 'reading', title: 'Reading & Language' },
  { id: 'science', title: 'Science Basics' },
  { id: 'art', title: 'Art & Creativity' },
];

const isModerator = (role: string) => role === 'moderator' || role === 'superadmin';

export default function AdminCoursesPage() {
  const { t } = useAdminLocale();
  const [authReady, setAuthReady] = useState(false);
  const [token, setToken] = useState('');
  const [actorRole, setActorRole] = useState('user');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [testsBySubject, setTestsBySubject] = useState<Record<string, any[]>>({});
  const [subjectId, setSubjectId] = useState(SUBJECTS[0].id);
  const [testTitle, setTestTitle] = useState('');
  const [testGrade, setTestGrade] = useState('1');
  const [selectedTestId, setSelectedTestId] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [questionOptions, setQuestionOptions] = useState(['', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState(0);

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
      setTestsBySubject(result?.data || {});
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

  const resetQuestionForm = () => {
    setQuestionText('');
    setQuestionOptions(['', '', '', '']);
    setCorrectIndex(0);
  };

  const submitTest = useCallback(async () => {
    if (!token || !isModerator(actorRole)) return;
    if (!testTitle.trim()) {
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
          title: testTitle.trim(),
          grade: testGrade.trim(),
          questions: selectedTest?.questions || [],
        },
      };
      const result = await upsertCourseTest(token, payload);
      const saved = result?.data;
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
  }, [actorRole, selectedTest, selectedTestId, subjectId, t, testGrade, testTitle, token]);

  const submitQuestion = useCallback(async () => {
    if (!token || !isModerator(actorRole) || !selectedTest) return;
    if (!questionText.trim() || questionOptions.some((item) => !item.trim())) {
      setMessage('Question and all options are required');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const question = {
        id: `${selectedTest.id}-q-${Date.now()}`,
        text: questionText.trim(),
        options: questionOptions.map((item) => item.trim()),
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
        questions.push(question);
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
  }, [actorRole, correctIndex, questionOptions, questionText, selectedTest, subjectId, t, token]);

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
          setTestTitle('');
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
    setTestTitle(test.title || '');
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
          <span>Subject</span>
          <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
            {SUBJECTS.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Grade</span>
          <input value={testGrade} onChange={(event) => setTestGrade(event.target.value)} />
        </label>
      </div>

      <label className="field">
        <span>Test title</span>
        <input value={testTitle} onChange={(event) => setTestTitle(event.target.value)} />
      </label>

      <div className="actions">
        <button type="button" className="primary" disabled={saving} onClick={submitTest}>
          {saving ? t('saving') : selectedTestId ? t('newsAdminUpdate') : 'Add test'}
        </button>
        {selectedTestId ? (
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setSelectedTestId('');
              setTestTitle('');
              setTestGrade('1');
            }}
          >
            {t('newsAdminCancel')}
          </button>
        ) : null}
        {message ? <span className="status">{message}</span> : null}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Tests</h3>
        {loading ? (
          <p className="muted">{t('usersLoading')}</p>
        ) : currentTests.length ? (
          <div className="schools-admin-list">
            {currentTests.map((test) => (
              <div key={test.id} className="schools-admin-card">
                <p className="request-title">{test.title}</p>
                <p className="muted">Grade: {test.grade || '—'}</p>
                <p className="muted">Questions: {Array.isArray(test.questions) ? test.questions.length : 0}</p>
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
          <h3 style={{ marginTop: 0 }}>Add question to: {selectedTest.title}</h3>
          <label className="field">
            <span>Question text</span>
            <textarea
              value={questionText}
              rows={3}
              onChange={(event) => setQuestionText(event.target.value)}
            />
          </label>
          {['A', 'B', 'C', 'D'].map((label, idx) => (
            <label key={label} className="field">
              <span>{`Option ${label}${correctIndex === idx ? ' (Correct)' : ''}`}</span>
              <input
                value={questionOptions[idx]}
                onChange={(event) =>
                  setQuestionOptions((prev) => {
                    const next = [...prev];
                    next[idx] = event.target.value;
                    return next;
                  })
                }
                onFocus={() => setCorrectIndex(idx)}
              />
            </label>
          ))}
          <div className="actions">
            <button type="button" className="primary" disabled={saving} onClick={submitQuestion}>
              {saving ? t('saving') : 'Add question'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
