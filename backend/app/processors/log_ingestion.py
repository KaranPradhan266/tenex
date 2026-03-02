from __future__ import annotations

import json
from collections import Counter
from typing import Any

from fastapi import HTTPException
from pydantic import ValidationError

from app.config import get_settings
from app.models import (
    ChartTrafficSankeyAggregate,
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
    )
