import { GAME_MODES } from './constants.js';
import { labelForCategory, roundToOneDecimal } from './utils.js';

const READINESS_MIN_ANSWERS = 10;
const WEAK_SPOTS_MIN_ANSWERS = 5;
const WEAK_SPOTS_SESSION_WINDOW = 10;

export function normalizeReviewItem(item, index = 0) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const selectedAnswer = item.selectedAnswer ?? item.answer ?? null;

  return {
    questionId: item.questionId?.toString().trim() || `unknown-${index + 1}`,
    questionContent: item.questionContent?.toString().trim() || item.content?.toString().trim() || 'Pytanie bez treści',
    category: item.category?.toString().trim().toLowerCase() || 'all',
    selectedAnswer: selectedAnswer == null ? null : selectedAnswer.toString(),
    correctAnswer: item.correctAnswer?.toString().trim() || '',
    isCorrect: Boolean(item.isCorrect ?? item.correct),
    timedOut: Boolean(item.timedOut),
    elapsedMs: Math.max(0, Number(item.elapsedMs) || 0),
    points: Math.max(0, Number(item.points) || 0),
    explanation: item.explanation?.toString().trim() || '',
  };
}

export function normalizeHistoryEntry(item, index = 0, defaultMode = 'study') {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const mode = GAME_MODES[item.mode] ? item.mode : defaultMode;
  const score = Math.max(0, Number(item.score) || 0);
  const total = Math.max(score, Number(item.total) || 0);
  const review = Array.isArray(item.review)
    ? item.review.map((reviewItem, reviewIndex) => normalizeReviewItem(reviewItem, reviewIndex)).filter(Boolean)
    : [];
  const incorrectQuestionIds = Array.isArray(item.incorrectQuestionIds)
    ? [...new Set(item.incorrectQuestionIds.map((questionId) => questionId?.toString().trim()).filter(Boolean))]
    : [...new Set(review.filter((reviewItem) => !reviewItem.isCorrect).map((reviewItem) => reviewItem.questionId))];
  const totalElapsedMs = Math.max(0, Number(item.totalElapsedMs) || review.reduce((sum, reviewItem) => sum + reviewItem.elapsedMs, 0));
  const averageAnswerTimeMs = total > 0
    ? roundToOneDecimal((Number(item.averageAnswerTimeMs) || (review.length ? totalElapsedMs / review.length : 0)))
    : 0;

  return {
    id: item.id?.toString().trim() || `history-${index + 1}`,
    nickname: item.nickname?.toString().trim() || 'Gracz lokalny',
    score,
    total,
    percentage: total > 0 ? roundToOneDecimal((score / total) * 100) : 0,
    points: Math.max(0, Number(item.points) || 0),
    averageAnswerTimeMs,
    totalElapsedMs,
    mode,
    category: item.category?.toString().trim().toLowerCase() || 'all',
    requestedCategory: item.requestedCategory?.toString().trim().toLowerCase() || item.category?.toString().trim().toLowerCase() || 'all',
    reason: item.reason?.toString().trim() || 'completed',
    sessionKind: item.sessionKind?.toString().trim() || 'full',
    timestamp: item.timestamp?.toString().trim() || new Date().toISOString(),
    incorrectQuestionIds,
    review,
  };
}

export function createHistoryEntry({
  nickname,
  mode,
  requestedCategory,
  resolvedCategory,
  reason,
  sessionKind,
  review,
  points,
  timestamp = new Date().toISOString(),
}) {
  const score = review.filter((item) => item.isCorrect).length;
  const total = review.length;
  const totalElapsedMs = review.reduce((sum, item) => sum + item.elapsedMs, 0);
  const averageAnswerTimeMs = total > 0 ? roundToOneDecimal(totalElapsedMs / total) : 0;

  return {
    id: `session-${timestamp}-${Math.round(Math.random() * 1_000_000)}`,
    nickname,
    score,
    total,
    percentage: total > 0 ? roundToOneDecimal((score / total) * 100) : 0,
    points,
    averageAnswerTimeMs,
    totalElapsedMs,
    mode,
    category: resolvedCategory,
    requestedCategory,
    reason,
    sessionKind,
    timestamp,
    incorrectQuestionIds: [...new Set(review.filter((item) => !item.isCorrect).map((item) => item.questionId))],
    review,
  };
}

export function getHistoryMetrics(history) {
  const totalGames = history.length;
  const totalCorrect = history.reduce((sum, entry) => sum + entry.score, 0);
  const totalQuestions = history.reduce((sum, entry) => sum + entry.total, 0);
  const totalPoints = history.reduce((sum, entry) => sum + entry.points, 0);
  const weightedTime = history.reduce((sum, entry) => sum + (entry.averageAnswerTimeMs * entry.total), 0);

  return {
    totalGames,
    totalCorrect,
    totalQuestions,
    totalPoints,
    averageAccuracy: totalQuestions > 0 ? roundToOneDecimal((totalCorrect / totalQuestions) * 100) : 0,
    averageAnswerTimeMs: totalQuestions > 0 ? roundToOneDecimal(weightedTime / totalQuestions) : 0,
  };
}

export function getPerformanceData(history) {
  const categoryStats = new Map();
  const mistakeStats = new Map();

  history.forEach((entry) => {
    if (entry.review.length > 0) {
      entry.review.forEach((reviewItem) => {
        const categoryKey = reviewItem.category || entry.category || 'all';
        const categoryBucket = categoryStats.get(categoryKey) || { correct: 0, total: 0 };
        categoryBucket.total += 1;
        if (reviewItem.isCorrect) {
          categoryBucket.correct += 1;
        }
        categoryStats.set(categoryKey, categoryBucket);

        if (!reviewItem.isCorrect) {
          const mistakeBucket = mistakeStats.get(reviewItem.questionId) || {
            questionId: reviewItem.questionId,
            questionContent: reviewItem.questionContent,
            category: categoryKey,
            misses: 0,
            lastSeen: entry.timestamp,
          };
          mistakeBucket.misses += 1;
          mistakeBucket.lastSeen = entry.timestamp;
          mistakeStats.set(reviewItem.questionId, mistakeBucket);
        }
      });
      return;
    }

    if (entry.category !== 'all') {
      const categoryBucket = categoryStats.get(entry.category) || { correct: 0, total: 0 };
      categoryBucket.correct += entry.score;
      categoryBucket.total += entry.total;
      categoryStats.set(entry.category, categoryBucket);
    }
  });

  return { categoryStats, mistakeStats };
}

export function sortHistoryByRecency(history) {
  return [...history].sort((left, right) => right.timestamp.localeCompare(left.timestamp));
}

export function getRecentHistory(history, limit = WEAK_SPOTS_SESSION_WINDOW) {
  return sortHistoryByRecency(history).slice(0, limit);
}

export function getExamReadiness(history, category, minimumAnswers = READINESS_MIN_ANSWERS) {
  if (!category || category === 'all') {
    return {
      category: category || 'all',
      totalAnswers: 0,
      accuracy: 0,
      status: 'insufficient',
      label: 'Za mało danych',
      tone: 'warning',
      isReady: false,
      description: 'Potrzeba co najmniej 10 odpowiedzi w jednej kategorii.',
    };
  }

  const { categoryStats } = getPerformanceData(history);
  const stats = categoryStats.get(category);
  const totalAnswers = stats?.total ?? 0;
  const accuracy = totalAnswers > 0 ? roundToOneDecimal((stats.correct / stats.total) * 100) : 0;

  if (totalAnswers < minimumAnswers) {
    return {
      category,
      totalAnswers,
      accuracy,
      status: 'insufficient',
      label: 'Za mało danych',
      tone: 'warning',
      isReady: false,
      description: 'Najpierw zbierz więcej odpowiedzi w tej kategorii.',
    };
  }

  if (accuracy < 70) {
    return {
      category,
      totalAnswers,
      accuracy,
      status: 'not-ready',
      label: 'Jeszcze nie',
      tone: 'warning',
      isReady: false,
      description: 'Najpierw popraw słabe miejsca w trybie study.',
    };
  }

  if (accuracy < 85) {
    return {
      category,
      totalAnswers,
      accuracy,
      status: 'almost-ready',
      label: 'Prawie gotowe',
      tone: 'accent',
      isReady: false,
      description: 'Jeszcze jedna mocna sesja i można iść do exam.',
    };
  }

  return {
    category,
    totalAnswers,
    accuracy,
    status: 'ready',
    label: 'Gotowe na exam',
    tone: 'accent',
    isReady: true,
    description: 'Ta kategoria wygląda już stabilnie pod egzamin.',
  };
}

export function getAccuracyTrend(history, windowSize = 5) {
  const recent = sortHistoryByRecency(history);
  const latestWindow = recent.slice(0, windowSize);
  const previousWindow = recent.slice(windowSize, windowSize * 2);

  if (latestWindow.length < windowSize || previousWindow.length < windowSize) {
    return {
      status: 'insufficient',
      label: 'Za mało danych',
      delta: 0,
      latestAverage: latestWindow.length > 0
        ? roundToOneDecimal(latestWindow.reduce((sum, item) => sum + item.percentage, 0) / latestWindow.length)
        : 0,
      previousAverage: previousWindow.length > 0
        ? roundToOneDecimal(previousWindow.reduce((sum, item) => sum + item.percentage, 0) / previousWindow.length)
        : 0,
      tone: 'warning',
      description: 'Trend pojawi się po zebraniu co najmniej 10 sesji.',
    };
  }

  const latestAverage = roundToOneDecimal(latestWindow.reduce((sum, item) => sum + item.percentage, 0) / latestWindow.length);
  const previousAverage = roundToOneDecimal(previousWindow.reduce((sum, item) => sum + item.percentage, 0) / previousWindow.length);
  const delta = roundToOneDecimal(latestAverage - previousAverage);
  const trendDirection = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';

  return {
    status: trendDirection,
    label: delta > 0 ? `+${delta} pp` : delta < 0 ? `${delta} pp` : 'Bez zmian',
    delta,
    latestAverage,
    previousAverage,
    tone: delta > 0 ? 'accent' : delta < 0 ? 'warning' : 'default',
    description: `Ostatnie 5 sesji vs poprzednie 5: ${latestAverage}% vs ${previousAverage}%.`,
  };
}

export function buildWeakSpotQuestionSet({
  history,
  questions,
  limit,
  minimumAnswers = WEAK_SPOTS_MIN_ANSWERS,
  recentSessionLimit = WEAK_SPOTS_SESSION_WINDOW,
}) {
  const recentHistory = getRecentHistory(history, recentSessionLimit);
  const observedAnswers = recentHistory.reduce((sum, entry) => sum + (entry.review.length > 0 ? entry.review.length : entry.total), 0);

  if (observedAnswers < minimumAnswers) {
    return {
      available: false,
      questions: [],
      message: 'Zbieramy dane do adaptacyjnej sesji. Rozegraj jeszcze kilka pytań.',
      observedAnswers,
      hardestCategory: null,
      recentMistakeCount: 0,
    };
  }

  const questionMap = new Map(questions.map((question) => [question.id, question]));
  const mistakeCounts = new Map();

  recentHistory.forEach((entry) => {
    const incorrectIds = entry.review.length > 0
      ? entry.review.filter((reviewItem) => !reviewItem.isCorrect).map((reviewItem) => reviewItem.questionId)
      : entry.incorrectQuestionIds;

    incorrectIds.forEach((questionId) => {
      if (!questionMap.has(questionId)) {
        return;
      }
      const current = mistakeCounts.get(questionId) || 0;
      mistakeCounts.set(questionId, current + 1);
    });
  });

  const hardestCategory = getHardestCategory(recentHistory);
  const ordered = [];
  const seen = new Set();

  [...mistakeCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .forEach(([questionId]) => {
      const question = questionMap.get(questionId);
      if (!question || seen.has(question.id)) {
        return;
      }
      seen.add(question.id);
      ordered.push(question);
    });

  if (hardestCategory?.category) {
    questions
      .filter((question) => question.category === hardestCategory.category)
      .forEach((question) => {
        if (seen.has(question.id)) {
          return;
        }
        seen.add(question.id);
        ordered.push(question);
      });
  }

  questions.forEach((question) => {
    if (seen.has(question.id)) {
      return;
    }
    seen.add(question.id);
    ordered.push(question);
  });

  if (ordered.length === 0) {
    return {
      available: false,
      questions: [],
      message: 'Zbieramy dane do adaptacyjnej sesji. Brakuje pytań powiązanych z historią.',
      observedAnswers,
      hardestCategory: hardestCategory?.category ?? null,
      recentMistakeCount: 0,
    };
  }

  return {
    available: true,
    questions: ordered.slice(0, limit),
    message: hardestCategory?.category
      ? `Sesja opiera się na najczęstszych błędach i kategorii ${labelForCategory(hardestCategory.category)}.`
      : 'Sesja opiera się na ostatnich błędach i lokalnej historii.',
    observedAnswers,
    hardestCategory: hardestCategory?.category ?? null,
    recentMistakeCount: mistakeCounts.size,
  };
}

export function getHardestCategory(history) {
  const { categoryStats } = getPerformanceData(history);
  const categories = [...categoryStats.entries()]
    .filter(([category, stats]) => category !== 'all' && stats.total > 0)
    .map(([category, stats]) => ({
      category,
      total: stats.total,
      accuracy: roundToOneDecimal((stats.correct / stats.total) * 100),
    }))
    .sort((left, right) => left.accuracy - right.accuracy || right.total - left.total);

  return categories[0] || null;
}

export function getMostMistakenQuestions(history, questions, limit = 5) {
  const { mistakeStats } = getPerformanceData(history);
  const questionMap = new Map(questions.map((question) => [question.id, question]));

  return [...mistakeStats.values()]
    .map((item) => {
      const question = questionMap.get(item.questionId);
      return {
        ...item,
        questionContent: item.questionContent || question?.content || 'Pytanie bez treści',
        category: item.category || question?.category || 'all',
      };
    })
    .sort((left, right) => right.misses - left.misses || right.lastSeen.localeCompare(left.lastSeen))
    .slice(0, limit);
}

export function getRecommendedSession({ history, questions, focus }) {
  const metrics = getHistoryMetrics(history);
  const hardest = getHardestCategory(history);
  const availableCategories = ['all', ...new Set(questions.map((question) => question.category))];
  const normalizedFocus = focus?.toLowerCase();
  const targetCategory = hardest?.category || (availableCategories.includes(normalizedFocus) ? normalizedFocus : null);
  const readiness = targetCategory ? getExamReadiness(history, targetCategory) : null;

  if (hardest) {
    if (readiness?.isReady) {
      return {
        title: `Egzamin: ${labelForCategory(hardest.category)}`,
        description: `Ta kategoria ma już ${hardest.accuracy}% skuteczności i wygląda dobrze pod exam.`,
        mode: 'exam',
        trainingType: 'exam',
        category: hardest.category,
      };
    }

    return {
      title: `Study + słabe miejsca: ${labelForCategory(hardest.category)}`,
      description: `To dziś najtrudniejsza kategoria (${hardest.accuracy}%). Najpierw popraw błędy, potem wróć do exam.`,
      mode: 'study',
      trainingType: 'weak-spots',
      category: hardest.category,
    };
  }

  return {
    title: availableCategories.includes(normalizedFocus) ? `Rozgrzewka: ${labelForCategory(normalizedFocus)}` : 'Rozgrzewka study',
    description: metrics.totalGames === 0
      ? 'Brak historii. Zacznij spokojną sesją, a dashboard od razu zbuduje pierwsze insighty.'
      : 'Masz już wyniki, ale jeszcze brakuje wyraźnego słabego punktu. Zagraj kolejną sesję i sprawdź trendy.',
    mode: 'study',
    trainingType: 'study',
    category: availableCategories.includes(normalizedFocus) ? normalizedFocus : 'all',
  };
}
