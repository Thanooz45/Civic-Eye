from __future__ import annotations

import secrets
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from jose import JWTError
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.security import create_access_token, decode_access_token, extract_bearer_token

router = APIRouter()


class CityTeamLogin(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    access_code: str = Field(min_length=16, max_length=200)


@router.post("/city-team")
async def city_team_login(payload: CityTeamLogin):
    configured_code = settings.CITY_TEAM_ACCESS_CODE
    role, department = "DEPARTMENT_HEAD", None
    matched = bool(configured_code) and secrets.compare_digest(payload.access_code, configured_code)
    if not matched:
        for department in DEPARTMENTS:
            candidate = getattr(settings, f"CIVIC_DEPT_{department}_ACCESS_CODE")
            if candidate and len(candidate) < 16:
                raise HTTPException(status_code=503, detail=f"The {department.replace('_', ' ').lower()} access code must be at least 16 characters.")
            if candidate and secrets.compare_digest(payload.access_code, candidate):
                role, matched = "DEPARTMENT", True
                break
    if not matched:
        raise HTTPException(status_code=401, detail="The access code was not accepted.")
    name = " ".join(payload.name.split())
    token = create_access_token(subject=name, role=role, department=department)
    return {"access_token": token, "token_type": "bearer", "name": name, "role": role, "department": department}


DEPARTMENTS = ("ROAD_MAINTENANCE", "ROADS_ENGINEERING", "MUNICIPAL_SANITATION", "WATER_SUPPLY", "DRAINAGE", "ELECTRICAL_MAINTENANCE", "GENERAL", "POLLUTION_CONTROL")


async def require_city_team(authorization: Optional[str] = Header(default=None)) -> dict:
    token = extract_bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="City-team sign-in is required.")
    try:
        claims = decode_access_token(token)
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="City-team sign-in expired. Sign in again.") from exc
    if claims.get("role") not in {"CITY_TEAM", "DEPARTMENT_HEAD", "DEPARTMENT"} or not claims.get("sub"):
        raise HTTPException(status_code=403, detail="This action is available to the city team only.")
    return claims


require_staff = require_city_team


async def optional_staff(authorization: Optional[str] = Header(default=None)) -> Optional[dict]:
    if not authorization:
        return None
    return await require_city_team(authorization)
