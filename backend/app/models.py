from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel


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


class ChartUserAgentAggregate(BaseModel):
    group_name: str
    category_name: str
    tier_name: str
    leaf_name: str
    event_count: int


class ChartTrafficSankeyAggregate(BaseModel):
    source: str
    target: str
    value: int


class ProcessedLogFile(BaseModel):
    total_lines: int
    parsed_lines: int
    rejected_lines: int
    sample_errors: list[LineError]
    sample_events: list[LogEvent]
    user_agent_aggregates: list[ChartUserAgentAggregate]
    sankey_aggregates: list[ChartTrafficSankeyAggregate]


class SupabaseRequestPayload(BaseModel):
    method: str
    path: str
    body: bytes | None = None
    content_type: str | None = None
    extra_headers: dict[str, str] | None = None


SupabaseJson = dict[str, Any] | list[dict[str, Any]] | None | bytes
