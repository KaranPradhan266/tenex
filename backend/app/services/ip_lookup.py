from __future__ import annotations

import json
from urllib import error, parse, request

from fastapi import HTTPException

from app.models import IpLookupResponse


def lookup_ip_metadata(src_ip: str) -> IpLookupResponse:
    encoded_ip = parse.quote(src_ip, safe="")
    lookup_url = f"http://ip-api.com/json/{encoded_ip}"

    try:
        with request.urlopen(lookup_url, timeout=10) as response:
            raw_response = response.read().decode("utf-8")
    except error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        raise HTTPException(
            status_code=502,
            detail=f"IP lookup failed: {error_body or exc.reason}",
        ) from exc
    except error.URLError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"IP lookup failed: {exc.reason}",
        ) from exc

    try:
        parsed_response = json.loads(raw_response)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=502,
            detail="IP lookup returned an invalid response payload.",
        ) from exc

    if parsed_response.get("status") != "success":
        raise HTTPException(
            status_code=404,
            detail=parsed_response.get("message", "IP lookup was unsuccessful."),
        )

    return IpLookupResponse(
        country=parsed_response.get("country"),
        regionName=parsed_response.get("regionName"),
        city=parsed_response.get("city"),
        isp=parsed_response.get("isp"),
        org=parsed_response.get("org"),
    )
