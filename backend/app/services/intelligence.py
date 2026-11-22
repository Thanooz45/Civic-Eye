from __future__ import annotations

import math
from typing import Optional

from app.ai.schemas import (
    ComponentScore,
    Department,
    EvidenceValidity,
    IssueAnalysisResult,
    IssueCategory,
    Priority,
    SeverityScore,
)
from app.core.config import settings


WEIGHTS = {"H": 0.40, "E": 0.25, "L": 0.20, "R": 0.15}

SUPPORTED_REPORT_CATEGORIES = {
    IssueCategory.POTHOLE,
    IssueCategory.DAMAGED_ROAD,
    IssueCategory.GARBAGE,
    IssueCategory.WATER_LEAKAGE,
    IssueCategory.OPEN_DRAIN,
    IssueCategory.OPEN_MANHOLE,
    IssueCategory.STREETLIGHT,
    IssueCategory.POLLUTION,
}

# Configurable department routing table.
# To reroute a category, change this mapping; a GENERAL fallback is always safe.
CATEGORY_DEPARTMENTS = {
    IssueCategory.POTHOLE: Department.ROAD_MAINTENANCE,
    IssueCategory.DAMAGED_ROAD: Department.ROADS_ENGINEERING,
    IssueCategory.GARBAGE: Department.MUNICIPAL_SANITATION,
    IssueCategory.WATER_LEAKAGE: Department.WATER_SUPPLY,
    IssueCategory.OPEN_DRAIN: Department.DRAINAGE,
    IssueCategory.OPEN_MANHOLE: Department.DRAINAGE,
    IssueCategory.STREETLIGHT: Department.ELECTRICAL_MAINTENANCE,
    # Pollution is routed to the Pollution Control Board.
    # If no specific board is configured, GENERAL is a safe fallback.
    IssueCategory.POLLUTION: Department.POLLUTION_CONTROL,
    IssueCategory.OTHER: Department.GENERAL,
}

# Routing rationale shown in the incident record and staff queue.
CATEGORY_ROUTING_RATIONALE = {
    IssueCategory.POTHOLE: "Potholes are handled by the Road Maintenance department.",
    IssueCategory.DAMAGED_ROAD: "Structural road damage is handled by Roads Engineering.",
    IssueCategory.GARBAGE: "Waste collection falls under Municipal Sanitation.",
    IssueCategory.WATER_LEAKAGE: "Pipe leaks are managed by the Water Supply department.",
    IssueCategory.OPEN_DRAIN: "Open drains are managed by the Stormwater & Drainage department.",
    IssueCategory.OPEN_MANHOLE: "Open manholes are managed by the Stormwater & Drainage department.",
    IssueCategory.STREETLIGHT: "Streetlight outages are handled by Electrical Maintenance.",
    IssueCategory.POLLUTION: (
        "Pollution reports are routed to the Pollution Control Board. "
        "If the responsible authority is unclear, the report is sent for general review."
    ),
    IssueCategory.OTHER: "Issue type unclear; sent to General Review for manual triage.",
}

CATEGORY_HAZARD = {
    IssueCategory.POTHOLE: 6.0,
    IssueCategory.DAMAGED_ROAD: 6.0,
    IssueCategory.GARBAGE: 3.0,
    IssueCategory.WATER_LEAKAGE: 5.0,
    IssueCategory.OPEN_MANHOLE: 8.0,
    IssueCategory.OPEN_DRAIN: 6.0,
    IssueCategory.STREETLIGHT: 4.0,
    IssueCategory.POLLUTION: 5.0,
    IssueCategory.OTHER: 0.0,
}


def analyze_description(description: str, input_language: str = "en") -> IssueAnalysisResult:
    """Return a conservative keyword-based classification for internal validation."""
    text = description.casefold()
    rules = (
        (IssueCategory.POTHOLE, ("pothole", "road hole", "crater")),
        (IssueCategory.DAMAGED_ROAD, ("damaged road", "broken road", "road damage")),
        # Pollution keywords prioritized before general municipal waste
        (IssueCategory.POLLUTION, (
            "pollution", "polluted", "smoke", "fumes", "toxic", "chemical",
            "air quality", "water quality", "contamination", "contaminated",
            "noise pollution", "dust pollution", "factory emission", "burning",
            "industrial waste", "sewage smell", "effluent",
        )),
        (IssueCategory.GARBAGE, ("garbage", "trash", "rubbish", "litter", "waste")),
        (IssueCategory.WATER_LEAKAGE, ("water leak", "leaking water", "pipe leak")),
        (IssueCategory.OPEN_MANHOLE, ("open manhole", "missing manhole cover")),
        (IssueCategory.OPEN_DRAIN, ("open drain", "blocked drain", "drain")),
    )
    category = next(
        (candidate for candidate, keywords in rules if any(word in text for word in keywords)),
        IssueCategory.OTHER,
    )
    valid = category != IssueCategory.OTHER

    hazard_severity = estimate_hazard(category, description)
    title = f"{category.value.replace('_', ' ').title()} reported"
    return IssueAnalysisResult(
        is_valid_civic_issue=valid,
        category=category,
        title=title,
        description_en=description.strip(),
        hazard_severity=hazard_severity,
        department=CATEGORY_DEPARTMENTS[category],
        routing_rationale=CATEGORY_ROUTING_RATIONALE[category],
        input_language=input_language,
        original_transcript=description if input_language != "en" else None,
        evidence_validity=EvidenceValidity.LIKELY_VALID if valid else EvidenceValidity.UNCERTAIN,
        rejection_reason=None if valid else "Text rules could not identify a supported civic issue.",
        recommended_action="Route for staff inspection." if valid else "Request clarification and manual review.",
        is_demo_output=True,
    )


def estimate_hazard(category: IssueCategory, description: str) -> float:
    text = description.casefold()
    extra = 2.0 if any(word in text for word in ("deep", "large", "dangerous", "busy")) else 0.0
    return min(10.0, CATEGORY_HAZARD[category] + extra)


def calculate_severity(
    hazard: float,
    exposure: Optional[float] = None,
    location_sensitivity: Optional[float] = None,
    corroboration: Optional[float] = None,
) -> SeverityScore:
    """Score only available inputs and renormalize; missing inputs remain visible."""
    values = {"H": hazard, "E": exposure, "L": location_sensitivity, "R": corroboration}
    components = {}
    available_weight = 0.0
    weighted_total = 0.0

    for name, value in values.items():
        available = value is not None
        components[name] = ComponentScore(
            value=value,
            weight=WEIGHTS[name],
            available=available,
            reason=(
                "Estimated from the submitted description."
                if name == "H" and available
                else "Computed from available report context."
                if available
                else "Unavailable; excluded from the weighted score."
            ),
        )
        if value is not None:
            weighted_total += WEIGHTS[name] * value
            available_weight += WEIGHTS[name]

    final_score = weighted_total / available_weight if available_weight else 0.0
    if final_score >= 7.5:
        priority = Priority.CRITICAL
    elif final_score >= 5.0:
        priority = Priority.HIGH
    elif final_score >= 3.0:
        priority = Priority.MEDIUM
    else:
        priority = Priority.LOW

    available_names = [name for name, value in values.items() if value is not None]
    missing_names = [name for name, value in values.items() if value is None]
    reason = (
        f"Score {final_score:.2f}/10 uses available components {', '.join(available_names)}"
        + (f"; {', '.join(missing_names)} are unavailable and were excluded." if missing_names else ".")
    )
    return SeverityScore(
        **components,
        final_score=final_score,
        priority=priority,
        plain_language_reason=reason,
        sla_hours=settings.sla_hours_for_priority(priority.value),
        has_missing_components=bool(missing_names),
        is_demo_output=False,
    )


def corroboration_score(report_count: int) -> float:
    """Diminishing-return corroboration score on a 0–10 scale."""
    if report_count < 1:
        raise ValueError("report_count must be at least one")
    return min(10.0, math.log2(report_count + 1) * 2.5)


def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    earth_radius_m = 6_371_000
    lat1_rad, lat2_rad = math.radians(lat1), math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
    )
    return 2 * earth_radius_m * math.asin(math.sqrt(a))
