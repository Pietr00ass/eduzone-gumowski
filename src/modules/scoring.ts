import type { ScoreModeConfig } from '../types/quiz.js';

export interface ScoreAnswerInput {
  isCorrect: boolean;
  timedOut: boolean;
  reactionTimeMs: number;
  timeLimitMs: number;
  basePoints?: number;
  mode?: ScoreModeConfig;
}

export interface ScoreAnswerResult {
  basePoints: number;
  speedBonusPoints: number;
  totalPoints: number;
}

export function calculateSpeedBonus(
  reactionTimeMs: number,
  timeLimitMs: number,
  maxSpeedBonusPoints: number,
): number {
  if (reactionTimeMs < 0 || timeLimitMs <= 0 || maxSpeedBonusPoints <= 0) {
    return 0;
  }

  const normalizedRemainingTime = Math.max(0, timeLimitMs - reactionTimeMs) / timeLimitMs;
  return Math.round(normalizedRemainingTime * maxSpeedBonusPoints);
}

export function scoreAnswer({
  isCorrect,
  timedOut,
  reactionTimeMs,
  timeLimitMs,
  basePoints = 100,
  mode,
}: ScoreAnswerInput): ScoreAnswerResult {
  if (!isCorrect || timedOut) {
    return {
      basePoints: 0,
      speedBonusPoints: 0,
      totalPoints: 0,
    };
  }

  const speedBonusPoints = mode?.enableSpeedBonus
    ? calculateSpeedBonus(reactionTimeMs, timeLimitMs, mode.maxSpeedBonusPoints ?? 25)
    : 0;

  return {
    basePoints,
    speedBonusPoints,
    totalPoints: basePoints + speedBonusPoints,
  };
}
