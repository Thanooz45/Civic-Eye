from __future__ import annotations

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field
import re

from app.core.database import get_db
from app.services.ai_review import answer_civic_question

router = APIRouter()


class AssistantQuestion(BaseModel):
    question: str = Field(min_length=3, max_length=500)


@router.get("/incidents.geojson")
async def public_incidents_geojson(db: AsyncIOMotorDatabase = Depends(get_db)):
    incidents = await db.incidents.find({"status": "CLOSED"}).to_list(length=None)
    features = []
    for document in incidents:
        features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [
                        round(document["longitude"], 3),
                        round(document["latitude"], 3),
                    ],
                },
                "properties": {
                    "incident_code": document["incident_code"],
                    "category": document["category"],
                    "title": document["title"],
                    "status": document["status"],
                    "priority": document["priority"],
                    "report_count": document["report_count"],
                    "is_demo": document["is_demo"],
                },
            }
        )
    return {"type": "FeatureCollection", "features": features}


@router.get("/stats")
async def public_stats(db: AsyncIOMotorDatabase = Depends(get_db)):
    counts = await db.incidents.aggregate(
        [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    ).to_list(length=None)
    by_status = {item["_id"]: item["count"] for item in counts}
    return {
        "total": sum(by_status.values()),
        "open": sum(count for status, count in by_status.items() if status != "CLOSED"),
        "closed": by_status.get("CLOSED", 0),
        "demo_data": False,
    }


@router.post("/assistant")
async def civic_assistant(payload: AssistantQuestion, db: AsyncIOMotorDatabase = Depends(get_db)):
    def as_iso(value):
        return value.isoformat() if hasattr(value, "isoformat") else value

    incidents = await db.incidents.find({}, {
        "incident_code": 1, "title": 1, "description_en": 1, "city": 1,
        "department": 1, "category": 1, "status": 1, "report_count": 1,
        "created_at": 1, "sla_due_at": 1, "updated_at": 1,
        "timeline.event": 1, "timeline.actor": 1, "timeline.timestamp": 1,
    }).sort("updated_at", -1).to_list(length=500)
    department_rows = await db.incidents.aggregate([{"$group": {
        "_id": "$department",
        "issues": {"$sum": 1},
        "community_reports": {"$sum": {"$ifNull": ["$report_count", 1]}},
        "open": {"$sum": {"$cond": [{"$ne": ["$status", "CLOSED"]}, 1, 0]}},
        "closed": {"$sum": {"$cond": [{"$eq": ["$status", "CLOSED"]}, 1, 0]}},
    }}]).to_list(length=None)
    department_counts = {row.get("_id") or "Unassigned": {key: row[key] for key in ("issues", "community_reports", "open", "closed")} for row in department_rows}

    terms = [term for term in re.findall(r"[\w-]+", payload.question.casefold()) if len(term) > 2 and term not in {"the", "and", "for", "with", "what", "when", "where", "how", "who", "was", "are", "does", "from", "that", "this", "complaint", "complaints", "request", "issue", "issues"}]
    scored = []
    for item in incidents:
        haystack = " ".join(str(item.get(key, "")) for key in ("incident_code", "title", "description_en", "city", "department", "category")).casefold()
        score = sum(3 if term in str(item.get("incident_code", "")).casefold() else 1 for term in terms if term in haystack)
        if score:
            scored.append((score, item))
    scored.sort(key=lambda pair: (pair[0], pair[1].get("updated_at")), reverse=True)
    matches = []
    for _, item in scored[:8]:
        timeline = [
            {"event": event.get("event"), "actor": event.get("actor"), "timestamp": as_iso(event.get("timestamp"))}
            for event in item.get("timeline", [])
            if event.get("event") in {"RECEIVED", "ROUTED", "ACCEPTED", "WORK_STARTED", "WORK_COMPLETED"}
        ]
        matches.append({
            "incident_code": item.get("incident_code"),
            "title": item.get("title"),
            "city": item.get("city", "Not specified"),
            "department": item.get("department", "Unassigned"),
            "status": item.get("status", "SUBMITTED"),
            "report_count": item.get("report_count", 1),
            "created_at": as_iso(item.get("created_at")),
            "sla_due_at": as_iso(item.get("sla_due_at")),
            "timeline": timeline,
        })
    answer, provider = await answer_civic_question(payload.question, {
        "total_issues": sum(counts["issues"] for counts in department_counts.values()),
        "department_counts": department_counts,
        "matching_complaints": matches,
    })
    return {"answer": answer, "provider": provider}
