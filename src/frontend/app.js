import { createQuizSession, submitAnswer } from './quizLogic.js';

export function createQuizApp({ questions, random, limit = 3, timeLimitMs = 30_000 }) {
  const state = {
    screen: 'menu',
    category: null,
    session: null,
    finalScore: 0,
  };

  return {
    getState() {
      return structuredClone(state);
    },
    start() {
      state.screen = 'menu';
      state.category = null;
      state.session = null;
      state.finalScore = 0;
      return this.getState();
    },
    chooseCategory(category) {
      state.category = category;
      state.session = createQuizSession({ questions, category, random, limit, timeLimitMs });
      state.session.startedAt = 0;
      state.screen = 'quiz';
      return this.getState();
    },
    answerCurrent(answer, now) {
      state.session = submitAnswer(state.session, answer, now);
      state.finalScore = state.session.score ?? 0;
      if (state.session.finished) {
        state.screen = 'result';
      }
      return this.getState();
    },
    restart() {
      return this.start();
    },
    backToMenu() {
      state.screen = 'menu';
      state.session = null;
      return this.getState();
    },
  };
}
