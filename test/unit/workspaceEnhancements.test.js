import test from 'node:test';
import assert from 'node:assert/strict';

import { GAME_MODES } from '../../frontend/src/constants.js';
import {
  buildWeakSpotQuestionSet,
  createHistoryEntry,
  getAccuracyTrend,
  getExamReadiness,
  getHardestCategory,
  getMostMistakenQuestions,
  getRecommendedSession,
} from '../../frontend/src/history.js';
import { validateQuestions, suggestQuestionId } from '../../frontend/src/questions.js';
import { computePoints, filterSessionReview, getSessionAchievements, getSessionReviewCounts } from '../../frontend/src/session.js';

const sampleQuestions = [
  {
    id: 'frontend-1',
    content: 'Jakiego hooka używa się do stanu lokalnego w React?',
    answers: ['useMemo', 'useEffect', 'useState'],
    correctAnswer: 'useState',
    category: 'frontend',
    explanation: 'useState przechowuje stan komponentu.',
  },
  {
    id: 'backend-1',
    content: 'Który kod HTTP oznacza utworzenie zasobu?',
    answers: ['200', '201', '204'],
    correctAnswer: '201',
    category: 'backend',
    explanation: '201 Created potwierdza utworzenie zasobu.',
  },
  {
    id: 'frontend-2',
    content: 'Która właściwość CSS włącza flexbox?',
    answers: ['display: grid', 'display: flex', 'position: sticky'],
    correctAnswer: 'display: flex',
    category: 'frontend',
    explanation: 'display: flex aktywuje flexbox.',
  },
];

function buildReview(question, overrides = {}) {
  const selectedAnswer = overrides.selectedAnswer ?? question.correctAnswer;
  return {
    questionId: question.id,
    questionContent: question.content,
    category: question.category,
    selectedAnswer,
    correctAnswer: question.correctAnswer,
    isCorrect: overrides.isCorrect ?? selectedAnswer === question.correctAnswer,
    timedOut: Boolean(overrides.timedOut),
    elapsedMs: overrides.elapsedMs ?? 4_000,
    points: overrides.points ?? 10,
    explanation: question.explanation,
  };
}

test('validateQuestions rejects duplicated ids and duplicated answers', () => {
  assert.throws(
    () => validateQuestions([
      { ...sampleQuestions[0] },
      { ...sampleQuestions[0], content: 'Duplikat', answers: ['A', 'A'], correctAnswer: 'A' },
    ]),
    /unikalne|zduplikowane/i,
  );
});

test('suggestQuestionId skips ids already present in the bank', () => {
  const candidate = suggestQuestionId(sampleQuestions, 'frontend');
  assert.equal(candidate, 'frontend-3');
});

test('runner mode stays available as a timed lane challenge', () => {
  assert.equal(GAME_MODES.runner.forceTimer, true);
  assert.equal(GAME_MODES.runner.runnerChallenge, true);
  assert.match(GAME_MODES.runner.description, /tor/i);

  const points = computePoints({
    session: { timePerQuestionMs: 15_000, timerEnabled: true },
    config: { mode: 'runner' },
    isCorrect: true,
    elapsedMs: 7_000,
    streak: 2,
  });

  assert.ok(points > 20);
});

test('history insights find hardest category and most mistaken question', () => {
  const history = [
    createHistoryEntry({
      nickname: 'Ada',
      mode: 'study',
      requestedCategory: 'frontend',
      resolvedCategory: 'frontend',
      reason: 'completed',
      sessionKind: 'full',
      points: 18,
      review: [
        buildReview(sampleQuestions[0], { selectedAnswer: 'useEffect', isCorrect: false, points: 0 }),
      ],
    }),
    createHistoryEntry({
      nickname: 'Ada',
      mode: 'exam',
      requestedCategory: 'backend',
      resolvedCategory: 'backend',
      reason: 'completed',
      sessionKind: 'full',
      points: 14,
      review: [
        buildReview(sampleQuestions[1], { selectedAnswer: '201', isCorrect: true, points: 14 }),
      ],
    }),
  ];

  const hardest = getHardestCategory(history);
  const mistakes = getMostMistakenQuestions(history, sampleQuestions, 3);
  const recommendation = getRecommendedSession({ history, questions: sampleQuestions, focus: 'frontend' });

  assert.equal(hardest?.category, 'frontend');
  assert.equal(mistakes[0]?.questionId, 'frontend-1');
  assert.match(recommendation.title, /Study|frontend/i);
});

test('buildWeakSpotQuestionSet prioritizes mistakes and ignores deleted question ids', () => {
  const history = [
    createHistoryEntry({
      nickname: 'Ada',
      mode: 'study',
      requestedCategory: 'frontend',
      resolvedCategory: 'frontend',
      reason: 'completed',
      sessionKind: 'full',
      points: 0,
      review: [
        buildReview(sampleQuestions[0], { selectedAnswer: 'useEffect', isCorrect: false, points: 0 }),
        buildReview(sampleQuestions[2], { selectedAnswer: 'display: grid', isCorrect: false, points: 0 }),
      ],
    }),
    createHistoryEntry({
      nickname: 'Ada',
      mode: 'study',
      requestedCategory: 'frontend',
      resolvedCategory: 'frontend',
      reason: 'completed',
      sessionKind: 'full',
      points: 0,
      review: [
        buildReview(sampleQuestions[0], { selectedAnswer: 'useEffect', isCorrect: false, points: 0 }),
        {
          questionId: 'deleted-question',
          questionContent: 'Usunięte pytanie',
          category: 'frontend',
          selectedAnswer: 'A',
          correctAnswer: 'B',
          isCorrect: false,
          timedOut: false,
          elapsedMs: 5_000,
          points: 0,
          explanation: '',
        },
      ],
    }),
    createHistoryEntry({
      nickname: 'Ada',
      mode: 'study',
      requestedCategory: 'backend',
      resolvedCategory: 'backend',
      reason: 'completed',
      sessionKind: 'full',
      points: 10,
      review: [
        buildReview(sampleQuestions[1], { selectedAnswer: '201', isCorrect: true, points: 10 }),
      ],
    }),
  ];

  const weakSpots = buildWeakSpotQuestionSet({
    history,
    questions: sampleQuestions,
    limit: 3,
  });

  assert.equal(weakSpots.available, true);
  assert.deepEqual(weakSpots.questions.map((question) => question.id), ['frontend-1', 'frontend-2', 'backend-1']);
});

test('buildWeakSpotQuestionSet disables adaptive training when history is too small', () => {
  const history = [
    createHistoryEntry({
      nickname: 'Ada',
      mode: 'study',
      requestedCategory: 'frontend',
      resolvedCategory: 'frontend',
      reason: 'completed',
      sessionKind: 'full',
      points: 10,
      review: [
        buildReview(sampleQuestions[0], { selectedAnswer: 'useState', isCorrect: true, points: 10 }),
      ],
    }),
  ];

  const weakSpots = buildWeakSpotQuestionSet({
    history,
    questions: sampleQuestions,
    limit: 3,
  });

  assert.equal(weakSpots.available, false);
  assert.match(weakSpots.message, /Zbieramy dane/i);
});

test('exam readiness returns proper thresholds and trend compares 5 vs 5', () => {
  const history = [];

  for (let index = 0; index < 10; index += 1) {
    history.push(
      createHistoryEntry({
        nickname: 'Ada',
        mode: 'study',
        requestedCategory: 'frontend',
        resolvedCategory: 'frontend',
        reason: 'completed',
        sessionKind: 'full',
        points: 10,
        timestamp: `2026-03-${String(20 - index).padStart(2, '0')}T10:00:00.000Z`,
        review: [
          buildReview(sampleQuestions[0], {
            selectedAnswer: index < 8 ? 'useState' : 'useEffect',
            isCorrect: index < 8,
            points: index < 8 ? 10 : 0,
          }),
        ],
      }),
    );
  }

  const readiness = getExamReadiness(history, 'frontend');
  const trend = getAccuracyTrend(history);

  assert.equal(readiness.status, 'almost-ready');
  assert.equal(readiness.totalAnswers, 10);
  assert.equal(trend.status, 'up');
  assert.equal(trend.latestAverage, 100);
  assert.equal(trend.previousAverage, 60);
});

test('exam readiness covers insufficient, not-ready and ready states', () => {
  const insufficient = getExamReadiness([], 'frontend');
  assert.equal(insufficient.status, 'insufficient');

  const notReadyHistory = Array.from({ length: 10 }, (_, index) => createHistoryEntry({
    nickname: 'Ada',
    mode: 'study',
    requestedCategory: 'frontend',
    resolvedCategory: 'frontend',
    reason: 'completed',
    sessionKind: 'full',
    points: 0,
    timestamp: `2026-02-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
    review: [
      buildReview(sampleQuestions[0], {
        selectedAnswer: index < 6 ? 'useEffect' : 'useState',
        isCorrect: index >= 6,
        points: index >= 6 ? 10 : 0,
      }),
    ],
  }));
  assert.equal(getExamReadiness(notReadyHistory, 'frontend').status, 'not-ready');

  const readyHistory = Array.from({ length: 10 }, (_, index) => createHistoryEntry({
    nickname: 'Ada',
    mode: 'study',
    requestedCategory: 'frontend',
    resolvedCategory: 'frontend',
    reason: 'completed',
    sessionKind: 'full',
    points: 10,
    timestamp: `2026-01-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
    review: [
      buildReview(sampleQuestions[0], {
        selectedAnswer: index < 9 ? 'useState' : 'useEffect',
        isCorrect: index < 9,
        points: index < 9 ? 10 : 0,
      }),
    ],
  }));
  assert.equal(getExamReadiness(readyHistory, 'frontend').status, 'ready');
});

test('session review filters and achievements expose the right subsets', () => {
  const review = [
    buildReview(sampleQuestions[0], { selectedAnswer: 'useState', isCorrect: true, elapsedMs: 4_000 }),
    buildReview(sampleQuestions[1], { selectedAnswer: '200', isCorrect: false, elapsedMs: 6_000, points: 0 }),
    buildReview(sampleQuestions[2], { selectedAnswer: null, isCorrect: false, timedOut: true, elapsedMs: 8_000, points: 0 }),
  ];
  const summary = {
    review,
    averageAnswerTimeMs: 6_000,
    incorrectCount: 2,
    category: 'frontend',
  };

  assert.equal(filterSessionReview(review, 'all').length, 3);
  assert.equal(filterSessionReview(review, 'incorrect').length, 1);
  assert.equal(filterSessionReview(review, 'timedout').length, 1);
  assert.equal(filterSessionReview(review, 'correct').length, 1);
  assert.deepEqual(getSessionReviewCounts(review), { all: 3, incorrect: 1, timedout: 1, correct: 1 });

  const achievements = getSessionAchievements(summary, {
    readiness: { isReady: true },
  });
  assert.deepEqual(achievements.map((item) => item.id), ['fast-round', 'ready-for-exam']);
});
