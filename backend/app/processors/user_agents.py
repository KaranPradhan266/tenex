from __future__ import annotations

from collections import Counter

from app.models import ChartUserAgentAggregate

TierName = str
UserAgentPath = tuple[str, str, TierName, str]


def _normalize_user_agent(user_agent: str) -> str:
    return " ".join(user_agent.strip().lower().split())


def classify_user_agent(user_agent: str) -> UserAgentPath:
    normalized = _normalize_user_agent(user_agent)

    if not normalized:
        return ("Automated", "Suspicious", "1☆", "Empty Header")

    suspicious_rules = [
        ("sqlmap", "Legacy Signatures"),
        ("headlesschrome", "Headless Chrome"),
    ]
    for token, leaf_name in suspicious_rules:
        if token in normalized:
            if leaf_name == "Headless Chrome":
                return ("Automated", "Automation", "2☆", leaf_name)
            return ("Automated", "Suspicious", "1☆", leaf_name)

    library_rules = [
        ("python-requests", "python-requests"),
        ("curl/", "curl"),
        ("go-http-client", "Go-http-client"),
        ("axios", "axios"),
        ("postmanruntime", "PostmanRuntime"),
    ]
    for token, leaf_name in library_rules:
        if token in normalized:
            return ("Clients", "Libraries", "5☆", leaf_name)

    crawler_rules = [
        ("googlebot", "Googlebot"),
        ("bingbot", "Bingbot"),
        ("duckduckbot", "DuckDuckBot"),
        ("yandexbot", "YandexBot"),
    ]
    for token, leaf_name in crawler_rules:
        if token in normalized:
            return ("Automated", "Crawlers", "4☆", leaf_name)

    internal_tooling_rules = [
        ("prometheus", "Health Probe"),
        ("health", "Health Probe"),
        ("synthetic", "Synthetic Monitor"),
    ]
    for token, leaf_name in internal_tooling_rules:
        if token in normalized:
            return ("Automated", "Internal Tooling", "4☆", leaf_name)

    automation_rules = [
        ("playwright", "Playwright"),
        ("puppeteer", "Puppeteer"),
        ("selenium", "Selenium Grid"),
    ]
    for token, leaf_name in automation_rules:
        if token in normalized:
            return ("Automated", "Automation", "2☆", leaf_name)

    engineering_rules = [
        ("k6", "K6 Client"),
        ("load test", "Load Test Runner"),
    ]
    for token, leaf_name in engineering_rules:
        if token in normalized:
            return ("Automated", "Engineering", "3☆", leaf_name)

    if "iphone" in normalized or "ios" in normalized:
        return ("Automated", "Mobile Apps", "3☆", "iOS App WebView")

    if "android" in normalized:
        return ("Automated", "Mobile Apps", "3☆", "Android App WebView")

    if "windows nt" in normalized:
        return ("Clients", "Browsers", "3☆", "Chrome / Windows")

    if "macintosh" in normalized or "mac os" in normalized:
        return ("Clients", "Browsers", "3☆", "Safari / Mac")

    if "x11" in normalized or "linux x86_64" in normalized:
        return ("Clients", "Browsers", "3☆", "Firefox / Desktop")

    if "mozilla/" in normalized:
        return ("Clients", "Browsers", "3☆", "Browser / Generic")

    return ("Automated", "Suspicious", "1☆", "Malformed Tokens")


def build_user_agent_aggregates(user_agents: list[str]) -> list[ChartUserAgentAggregate]:
    counts: Counter[UserAgentPath] = Counter()

    for user_agent in user_agents:
        counts[classify_user_agent(user_agent)] += 1

    return [
        ChartUserAgentAggregate(
            group_name=group_name,
            category_name=category_name,
            tier_name=tier_name,
            leaf_name=leaf_name,
            event_count=event_count,
        )
        for (group_name, category_name, tier_name, leaf_name), event_count in sorted(
            counts.items()
        )
    ]
