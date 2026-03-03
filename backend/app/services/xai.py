from __future__ import annotations

import json
import subprocess

from fastapi import HTTPException

from app.config import get_settings
from app.models import IpAiInsightRequest


class XAIService:
    def __init__(self, *, api_key: str, model: str) -> None:
        self.api_key = api_key
        self.model = model

    @classmethod
    def from_settings(cls) -> "XAIService":
        settings = get_settings()
        if not settings.xai_api_key:
            raise HTTPException(status_code=503, detail="XAI_API_KEY is not configured.")

        return cls(api_key=settings.xai_api_key, model=settings.xai_model)

    def generate_ip_insight(self, payload: IpAiInsightRequest) -> str:
        body = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are assisting a SOC analyst. Use only the provided structured facts. "
                        "Do not invent context, actors, or mitigations. "
                        "Write 4 to 6 concise bullet points covering behavior, likely risk, and what stands out."
                    ),
                },
                {
                    "role": "user",
                    "content": self._build_prompt(payload),
                },
            ],
            "stream": False,
            "temperature": 0,
        }
        try:
            completed = subprocess.run(
                [
                    "curl",
                    "--silent",
                    "--show-error",
                    "--fail",
                    "https://api.x.ai/v1/chat/completions",
                    "-H",
                    f"Authorization: Bearer {self.api_key}",
                    "-H",
                    "Content-Type: application/json",
                    "-d",
                    "@-",
                ],
                input=json.dumps(body),
                text=True,
                capture_output=True,
                timeout=30,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            raise HTTPException(
                status_code=502,
                detail=f"xAI request timed out for model {self.model}.",
            ) from exc

        if completed.returncode != 0:
            raise HTTPException(
                status_code=502,
                detail=(
                    f"xAI request failed for model {self.model}: "
                    f"{completed.stderr.strip() or completed.stdout.strip() or 'curl returned a non-zero exit code.'}"
                ),
            )

        try:
            parsed_response = json.loads(completed.stdout)
            content = parsed_response["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
            raise HTTPException(
                status_code=502,
                detail="xAI returned an invalid response payload.",
            ) from exc

        if not isinstance(content, str) or not content.strip():
            raise HTTPException(status_code=502, detail="xAI returned an empty insight.")

        return content.strip()

    def _build_prompt(self, payload: IpAiInsightRequest) -> str:
        summary = {
            "source_ip": payload.src_ip,
            "job_id": str(payload.job_id),
            "ip_enrichment": {
                "country": payload.country,
                "regionName": payload.regionName,
                "city": payload.city,
                "isp": payload.isp,
                "org": payload.org,
            },
            "totals": {
                "requests": payload.total_requests,
                "bytes_in": payload.total_bytes_in,
                "bytes_out": payload.total_bytes_out,
            },
            "top_services": [row.model_dump() for row in payload.services],
            "top_paths": [row.model_dump() for row in payload.paths],
            "top_outcomes": [row.model_dump() for row in payload.outcomes],
            "status_codes": [row.model_dump() for row in payload.statuses],
        }

        return (
            "Analyze this source IP using only the provided summary facts. "
            "Focus on notable access patterns, error behavior, volume, and suspicious indicators.\n\n"
            f"{json.dumps(summary, indent=2)}"
        )
