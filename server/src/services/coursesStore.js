const fs = require('fs/promises');
const path = require('path');
const { buildConfig } = require('../utils/config');
const { getPool, ensureCoursesTestsTable } = require('./db');

const config = buildConfig();
const STORAGE_DIR = path.resolve(__dirname, '../data');
const STORAGE_PATH = path.join(STORAGE_DIR, 'courses-tests.json');
const STORAGE_ROW_ID = 'default';

const DEFAULT_COURSES_TESTS = {
  math: [],
  reading: [],
  science: [],
  art: [],
};

const ensureStorage = async () => {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
};

const normalizeMap = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_COURSES_TESTS };
  }
  const result = {};
  Object.entries(value).forEach(([subjectId, tests]) => {
    if (!Array.isArray(tests)) return;
    result[subjectId] = tests.map((test) => ({
      id: String(test?.id || '').trim(),
      title: String(test?.title || '').trim(),
      grade: String(test?.grade || '').trim(),
      questions: Array.isArray(test?.questions)
        ? test.questions.map((q) => ({
            id: String(q?.id || '').trim(),
            text: String(q?.text || '').trim(),
            options: Array.isArray(q?.options)
              ? q.options.map((opt) => String(opt || '').trim())
              : [],
            correctIndex: Number.isFinite(Number(q?.correctIndex))
              ? Number(q.correctIndex)
              : 0,
            video: String(q?.video || '').trim(),
            image: String(q?.image || '').trim(),
          }))
        : [],
    }));
  });
  return { ...DEFAULT_COURSES_TESTS, ...result };
};

const readFileStore = async () => {
  try {
    await ensureStorage();
    const raw = await fs.readFile(STORAGE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return normalizeMap(parsed);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { ...DEFAULT_COURSES_TESTS };
    }
    throw error;
  }
};

const writeFileStore = async (value) => {
  await ensureStorage();
  await fs.writeFile(STORAGE_PATH, JSON.stringify(normalizeMap(value), null, 2));
};

const readCoursesTests = async () => {
  if (!config.databaseUrl) {
    return readFileStore();
  }
  const db = getPool();
  await ensureCoursesTestsTable();
  const { rows } = await db.query('SELECT payload FROM courses_tests WHERE id = $1 LIMIT 1', [
    STORAGE_ROW_ID,
  ]);
  if (!rows.length) return { ...DEFAULT_COURSES_TESTS };
  return normalizeMap(rows[0]?.payload);
};

const writeCoursesTests = async (value) => {
  const normalized = normalizeMap(value);
  if (!config.databaseUrl) {
    await writeFileStore(normalized);
    return normalized;
  }
  const db = getPool();
  await ensureCoursesTestsTable();
  await db.query(
    `
      INSERT INTO courses_tests (id, payload, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (id)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
    `,
    [STORAGE_ROW_ID, normalized]
  );
  return normalized;
};

const upsertCourseTest = async ({ subjectId, test }) => {
  const key = String(subjectId || '').trim();
  if (!key) throw new Error('subjectId is required');
  if (!test || typeof test !== 'object') throw new Error('test is required');
  const testId = String(test.id || `${key}-${Date.now()}`).trim();
  const title = String(test.title || '').trim();
  if (!title) throw new Error('test.title is required');

  const nextTest = {
    id: testId,
    title,
    grade: String(test.grade || '').trim(),
    questions: Array.isArray(test.questions) ? test.questions : [],
  };

  const current = await readCoursesTests();
  const list = Array.isArray(current[key]) ? [...current[key]] : [];
  const index = list.findIndex((item) => item.id === testId);
  if (index === -1) list.push(nextTest);
  else list[index] = nextTest;
  const next = { ...current, [key]: list };
  await writeCoursesTests(next);
  return nextTest;
};

const upsertCourseQuestion = async ({ subjectId, testId, question }) => {
  const key = String(subjectId || '').trim();
  const id = String(testId || '').trim();
  if (!key || !id) throw new Error('subjectId and testId are required');
  if (!question || typeof question !== 'object') throw new Error('question is required');

  const current = await readCoursesTests();
  const tests = Array.isArray(current[key]) ? [...current[key]] : [];
  const testIndex = tests.findIndex((item) => String(item?.id || '') === id);
  if (testIndex === -1) throw new Error('test not found');

  const targetTest = { ...tests[testIndex] };
  const currentQuestions = Array.isArray(targetTest.questions)
    ? [...targetTest.questions]
    : [];
  const questionId = String(question.id || `${id}-q-${Date.now()}`).trim();
  const nextQuestion = {
    id: questionId,
    text: String(question.text || '').trim(),
    options: Array.isArray(question.options)
      ? question.options.map((opt) => String(opt || '').trim())
      : [],
    correctIndex: Number.isFinite(Number(question.correctIndex))
      ? Number(question.correctIndex)
      : 0,
    video: String(question.video || '').trim(),
    image: String(question.image || '').trim(),
  };

  const questionIndex = currentQuestions.findIndex((item) => item.id === questionId);
  if (questionIndex === -1) currentQuestions.push(nextQuestion);
  else currentQuestions[questionIndex] = nextQuestion;
  targetTest.questions = currentQuestions;
  tests[testIndex] = targetTest;
  const next = { ...current, [key]: tests };
  await writeCoursesTests(next);
  return nextQuestion;
};

const deleteCourseTest = async ({ subjectId, testId }) => {
  const key = String(subjectId || '').trim();
  const id = String(testId || '').trim();
  if (!key || !id) throw new Error('subjectId and testId are required');
  const current = await readCoursesTests();
  const tests = Array.isArray(current[key]) ? current[key] : [];
  const next = {
    ...current,
    [key]: tests.filter((item) => String(item?.id || '') !== id),
  };
  await writeCoursesTests(next);
  return next;
};

module.exports = {
  readCoursesTests,
  writeCoursesTests,
  upsertCourseTest,
  upsertCourseQuestion,
  deleteCourseTest,
};
