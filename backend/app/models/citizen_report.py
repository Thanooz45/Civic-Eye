from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from pydantic import BaseModel, Field


class CitizenReport(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    incident_id: str
    input_language: str = "en"
    original_transcript: Optional[str] = None
    description_en: str
    is_demo: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def to_document(self) -> dict:
        document = self.model_dump(mode="python")
        document["_id"] = document.pop("id")
        return document
