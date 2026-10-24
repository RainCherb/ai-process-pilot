from pathlib import Path

from processpilot.evaluation import evaluate_cases, load_cases


def test_evaluation_fixture_meets_quality_gate():
    path = Path(__file__).parent / "fixtures" / "evaluation.jsonl"
    report = evaluate_cases(load_cases(path))
    assert report.total >= 20
    assert report.category_accuracy >= 0.90
    assert report.priority_accuracy >= 0.90
