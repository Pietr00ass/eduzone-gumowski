export const ANSWER_OPTIONS_COUNT = 4;

/** @typedef {'historia'|'nauka'|'technologia'|'sport'|'geografia'} QuestionCategory */

/** @typedef {{ id: string, text: string }} QuestionOption */

/**
 * @typedef {Object} Question
 * @property {string} id
 * @property {string} prompt
 * @property {[QuestionOption, QuestionOption, QuestionOption, QuestionOption]} options
 * @property {string} correctOptionId
 * @property {QuestionCategory} category
 * @property {string | undefined} [explanation]
 */

/** @typedef {{ category?: QuestionCategory, limit?: number }} QuestionFilters */

/**
 * @typedef {Object} ScoringRule
 * @property {number} basePoints
 * @property {number} speedBonusMultiplier
 * @property {number} streakBonus
 */

/**
 * @typedef {Object} ScoreBreakdown
 * @property {number} basePoints
 * @property {number} speedBonus
 * @property {number} streakBonus
 * @property {number} totalAwarded
 */

/**
 * @typedef {Object} QuestionResult
 * @property {string} questionId
 * @property {string} selectedOptionId
 * @property {string} correctOptionId
 * @property {boolean} isCorrect
 * @property {ScoreBreakdown} score
 */

/**
 * @typedef {Object} QuizState
 * @property {Question[]} questions
 * @property {number} currentQuestionIndex
 * @property {number} score
 * @property {string | null} selectedOptionId
 * @property {boolean} isResolved
 * @property {boolean} isFinished
 * @property {number} streak
 * @property {QuestionResult[]} results
 * @property {ScoringRule} scoringRule
 */

/**
 * @typedef {Object} AnswerEvaluation
 * @property {boolean} isCorrect
 * @property {string} selectedOptionId
 * @property {string} correctOptionId
 * @property {ScoreBreakdown} score
 */

/**
 * @typedef {Object} AnswerOptionViewState
 * @property {string} optionId
 * @property {boolean} isSelected
 * @property {boolean} isCorrect
 * @property {boolean} isIncorrect
 */
