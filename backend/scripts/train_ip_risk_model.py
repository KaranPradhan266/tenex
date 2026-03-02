from __future__ import annotations

import argparse
from collections import Counter
from pathlib import Path
import sys
from uuid import UUID

import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.ml.ip_risk import build_ip_risk_features, feature_matrix, feature_names
from app.services.supabase import SupabaseService


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train a baseline suspicious-IP classifier from summary tables."
    )
    parser.add_argument("--user-id", required=True, help="Supabase auth user id")
    parser.add_argument(
        "--job-id",
        help="Specific ingestion job id to train from. Defaults to the latest completed job for the user.",
    )
    parser.add_argument(
        "--output",
        default="models/ip_risk_model.joblib",
        help="Path to write the trained model artifact.",
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
    supabase = SupabaseService.from_settings()
    job_id = resolve_job_id(supabase, user_id, args.job_id)

    volume_rows = supabase.fetch_table_rows_for_job(
        "ip_volume_summary",
        job_id,
        columns="src_ip,total_requests,total_bytes_in,total_bytes_out",
    )
    service_rows = supabase.fetch_table_rows_for_job(
        "ip_service_summary",
        job_id,
        columns="src_ip,service,request_count",
    )
    path_rows = supabase.fetch_table_rows_for_job(
        "ip_path_summary",
        job_id,
        columns="src_ip,path,request_count",
    )
    outcome_rows = supabase.fetch_table_rows_for_job(
        "ip_outcome_summary",
        job_id,
        columns="src_ip,outcome,request_count",
    )
    status_rows = supabase.fetch_table_rows_for_job(
        "ip_status_summary",
        job_id,
        columns="src_ip,status,request_count",
    )

    feature_rows = build_ip_risk_features(
        volume_rows=volume_rows,
        service_rows=service_rows,
        path_rows=path_rows,
        outcome_rows=outcome_rows,
        status_rows=status_rows,
    )

    if len(feature_rows) < 4:
        raise SystemExit(
            "Need at least 4 IP feature rows to train a baseline model. Upload a log with more unique source IPs first."
        )

    X, y = feature_matrix(feature_rows)
    model = RandomForestClassifier(
        n_estimators=200,
        random_state=42,
        class_weight="balanced",
    )

    artifact = {
        "job_id": str(job_id),
        "feature_names": feature_names(),
        "labels": y,
    }

    if len(feature_rows) >= 8 and len(set(y)) > 1:
        X_train, X_test, y_train, y_test = train_test_split(
            X,
            y,
            test_size=0.25,
            random_state=42,
            stratify=y if len(set(y)) > 1 else None,
        )
        model.fit(X_train, y_train)
        predictions = model.predict(X_test)
        artifact["classification_report"] = classification_report(
            y_test,
            predictions,
            zero_division=0,
            output_dict=True,
        )
    else:
        model.fit(X, y)
        artifact["classification_report"] = None

    artifact["model"] = model
    artifact["training_rows"] = len(feature_rows)
    artifact["src_ips"] = [row.src_ip for row in feature_rows]
    artifact["label_distribution"] = dict(Counter(y))
    artifact["feature_importances"] = dict(
        sorted(
            zip(feature_names(), model.feature_importances_, strict=True),
            key=lambda item: item[1],
            reverse=True,
        )
    )
    artifact["feature_rows"] = [
        {
            "src_ip": row.src_ip,
            "label": row.label,
            **{
                feature_name: getattr(row, feature_name)
                for feature_name in feature_names()
            },
        }
        for row in feature_rows
    ]

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, output_path)

    print(f"Trained baseline IP risk model for job {job_id}")
    print(f"Training rows: {len(feature_rows)}")
    print(f"Output: {output_path}")
    print(f"Label distribution: {artifact['label_distribution']}")
    print("Top feature importances:")
    for feature_name, importance in list(artifact["feature_importances"].items())[:5]:
        print(f"  - {feature_name}: {importance:.4f}")
    if artifact["classification_report"] is None:
        print("Classification report skipped due to small dataset.")


if __name__ == "__main__":
    main()
