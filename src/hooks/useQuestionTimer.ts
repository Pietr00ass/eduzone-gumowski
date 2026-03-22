import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseQuestionTimerOptions {
  questionId: string;
  durationMs?: number;
  autoAdvanceDelayMs?: number;
  onTimeout?: (payload: { questionId: string; reactionTimeMs: number }) => void;
  onAutoAdvance?: (payload: { questionId: string }) => void;
}

export interface UseQuestionTimerResult {
  remainingMs: number;
  isTimedOut: boolean;
  isAnswerLocked: boolean;
  reactionTimeMs: number;
  registerAnswer: () => number;
}

const DEFAULT_DURATION_MS = 20_000;
const DEFAULT_AUTO_ADVANCE_DELAY_MS = 1_500;

export function useQuestionTimer({
  questionId,
  durationMs = DEFAULT_DURATION_MS,
  autoAdvanceDelayMs = DEFAULT_AUTO_ADVANCE_DELAY_MS,
  onTimeout,
  onAutoAdvance,
}: UseQuestionTimerOptions): UseQuestionTimerResult {
  const [remainingMs, setRemainingMs] = useState(durationMs);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [isAnswerLocked, setIsAnswerLocked] = useState(false);
  const [reactionTimeMs, setReactionTimeMs] = useState(0);
  const startedAtRef = useRef(Date.now());
  const answerRegisteredRef = useRef(false);

  useEffect(() => {
    startedAtRef.current = Date.now();
    answerRegisteredRef.current = false;
    setRemainingMs(durationMs);
    setIsTimedOut(false);
    setIsAnswerLocked(false);
    setReactionTimeMs(0);
  }, [questionId, durationMs]);

  useEffect(() => {
    if (isAnswerLocked) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      const nextRemaining = Math.max(durationMs - elapsed, 0);
      setRemainingMs(nextRemaining);

      if (nextRemaining === 0) {
        setIsTimedOut(true);
        setIsAnswerLocked(true);
        setReactionTimeMs(durationMs);
        onTimeout?.({ questionId, reactionTimeMs: durationMs });
        window.clearInterval(intervalId);

        if (autoAdvanceDelayMs >= 0) {
          window.setTimeout(() => onAutoAdvance?.({ questionId }), autoAdvanceDelayMs);
        }
      }
    }, 100);

    return () => window.clearInterval(intervalId);
  }, [autoAdvanceDelayMs, durationMs, isAnswerLocked, onAutoAdvance, onTimeout, questionId]);

  const registerAnswer = useCallback(() => {
      if (answerRegisteredRef.current || isAnswerLocked) {
        return reactionTimeMs;
      }

      answerRegisteredRef.current = true;
      const measuredReactionTimeMs = Math.min(Date.now() - startedAtRef.current, durationMs);
      setReactionTimeMs(measuredReactionTimeMs);
      setIsAnswerLocked(true);
      return measuredReactionTimeMs;
  }, [durationMs, isAnswerLocked, reactionTimeMs]);

  return {
    remainingMs,
    isTimedOut,
    isAnswerLocked,
    reactionTimeMs,
    registerAnswer,
  };
}
