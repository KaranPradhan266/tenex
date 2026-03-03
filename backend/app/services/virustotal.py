from __future__ import annotations

import json
from urllib import error, parse, request

from fastapi import HTTPException

from app.config import get_settings
from app.models import IpThreatIntelResponse


def lookup_ip_threat_intel(src_ip: str) -> IpThreatIntelResponse:
    settings = get_settings()
    if not settings.virustotal_api_key:
        raise HTTPException(
            status_code=503,
            detail="VirusTotal API key is not configured.",
        )

    encoded_ip = parse.quote(src_ip, safe="")
    lookup_url = f"https://www.virustotal.com/api/v3/ip_addresses/{encoded_ip}"
    req = request.Request(
        lookup_url,
        headers={
            "x-apikey": settings.virustotal_api_key,
            "accept": "application/json",
        },
        method="GET",
    )

    try:
        with request.urlopen(req, timeout=15) as response:
            raw_response = response.read().decode("utf-8")
    except error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        raise HTTPException(
            status_code=502,
            detail=f"VirusTotal lookup failed: {error_body or exc.reason}",
        ) from exc
    except error.URLError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"VirusTotal lookup failed: {exc.reason}",
        ) from exc

    try:
        parsed_response = json.loads(raw_response)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=502,
            detail="VirusTotal lookup returned an invalid response payload.",
        ) from exc

    analysis_results = (
        parsed_response.get("data", {})
        .get("attributes", {})
        .get("last_analysis_results", {})
    )

    detected_engines = sorted(
        engine_name
        for engine_name, result in analysis_results.items()
        if isinstance(result, dict)
        and str(result.get("category", "")).lower() in {"malicious", "suspicious"}
    )

    return IpThreatIntelResponse(
        blacklisted=len(detected_engines) > 0,
        detected_engines=detected_engines,
    )
