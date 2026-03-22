import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildQuestionSet,
  createQuizState,
  getAnswerOptionState,
  goToNextQuestion,
  questionSeed,
  resetQuiz,
  resolveAnswer,
  selectAnswer,
} from '../src/domain/questions/index.js';

test('buildQuestionSet filters by category and enforces limit', () => {
  const result = buildQuestionSet(
    { category: 'historia', limit: 1 },
    questionSeed,
    () => 0,
  );

  assert.equal(result.length, 1);
  assert.equal(result[0]?.category, 'historia');
});

test('quiz state resolves correct answer and exposes option view state', () => {
  const quiz = createQuizState({ limit: 2 }, { questions: questionSeed, random: () => 0 });
  const selected = selectAnswer(quiz, quiz.questions[0].correctOptionId);
  const { state, evaluation } = resolveAnswer(selected, 1_500);

  assert.equal(evaluation.isCorrect, true);
  assert.equal(state.score, 100);
  assert.equal(state.isResolved, true);

  const correctState = getAnswerOptionState(state, quiz.questions[0].correctOptionId);
  assert.equal(correctState.isCorrect, true);
  assert.equal(correctState.isIncorrect, false);
});

test('quiz progresses to next question, then can be reset', () => {
  const quiz = createQuizState({ limit: 2 }, { questions: questionSeed, random: () => 0 });
  const answered = selectAnswer(quiz, quiz.questions[0].correctOptionId);
  const { state: resolved } = resolveAnswer(answered);
  const next = goToNextQuestion(resolved);

  assert.equal(next.currentQuestionIndex, 1);
  assert.equal(next.isFinished, false);
  assert.equal(next.selectedOptionId, null);

  const reset = resetQuiz(next, { limit: 2 }, () => 0);
  assert.equal(reset.currentQuestionIndex, 0);
  assert.equal(reset.score, 0);
  assert.equal(reset.results.length, 0);
});
