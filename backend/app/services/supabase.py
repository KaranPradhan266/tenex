from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from urllib import error, parse, request
from uuid import UUID

from fastapi import HTTPException

from app.config import get_settings
from app.models import (
    ChartTrafficSankeyAggregate,
    ChartUserAgentAggregate,
    SupabaseJson,
)


@dataclass
class SupabaseService:
    base_url: str
    service_role_key: str
    raw_logs_bucket: str

    @classmethod
    def from_settings(cls) -> "SupabaseService":
        settings = get_settings()
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise HTTPException(
                status_code=500,
                detail="Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend environment",
            )

        return cls(
            base_url=settings.supabase_url.rstrip("/"),
            service_role_key=settings.supabase_service_role_key,
            raw_logs_bucket=settings.supabase_raw_logs_bucket,
        )

    def request(
        self,
        method: str,
        path: str,
        *,
        body: bytes | None = None,
        content_type: str | None = None,
        extra_headers: dict[str, str] | None = None,
    ) -> SupabaseJson:
        headers = {
            "apikey": self.service_role_key,
            "Authorization": f"Bearer {self.service_role_key}",
        }
        if content_type:
            headers["Content-Type"] = content_type
        if extra_headers:
            headers.update(extra_headers)

        req = request.Request(
            url=f"{self.base_url}{path}",
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

    def upload_file(self, storage_path: str, content: bytes, content_type: str) -> None:
        encoded_path = parse.quote(storage_path, safe="/")
        self.request(
            "POST",
            f"/storage/v1/object/{self.raw_logs_bucket}/{encoded_path}",
            body=content,
            content_type=content_type,
            extra_headers={"x-upsert": "false"},
        )

    def delete_file(self, storage_path: str) -> None:
        encoded_path = parse.quote(storage_path, safe="/")
        self.request(
            "DELETE",
            f"/storage/v1/object/{self.raw_logs_bucket}/{encoded_path}",
        )

    def insert_ingestion_job(self, job_id: UUID, user_id: UUID, filename: str) -> None:
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
        self.request(
            "POST",
            "/rest/v1/ingestion_jobs",
            body=json.dumps(payload).encode("utf-8"),
            content_type="application/json",
            extra_headers={"Prefer": "return=minimal"},
        )

    def update_ingestion_job(self, job_id: UUID, values: dict[str, Any]) -> None:
        encoded_job_id = parse.quote(str(job_id), safe="")
        self.request(
            "PATCH",
            f"/rest/v1/ingestion_jobs?id=eq.{encoded_job_id}",
            body=json.dumps(values).encode("utf-8"),
            content_type="application/json",
            extra_headers={"Prefer": "return=minimal"},
        )

    def delete_chart_rows(self, table_name: str, job_id: UUID) -> None:
        encoded_job_id = parse.quote(str(job_id), safe="")
        self.request(
            "DELETE",
            f"/rest/v1/{table_name}?job_id=eq.{encoded_job_id}",
            extra_headers={"Prefer": "return=minimal"},
        )

    def delete_other_chart_rows_for_user(
        self,
        table_name: str,
        user_id: UUID,
        keep_job_id: UUID,
    ) -> None:
        encoded_user_id = parse.quote(str(user_id), safe="")
        encoded_job_id = parse.quote(str(keep_job_id), safe="")
        self.request(
            "DELETE",
            f"/rest/v1/{table_name}?user_id=eq.{encoded_user_id}&job_id=neq.{encoded_job_id}",
            extra_headers={"Prefer": "return=minimal"},
        )

    def insert_chart_user_agents(
        self,
        job_id: UUID,
        user_id: UUID,
        rows: list[ChartUserAgentAggregate],
    ) -> None:
        if not rows:
            return

        payload = [
            {
                "job_id": str(job_id),
                "user_id": str(user_id),
                "group_name": row.group_name,
                "category_name": row.category_name,
                "tier_name": row.tier_name,
                "leaf_name": row.leaf_name,
                "event_count": row.event_count,
            }
            for row in rows
        ]
        self.request(
            "POST",
            "/rest/v1/chart_user_agents",
            body=json.dumps(payload).encode("utf-8"),
            content_type="application/json",
            extra_headers={"Prefer": "return=minimal"},
        )

    def insert_chart_traffic_sankey(
        self,
        job_id: UUID,
        user_id: UUID,
        rows: list[ChartTrafficSankeyAggregate],
    ) -> None:
        if not rows:
            return

        payload = [
            {
                "job_id": str(job_id),
                "user_id": str(user_id),
                "source": row.source,
                "target": row.target,
                "value": row.value,
            }
            for row in rows
        ]
        self.request(
            "POST",
            "/rest/v1/chart_traffic_sankey",
            body=json.dumps(payload).encode("utf-8"),
            content_type="application/json",
            extra_headers={"Prefer": "return=minimal"},
        )
