from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


@dataclass(frozen=True)
class Settings:
    supabase_url: str | None
    supabase_service_role_key: str | None
    supabase_raw_logs_bucket: str
    allowed_extensions: tuple[str, ...]
    max_sample_errors: int
    max_sample_events: int


def get_settings() -> Settings:
    return Settings(
        supabase_url=os.getenv("SUPABASE_URL"),
        supabase_service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY"),
        supabase_raw_logs_bucket=os.getenv("SUPABASE_RAW_LOGS_BUCKET", "raw-logs"),
        allowed_extensions=(".log", ".txt"),
        max_sample_errors=5,
        max_sample_events=5,
    )
