from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass


@dataclass(frozen=True)
class QuizResult:
    profile_id: str
    category: str
    mode: str
    correct_answers: int
    total_questions: int

    @property
    def percentage(self) -> float:
        if self.total_questions == 0:
            return 0.0
        return round((self.correct_answers / self.total_questions) * 100, 2)


class StatisticsStore:
    def __init__(self) -> None:
        self._results: list[QuizResult] = []

    def save_result(self, result: QuizResult) -> None:
        self._results.append(result)

    def results_for_profile(self, profile_id: str) -> list[QuizResult]:
        return [result for result in self._results if result.profile_id == profile_id]

    def summary_by_category(self, profile_id: str) -> dict[str, dict[str, float]]:
        grouped: dict[str, list[QuizResult]] = defaultdict(list)
        for result in self.results_for_profile(profile_id):
            grouped[result.category].append(result)

        summary: dict[str, dict[str, float]] = {}
        for category, results in grouped.items():
            total_sessions = len(results)
            total_questions = sum(result.total_questions for result in results)
            total_correct = sum(result.correct_answers for result in results)
            summary[category] = {
                "sessions": total_sessions,
                "correct_answers": total_correct,
                "total_questions": total_questions,
                "average_percentage": round((total_correct / total_questions) * 100, 2)
                if total_questions
                else 0.0,
            }
        return summary
