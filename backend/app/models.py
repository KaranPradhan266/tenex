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


class ProcessingSectionReport(BaseModel):
    name: str
    status: str
    message: str | None = None


class UploadSummary(BaseModel):
    job_id: UUID
    filename: str
    storage_path: str
    total_lines: int
    parsed_lines: int
    rejected_lines: int
    sample_errors: list[LineError]
    sample_events: list[LogEvent]
    processing_report: list[ProcessingSectionReport]


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


class IpMinuteTrafficAggregate(BaseModel):
    src_ip: str
    bucket_ts: datetime
    traffic_count: int
    allowed_count: int
    blocked_count: int


class IpServiceSummaryAggregate(BaseModel):
    src_ip: str
    service: str
    request_count: int


class IpMethodSummaryAggregate(BaseModel):
    src_ip: str
    method: str
    request_count: int


class IpPathSummaryAggregate(BaseModel):
    src_ip: str
    path: str
    request_count: int


class IpOutcomeSummaryAggregate(BaseModel):
    src_ip: str
    outcome: str
    request_count: int


class IpStatusSummaryAggregate(BaseModel):
    src_ip: str
    status: int
    request_count: int


class IpVolumeSummaryAggregate(BaseModel):
    src_ip: str
    total_requests: int
    total_bytes_in: int
    total_bytes_out: int


class IpActionSummaryAggregate(BaseModel):
    src_ip: str
    action: str
    request_count: int


class ProcessedLogFile(BaseModel):
    total_lines: int
    parsed_lines: int
    rejected_lines: int
    sample_errors: list[LineError]
    sample_events: list[LogEvent]
    user_agent_aggregates: list[ChartUserAgentAggregate]
    sankey_aggregates: list[ChartTrafficSankeyAggregate]
    ip_minute_traffic_aggregates: list[IpMinuteTrafficAggregate]
    ip_service_aggregates: list[IpServiceSummaryAggregate]
    ip_method_aggregates: list[IpMethodSummaryAggregate]
    ip_path_aggregates: list[IpPathSummaryAggregate]
    ip_outcome_aggregates: list[IpOutcomeSummaryAggregate]
    ip_status_aggregates: list[IpStatusSummaryAggregate]
    ip_volume_aggregates: list[IpVolumeSummaryAggregate]
    ip_action_aggregates: list[IpActionSummaryAggregate]


class TimeSeriesPoint(BaseModel):
    bucket_ts: datetime
    value: float


class IpSignalsResponse(BaseModel):
    job_id: UUID
    src_ip: str
    total_events: int
    traffic_series: list[TimeSeriesPoint]
    allowed_series: list[TimeSeriesPoint]
    blocked_series: list[TimeSeriesPoint]


class IpRiskRankingEntry(BaseModel):
    src_ip: str
    predicted_label: str
    heuristic_label: str
    prediction_confidence: float
    probabilities: dict[str, float]
    total_requests: int
    total_bytes_in: int
    total_bytes_out: int
    service_count: int
    path_count: int
    outcome_count: int
    suspicious_outcome_ratio: float
    status_4xx_ratio: float
    status_5xx_ratio: float


class IpRiskRankingsResponse(BaseModel):
    job_id: UUID
    total_ips: int
    rankings: list[IpRiskRankingEntry]


class IpInsightSummaryRow(BaseModel):
    label: str
    request_count: int


class IpAiInsightRequest(BaseModel):
    src_ip: str
    job_id: UUID
    total_requests: int
    total_bytes_in: int
    total_bytes_out: int
    country: str | None = None
    regionName: str | None = None
    city: str | None = None
    isp: str | None = None
    org: str | None = None
    services: list[IpInsightSummaryRow]
    paths: list[IpInsightSummaryRow]
    outcomes: list[IpInsightSummaryRow]
    statuses: list[IpInsightSummaryRow]


class IpAiInsightResponse(BaseModel):
    insight: str
    model: str


class IpLookupResponse(BaseModel):
    country: str | None = None
    regionName: str | None = None
    city: str | None = None
    isp: str | None = None
    org: str | None = None


class IpThreatIntelResponse(BaseModel):
    blacklisted: bool
    detected_engines: list[str]


class SupabaseRequestPayload(BaseModel):
    method: str
    path: str
    body: bytes | None = None
    content_type: str | None = None
    extra_headers: dict[str, str] | None = None


SupabaseJson = dict[str, Any] | list[dict[str, Any]] | None | bytes
