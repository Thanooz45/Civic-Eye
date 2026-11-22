"""
app/core/config.py
==================
Centralised application settings loaded from environment variables / .env file.
Uses pydantic-settings for type-safe, validated configuration.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any, List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All environment-driven configuration for CIVIC EYE backend."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ------------------------------------------------------------------
    # Application
    # ------------------------------------------------------------------
    APP_NAME: str = "CIVIC EYE"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # ------------------------------------------------------------------
    # Database
    # ------------------------------------------------------------------
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DATABASE: str = "civic_eye"

    # ------------------------------------------------------------------
    # Security / JWT
    # ------------------------------------------------------------------
    SECRET_KEY: str = "CHANGE_ME_TO_A_LONG_RANDOM_STRING"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    CITY_TEAM_ACCESS_CODE: str = ""
    CIVIC_DEPT_ROAD_MAINTENANCE_ACCESS_CODE: str = ""
    CIVIC_DEPT_ROADS_ENGINEERING_ACCESS_CODE: str = ""
    CIVIC_DEPT_MUNICIPAL_SANITATION_ACCESS_CODE: str = ""
    CIVIC_DEPT_WATER_SUPPLY_ACCESS_CODE: str = ""
    CIVIC_DEPT_DRAINAGE_ACCESS_CODE: str = ""
    CIVIC_DEPT_ELECTRICAL_MAINTENANCE_ACCESS_CODE: str = ""
    CIVIC_DEPT_GENERAL_ACCESS_CODE: str = ""

    # ------------------------------------------------------------------
    # AI Engine
    # ------------------------------------------------------------------
    AI_PROVIDER: str = "auto"
    AI_MODEL: str = "gemini-3.8-flash"
    AI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-20b"

    # ------------------------------------------------------------------
    # File / Storage
    # ------------------------------------------------------------------
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_MB: int = 10
    MAX_VIDEO_SIZE_MB: int = 12
    ALLOWED_IMAGE_TYPES: str = "image/jpeg,image/png,image/webp"
    ALLOWED_AUDIO_TYPES: str = "audio/mpeg,audio/wav,audio/ogg,audio/mp4"
    ALLOWED_VIDEO_TYPES: str = "video/mp4,video/webm"

    # ------------------------------------------------------------------
    # CORS
    # ------------------------------------------------------------------
    # Keep this field non-complex so pydantic-settings does not try to JSON-decode
    # the comma-separated value used by the existing .env file before validation.
    CORS_ORIGINS: Any = [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors(cls, v):
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug(cls, value):
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"true", "1", "yes", "on"}:
                return True
            if normalized in {"false", "0", "no", "off"}:
                return False
        # Fail closed for unexpected values instead of enabling debug mode.
        return False

    # ------------------------------------------------------------------
    # Geospatial
    # ------------------------------------------------------------------
    DEDUP_RADIUS_METERS: int = 150
    REPAIR_GEOFENCE_METERS: int = 30

    # ------------------------------------------------------------------
    # SLA defaults (hours)
    # ------------------------------------------------------------------
    SLA_CRITICAL_HOURS: int = 24
    SLA_HIGH_HOURS: int = 72
    SLA_MEDIUM_HOURS: int = 168   # 7 days
    SLA_LOW_HOURS: int = 336      # 14 days

    # ------------------------------------------------------------------
    # ------------------------------------------------------------------
    # Convenience helpers
    # ------------------------------------------------------------------
    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    @property
    def max_video_upload_bytes(self) -> int:
        return self.MAX_VIDEO_SIZE_MB * 1024 * 1024

    @property
    def allowed_image_types_list(self) -> List[str]:
        return [t.strip() for t in self.ALLOWED_IMAGE_TYPES.split(",")]

    @property
    def allowed_audio_types_list(self) -> List[str]:
        return [t.strip() for t in self.ALLOWED_AUDIO_TYPES.split(",")]

    @property
    def allowed_video_types_list(self) -> List[str]:
        return [t.strip() for t in self.ALLOWED_VIDEO_TYPES.split(",")]

    def sla_hours_for_priority(self, priority: str) -> int:
        """Return configured SLA hours for a given priority string."""
        mapping = {
            "CRITICAL": self.SLA_CRITICAL_HOURS,
            "HIGH": self.SLA_HIGH_HOURS,
            "MEDIUM": self.SLA_MEDIUM_HOURS,
            "LOW": self.SLA_LOW_HOURS,
        }
        return mapping.get(priority.upper(), self.SLA_LOW_HOURS)


@lru_cache()
def get_settings() -> Settings:
    """Return cached Settings singleton."""
    return Settings()


# Module-level singleton for convenience imports
settings: Settings = get_settings()
