from __future__ import annotations

import json
from collections import Counter
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from pydantic import ValidationError

from app.models import IpSignalsResponse, LogEvent, TimeSeriesPoint


def _decode_uploaded_text(content: bytes) -> str:
    try:
        return content.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"File must be UTF-8 encoded text: {exc.reason}",
        ) from exc


def _floor_bucket(ts: datetime, bucket_seconds: int) -> datetime:
    unix_seconds = int(ts.timestamp())
    floored = unix_seconds - (unix_seconds % bucket_seconds)
    return datetime.fromtimestamp(floored, tz=UTC)


def _parse_events_for_ip(content: bytes, src_ip: str) -> list[LogEvent]:
    text = _decode_uploaded_text(content)
    events: list[LogEvent] = []

    for raw_line in text.splitlines():
        if not raw_line.strip():
            continue

        try:
            payload: Any = json.loads(raw_line)
            if not isinstance(payload, dict):
                continue
            event = LogEvent.model_validate(payload)
        except (json.JSONDecodeError, ValidationError):
            continue

        if event.src_ip == src_ip:
            events.append(event)

    events.sort(key=lambda event: event.ts)
    return events


def _build_traffic_series(events: list[LogEvent]) -> list[TimeSeriesPoint]:
    counts: Counter[datetime] = Counter()

    for event in events:
        counts[_floor_bucket(event.ts, 60)] += 1

    return [
        TimeSeriesPoint(bucket_ts=bucket_ts, value=float(count))
        for bucket_ts, count in sorted(counts.items())
    ]


def _build_action_series(
    events: list[LogEvent],
    *,
    action: str,
) -> list[TimeSeriesPoint]:
    counts: Counter[datetime] = Counter()

    for event in events:
        if event.action != action:
            continue
        counts[_floor_bucket(event.ts, 60)] += 1

    return [
        TimeSeriesPoint(bucket_ts=bucket_ts, value=float(count))
        for bucket_ts, count in sorted(counts.items())
    ]


def compute_ip_signals(content: bytes, src_ip: str, job_id: UUID) -> IpSignalsResponse:
    events = _parse_events_for_ip(content, src_ip)

    return IpSignalsResponse(
        job_id=job_id,
        src_ip=src_ip,
        total_events=len(events),
        traffic_series=_build_traffic_series(events),
        allowed_series=_build_action_series(events, action="allowed"),
        blocked_series=_build_action_series(events, action="blocked"),
    )
