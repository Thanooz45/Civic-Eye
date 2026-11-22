from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
import re

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

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
async def public_stats(
    category: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    query = {}
    if category and category.strip():
        query["category"] = category.strip().upper()
    date_filter = {}
    if from_date and from_date.strip():
        try:
            date_filter["$gte"] = datetime.fromisoformat(from_date.strip())
        except ValueError:
            pass
    if to_date and to_date.strip():
        try:
            date_filter["$lte"] = datetime.fromisoformat(to_date.strip())
        except ValueError:
            pass
    if date_filter:
        query["created_at"] = date_filter

    documents = await db.incidents.find(query).to_list(length=None)
    now = datetime.now(timezone.utc)

    total = len(documents)
    closed_docs = [d for d in documents if d.get("status") == "CLOSED"]
    open_docs = [d for d in documents if d.get("status") != "CLOSED"]
    in_progress_docs = [d for d in documents if d.get("status") in {"IN_PROGRESS", "ASSIGNED"}]

    overdue_count = 0
    for d in open_docs:
        due = d.get("sla_due_at")
        if due:
            if isinstance(due, str):
                try:
                    due = datetime.fromisoformat(due)
                except ValueError:
                    due = None
            if due:
                if due.tzinfo is None:
                    due = due.replace(tzinfo=timezone.utc)
                if due < now:
                    overdue_count += 1

    resolution_times = []
    for d in closed_docs:
        c_at = d.get("created_at")
        u_at = d.get("updated_at")
        if c_at and u_at:
            if isinstance(c_at, str):
                try:
                    c_at = datetime.fromisoformat(c_at)
                except ValueError:
                    c_at = None
            if isinstance(u_at, str):
                try:
                    u_at = datetime.fromisoformat(u_at)
                except ValueError:
                    u_at = None
            if c_at and u_at:
                diff_hours = (u_at - c_at).total_seconds() / 3600.0
                if diff_hours >= 0:
                    resolution_times.append(diff_hours)

    avg_resolution_hours = round(sum(resolution_times) / len(resolution_times), 1) if resolution_times else None

    by_category = {}
    by_department = {}
    for d in documents:
        cat = d.get("category", "OTHER")
        dept = d.get("department", "GENERAL")
        st = d.get("status", "SUBMITTED")
        is_closed = (st == "CLOSED")

        if cat not in by_category:
            by_category[cat] = {"total": 0, "open": 0, "closed": 0}
        by_category[cat]["total"] += 1
        if is_closed:
            by_category[cat]["closed"] += 1
        else:
            by_category[cat]["open"] += 1

        if dept not in by_department:
            by_department[dept] = {"total": 0, "open": 0, "closed": 0}
        by_department[dept]["total"] += 1
        if is_closed:
            by_department[dept]["closed"] += 1
        else:
            by_department[dept]["open"] += 1

    return {
        "total": total,
        "open": len(open_docs),
        "closed": len(closed_docs),
        "in_progress": len(in_progress_docs),
        "overdue": overdue_count,
        "avg_resolution_hours": avg_resolution_hours,
        "by_category": by_category,
        "by_department": by_department,
        "demo_data": any(d.get("is_demo") for d in documents),
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
