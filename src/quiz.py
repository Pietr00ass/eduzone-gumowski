from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class GameMode(str, Enum):
    STUDY = "study"
    EXAM = "exam"


@dataclass(frozen=True)
class QuizModeConfig:
    mode: GameMode
    show_explanations_after_answer: bool
    timer_enabled_by_default: bool
    allow_timer_toggle: bool
    allow_repeat_question: bool
    hints_enabled: bool
    question_time_limit_seconds: int
    show_percentage_score: bool


QUIZ_MODE_CONFIGS: dict[GameMode, QuizModeConfig] = {
    GameMode.STUDY: QuizModeConfig(
        mode=GameMode.STUDY,
        show_explanations_after_answer=True,
        timer_enabled_by_default=False,
        allow_timer_toggle=True,
        allow_repeat_question=True,
        hints_enabled=True,
        question_time_limit_seconds=90,
        show_percentage_score=False,
    ),
    GameMode.EXAM: QuizModeConfig(
        mode=GameMode.EXAM,
        show_explanations_after_answer=False,
        timer_enabled_by_default=True,
        allow_timer_toggle=False,
        allow_repeat_question=False,
        hints_enabled=False,
        question_time_limit_seconds=45,
        show_percentage_score=True,
    ),
}


@dataclass
class AnswerOutcome:
    is_correct: bool
    explanation: str | None
    can_repeat_question: bool


@dataclass
class QuizSessionSummary:
    mode: GameMode
    correct_answers: int
    total_questions: int

    @property
    def percentage_score(self) -> float | None:
        if not QUIZ_MODE_CONFIGS[self.mode].show_percentage_score:
            return None
        if self.total_questions == 0:
            return 0.0
        return round((self.correct_answers / self.total_questions) * 100, 2)


def build_answer_outcome(mode: GameMode, is_correct: bool, explanation: str) -> AnswerOutcome:
    config = QUIZ_MODE_CONFIGS[mode]
    return AnswerOutcome(
        is_correct=is_correct,
        explanation=explanation if config.show_explanations_after_answer else None,
        can_repeat_question=config.allow_repeat_question,
    )
