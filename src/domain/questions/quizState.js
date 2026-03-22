/** @import { AnswerEvaluation, AnswerOptionViewState, Question, QuestionFilters, QuizState, ScoreBreakdown, ScoringRule } from './types.js' */
import { buildQuestionSet } from './selectors.js';
import { questionSeed } from './seed.js';

/** @type {ScoringRule} */
export const defaultScoringRule = {
  basePoints: 100,
  speedBonusMultiplier: 0,
  streakBonus: 0,
};

/** @param {boolean} isCorrect @param {ScoringRule} scoringRule @param {{ responseTimeMs?: number, streak?: number }} [context={}] @returns {ScoreBreakdown} */
export function calculateScore(isCorrect, scoringRule, context = {}) {
  if (!isCorrect) {
    return { basePoints: 0, speedBonus: 0, streakBonus: 0, totalAwarded: 0 };
  }

  const responseTimeMs = context.responseTimeMs ?? 0;
  const streak = context.streak ?? 0;
  const speedBonus = Math.max(0, Math.round((10_000 - responseTimeMs) * scoringRule.speedBonusMultiplier));
  const streakBonus = Math.max(0, streak * scoringRule.streakBonus);
  const basePoints = scoringRule.basePoints;

  return { basePoints, speedBonus, streakBonus, totalAwarded: basePoints + speedBonus + streakBonus };
}

/** @param {QuestionFilters} [filters={}] @param {{ questions?: Question[], scoringRule?: ScoringRule, random?: () => number }} [options={}] @returns {QuizState} */
export function createQuizState(filters = {}, options = {}) {
  const questions = buildQuestionSet(filters, options.questions ?? questionSeed, options.random);

  return {
    questions,
    currentQuestionIndex: 0,
    score: 0,
    selectedOptionId: null,
    isResolved: false,
    isFinished: questions.length === 0,
    streak: 0,
    results: [],
    scoringRule: options.scoringRule ?? defaultScoringRule,
  };
}

/** @param {QuizState} state */
export function getCurrentQuestion(state) {
  return state.questions[state.currentQuestionIndex] ?? null;
}

/** @param {QuizState} state @param {string} optionId @returns {QuizState} */
export function selectAnswer(state, optionId) {
  if (state.isFinished || state.isResolved) {
    return state;
  }

  return { ...state, selectedOptionId: optionId };
}

/** @param {QuizState} state @param {number | undefined} [responseTimeMs] */
export function resolveAnswer(state, responseTimeMs) {
  const question = getCurrentQuestion(state);

  if (!question) {
    throw new Error('Nie można sprawdzić odpowiedzi bez aktywnego pytania.');
  }

  if (!state.selectedOptionId) {
    throw new Error('Nie można sprawdzić odpowiedzi bez zaznaczonej opcji.');
  }

  if (state.isResolved) {
    const previous = state.results[state.results.length - 1];
    return {
      state,
      evaluation: {
        isCorrect: previous?.isCorrect ?? false,
        selectedOptionId: state.selectedOptionId,
        correctOptionId: question.correctOptionId,
        score: previous?.score ?? calculateScore(false, state.scoringRule),
      },
    };
  }

  const isCorrect = state.selectedOptionId === question.correctOptionId;
  const nextStreak = isCorrect ? state.streak + 1 : 0;
  const score = calculateScore(isCorrect, state.scoringRule, { responseTimeMs, streak: nextStreak });

  /** @type {AnswerEvaluation} */
  const evaluation = {
    isCorrect,
    selectedOptionId: state.selectedOptionId,
    correctOptionId: question.correctOptionId,
    score,
  };

  return {
    evaluation,
    state: {
      ...state,
      score: state.score + score.totalAwarded,
      isResolved: true,
      streak: nextStreak,
      results: [
        ...state.results,
        {
          questionId: question.id,
          selectedOptionId: state.selectedOptionId,
          correctOptionId: question.correctOptionId,
          isCorrect,
          score,
        },
      ],
    },
  };
}

/** @param {QuizState} state @param {string} optionId @returns {AnswerOptionViewState} */
export function getAnswerOptionState(state, optionId) {
  const question = getCurrentQuestion(state);
  const isSelected = state.selectedOptionId === optionId;
  const isCorrect = state.isResolved && question?.correctOptionId === optionId;
  const isIncorrect = state.isResolved && isSelected && question?.correctOptionId !== optionId;

  return { optionId, isSelected, isCorrect, isIncorrect };
}

/** @param {QuizState} state @returns {QuizState} */
export function goToNextQuestion(state) {
  if (!state.isResolved) {
    throw new Error('Nie można przejść dalej przed rozstrzygnięciem pytania.');
  }

  const nextIndex = state.currentQuestionIndex + 1;
  const isFinished = nextIndex >= state.questions.length;

  return {
    ...state,
    currentQuestionIndex: isFinished ? state.currentQuestionIndex : nextIndex,
    selectedOptionId: null,
    isResolved: false,
    isFinished,
  };
}

/** @param {QuizState} state @param {QuestionFilters} [filters={}] @param {() => number} [random=Math.random] @returns {QuizState} */
export function resetQuiz(state, filters = {}, random = Math.random) {
  return createQuizState(filters, {
    questions: state.questions,
    scoringRule: state.scoringRule,
    random,
  });
}
