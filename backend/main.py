from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib import error, parse, request
from uuid import UUID, uuid4

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ValidationError

load_dotenv(Path(__file__).with_name(".env"))

app = FastAPI(title="tenex-backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_EXTENSIONS = {".log", ".txt"}
MAX_SAMPLE_ERRORS = 5
MAX_SAMPLE_EVENTS = 5
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_RAW_LOGS_BUCKET = os.getenv("SUPABASE_RAW_LOGS_BUCKET", "raw-logs")


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
    job_id: UUID
    filename: str
    storage_path: str
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


def _require_supabase_settings() -> tuple[str, str, str]:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=500,
            detail="Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend environment",
        )

    return SUPABASE_URL.rstrip("/"), SUPABASE_SERVICE_ROLE_KEY, SUPABASE_RAW_LOGS_BUCKET


def _supabase_request(
    method: str,
    path: str,
    *,
    body: bytes | None = None,
    content_type: str | None = None,
    extra_headers: dict[str, str] | None = None,
) -> Any:
    base_url, service_role_key, _ = _require_supabase_settings()
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
    }
    if content_type:
        headers["Content-Type"] = content_type
    if extra_headers:
        headers.update(extra_headers)

    req = request.Request(
        url=f"{base_url}{path}",
        data=body,
        headers=headers,
        method=method,
    )

    try:
        with request.urlopen(req) as response:
            raw = response.read()
            if not raw:
                return None
            if "application/json" in response.headers.get("Content-Type", ""):
                return json.loads(raw.decode("utf-8"))
            return raw
    except error.HTTPError as exc:
        raw_error = exc.read().decode("utf-8", errors="ignore")
        detail = raw_error
        try:
            payload = json.loads(raw_error)
            detail = (
                payload.get("message")
                or payload.get("error")
                or payload.get("hint")
                or raw_error
            )
        except json.JSONDecodeError:
            pass

        raise HTTPException(
            status_code=500,
            detail=f"Supabase request failed: {detail}",
        ) from exc
    except error.URLError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to reach Supabase: {exc.reason}",
        ) from exc


def _upload_file_to_storage(storage_path: str, content: bytes, content_type: str) -> None:
    _, _, bucket = _require_supabase_settings()
    encoded_path = parse.quote(storage_path, safe="/")
    _supabase_request(
        "POST",
        f"/storage/v1/object/{bucket}/{encoded_path}",
        body=content,
        content_type=content_type,
        extra_headers={"x-upsert": "false"},
    )


def _delete_file_from_storage(storage_path: str) -> None:
    _, _, bucket = _require_supabase_settings()
    encoded_path = parse.quote(storage_path, safe="/")
    _supabase_request(
        "DELETE",
        f"/storage/v1/object/{bucket}/{encoded_path}",
    )


def _insert_ingestion_job(job_id: UUID, user_id: UUID, filename: str) -> None:
    payload = {
        "id": str(job_id),
        "user_id": str(user_id),
        "filename": filename,
        "storage_path": None,
        "status": "uploading",
        "total_lines": 0,
        "parsed_lines": 0,
        "rejected_lines": 0,
        "error_message": None,
    }
    _supabase_request(
        "POST",
        "/rest/v1/ingestion_jobs",
        body=json.dumps(payload).encode("utf-8"),
        content_type="application/json",
        extra_headers={"Prefer": "return=minimal"},
    )


def _update_ingestion_job(job_id: UUID, values: dict[str, Any]) -> None:
    encoded_job_id = parse.quote(str(job_id), safe="")
    _supabase_request(
        "PATCH",
        f"/rest/v1/ingestion_jobs?id=eq.{encoded_job_id}",
        body=json.dumps(values).encode("utf-8"),
        content_type="application/json",
        extra_headers={"Prefer": "return=minimal"},
    )


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


@app.get("/api/hello")
async def hello() -> dict[str, str]:
    return {"message": "Hello from Python backend"}


@app.post("/api/logs/upload", response_model=UploadSummary)
async def upload_logs(
    user_id: UUID = Form(...),
    file: UploadFile = File(...),
) -> UploadSummary:
    filename = _validate_filename(file.filename)
    _require_supabase_settings()

    job_id = uuid4()
    storage_path = f"{user_id}/{job_id}/{filename}"
    _insert_ingestion_job(job_id, user_id, filename)

    content = await file.read()

    try:
        _upload_file_to_storage(storage_path, content, file.content_type or "text/plain")
    except HTTPException as exc:
        _update_ingestion_job(
            job_id,
            {
                "status": "failed",
                "error_message": exc.detail,
            },
        )
        raise

    try:
        _update_ingestion_job(
            job_id,
            {
                "storage_path": storage_path,
                "status": "processing",
                "error_message": None,
            },
        )
    except HTTPException:
        _delete_file_from_storage(storage_path)
        raise

    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError as exc:
        _update_ingestion_job(
            job_id,
            {
                "status": "failed",
                "error_message": f"File must be UTF-8 encoded text: {exc.reason}",
            },
        )
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
        event, error = _parse_json_line(raw_line)

        if error:
            if len(sample_errors) < MAX_SAMPLE_ERRORS:
                sample_errors.append(LineError(line=line_number, error=error))
            continue

        parsed_lines += 1
        if event and len(sample_events) < MAX_SAMPLE_EVENTS:
            sample_events.append(event)

    try:
        _update_ingestion_job(
            job_id,
            {
                "status": "completed",
                "total_lines": total_lines,
                "parsed_lines": parsed_lines,
                "rejected_lines": total_lines - parsed_lines,
                "error_message": None,
                "completed_at": datetime.utcnow().isoformat(),
            },
        )
    except HTTPException as exc:
        _delete_file_from_storage(storage_path)
        _update_ingestion_job(
            job_id,
            {
                "status": "failed",
                "error_message": f"Failed finalizing ingestion job: {exc.detail}",
            },
        )
        raise

    return UploadSummary(
        job_id=job_id,
        filename=filename,
        storage_path=storage_path,
        total_lines=total_lines,
        parsed_lines=parsed_lines,
        rejected_lines=total_lines - parsed_lines,
        sample_errors=sample_errors,
        sample_events=sample_events,
    )
