from __future__ import annotations

from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Optional
from uuid import uuid4
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field
from PIL import Image, UnidentifiedImageError

from app.core.database import get_db
from app.core.config import settings
from app.api.auth import require_city_team, optional_staff
from app.models import Incident

router = APIRouter()


class StatusUpdate(BaseModel):
    status: str = Field(min_length=3, max_length=32)
    reason: str = Field(min_length=3, max_length=500)
    actor: str = Field(default="CITY_TEAM", max_length=64)


class RepairEvidence(BaseModel):
    after_description: str = Field(min_length=10, max_length=1000)
    location_match: bool = True


IMAGE_SUFFIXES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
VIDEO_SUFFIXES = {"video/mp4": ".mp4", "video/webm": ".webm"}


class ResolutionApproval(BaseModel):
    approved_by: str = Field(min_length=3, max_length=64)
    reason: str = Field(min_length=3, max_length=500)


def append_timeline(incident: Incident, status: str, reason: str, actor: str) -> dict:
    now = datetime.now(timezone.utc)
    normalized = status.upper()
    return {
        "from": incident.status,
        "to": normalized,
        "reason": reason,
        "actor": actor,
        "event": "ACCEPTED" if normalized == "ASSIGNED" else "WORK_STARTED" if normalized == "IN_PROGRESS" else "WORK_COMPLETED" if normalized == "CLOSED" else "STATUS_UPDATED",
        "department": incident.department,
        "timestamp": now.isoformat(),
    }


def incident_response(incident: Incident, include_evidence: bool = False) -> dict:
    result = {
        "id": incident.id,
        "incident_code": incident.incident_code,
        "category": incident.category,
        "title": incident.title,
        "description": incident.description_en,
        "latitude": incident.latitude,
        "longitude": incident.longitude,
        "city": incident.city,
        "department": incident.department,
        "status": incident.status,
        "priority": incident.priority,
        "severity_score": incident.severity_score,
        "score_breakdown": incident.score_breakdown,
        "report_count": incident.report_count,
        "timeline": incident.timeline or [],
        "created_at": incident.created_at.isoformat(),
        "sla_due_at": incident.sla_due_at.isoformat(),
        "updated_at": incident.updated_at.isoformat(),
        "repair_status": incident.repair_status,
        "repair_reason": incident.repair_reason,
        "is_demo": incident.is_demo,
    }
    if include_evidence:
        evidence = incident.repair_evidence
        result["repair_evidence"] = ({key: value for key, value in evidence.items() if key not in {"photo_data", "video_data"}} if evidence else None)
    return result


def ensure_department_access(staff: dict, incident: Incident):
    if isinstance(staff, dict) and staff.get("role") == "DEPARTMENT" and staff.get("department") != incident.department:
        raise HTTPException(status_code=404, detail="Incident was not found.")


async def get_incident(db: AsyncIOMotorDatabase, incident_id: str) -> Incident:
    document = await db.incidents.find_one({"_id": incident_id})
    if document is None:
        raise HTTPException(status_code=404, detail="Incident was not found.")
    return Incident.from_document(document)


@router.get("")
async def list_incidents(db: AsyncIOMotorDatabase = Depends(get_db), staff: Optional[dict] = Depends(optional_staff)):
    query = {"department": staff["department"]} if staff and staff.get("role") == "DEPARTMENT" else {}
    documents = await db.incidents.find(query, {"repair_evidence.photo_data": 0}).sort(
        [("severity_score", -1), ("created_at", -1)]
    ).to_list(length=None)
    return {
        "items": [incident_response(Incident.from_document(document)) for document in documents],
        "demo_mode": False,
    }


class DepartmentMessage(BaseModel):
    message: str = Field(min_length=2, max_length=2000)
    department: Optional[str] = Field(default=None, max_length=80)


@router.get("/staff-messages", dependencies=[Depends(require_city_team)])
async def list_messages(db: AsyncIOMotorDatabase = Depends(get_db), staff: dict = Depends(require_city_team)):
    query = {} if staff.get("role") in {"CITY_TEAM", "DEPARTMENT_HEAD"} else {"department": staff.get("department")}
    rows = await db.department_messages.find(query).sort("created_at", 1).to_list(length=500)
    return [{"id": str(row["_id"]), "from": row["from"], "department": row["department"], "message": row["message"], "created_at": row["created_at"].isoformat()} for row in rows]


@router.post("/staff-messages", dependencies=[Depends(require_city_team)])
async def send_message(payload: DepartmentMessage, db: AsyncIOMotorDatabase = Depends(get_db), staff: dict = Depends(require_city_team)):
    is_head = staff.get("role") in {"CITY_TEAM", "DEPARTMENT_HEAD"}
    department = payload.department if is_head else staff.get("department")
    if not department:
        raise HTTPException(status_code=422, detail="Choose a department for this message.")
    if not is_head and payload.department and payload.department != staff.get("department"):
        raise HTTPException(status_code=403, detail="You can message only your department head.")
    from_role = "HEAD" if is_head else "DEPARTMENT"
    doc = {"from": from_role, "department": department, "message": payload.message.strip(), "created_at": datetime.now(timezone.utc)}
    result = await db.department_messages.insert_one(doc)
    return {"id": str(result.inserted_id), "from": from_role, "department": department, "message": doc["message"], "created_at": doc["created_at"].isoformat()}


DEPARTMENTS = ("ROAD_MAINTENANCE", "ROADS_ENGINEERING", "MUNICIPAL_SANITATION", "WATER_SUPPLY", "DRAINAGE", "ELECTRICAL_MAINTENANCE", "GENERAL")


def staff_participant(staff: dict) -> str:
    return "DEPARTMENT_HEAD" if staff.get("role") in {"CITY_TEAM", "DEPARTMENT_HEAD"} else str(staff.get("department") or "")


async def get_staff_conversation(db: AsyncIOMotorDatabase, conversation_id: str, participant: str) -> dict:
    conversation = await db.staff_conversations.find_one({"_id": conversation_id, "participants": participant})
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return conversation


@router.get("/staff-conversations", dependencies=[Depends(require_city_team)])
async def list_staff_conversations(db: AsyncIOMotorDatabase = Depends(get_db), staff: dict = Depends(require_city_team)):
    participant = staff_participant(staff)
    legacy_query = {} if participant == "DEPARTMENT_HEAD" else {"department": participant}
    legacy_messages = await db.department_messages.find(legacy_query).to_list(length=1000)
    for old in legacy_messages:
        department = str(old.get("department") or "GENERAL")
        sender_id = "DEPARTMENT_HEAD" if old.get("from") == "HEAD" else department
        recipient_id = department if sender_id == "DEPARTMENT_HEAD" else "DEPARTMENT_HEAD"
        conversation_id = "|".join(sorted([sender_id, recipient_id]))
        await db.staff_conversations.update_one(
            {"_id": conversation_id},
            {"$setOnInsert": {"participants": sorted([sender_id, recipient_id]), "created_at": old["created_at"]}, "$set": {"updated_at": old["created_at"]}},
            upsert=True,
        )
        await db.staff_conversation_messages.update_one(
            {"_id": f"legacy:{old['_id']}"},
            {"$setOnInsert": {
                "conversation_id": conversation_id, "sender_id": sender_id,
                "sender_name": "Department Head" if sender_id == "DEPARTMENT_HEAD" else department.replace("_", " ").title(),
                "recipients": [recipient_id], "read_by": [], "message": old.get("message", ""),
                "is_emergency": False, "attachments": [], "created_at": old["created_at"],
            }},
            upsert=True,
        )
    conversations = await db.staff_conversations.find({"participants": participant}).sort("updated_at", -1).to_list(length=200)
    response = []
    for conversation in conversations:
        last_message = await db.staff_conversation_messages.find_one(
            {"conversation_id": conversation["_id"]}, sort=[("created_at", -1)]
        )
        unread_count = await db.staff_conversation_messages.count_documents(
            {"conversation_id": conversation["_id"], "recipients": participant, "read_by": {"$ne": participant}}
        )
        other = next((value for value in conversation["participants"] if value != participant), "")
        response.append({
            "id": conversation["_id"], "participant": other,
            "last_message_id": (last_message or {}).get("_id", ""),
            "last_message": (last_message or {}).get("message", "") or "Attachment",
            "last_from": (last_message or {}).get("sender_id", ""),
            "last_at": (last_message or {}).get("created_at", conversation["updated_at"]).isoformat(),
            "unread_count": unread_count,
            "urgent": bool((last_message or {}).get("is_emergency")),
        })
    return {"participant": participant, "items": response}


@router.get("/staff-conversations/{conversation_id}", dependencies=[Depends(require_city_team)])
async def get_staff_conversation_messages(conversation_id: str, db: AsyncIOMotorDatabase = Depends(get_db), staff: dict = Depends(require_city_team)):
    participant = staff_participant(staff)
    await get_staff_conversation(db, conversation_id, participant)
    await db.staff_conversation_messages.update_many(
        {"conversation_id": conversation_id, "recipients": participant, "read_by": {"$ne": participant}},
        {"$addToSet": {"read_by": participant}},
    )
    rows = await db.staff_conversation_messages.find({"conversation_id": conversation_id}).sort("created_at", 1).to_list(length=1000)
    return [{
        "id": row["_id"], "sender_id": row["sender_id"], "sender_name": row["sender_name"],
        "message": row["message"], "is_emergency": row.get("is_emergency", False),
        "created_at": row["created_at"].isoformat(), "attachments": row.get("attachments", []),
    } for row in rows]


@router.post("/staff-conversations/{recipient}", dependencies=[Depends(require_city_team)])
async def send_staff_conversation_message(
    recipient: str,
    message: str = Form(default=""),
    is_emergency: bool = Form(default=False),
    files: list[UploadFile] = File(default=[]),
    db: AsyncIOMotorDatabase = Depends(get_db),
    staff: dict = Depends(require_city_team),
):
    sender = staff_participant(staff)
    recipient = recipient.strip().upper()
    allowed = set(DEPARTMENTS) | {"DEPARTMENT_HEAD"}
    if sender not in allowed or recipient not in allowed or sender == recipient:
        raise HTTPException(status_code=422, detail="Choose another department or the department head.")
    if len(files) > 5:
        raise HTTPException(status_code=413, detail="Attach no more than five files per message.")
    clean_message = message.strip()
    if not clean_message and not files:
        raise HTTPException(status_code=422, detail="Write a message or attach a file.")
    participants = sorted([sender, recipient])
    conversation_id = "|".join(participants)
    now = datetime.now(timezone.utc)
    attachment_metadata = []
    for upload in files:
        data = await upload.read(5 * 1024 * 1024 + 1)
        if not data or len(data) > 5 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Each attachment must be between 1 byte and 5 MB.")
        filename = Path(upload.filename or "attachment").name.replace('"', "'")[:180]
        attachment_id = str(uuid4())
        await db.staff_message_files.insert_one({
            "_id": attachment_id, "conversation_id": conversation_id, "filename": filename,
            "content_type": upload.content_type or "application/octet-stream", "size": len(data), "data": data,
        })
        attachment_metadata.append({"id": attachment_id, "filename": filename, "content_type": upload.content_type or "application/octet-stream", "size": len(data)})
    await db.staff_conversations.update_one(
        {"_id": conversation_id},
        {"$setOnInsert": {"participants": participants, "created_at": now}, "$set": {"updated_at": now}},
        upsert=True,
    )
    message_id = str(uuid4())
    await db.staff_conversation_messages.insert_one({
        "_id": message_id, "conversation_id": conversation_id, "sender_id": sender,
        "sender_name": str(staff.get("sub") or "City staff")[:80], "recipients": [recipient],
        "read_by": [sender], "message": clean_message, "is_emergency": is_emergency,
        "attachments": attachment_metadata, "created_at": now,
    })
    return {"id": message_id, "conversation_id": conversation_id}


@router.get("/staff-message-files/{attachment_id}", dependencies=[Depends(require_city_team)])
async def download_staff_message_file(attachment_id: str, db: AsyncIOMotorDatabase = Depends(get_db), staff: dict = Depends(require_city_team)):
    attachment = await db.staff_message_files.find_one({"_id": attachment_id})
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found.")
    await get_staff_conversation(db, attachment["conversation_id"], staff_participant(staff))
    filename = quote(attachment["filename"], safe="")
    return Response(
        content=attachment["data"], media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}", "X-Content-Type-Options": "nosniff"},
    )


@router.get("/{incident_id}")
async def get_incident_detail(incident_id: str, db: AsyncIOMotorDatabase = Depends(get_db), staff: Optional[dict] = Depends(optional_staff)):
    incident = await get_incident(db, incident_id)
    if staff and staff.get("role") == "DEPARTMENT" and staff.get("department") != incident.department:
        raise HTTPException(status_code=404, detail="Incident was not found.")
    result = incident_response(incident, include_evidence=True)
    report_media = await db.citizen_reports.find(
        {"incident_id": incident_id},
        {"photo_url": 1, "photo_urls": 1, "video_urls": 1, "_id": 0},
    ).to_list(length=None)
    result["photos"] = list(dict.fromkeys(url for report in report_media for url in (report.get("photo_urls") or ([report["photo_url"]] if report.get("photo_url") else []))))
    result["videos"] = list(dict.fromkeys(url for report in report_media for url in report.get("video_urls", [])))
    return result




@router.patch("/{incident_id}/status", dependencies=[Depends(require_city_team)])
async def update_status(
    incident_id: str,
    payload: StatusUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    staff: dict = Depends(require_city_team),
):
    incident = await get_incident(db, incident_id)
    ensure_department_access(staff, incident)
    next_status = payload.status.upper()
    event = append_timeline(incident, next_status, payload.reason, payload.actor)
    await db.incidents.update_one(
        {"_id": incident_id},
        {"$set": {"status": next_status, "updated_at": datetime.now(timezone.utc)},
         "$push": {"timeline": event}},
    )
    updated = await get_incident(db, incident_id)
    return {"incident_id": incident_id, "status": updated.status, "timeline": updated.timeline}


@router.post("/{incident_id}/repair-evidence", dependencies=[Depends(require_city_team)])
async def submit_repair_evidence(
    incident_id: str,
    after_description: str = Form(..., min_length=10, max_length=1000),
    photos: list[UploadFile] = File(default=[]),
    videos: list[UploadFile] = File(default=[]),
    db: AsyncIOMotorDatabase = Depends(get_db),
    staff: dict = Depends(require_city_team),
):
    incident = await get_incident(db, incident_id)
    ensure_department_access(staff, incident)
    if not photos and not videos:
        raise HTTPException(status_code=422, detail="Attach at least one repair photo or video.")
    if len(photos) > 5 or len(videos) > 3:
        raise HTTPException(status_code=422, detail="Attach up to 5 repair photos and up to 3 repair videos.")
    stored_photos = []
    total_bytes = 0
    for photo in photos:
        content_type = (photo.content_type or "").lower()
        if content_type not in IMAGE_SUFFIXES or content_type not in settings.allowed_image_types_list:
            raise HTTPException(status_code=415, detail="Choose JPG, PNG, or WEBP repair photos.")
        contents = await photo.read(settings.max_upload_bytes + 1)
        total_bytes += len(contents)
        if not contents or len(contents) > settings.max_upload_bytes or total_bytes > 20 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Each image must be under 10 MB and all photos together under 20 MB.")
        try:
            image = Image.open(BytesIO(contents))
            image.verify()
        except (UnidentifiedImageError, OSError, ValueError):
            raise HTTPException(status_code=415, detail="One of the selected files is not a valid image.") from None
        filename = f"{uuid4().hex}{IMAGE_SUFFIXES[content_type]}"
        photo_url = f"/api/incidents/{incident_id}/repair-photo/{filename}"
        await db.repair_photos.insert_one({"_id": filename, "incident_id": incident_id, "photo_content_type": content_type, "photo_data": contents})
        stored_photos.append({"photo_url": photo_url, "filename": filename})
    stored_videos = []
    total_video_bytes = 0
    for video in videos:
        content_type = (video.content_type or "").lower()
        if content_type not in VIDEO_SUFFIXES or content_type not in settings.allowed_video_types_list:
            raise HTTPException(status_code=415, detail="Choose MP4 or WEBM repair videos.")
        contents = await video.read(settings.max_video_upload_bytes + 1)
        total_video_bytes += len(contents)
        if not contents or len(contents) > settings.max_video_upload_bytes or total_video_bytes > 24 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Each video must be under 12 MB and all videos together under 24 MB.")
        valid_signature = (content_type == "video/mp4" and b"ftyp" in contents[:16]) or (content_type == "video/webm" and contents.startswith(b"\x1aE\xdf\xa3"))
        if not valid_signature:
            raise HTTPException(status_code=415, detail="One of the selected files is not a valid MP4 or WEBM video.")
        filename = f"{uuid4().hex}{VIDEO_SUFFIXES[content_type]}"
        video_url = f"/api/incidents/{incident_id}/repair-video/{filename}"
        await db.repair_videos.insert_one({"_id": filename, "incident_id": incident_id, "video_content_type": content_type, "video_data": contents})
        stored_videos.append(video_url)
    # Evidence is never marked as visually verified from text alone. A city
    # team lead must inspect the stored photo and explicitly approve closure.
    status_name = "MANUAL_REVIEW_REQUIRED"
    reason = "Repair evidence submitted. A city team lead must inspect the attached media and approve closure."

    now = datetime.now(timezone.utc)
    events = [
        append_timeline(incident, "REPAIR_SUBMITTED", "Repair evidence submitted.", "CITY_TEAM"),
        append_timeline(incident, status_name, reason, "REVIEW_SERVICE"),
    ]
    await db.incidents.update_one(
        {"_id": incident_id},
        {
            "$set": {
                "status": status_name,
                "repair_status": status_name,
                "repair_reason": reason,
                "repair_evidence": {
                    "after_description": after_description,
                    "location_match": True,
                    "photo_url": stored_photos[0]["photo_url"] if stored_photos else None,
                    "photos": [photo["photo_url"] for photo in stored_photos],
                    "videos": stored_videos,
                },
                "updated_at": now,
            },
            "$push": {"timeline": {"$each": events}},
        },
    )
    return {"status": status_name, "reason": reason, "requires_human_approval": True, "demo_mode": False}


@router.get("/{incident_id}/repair-photo/{filename}")
async def get_repair_photo(incident_id: str, filename: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    if not filename or Path(filename).name != filename:
        raise HTTPException(status_code=404, detail="Repair photo was not found.")
    stored = await db.repair_photos.find_one({"_id": filename, "incident_id": incident_id}, {"photo_data": 1, "photo_content_type": 1})
    if stored and stored.get("photo_data"):
        return Response(content=stored["photo_data"], media_type=stored.get("photo_content_type", "image/jpeg"), headers={"Cache-Control": "private, max-age=300"})
    incident = await db.incidents.find_one({"_id": incident_id}, {"repair_evidence": 1})
    evidence = (incident or {}).get("repair_evidence") or {}
    legacy_url = f"/api/incidents/{incident_id}/repair-photo/{filename}"
    if evidence.get("photo_url") == legacy_url and evidence.get("photo_data"):
        return Response(content=evidence["photo_data"], media_type=evidence.get("photo_content_type", "image/jpeg"), headers={"Cache-Control": "private, max-age=300"})
    raise HTTPException(status_code=404, detail="Repair photo was not found.")


@router.get("/{incident_id}/repair-video/{filename}")
async def get_repair_video(incident_id: str, filename: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    if not filename or Path(filename).name != filename:
        raise HTTPException(status_code=404, detail="Repair video was not found.")
    stored = await db.repair_videos.find_one({"_id": filename, "incident_id": incident_id}, {"video_data": 1, "video_content_type": 1})
    if not stored or not stored.get("video_data"):
        raise HTTPException(status_code=404, detail="Repair video was not found.")
    return Response(content=stored["video_data"], media_type=stored.get("video_content_type", "video/mp4"), headers={"Cache-Control": "private, max-age=300"})


@router.post("/{incident_id}/approve-resolution", dependencies=[Depends(require_city_team)])
async def approve_resolution(
    incident_id: str,
    payload: ResolutionApproval,
    db: AsyncIOMotorDatabase = Depends(get_db),
    staff: dict = Depends(require_city_team),
):
    incident = await get_incident(db, incident_id)
    ensure_department_access(staff, incident)
    if incident.repair_status not in {"VISUALLY_VERIFIED", "MANUAL_REVIEW_REQUIRED"}:
        raise HTTPException(status_code=409, detail="Submit repair evidence before approving closure.")
    evidence = incident.repair_evidence or {}
    if not evidence.get("photos") and not evidence.get("photo_url") and not evidence.get("videos"):
        raise HTTPException(status_code=409, detail="Upload and review after-repair photo or video evidence before approving closure.")
    event = append_timeline(incident, "CLOSED", payload.reason, payload.approved_by)
    await db.incidents.update_one(
        {"_id": incident_id},
        {
            "$set": {"status": "CLOSED", "updated_at": datetime.now(timezone.utc)},
            "$push": {"timeline": event},
        },
    )
    return {"incident_id": incident_id, "status": "CLOSED", "approved_by": payload.approved_by}
