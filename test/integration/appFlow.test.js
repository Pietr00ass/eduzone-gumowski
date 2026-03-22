import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuizApp } from '../../src/frontend/app.js';
import { sampleQuestions } from '../../src/shared.js';
import { createDeterministicRng } from '../../src/frontend/quizLogic.js';

test('start aplikacji pokazuje menu startowe', () => {
  const app = createQuizApp({ questions: sampleQuestions });
  const state = app.start();

  assert.equal(state.screen, 'menu');
  assert.equal(state.finalScore, 0);
});

test('wybór kategorii rozpoczyna quiz z pytaniami z tej kategorii', () => {
  const app = createQuizApp({ questions: sampleQuestions, random: createDeterministicRng([0, 0]) , limit: 2});
  app.start();
  const state = app.chooseCategory('math');

  assert.equal(state.screen, 'quiz');
  assert.equal(state.session.questions.length, 2);
  assert.ok(state.session.questions.every((question) => question.category === 'math'));
});

test('użytkownik może rozwiązać quiz i zobaczyć ekran wyniku', () => {
  const app = createQuizApp({ questions: sampleQuestions, random: createDeterministicRng([0, 0]), limit: 2 });
  app.start();
  app.chooseCategory('math');

  let state = app.answerCurrent('4', 10_000);
  assert.equal(state.screen, 'quiz');
  assert.equal(state.finalScore, 1);

  state = app.answerCurrent('15', 11_000);
  assert.equal(state.screen, 'result');
  assert.equal(state.finalScore, 2);
  assert.equal(state.session.finished, true);
});

test('po ekranie wyniku użytkownik może wrócić do menu albo zrestartować grę', () => {
  const app = createQuizApp({ questions: sampleQuestions, random: createDeterministicRng([0]), limit: 1 });
  app.start();
  app.chooseCategory('history');
  app.answerCurrent('966', 5_000);

  let state = app.backToMenu();
  assert.equal(state.screen, 'menu');
  assert.equal(state.session, null);

  state = app.restart();
  assert.equal(state.screen, 'menu');
  assert.equal(state.finalScore, 0);
});
