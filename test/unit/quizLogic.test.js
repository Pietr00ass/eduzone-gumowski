import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateScore,
  createDeterministicRng,
  filterQuestionsByCategory,
  isAnswerCorrect,
  isTimedOut,
  selectRandomQuestions,
} from '../../src/frontend/quizLogic.js';
import { sampleQuestions } from '../../src/shared.js';

test('filtrowanie po kategorii zwraca tylko pytania z wybranej kategorii', () => {
  const filtered = filterQuestionsByCategory(sampleQuestions, 'science');
  assert.equal(filtered.length, 2);
  assert.ok(filtered.every((question) => question.category === 'science'));
});

test('losowanie i limit pytań zwraca unikalne rekordy do zadanego limitu', () => {
  const random = createDeterministicRng([0.8, 0.1, 0.5]);
  const picked = selectRandomQuestions(sampleQuestions, 3, random);

  assert.equal(picked.length, 3);
  assert.equal(new Set(picked.map((question) => question.id)).size, 3);
  assert.deepEqual(picked.map((question) => question.id), [5, 1, 3]);
});

test('sprawdzanie odpowiedzi rozpoznaje poprawną i błędną odpowiedź', () => {
  assert.equal(isAnswerCorrect(sampleQuestions[0], '4'), true);
  assert.equal(isAnswerCorrect(sampleQuestions[0], '3'), false);
});

test('punktacja sumuje tylko poprawne odpowiedzi', () => {
  const score = calculateScore([
    { correct: true },
    { correct: false },
    { correct: true },
  ]);

  assert.equal(score, 2);
});

test('timeout aktywuje się po przekroczeniu limitu czasu', () => {
  assert.equal(isTimedOut(0, 29_999, 30_000), false);
  assert.equal(isTimedOut(0, 30_000, 30_000), true);
});
