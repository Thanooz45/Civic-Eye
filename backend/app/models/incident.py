from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from pydantic import BaseModel, Field


class Incident(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    incident_code: str
    category: str
    title: str
    description_en: str
    latitude: float
    longitude: float
    city: str = "Not specified"
    department: str
    status: str = "SUBMITTED"
    priority: str
    severity_score: float
    score_breakdown: dict[str, Any]
    report_count: int = 1
    sla_due_at: datetime
    timeline: list[dict[str, Any]] = Field(default_factory=list)
    repair_status: Optional[str] = None
    repair_reason: Optional[str] = None
    repair_evidence: Optional[dict[str, Any]] = None
    pollution_subtype: Optional[str] = None
    is_demo: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def to_document(self) -> dict[str, Any]:
        document = self.model_dump(mode="python")
        document["_id"] = document.pop("id")
        return document

    @classmethod
    def from_document(cls, document: dict[str, Any]) -> "Incident":
        values = dict(document)
        values["id"] = str(values.pop("_id"))
        return cls.model_validate(values)
