"""
app/ai/schemas.py
=================
Pydantic models for all AI outputs in CIVIC EYE.

All models use strict field definitions so that any structurally
invalid response from an AI provider is caught immediately during
validation and triggers the retry / fallback path.

Design rules
------------
* No invented confidence percentages – every field is categorical or a
  plain-language string.
* Missing information is represented explicitly (None with a reason
  field), never silently zeroed.
* All enum values are UPPER_SNAKE_CASE to match the JSON contract.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Shared enumerations
# ---------------------------------------------------------------------------

class EvidenceValidity(str, Enum):
    LIKELY_VALID = "LIKELY_VALID"
    UNCERTAIN = "UNCERTAIN"
    INVALID = "INVALID"


class Priority(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class EvidenceStrength(str, Enum):
    STRONG = "STRONG"
    MODERATE = "MODERATE"
    WEAK = "WEAK"


class VerificationStatus(str, Enum):
    VISUALLY_VERIFIED = "VISUALLY_VERIFIED"
    VERIFICATION_REJECTED = "VERIFICATION_REJECTED"
    LOCATION_MISMATCH = "REJECTED:LOCATION_MISMATCH"
    MANUAL_REVIEW_REQUIRED = "MANUAL_REVIEW_REQUIRED"


class LocationConsistency(str, Enum):
    MATCHED = "MATCHED"
    UNCERTAIN = "UNCERTAIN"
    MISMATCH = "MISMATCH"


class ImageQuality(str, Enum):
    ADEQUATE = "ADEQUATE"
    POOR = "POOR"
    UNUSABLE = "UNUSABLE"


class IssueCategory(str, Enum):
    POTHOLE = "POTHOLE"
    DAMAGED_ROAD = "DAMAGED_ROAD"
    GARBAGE = "GARBAGE"
    WATER_LEAKAGE = "WATER_LEAKAGE"
    OPEN_DRAIN = "OPEN_DRAIN"
    OPEN_MANHOLE = "OPEN_MANHOLE"
    STREETLIGHT = "STREETLIGHT"
    # Pollution categories added per project statement requirements
    POLLUTION = "POLLUTION"
    OTHER = "OTHER"


class PollutionSubtype(str, Enum):
    """Subtype selector for POLLUTION reports."""
    AIR = "AIR"
    WATER = "WATER"
    NOISE = "NOISE"
    OTHER = "OTHER"


class Department(str, Enum):
    ROAD_MAINTENANCE = "ROAD_MAINTENANCE"
    ROADS_ENGINEERING = "ROADS_ENGINEERING"
    MUNICIPAL_SANITATION = "MUNICIPAL_SANITATION"
    WATER_SUPPLY = "WATER_SUPPLY"
    DRAINAGE = "DRAINAGE"
    ELECTRICAL_MAINTENANCE = "ELECTRICAL_MAINTENANCE"
    POLLUTION_CONTROL = "POLLUTION_CONTROL"
    GENERAL = "GENERAL"


# ---------------------------------------------------------------------------
# IssueAnalysisResult – output of the image/voice analysis step
# ---------------------------------------------------------------------------

class IssueAnalysisResult(BaseModel):
    """
    Structured result of analysing a citizen's uploaded evidence.

    is_valid_civic_issue = False causes the report to be routed to
    manual review before any incident is created.
    """

    # Core classification
    is_valid_civic_issue: bool = Field(
        description="True only when the image clearly depicts a civic infrastructure issue."
    )
    category: IssueCategory = Field(
        description="Classified issue category."
    )
    title: str = Field(
        min_length=5,
        max_length=120,
        description="Short human-readable title for the incident."
    )
    description_en: str = Field(
        min_length=10,
        max_length=1000,
        description="Plain-English description of the issue and visible damage."
    )

    # Severity
    hazard_severity: float = Field(
        ge=0.0,
        le=10.0,
        description=(
            "Hazard severity estimated from visual cues (0 = trivial, 10 = life-threatening). "
            "AI proposal only; never authoritative."
        )
    )

    # Routing
    department: Department = Field(
        description="Recommended municipal department for this issue."
    )
    routing_rationale: Optional[str] = Field(
        default=None,
        description="Plain-language explanation of why the issue was routed to this department.",
    )
    # Pollution subtype — only set when category == POLLUTION
    pollution_subtype: Optional[str] = Field(
        default=None,
        description="Subtype for pollution reports: AIR, WATER, NOISE, or OTHER. None for non-pollution categories.",
    )

    # Language / transcript
    input_language: str = Field(
        default="en",
        description="BCP-47 language code detected in voice/text input (e.g. 'te', 'hi', 'en')."
    )
    original_transcript: Optional[str] = Field(
        default=None,
        description="Verbatim transcript in the original language (preserved separately from any translation)."
    )
    english_translation: Optional[str] = Field(
        default=None,
        description="English translation of the voice/text input (None when input is already English)."
    )

    # Evidence quality
    evidence_validity: EvidenceValidity = Field(
        description="Assessment of whether the submitted evidence is genuine and relevant."
    )
    rejection_reason: Optional[str] = Field(
        default=None,
        description="Human-readable reason when is_valid_civic_issue is False or evidence_validity is INVALID."
    )

    # Traceability
    recommended_action: Optional[str] = Field(
        default=None,
        description="Suggested immediate action for the assigned department."
    )
    is_demo_output: bool = Field(
        default=False,
        description="[DEMO] True when this result was produced by the deterministic demo mode, NOT real AI."
    )

    @field_validator("hazard_severity")
    @classmethod
    def round_severity(cls, v: float) -> float:
        return round(v, 2)


# ---------------------------------------------------------------------------
# SeverityScore – output of the transparent scoring engine
# ---------------------------------------------------------------------------

class ComponentScore(BaseModel):
    """A single scoring component with availability tracking."""
    value: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=10.0,
        description="Component value (0–10), or None when the data source is unavailable."
    )
    weight: float = Field(
        description="Configured weight for this component (e.g. 0.40)."
    )
    available: bool = Field(
        description="False when the component could not be computed; it is excluded from renormalisation."
    )
    reason: str = Field(
        description="Plain-language explanation of how this component was computed or why it is unavailable."
    )


class SeverityScore(BaseModel):
    """
    Transparent, configurable severity score for an incident.

    Formula: S = 0.40·H + 0.25·E + 0.20·L + 0.15·R  (0–10 scale)

    Missing components are NEVER silently zeroed.  Instead, the
    formula is renormalised over available components and the
    missing ones are flagged for review.
    """

    # Component scores
    H: ComponentScore = Field(
        description=(
            "Hazard severity (size, depth cues, open manhole worse than shallow pothole). Weight 0.40."
        )
    )
    E: ComponentScore = Field(
        description=(
            "Exposure: road type, junction, bus route, estimated pedestrian/traffic volume. Weight 0.25."
        )
    )
    L: ComponentScore = Field(
        description=(
            "Location sensitivity: school, hospital, market within 200 m. Weight 0.20."
        )
    )
    R: ComponentScore = Field(
        description=(
            "Corroboration: unique reporter count (log-scaled); weather risk contributes here. Weight 0.15."
        )
    )

    # Computed aggregate
    final_score: float = Field(
        ge=0.0,
        le=10.0,
        description="Weighted aggregate score (0–10), renormalised when any component is unavailable."
    )
    priority: Priority = Field(
        description="Priority band derived from final_score."
    )
    plain_language_reason: str = Field(
        description="One or two sentences explaining the score in plain English for the UI."
    )
    sla_hours: int = Field(
        description="Default SLA in hours based on priority band: CRITICAL=24, HIGH=72, MEDIUM=168, LOW=336."
    )
    has_missing_components: bool = Field(
        description="True when at least one component was unavailable; shown in the UI as a caveat."
    )
    is_demo_output: bool = Field(
        default=False,
        description="[DEMO] True when this result was produced by the deterministic demo mode, NOT real AI."
    )

    @field_validator("final_score")
    @classmethod
    def round_final(cls, v: float) -> float:
        return round(v, 2)


# ---------------------------------------------------------------------------
# VerificationResult – output of the Proof-of-Resolution Engine
# ---------------------------------------------------------------------------

class DeterministicChecks(BaseModel):
    """Results of the cheap, rule-based checks run before AI comparison."""
    capture_integrity: bool = Field(
        description="True when after-photo was captured in-app with a server timestamp."
    )
    capture_integrity_note: str = Field(default="")

    geofence_passed: bool = Field(
        description="True when after-photo GPS is within the configured radius (default 30 m)."
    )
    geofence_distance_m: Optional[float] = Field(
        default=None,
        description="Measured distance in metres between incident GPS and after-photo GPS."
    )
    geofence_threshold_m: float = Field(default=30.0)

    image_quality: ImageQuality = Field(
        description="Blur/darkness assessment of the after-photo."
    )
    image_quality_note: str = Field(default="")

    hash_reuse_detected: bool = Field(
        description="True when the perceptual hash of the after-photo matches a previously submitted image."
    )
    hash_reuse_note: str = Field(default="")

    all_passed: bool = Field(
        description="Convenience flag: True only when all deterministic checks pass."
    )


class VerificationResult(BaseModel):
    """
    Full output of the Proof-of-Resolution Engine for one repair submission.

    Honesty rules:
    * No invented confidence percentages.
    * evidence_strength is categorical (STRONG / MODERATE / WEAK).
    * This result is a RECOMMENDATION; an authorised human must approve closure.
    """

    incident_id: str = Field(
        description="Public incident code (e.g. 'CIVIC-2026-0001')."
    )

    # Deterministic pre-checks
    checks_run: DeterministicChecks = Field(
        description="Results of deterministic checks performed before AI comparison."
    )

    # AI visual comparison (None when deterministic checks already failed hard)
    ai_comparison: Optional[dict] = Field(
        default=None,
        description=(
            "Raw structured JSON returned by the AI visual comparison step. "
            "Stored for audit trail; do not expose directly in public APIs."
        )
    )

    # Verdict
    verification_status: VerificationStatus = Field(
        description="Overall outcome of the verification pipeline."
    )
    same_issue_identified: bool = Field(
        description="AI assessment: does the after-photo show the same civic issue type?"
    )
    location_consistency: LocationConsistency = Field(
        description="AI assessment of scene/location consistency between before and after photos."
    )
    visible_improvement: bool = Field(
        description="AI assessment: is the specific hazard visibly improved in the after-photo?"
    )
    remaining_damage: bool = Field(
        description="AI assessment: is there remaining visible damage?"
    )
    image_quality: ImageQuality = Field(
        description="AI assessment of after-photo quality."
    )
    evidence_strength: EvidenceStrength = Field(
        description="Overall evidence strength (STRONG / MODERATE / WEAK). Never a percentage."
    )
    reasoning: str = Field(
        description=(
            "Plain-language explanation of the verdict, referencing specific visual evidence. "
            "Never fabricated; grounded only in what the model can observe."
        )
    )
    requires_human_approval: bool = Field(
        default=True,
        description="Always True: an authorised human must approve before public closure."
    )
    is_demo_output: bool = Field(
        default=False,
        description="[DEMO] True when this result was produced by the deterministic demo mode, NOT real AI."
    )
