from __future__ import annotations

import argparse
from pathlib import Path
import sys
from uuid import UUID

import joblib

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.ml.ip_risk import feature_matrix
from app.ml.scoring import load_ip_risk_feature_rows
from app.services.supabase import SupabaseService


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Score suspicious-IP severity from summary tables using a saved model artifact."
    )
    parser.add_argument("--user-id", required=True, help="Supabase auth user id")
    parser.add_argument(
        "--job-id",
        help="Specific ingestion job id to score. Defaults to the latest completed job for the user.",
    )
    parser.add_argument(
        "--model",
        default="models/ip_risk_model.joblib",
        help="Path to a saved model artifact created by train_ip_risk_model.py.",
    )
    return parser.parse_args()


def resolve_job_id(supabase: SupabaseService, user_id: UUID, job_id: str | None) -> UUID:
    if job_id:
        return UUID(job_id)

    latest_job = supabase.get_latest_completed_ingestion_job(user_id)
    if not latest_job:
        raise SystemExit("No completed ingestion jobs found for that user.")

    return UUID(str(latest_job["id"]))

def main() -> None:
    args = parse_args()
    user_id = UUID(args.user_id)
    model_path = Path(args.model)
    if not model_path.exists():
        raise SystemExit(f"Model artifact not found: {model_path}")

    supabase = SupabaseService.from_settings()
    job_id = resolve_job_id(supabase, user_id, args.job_id)
    feature_rows = load_ip_risk_feature_rows(supabase, job_id)
    if not feature_rows:
        raise SystemExit("No IP summary rows found for that job.")

    artifact = joblib.load(model_path)
    model = artifact["model"]
    X, _ = feature_matrix(feature_rows)

    predictions = model.predict(X)
    probabilities = model.predict_proba(X) if hasattr(model, "predict_proba") else None
    classes = list(model.classes_) if hasattr(model, "classes_") else []

    print(f"Scoring job {job_id} with model {model_path}")
    for index, row in enumerate(feature_rows):
        output = [f"{row.src_ip}: predicted={predictions[index]}"]
        if probabilities is not None and classes:
            class_probs = {
                classes[class_index]: float(probabilities[index][class_index])
                for class_index in range(len(classes))
            }
            sorted_probs = sorted(
                class_probs.items(),
                key=lambda item: item[1],
                reverse=True,
            )
            probs_text = ", ".join(
                f"{label}={probability:.3f}" for label, probability in sorted_probs
            )
            output.append(f"probabilities[{probs_text}]")
        output.append(f"heuristic_label={row.label}")
        output.append(f"requests={row.total_requests}")
        output.append(f"suspicious_outcome_ratio={row.suspicious_outcome_ratio:.3f}")
        output.append(f"status_4xx_ratio={row.status_4xx_ratio:.3f}")
        output.append(f"status_5xx_ratio={row.status_5xx_ratio:.3f}")
        print(" | ".join(output))


if __name__ == "__main__":
    main()
