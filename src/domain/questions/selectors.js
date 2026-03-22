/** @import { Question, QuestionCategory, QuestionFilters } from './types.js' */
import { questionSeed } from './seed.js';

/** @param {Question[]} questions @param {QuestionCategory | undefined} [category] */
export function filterQuestionsByCategory(questions, category) {
  if (!category) {
    return [...questions];
  }

  return questions.filter((question) => question.category === category);
}

/** @param {Question[]} questions @param {() => number} [random=Math.random] */
export function shuffleQuestions(questions, random = Math.random) {
  const shuffled = [...questions];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

/** @param {Question[]} questions @param {number} [limit=questions.length] */
export function limitQuestions(questions, limit = questions.length) {
  return questions.slice(0, Math.max(0, limit));
}

/** @param {QuestionFilters} [filters={}] @param {Question[]} [sourceQuestions=questionSeed] @param {() => number} [random=Math.random] */
export function buildQuestionSet(filters = {}, sourceQuestions = questionSeed, random = Math.random) {
  const filtered = filterQuestionsByCategory(sourceQuestions, filters.category);
  const shuffled = shuffleQuestions(filtered, random);

  return limitQuestions(shuffled, filters.limit ?? shuffled.length);
}
