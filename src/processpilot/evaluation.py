"""Small, transparent regression evaluation for the deterministic triage engine."""
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path

from .engine import classify


@dataclass(frozen=True)
class EvaluationReport:
    total: int
    category_correct: int
    priority_correct: int

    @property
    def category_accuracy(self) -> float:
        return self.category_correct / self.total if self.total else 0.0

    @property
    def priority_accuracy(self) -> float:
        return self.priority_correct / self.total if self.total else 0.0

    def to_dict(self) -> dict:
        return {
            "total": self.total,
            "category_correct": self.category_correct,
            "priority_correct": self.priority_correct,
            "category_accuracy": round(self.category_accuracy, 4),
            "priority_accuracy": round(self.priority_accuracy, 4),
        }


def load_cases(path: Path) -> list[dict]:
    cases: list[dict] = []
    for line_number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        raw = raw.strip()
        if not raw or raw.startswith("#"):
            continue
        item = json.loads(raw)
        if not isinstance(item, dict):
            raise ValueError(f"Line {line_number}: expected JSON object")
        for key in ("text", "category", "priority"):
            if not isinstance(item.get(key), str) or not item[key].strip():
                raise ValueError(f"Line {line_number}: missing string field {key}")
        cases.append(item)
    if not cases:
        raise ValueError("Evaluation dataset is empty")
    return cases


def evaluate_cases(cases: list[dict]) -> EvaluationReport:
    category_correct = 0
    priority_correct = 0
    for case in cases:
        result = classify(case["text"])
        category_correct += int(result.category == case["category"])
        priority_correct += int(result.priority == case["priority"])
    return EvaluationReport(
        total=len(cases),
        category_correct=category_correct,
        priority_correct=priority_correct,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate deterministic routing on labeled JSONL")
    parser.add_argument("dataset", type=Path)
    parser.add_argument("--min-category-accuracy", type=float, default=0.90)
    parser.add_argument("--min-priority-accuracy", type=float, default=0.90)
    args = parser.parse_args()

    report = evaluate_cases(load_cases(args.dataset))
    print(json.dumps(report.to_dict(), ensure_ascii=False, indent=2))
    if report.category_accuracy < args.min_category_accuracy:
        raise SystemExit(
            f"category accuracy {report.category_accuracy:.1%} "
            f"is below {args.min_category_accuracy:.1%}"
        )
    if report.priority_accuracy < args.min_priority_accuracy:
        raise SystemExit(
            f"priority accuracy {report.priority_accuracy:.1%} "
            f"is below {args.min_priority_accuracy:.1%}"
        )


if __name__ == "__main__":
    main()
