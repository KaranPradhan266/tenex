from __future__ import annotations

from pathlib import Path
from uuid import UUID

import joblib
from fastapi import HTTPException

from app.ml.ip_risk import build_ip_risk_features, feature_matrix
from app.models import IpRiskRankingEntry
from app.services.supabase import SupabaseService

DEFAULT_MODEL_PATH = Path(__file__).resolve().parents[2] / "models" / "ip_risk_model.joblib"
SEVERITY_ORDER = {
    "critical": 3,
    "high": 2,
    "medium": 1,
    "low": 0,
}


def load_ip_risk_feature_rows(
    supabase: SupabaseService,
    job_id: UUID,
) -> list:
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

    return build_ip_risk_features(
        volume_rows=volume_rows,
        service_rows=service_rows,
        path_rows=path_rows,
        outcome_rows=outcome_rows,
        status_rows=status_rows,
    )


def score_ip_risk_rankings(
    supabase: SupabaseService,
    job_id: UUID,
    *,
    model_path: Path | None = None,
) -> list[IpRiskRankingEntry]:
    resolved_model_path = model_path or DEFAULT_MODEL_PATH
    if not resolved_model_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Model artifact not found: {resolved_model_path}",
        )

    feature_rows = load_ip_risk_feature_rows(supabase, job_id)
    if not feature_rows:
        return []

    artifact = joblib.load(resolved_model_path)
    model = artifact.get("model")
    if model is None:
        raise HTTPException(status_code=500, detail="Model artifact is missing the trained model")

    matrix, _ = feature_matrix(feature_rows)
    predictions = model.predict(matrix)
    probabilities = model.predict_proba(matrix) if hasattr(model, "predict_proba") else None
    classes = list(model.classes_) if hasattr(model, "classes_") else []

    rankings: list[IpRiskRankingEntry] = []
    for index, row in enumerate(feature_rows):
        probability_map = (
            {
                str(classes[class_index]): float(probabilities[index][class_index])
                for class_index in range(len(classes))
            }
            if probabilities is not None and classes
            else {}
        )
        predicted_label = str(predictions[index])
        rankings.append(
            IpRiskRankingEntry(
                src_ip=row.src_ip,
                predicted_label=predicted_label,
                heuristic_label=row.label,
                prediction_confidence=probability_map.get(predicted_label, 0.0),
                probabilities=probability_map,
                total_requests=row.total_requests,
                total_bytes_in=row.total_bytes_in,
                total_bytes_out=row.total_bytes_out,
                service_count=row.service_count,
                path_count=row.path_count,
                outcome_count=row.outcome_count,
                suspicious_outcome_ratio=row.suspicious_outcome_ratio,
                status_4xx_ratio=row.status_4xx_ratio,
                status_5xx_ratio=row.status_5xx_ratio,
            )
        )

    rankings.sort(
        key=lambda row: (
            SEVERITY_ORDER.get(row.predicted_label, -1),
            row.prediction_confidence,
            row.total_requests,
            row.suspicious_outcome_ratio,
        ),
        reverse=True,
    )
    return rankings
