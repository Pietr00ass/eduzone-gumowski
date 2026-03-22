import { createHistoryEntry } from './history.js';
import { GAME_MODES } from './constants.js';
import { clamp } from './utils.js';

export function getModeConfig(modeKey) {
  return GAME_MODES[modeKey] || GAME_MODES.study;
}

export function buildQuizSet(questions, config) {
  const filtered = config.category === 'all'
    ? [...questions]
    : questions.filter((question) => question.category === config.category);

  if (!config.shuffle) {
    return filtered.slice(0, config.limit);
  }

  const copy = [...filtered];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy.slice(0, config.limit);
}

export function deriveSessionCategory(questions) {
  const categories = [...new Set(questions.map((question) => question.category))];
  return categories.length === 1 ? categories[0] : 'all';
}

export function computePoints({ session, config, isCorrect, elapsedMs, streak }) {
  const mode = getModeConfig(config.mode);
  if (!isCorrect) {
    return 0;
  }

  const timeLimitMs = session.timePerQuestionMs;
  const speedBonus = session.timerEnabled
    ? Math.max(0, Math.round(((timeLimitMs - elapsedMs) / 1000) * mode.timeMultiplier))
    : 0;
  const arcadeBonus = mode.dynamicAnswers ? 4 : 0;
  const runnerBonus = mode.runnerChallenge ? 5 : 0;
  const mentorBonus = config.mode === 'mentor' && streak >= 2 ? 3 : 0;
  const examBonus = config.mode === 'exam' ? 4 : 0;

  return 10 + speedBonus + streak * mode.streakMultiplier + arcadeBonus + runnerBonus + mentorBonus + examBonus;
}

export function createSessionSummary({ session, config, nickname, reason }) {
  const review = session.answers.map((answer, index) => ({
    ...answer,
    index: index + 1,
  }));
  const points = review.reduce((sum, item) => sum + item.points, 0);
  const resolvedCategory = deriveSessionCategory(session.questions);
  const historyEntry = createHistoryEntry({
    nickname,
    mode: config.mode,
    requestedCategory: config.category,
    resolvedCategory,
    reason,
    sessionKind: session.source,
    review,
    points,
  });
  const incorrectQuestionIds = historyEntry.incorrectQuestionIds;
  const incorrectQuestions = session.questions.filter((question) => incorrectQuestionIds.includes(question.id));

  return {
    score: historyEntry.score,
    total: historyEntry.total,
    percentage: historyEntry.percentage,
    points,
    averageAnswerTimeMs: historyEntry.averageAnswerTimeMs,
    review,
    incorrectQuestions,
    incorrectCount: incorrectQuestions.length,
    mode: config.mode,
    category: resolvedCategory,
    reason,
    sessionKind: session.source,
    timerEnabled: session.timerEnabled,
    historyEntry,
  };
}

export function createReviewItem(question, overrides = {}) {
  const selectedAnswer = overrides.selectedAnswer ?? question.correctAnswer;
  const isCorrect = overrides.isCorrect ?? selectedAnswer === question.correctAnswer;

  return {
    questionId: question.id,
    questionContent: question.content,
    category: question.category,
    selectedAnswer,
    correctAnswer: question.correctAnswer,
    isCorrect,
    timedOut: Boolean(overrides.timedOut),
    elapsedMs: Math.max(0, overrides.elapsedMs ?? 8_500),
    points: overrides.points ?? (isCorrect ? 16 : 0),
    explanation: question.explanation || '',
  };
}

export function getFinishReasonLabel(reason) {
  if (reason === 'survival-hit') {
    return 'Błąd w survivalu';
  }
  if (reason === 'retry-completed') {
    return 'Ukończono retry błędnych pytań';
  }
  if (reason === 'weak-spots-completed') {
    return 'Ukończono trening słabych miejsc';
  }
  return 'Ukończono rundę';
}

export function getTimePerQuestionMs(config) {
  const mode = getModeConfig(config.mode);
  return clamp(Math.round(config.timeLimit * mode.timeMultiplier), 5, 120) * 1_000;
}

export function filterSessionReview(review, filter = 'all') {
  if (filter === 'incorrect') {
    return review.filter((item) => !item.isCorrect && !item.timedOut);
  }
  if (filter === 'timedout') {
    return review.filter((item) => item.timedOut);
  }
  if (filter === 'correct') {
    return review.filter((item) => item.isCorrect);
  }
  return review;
}

export function getSessionReviewCounts(review) {
  return {
    all: review.length,
    incorrect: review.filter((item) => !item.isCorrect && !item.timedOut).length,
    timedout: review.filter((item) => item.timedOut).length,
    correct: review.filter((item) => item.isCorrect).length,
  };
}

export function getSessionAchievements(summary, { readiness } = {}) {
  const achievements = [];

  if (summary.review.every((item) => !item.timedOut)) {
    achievements.push({ id: 'no-timeouts', label: 'Bez timeoutów', tone: 'accent' });
  }

  if (summary.averageAnswerTimeMs > 0 && summary.averageAnswerTimeMs <= 8_000) {
    achievements.push({ id: 'fast-round', label: 'Szybka runda', tone: 'accent' });
  }

  if (summary.category !== 'all' && summary.incorrectCount === 0) {
    achievements.push({ id: 'clean-category', label: 'Czysta kategoria', tone: 'accent' });
  }

  if (readiness?.isReady) {
    achievements.push({ id: 'ready-for-exam', label: 'Gotowy na exam', tone: 'accent' });
  }

  return achievements;
}
