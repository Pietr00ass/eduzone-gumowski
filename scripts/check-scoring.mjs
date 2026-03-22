import assert from 'node:assert/strict';
import { calculateSpeedBonus, scoreAnswer } from '../dist/modules/scoring.js';
import { QuizSession } from '../dist/modules/quizSession.js';

assert.equal(calculateSpeedBonus(2_000, 20_000, 30), 27);
assert.equal(calculateSpeedBonus(15_000, 20_000, 30), 8);

assert.deepEqual(
  scoreAnswer({
    isCorrect: true,
    timedOut: false,
    reactionTimeMs: 5_000,
    timeLimitMs: 20_000,
    mode: { enableSpeedBonus: true, maxSpeedBonusPoints: 40 },
  }),
  { basePoints: 100, speedBonusPoints: 30, totalPoints: 130 },
);

const session = new QuizSession(
  [
    {
      id: 'q1',
      prompt: '2 + 2 = ?',
      answers: [
        { id: 'a1', label: '4', isCorrect: true },
        { id: 'a2', label: '5', isCorrect: false },
      ],
    },
    {
      id: 'q2',
      prompt: '3 + 3 = ?',
      answers: [
        { id: 'a3', label: '6', isCorrect: true },
        { id: 'a4', label: '7', isCorrect: false },
      ],
    },
  ],
  {
    questionTimeLimitMs: 20_000,
    autoAdvanceDelayMs: 1_500,
    scoringMode: { enableSpeedBonus: true, maxSpeedBonusPoints: 20 },
  },
);

const result = session.recordAnswer('q1', 'a1', 4_000);
assert.equal(result.reactionTimeMs, 4_000);
assert.equal(result.speedBonusPoints, 16);
assert.equal(session.getTotalScore(), 116);

const timeoutResult = session.recordTimeout('q2');
assert.equal(timeoutResult.timedOut, true);
assert.equal(timeoutResult.awardedPoints, 0);
assert.equal(session.getConfig().autoAdvanceDelayMs, 1_500);
