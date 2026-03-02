from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Literal

RiskLabel = Literal["low", "medium", "high", "critical"]

SUSPICIOUS_OUTCOME_KEYWORDS = (
    "failed",
    "denied",
    "blocked",
    "waf",
    "limit",
    "invalid",
    "expired",
    "missing",
    "conflict",
    "error",
    "unavailable",
)


@dataclass
class IpRiskFeatures:
    src_ip: str
    total_requests: int
    total_bytes_in: int
    total_bytes_out: int
    avg_bytes_in_per_request: float
    avg_bytes_out_per_request: float
    service_count: int
    top_service_ratio: float
    path_count: int
    top_path_ratio: float
    outcome_count: int
    top_outcome_ratio: float
    suspicious_outcome_ratio: float
    distinct_status_count: int
    status_2xx_ratio: float
    status_3xx_ratio: float
    status_4xx_ratio: float
    status_5xx_ratio: float
    label: RiskLabel


def _safe_ratio(numerator: int | float, denominator: int | float) -> float:
    if denominator == 0:
        return 0.0
    return float(numerator) / float(denominator)


def _status_ratio(status_counts: dict[int, int], hundred: int, total_requests: int) -> float:
    matching = sum(
        count for status, count in status_counts.items() if status // 100 == hundred
    )
    return _safe_ratio(matching, total_requests)


def assign_risk_label(feature_row: dict[str, int | float | str]) -> RiskLabel:
    score = 0

    total_requests = int(feature_row["total_requests"])
    total_bytes_out = int(feature_row["total_bytes_out"])
    service_count = int(feature_row["service_count"])
    path_count = int(feature_row["path_count"])
    suspicious_outcome_ratio = float(feature_row["suspicious_outcome_ratio"])
    status_4xx_ratio = float(feature_row["status_4xx_ratio"])
    status_5xx_ratio = float(feature_row["status_5xx_ratio"])
    top_path_ratio = float(feature_row["top_path_ratio"])

    if total_requests >= 40:
        score += 2
    elif total_requests >= 20:
        score += 1

    if total_bytes_out >= 50_000:
        score += 1

    if service_count >= 4:
        score += 1

    if path_count >= 8:
        score += 1

    if top_path_ratio >= 0.7:
        score += 1

    if status_4xx_ratio >= 0.35:
        score += 2
    elif status_4xx_ratio >= 0.2:
        score += 1

    if status_5xx_ratio >= 0.15:
        score += 2
    elif status_5xx_ratio >= 0.05:
        score += 1

    if suspicious_outcome_ratio >= 0.3:
        score += 3
    elif suspicious_outcome_ratio >= 0.15:
        score += 2
    elif suspicious_outcome_ratio > 0:
        score += 1

    if score >= 8:
        return "critical"
    if score >= 5:
        return "high"
    if score >= 3:
        return "medium"
    return "low"


def build_ip_risk_features(
    volume_rows: list[dict],
    service_rows: list[dict],
    path_rows: list[dict],
    outcome_rows: list[dict],
    status_rows: list[dict],
) -> list[IpRiskFeatures]:
    service_by_ip: dict[str, list[dict]] = {}
    path_by_ip: dict[str, list[dict]] = {}
    outcome_by_ip: dict[str, list[dict]] = {}
    status_by_ip: dict[str, list[dict]] = {}

    for row in service_rows:
        service_by_ip.setdefault(str(row["src_ip"]), []).append(row)
    for row in path_rows:
        path_by_ip.setdefault(str(row["src_ip"]), []).append(row)
    for row in outcome_rows:
        outcome_by_ip.setdefault(str(row["src_ip"]), []).append(row)
    for row in status_rows:
        status_by_ip.setdefault(str(row["src_ip"]), []).append(row)

    features: list[IpRiskFeatures] = []

    for volume_row in volume_rows:
        src_ip = str(volume_row["src_ip"])
        total_requests = int(volume_row.get("total_requests", 0) or 0)
        total_bytes_in = int(volume_row.get("total_bytes_in", 0) or 0)
        total_bytes_out = int(volume_row.get("total_bytes_out", 0) or 0)

        service_counts = [int(row["request_count"]) for row in service_by_ip.get(src_ip, [])]
        path_counts = [int(row["request_count"]) for row in path_by_ip.get(src_ip, [])]
        outcome_rows_for_ip = outcome_by_ip.get(src_ip, [])
        outcome_counts = [int(row["request_count"]) for row in outcome_rows_for_ip]
        status_rows_for_ip = status_by_ip.get(src_ip, [])
        status_count_map = {
            int(row["status"]): int(row["request_count"]) for row in status_rows_for_ip
        }

        suspicious_outcome_hits = sum(
            int(row["request_count"])
            for row in outcome_rows_for_ip
            if any(
                keyword in str(row["outcome"]).lower()
                for keyword in SUSPICIOUS_OUTCOME_KEYWORDS
            )
        )

        feature_row = {
            "src_ip": src_ip,
            "total_requests": total_requests,
            "total_bytes_in": total_bytes_in,
            "total_bytes_out": total_bytes_out,
            "avg_bytes_in_per_request": _safe_ratio(total_bytes_in, total_requests),
            "avg_bytes_out_per_request": _safe_ratio(total_bytes_out, total_requests),
            "service_count": len(service_counts),
            "top_service_ratio": _safe_ratio(max(service_counts, default=0), total_requests),
            "path_count": len(path_counts),
            "top_path_ratio": _safe_ratio(max(path_counts, default=0), total_requests),
            "outcome_count": len(outcome_counts),
            "top_outcome_ratio": _safe_ratio(max(outcome_counts, default=0), total_requests),
            "suspicious_outcome_ratio": _safe_ratio(
                suspicious_outcome_hits, total_requests
            ),
            "distinct_status_count": len(status_count_map),
            "status_2xx_ratio": _status_ratio(status_count_map, 2, total_requests),
            "status_3xx_ratio": _status_ratio(status_count_map, 3, total_requests),
            "status_4xx_ratio": _status_ratio(status_count_map, 4, total_requests),
            "status_5xx_ratio": _status_ratio(status_count_map, 5, total_requests),
        }

        features.append(
            IpRiskFeatures(
                **feature_row,
                label=assign_risk_label(feature_row),
            )
        )

    return features


def feature_names() -> list[str]:
    return [
        "total_requests",
        "total_bytes_in",
        "total_bytes_out",
        "avg_bytes_in_per_request",
        "avg_bytes_out_per_request",
        "service_count",
        "top_service_ratio",
        "path_count",
        "top_path_ratio",
        "outcome_count",
        "top_outcome_ratio",
        "suspicious_outcome_ratio",
        "distinct_status_count",
        "status_2xx_ratio",
        "status_3xx_ratio",
        "status_4xx_ratio",
        "status_5xx_ratio",
    ]


def feature_matrix(rows: list[IpRiskFeatures]) -> tuple[list[list[float]], list[str]]:
    names = feature_names()
    matrix = [
        [float(asdict(row)[name]) for name in names]
        for row in rows
    ]
    labels = [row.label for row in rows]
    return matrix, labels
