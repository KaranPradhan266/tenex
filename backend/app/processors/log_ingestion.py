from __future__ import annotations

import json
from collections import Counter, defaultdict
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException
from pydantic import ValidationError

from app.config import get_settings
from app.models import (
    ChartTrafficSankeyAggregate,
    IpActionSummaryAggregate,
    IpMethodSummaryAggregate,
    IpMinuteTrafficAggregate,
    IpOutcomeSummaryAggregate,
    IpPathSummaryAggregate,
    IpServiceSummaryAggregate,
    IpStatusSummaryAggregate,
    IpVolumeSummaryAggregate,
    LineError,
    LogEvent,
    ProcessedLogFile,
)
from app.processors.user_agents import build_user_agent_aggregates


def validate_filename(filename: str | None) -> str:
    settings = get_settings()

    if not filename:
        raise HTTPException(status_code=400, detail="Uploaded file is missing a name")

    if not any(filename.endswith(ext) for ext in settings.allowed_extensions):
        raise HTTPException(
            status_code=400,
            detail="Only .log and .txt files are supported",
        )

    return filename


def _parse_json_line(raw_line: str) -> tuple[LogEvent | None, str | None]:
    try:
        payload: Any = json.loads(raw_line)
    except json.JSONDecodeError as exc:
        return None, f"Invalid JSON: {exc.msg}"

    if not isinstance(payload, dict):
        return None, "Each line must be a JSON object"

    try:
        return LogEvent.model_validate(payload), None
    except ValidationError as exc:
        return None, exc.errors()[0]["msg"]


def _status_class(status: int) -> str:
    if 100 <= status < 600:
        return f"{status // 100}xx"
    return "other"


def _floor_bucket(ts: datetime, bucket_seconds: int) -> datetime:
    unix_seconds = int(ts.timestamp())
    floored = unix_seconds - (unix_seconds % bucket_seconds)
    return datetime.fromtimestamp(floored, tz=UTC)


def process_uploaded_log(content: bytes) -> ProcessedLogFile:
    settings = get_settings()

    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"File must be UTF-8 encoded text: {exc.reason}",
        ) from exc

    total_lines = 0
    parsed_lines = 0
    sample_errors: list[LineError] = []
    sample_events: list[LogEvent] = []
    user_agents: list[str] = []
    sankey_link_counts: Counter[tuple[str, str]] = Counter()
    ip_minute_traffic_counts: dict[tuple[str, datetime], dict[str, int]] = defaultdict(
        lambda: {"traffic_count": 0, "allowed_count": 0, "blocked_count": 0}
    )
    ip_service_counts: Counter[tuple[str, str]] = Counter()
    ip_method_counts: Counter[tuple[str, str]] = Counter()
    ip_path_counts: Counter[tuple[str, str]] = Counter()
    ip_outcome_counts: Counter[tuple[str, str]] = Counter()
    ip_status_counts: Counter[tuple[str, int]] = Counter()
    ip_action_counts: Counter[tuple[str, str]] = Counter()
    ip_volume_counts: dict[str, dict[str, int]] = defaultdict(
        lambda: {
            "total_requests": 0,
            "total_bytes_in": 0,
            "total_bytes_out": 0,
        }
    )

    for line_number, raw_line in enumerate(text.splitlines(), start=1):
        if not raw_line.strip():
            continue

        total_lines += 1
        event, error = _parse_json_line(raw_line)

        if error:
            if len(sample_errors) < settings.max_sample_errors:
                sample_errors.append(LineError(line=line_number, error=error))
            continue

        assert event is not None
        parsed_lines += 1

        if len(sample_events) < settings.max_sample_events:
            sample_events.append(event)

        # Future chart hooks: one parse pass updates multiple aggregate streams.
        user_agents.append(event.user_agent)

        status_class = _status_class(event.status)
        sankey_link_counts[(event.method, event.service)] += 1
        sankey_link_counts[(event.service, status_class)] += 1
        sankey_link_counts[(status_class, event.outcome)] += 1
        sankey_link_counts[(event.outcome, event.action)] += 1

        bucket_ts = _floor_bucket(event.ts, 60)
        minute_counts = ip_minute_traffic_counts[(event.src_ip, bucket_ts)]
        minute_counts["traffic_count"] += 1
        if event.action == "allowed":
            minute_counts["allowed_count"] += 1
        if event.action == "blocked":
            minute_counts["blocked_count"] += 1

        ip_service_counts[(event.src_ip, event.service)] += 1
        ip_method_counts[(event.src_ip, event.method)] += 1
        ip_path_counts[(event.src_ip, event.path)] += 1
        ip_outcome_counts[(event.src_ip, event.outcome)] += 1
        ip_status_counts[(event.src_ip, event.status)] += 1
        ip_action_counts[(event.src_ip, event.action)] += 1

        ip_volume = ip_volume_counts[event.src_ip]
        ip_volume["total_requests"] += 1
        ip_volume["total_bytes_in"] += event.bytes_in or 0
        ip_volume["total_bytes_out"] += event.bytes_out or 0

    return ProcessedLogFile(
        total_lines=total_lines,
        parsed_lines=parsed_lines,
        rejected_lines=total_lines - parsed_lines,
        sample_errors=sample_errors,
        sample_events=sample_events,
        user_agent_aggregates=build_user_agent_aggregates(user_agents),
        sankey_aggregates=[
            ChartTrafficSankeyAggregate(source=source, target=target, value=value)
            for (source, target), value in sorted(sankey_link_counts.items())
        ],
        ip_minute_traffic_aggregates=[
            IpMinuteTrafficAggregate(
                src_ip=src_ip,
                bucket_ts=bucket_ts,
                traffic_count=counts["traffic_count"],
                allowed_count=counts["allowed_count"],
                blocked_count=counts["blocked_count"],
            )
            for (src_ip, bucket_ts), counts in sorted(ip_minute_traffic_counts.items())
        ],
        ip_service_aggregates=[
            IpServiceSummaryAggregate(
                src_ip=src_ip,
                service=service,
                request_count=request_count,
            )
            for (src_ip, service), request_count in sorted(ip_service_counts.items())
        ],
        ip_method_aggregates=[
            IpMethodSummaryAggregate(
                src_ip=src_ip,
                method=method,
                request_count=request_count,
            )
            for (src_ip, method), request_count in sorted(ip_method_counts.items())
        ],
        ip_path_aggregates=[
            IpPathSummaryAggregate(
                src_ip=src_ip,
                path=path,
                request_count=request_count,
            )
            for (src_ip, path), request_count in sorted(ip_path_counts.items())
        ],
        ip_outcome_aggregates=[
            IpOutcomeSummaryAggregate(
                src_ip=src_ip,
                outcome=outcome,
                request_count=request_count,
            )
            for (src_ip, outcome), request_count in sorted(ip_outcome_counts.items())
        ],
        ip_status_aggregates=[
            IpStatusSummaryAggregate(
                src_ip=src_ip,
                status=status,
                request_count=request_count,
            )
            for (src_ip, status), request_count in sorted(ip_status_counts.items())
        ],
        ip_volume_aggregates=[
            IpVolumeSummaryAggregate(
                src_ip=src_ip,
                total_requests=counts["total_requests"],
                total_bytes_in=counts["total_bytes_in"],
                total_bytes_out=counts["total_bytes_out"],
            )
            for src_ip, counts in sorted(ip_volume_counts.items())
        ],
        ip_action_aggregates=[
            IpActionSummaryAggregate(
                src_ip=src_ip,
                action=action,
                request_count=request_count,
            )
            for (src_ip, action), request_count in sorted(ip_action_counts.items())
        ],
    )
