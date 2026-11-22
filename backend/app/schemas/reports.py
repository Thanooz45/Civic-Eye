from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

from app.ai.schemas import IssueAnalysisResult, SeverityScore


class AnalyzeReportRequest(BaseModel):
    description: str = Field(min_length=10, max_length=1000)
    input_language: str = Field(default="en", min_length=2, max_length=16)


class ReportPreview(BaseModel):
    analysis: IssueAnalysisResult
    severity: SeverityScore
    provider: str = "gemini"
    demo_mode: bool = False
    notice: str = "Automated classification is a recommendation. Review it before submitting."


class CreateReportRequest(BaseModel):
    category: str = Field(min_length=3, max_length=32)
    title: str = Field(min_length=5, max_length=120)
    description_en: str = Field(min_length=10, max_length=1000)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    city: Optional[str] = Field(default=None, max_length=120)
    input_language: str = Field(default="en", min_length=2, max_length=16)
    original_transcript: Optional[str] = Field(default=None, max_length=1000)
    merge_incident_id: Optional[str] = None
    pollution_subtype: Optional[str] = None


class DuplicateCandidate(BaseModel):
    incident_id: str
    incident_code: str
    category: str
    title: str
    distance_m: float
    reason: str = "Same category within the configured search radius; confirm explicitly before linking."


class ReportCreated(BaseModel):
    report_id: str
    incident_id: str
    incident_code: str
    status: str
    report_count: int
    duplicate_linked: bool
    is_demo: bool = False
    needs_review: bool
    category: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    city: Optional[str] = None
    audio_urls: list = []
