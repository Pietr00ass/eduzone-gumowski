import unittest

from src.quiz import GameMode, QUIZ_MODE_CONFIGS, QuizSessionSummary, build_answer_outcome
from src.statistics import QuizResult, StatisticsStore


class QuizModeTests(unittest.TestCase):
    def test_study_mode_exposes_learning_features(self) -> None:
        config = QUIZ_MODE_CONFIGS[GameMode.STUDY]
        self.assertTrue(config.show_explanations_after_answer)
        self.assertTrue(config.allow_timer_toggle)
        self.assertTrue(config.allow_repeat_question)

    def test_exam_mode_is_faster_and_reports_percentage(self) -> None:
        study = QUIZ_MODE_CONFIGS[GameMode.STUDY]
        exam = QUIZ_MODE_CONFIGS[GameMode.EXAM]
        self.assertFalse(exam.hints_enabled)
        self.assertLess(exam.question_time_limit_seconds, study.question_time_limit_seconds)
        summary = QuizSessionSummary(mode=GameMode.EXAM, correct_answers=7, total_questions=10)
        self.assertEqual(summary.percentage_score, 70.0)

    def test_answer_outcome_hides_explanation_in_exam(self) -> None:
        outcome = build_answer_outcome(GameMode.EXAM, True, "Detailed explanation")
        self.assertIsNone(outcome.explanation)
        self.assertFalse(outcome.can_repeat_question)


class StatisticsTests(unittest.TestCase):
    def test_results_are_grouped_by_local_profile_and_category(self) -> None:
        store = StatisticsStore()
        store.save_result(QuizResult(profile_id="device-a", category="tcp", mode="study", correct_answers=8, total_questions=10))
        store.save_result(QuizResult(profile_id="device-a", category="tcp", mode="exam", correct_answers=7, total_questions=10))
        store.save_result(QuizResult(profile_id="device-a", category="udp", mode="study", correct_answers=5, total_questions=10))
        store.save_result(QuizResult(profile_id="device-b", category="tcp", mode="study", correct_answers=10, total_questions=10))

        summary = store.summary_by_category(profile_id="device-a")

        self.assertEqual(summary["tcp"]["sessions"], 2)
        self.assertEqual(summary["tcp"]["average_percentage"], 75.0)
        self.assertEqual(summary["udp"]["sessions"], 1)
        self.assertNotIn("icmp", summary)


if __name__ == "__main__":
    unittest.main()
