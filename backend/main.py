from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel, ValidationError


app = FastAPI(title="tenex-backend")

ALLOWED_EXTENSIONS = {".log", ".txt"}
MAX_SAMPLE_ERRORS = 5
MAX_SAMPLE_EVENTS = 5


class LogEvent(BaseModel):
    ts: datetime
    src_ip: str
    service: str
    method: str
    path: str
    status: int
    user_agent: str
    action: str
    outcome: str
    dest_ip: str | None = None
    request_id: str | None = None
    duration_ms: int | None = None
    bytes_in: int | None = None
    bytes_out: int | None = None


class LineError(BaseModel):
    line: int
    error: str


class UploadSummary(BaseModel):
    filename: str
    total_lines: int
    parsed_lines: int
    rejected_lines: int
    sample_errors: list[LineError]
    sample_events: list[LogEvent]


def _validate_filename(filename: str | None) -> str:
    if not filename:
        raise HTTPException(status_code=400, detail="Uploaded file is missing a name")

    if not any(filename.endswith(ext) for ext in ALLOWED_EXTENSIONS):
        raise HTTPException(
            status_code=400,
            detail="Only .log and .txt files are supported",
        )

    return filename


def _parse_json_line(raw_line: str, line_number: int) -> tuple[LogEvent | None, str | None]:
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


@app.get("/api/hello")
async def hello() -> dict[str, str]:
    return {"message": "Hello from Python backend"}


@app.post("/api/logs/upload", response_model=UploadSummary)
async def upload_logs(file: UploadFile = File(...)) -> UploadSummary:
    filename = _validate_filename(file.filename)

    content = await file.read()
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

    for line_number, raw_line in enumerate(text.splitlines(), start=1):
        if not raw_line.strip():
            continue

        total_lines += 1
        event, error = _parse_json_line(raw_line, line_number)

        if error:
            if len(sample_errors) < MAX_SAMPLE_ERRORS:
                sample_errors.append(LineError(line=line_number, error=error))
            continue

        parsed_lines += 1
        if event and len(sample_events) < MAX_SAMPLE_EVENTS:
            sample_events.append(event)

    return UploadSummary(
        filename=filename,
        total_lines=total_lines,
        parsed_lines=parsed_lines,
        rejected_lines=total_lines - parsed_lines,
        sample_errors=sample_errors,
        sample_events=sample_events,
    )
