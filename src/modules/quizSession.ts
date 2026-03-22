import type { AnswerResult, Question, ScoreModeConfig } from '../types/quiz.js';
import { scoreAnswer } from './scoring.js';

export interface QuizSessionConfig {
  questionTimeLimitMs?: number;
  autoAdvanceDelayMs?: number;
  scoringMode?: ScoreModeConfig;
}

export class QuizSession {
  private readonly questionTimeLimitMs: number;
  private readonly autoAdvanceDelayMs: number;
  private readonly scoringMode?: ScoreModeConfig;
  private readonly answers = new Map<string, AnswerResult>();

  constructor(private readonly questions: Question[], config: QuizSessionConfig = {}) {
    this.questionTimeLimitMs = config.questionTimeLimitMs ?? 20_000;
    this.autoAdvanceDelayMs = config.autoAdvanceDelayMs ?? 1_500;
    this.scoringMode = config.scoringMode;
  }

  getConfig() {
    return {
      questionTimeLimitMs: this.questionTimeLimitMs,
      autoAdvanceDelayMs: this.autoAdvanceDelayMs,
      scoringMode: this.scoringMode,
    };
  }

  recordAnswer(questionId: string, answerId: string, reactionTimeMs: number): AnswerResult {
    const question = this.requireQuestion(questionId);
    const answer = question.answers.find(({ id }) => id === answerId);

    if (!answer) {
      throw new Error(`Answer ${answerId} not found for question ${questionId}.`);
    }

    const awarded = scoreAnswer({
      isCorrect: answer.isCorrect,
      timedOut: false,
      reactionTimeMs,
      timeLimitMs: this.questionTimeLimitMs,
      mode: this.scoringMode,
    });

    const result: AnswerResult = {
      questionId,
      answerId,
      isCorrect: answer.isCorrect,
      timedOut: false,
      reactionTimeMs,
      awardedPoints: awarded.totalPoints,
      speedBonusPoints: awarded.speedBonusPoints,
    };

    this.answers.set(questionId, result);
    return result;
  }

  recordTimeout(questionId: string): AnswerResult {
    this.requireQuestion(questionId);

    const result: AnswerResult = {
      questionId,
      isCorrect: false,
      timedOut: true,
      reactionTimeMs: this.questionTimeLimitMs,
      awardedPoints: 0,
      speedBonusPoints: 0,
    };

    this.answers.set(questionId, result);
    return result;
  }

  getAnswerResult(questionId: string): AnswerResult | undefined {
    return this.answers.get(questionId);
  }

  getTotalScore(): number {
    return [...this.answers.values()].reduce((sum, result) => sum + result.awardedPoints, 0);
  }

  getNextQuestionId(currentQuestionId: string): string | null {
    const currentIndex = this.questions.findIndex(({ id }) => id === currentQuestionId);
    if (currentIndex < 0 || currentIndex === this.questions.length - 1) {
      return null;
    }

    return this.questions[currentIndex + 1].id;
  }

  private requireQuestion(questionId: string): Question {
    const question = this.questions.find(({ id }) => id === questionId);
    if (!question) {
      throw new Error(`Question ${questionId} not found.`);
    }

    return question;
  }
}
