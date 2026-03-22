export interface AnswerOption {
  id: string;
  label: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  prompt: string;
  answers: AnswerOption[];
}

export interface AnswerResult {
  questionId: string;
  answerId?: string;
  isCorrect: boolean;
  timedOut: boolean;
  reactionTimeMs: number;
  awardedPoints: number;
  speedBonusPoints: number;
}

export interface ScoreModeConfig {
  enableSpeedBonus?: boolean;
  maxSpeedBonusPoints?: number;
}
