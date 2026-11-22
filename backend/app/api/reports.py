from __future__ import annotations

from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse, Response
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument
from PIL import Image, UnidentifiedImageError

from app.ai.schemas import IssueCategory
from app.api.auth import optional_staff
from app.core.config import settings
from app.core.database import get_db
from app.models import CitizenReport, Incident
from app.schemas.reports import (
    AnalyzeReportRequest,
    CreateReportRequest,
    DuplicateCandidate,
    ReportCreated,
    ReportPreview,
)
from app.services.intelligence import (
    CATEGORY_DEPARTMENTS,
    SUPPORTED_REPORT_CATEGORIES,
    analyze_description,
    calculate_severity,
    corroboration_score,
    estimate_hazard,
    haversine_meters,
)
from app.services.ai_review import review_report

router = APIRouter()

IMAGE_SUFFIXES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
VIDEO_SUFFIXES = {"video/mp4": ".mp4", "video/webm": ".webm"}
AUDIO_SUFFIXES = {"audio/mpeg": ".mp3", "audio/wav": ".wav", "audio/ogg": ".ogg", "audio/mp4": ".m4a", "audio/webm": ".webm"}


@router.post("/submit-with-evidence", status_code=status.HTTP_201_CREATED)
async def submit_report_with_evidence(payload: str = Form(...), photos: list[UploadFile] = File(default=[]), videos: list[UploadFile] = File(default=[]), audios: list[UploadFile] = File(default=[]), db: AsyncIOMotorDatabase = Depends(get_db)):
    try:
        report_payload = CreateReportRequest.model_validate_json(payload)
    except Exception:
        raise HTTPException(status_code=422, detail="Report details are invalid.") from None
    if len(photos) > 5 or len(videos) > 3:
        raise HTTPException(status_code=422, detail="Attach up to 5 photos and 3 videos.")
    if len(audios) > 2:
        raise HTTPException(status_code=422, detail="Attach up to 2 audio files.")
    photo_data = []
    for photo in photos:
        content_type = (photo.content_type or "").lower()
        contents = await photo.read(settings.max_upload_bytes + 1)
        if content_type not in IMAGE_SUFFIXES or content_type not in settings.allowed_image_types_list or not contents or len(contents) > settings.max_upload_bytes:
            raise HTTPException(status_code=415, detail="Choose valid JPG, PNG, or WEBP photos under the size limit.")
        try:
            image = Image.open(BytesIO(contents)); image.verify()
        except (UnidentifiedImageError, OSError, ValueError):
            raise HTTPException(status_code=415, detail="One of the selected files is not a valid image.") from None
        photo_data.append((contents, content_type))
    video_data = []
    for video in videos:
        content_type = (video.content_type or "").lower(); contents = await video.read(settings.max_video_upload_bytes + 1)
        valid = (content_type == "video/mp4" and b"ftyp" in contents[:16]) or (content_type == "video/webm" and contents.startswith(b"\x1aE\xdf\xa3"))
        if content_type not in VIDEO_SUFFIXES or not contents or len(contents) > settings.max_video_upload_bytes or not valid:
            raise HTTPException(status_code=415, detail="Choose valid MP4 or WEBM videos under the size limit.")
        video_data.append((contents, content_type))
    audio_data = []
    for audio in audios:
        content_type = (audio.content_type or "").lower()
        contents = await audio.read(settings.max_upload_bytes + 1)
        if content_type not in AUDIO_SUFFIXES or not contents or len(contents) > settings.max_upload_bytes:
            raise HTTPException(status_code=415, detail="Choose valid audio files (MP3, WAV, OGG, M4A) under 10 MB each.")
        audio_data.append((contents, content_type))
    report = await create_report(report_payload, db)
    photo_urls, video_urls, audio_urls = [], [], []
    for contents, content_type in photo_data:
        filename = f"{uuid4().hex}{IMAGE_SUFFIXES[content_type]}"; url = f"/api/reports/photos/{filename}"
        await db.report_photos.insert_one({"_id":filename,"report_id":report.report_id,"photo_content_type":content_type,"photo_data":contents}); photo_urls.append(url)
    for contents, content_type in video_data:
        filename = f"{uuid4().hex}{VIDEO_SUFFIXES[content_type]}"; url = f"/api/reports/videos/{filename}"
        await db.report_videos.insert_one({"_id":filename,"report_id":report.report_id,"video_content_type":content_type,"video_data":contents}); video_urls.append(url)
    for contents, content_type in audio_data:
        filename = f"{uuid4().hex}{AUDIO_SUFFIXES[content_type]}"; url = f"/api/reports/audio/{filename}"
        await db.report_audios.insert_one({"_id":filename,"report_id":report.report_id,"audio_content_type":content_type,"audio_data":contents}); audio_urls.append(url)
    if photo_urls or video_urls or audio_urls:
        await db.citizen_reports.update_one({"_id":report.report_id},{"$set":{"photo_url":photo_urls[0] if photo_urls else None,"photo_urls":photo_urls,"video_urls":video_urls,"audio_urls":audio_urls}})
    return {**report.model_dump(mode="json"),"photo_urls":photo_urls,"video_urls":video_urls,"audio_urls":audio_urls}


@router.post("/{report_id}/photo")
async def upload_report_photo(
    report_id: str,
    photo: UploadFile = File(...),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Store a validated report photo and attach it to the citizen report."""
    report = await db.citizen_reports.find_one({"_id": report_id})
    if report is None:
        raise HTTPException(status_code=404, detail="Report was not found.")
    content_type = (photo.content_type or "").lower()
    if content_type not in IMAGE_SUFFIXES or content_type not in settings.allowed_image_types_list:
        raise HTTPException(status_code=415, detail="Choose a JPG, PNG, or WEBP image.")
    contents = await photo.read(settings.max_upload_bytes + 1)
    if not contents or len(contents) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail=f"Image must be smaller than {settings.MAX_UPLOAD_SIZE_MB} MB.")
    try:
        image = Image.open(BytesIO(contents))
        image.verify()
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(status_code=415, detail="The selected file is not a valid image.") from None

    filename = f"{uuid4().hex}{IMAGE_SUFFIXES[content_type]}"
    photo_url = f"/api/reports/photos/{filename}"
    await db.report_photos.insert_one({"_id": filename, "report_id": report_id, "photo_content_type": content_type, "photo_data": contents})
    await db.citizen_reports.update_one(
        {"_id": report_id},
        {"$set": {
            "photo_url": photo_url,
        }, "$push": {"photo_urls": photo_url}},
    )
    return {"report_id": report_id, "photo_url": photo_url}


@router.post("/{report_id}/video")
async def upload_report_video(
    report_id: str,
    video: UploadFile = File(...),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if await db.citizen_reports.find_one({"_id": report_id}) is None:
        raise HTTPException(status_code=404, detail="Report was not found.")
    content_type = (video.content_type or "").lower()
    if content_type not in VIDEO_SUFFIXES or content_type not in settings.allowed_video_types_list:
        raise HTTPException(status_code=415, detail="Choose an MP4 or WEBM video.")
    contents = await video.read(settings.max_video_upload_bytes + 1)
    if not contents or len(contents) > settings.max_video_upload_bytes:
        raise HTTPException(status_code=413, detail=f"Each video must be smaller than {settings.MAX_VIDEO_SIZE_MB} MB.")
    valid_signature = (content_type == "video/mp4" and b"ftyp" in contents[:16]) or (content_type == "video/webm" and contents.startswith(b"\x1aE\xdf\xa3"))
    if not valid_signature:
        raise HTTPException(status_code=415, detail="The selected file is not a valid MP4 or WEBM video.")
    filename = f"{uuid4().hex}{VIDEO_SUFFIXES[content_type]}"
    video_url = f"/api/reports/videos/{filename}"
    await db.report_videos.insert_one({"_id": filename, "report_id": report_id, "video_content_type": content_type, "video_data": contents})
    await db.citizen_reports.update_one({"_id": report_id}, {"$push": {"video_urls": video_url}})
    return {"report_id": report_id, "video_url": video_url}


@router.get("/photos/{filename}")
async def get_report_photo(filename: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    if not filename or Path(filename).name != filename:
        raise HTTPException(status_code=404, detail="Photo was not found.")
    photo_path = Path(settings.UPLOAD_DIR).resolve() / "report_photos" / filename
    media_type = {".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}.get(photo_path.suffix)
    if not media_type:
        raise HTTPException(status_code=404, detail="Photo was not found.")
    report = await db.citizen_reports.find_one(
        {"photo_url": f"/api/reports/photos/{filename}"},
        {"photo_data": 1, "photo_content_type": 1},
    )
    stored = await db.report_photos.find_one({"_id": filename}, {"photo_data": 1, "photo_content_type": 1})
    if stored and stored.get("photo_data"):
        return Response(content=stored["photo_data"], media_type=stored.get("photo_content_type") or media_type, headers={"Cache-Control": "private, max-age=300"})
    if report and report.get("photo_data"):
        return Response(
            content=report["photo_data"],
            media_type=report.get("photo_content_type") or media_type,
            headers={"Cache-Control": "private, max-age=300"},
        )
    # Keep older local uploads readable after migrating to database-backed photos.
    if not photo_path.is_file():
        raise HTTPException(status_code=404, detail="Photo was not found.")
    return FileResponse(photo_path, media_type=media_type)


@router.get("/videos/{filename}")
async def get_report_video(filename: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    if not filename or Path(filename).name != filename:
        raise HTTPException(status_code=404, detail="Video was not found.")
    stored = await db.report_videos.find_one({"_id": filename}, {"video_data": 1, "video_content_type": 1})
    if not stored or not stored.get("video_data"):
        raise HTTPException(status_code=404, detail="Video was not found.")
    return Response(content=stored["video_data"], media_type=stored.get("video_content_type", "video/mp4"), headers={"Cache-Control": "private, max-age=300"})


@router.get("/audio/{filename}")
async def get_report_audio(filename: str, db: AsyncIOMotorDatabase = Depends(get_db), staff: Optional[dict] = Depends(optional_staff)):
    """Serve citizen-submitted audio evidence. Staff-only: not exposed through public map or outcomes."""
    if not filename or Path(filename).name != filename:
        raise HTTPException(status_code=404, detail="Audio was not found.")
    if staff is None:
        raise HTTPException(status_code=403, detail="Audio evidence is only accessible to authorized city staff.")
    stored = await db.report_audios.find_one({"_id": filename}, {"audio_data": 1, "audio_content_type": 1})
    if not stored or not stored.get("audio_data"):
        raise HTTPException(status_code=404, detail="Audio was not found.")
    return Response(content=stored["audio_data"], media_type=stored.get("audio_content_type", "audio/mpeg"), headers={"Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff"})


@router.post("/analyze", response_model=ReportPreview)
async def analyze_report(payload: AnalyzeReportRequest):
    analysis, provider = await review_report(payload.description, payload.input_language)
    severity = calculate_severity(analysis.hazard_severity)
    notice = "Automated classification is a recommendation. Review it before submitting."
    if not analysis.is_valid_civic_issue:
        notice += " The description is unclear and requires human review."
    return ReportPreview(analysis=analysis, severity=severity, provider=provider, notice=notice)


@router.get("/duplicates", response_model=list[DuplicateCandidate])
async def find_duplicate_candidates(
    category: IssueCategory,
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    documents = await db.incidents.find(
        {"category": category.value, "status": {"$ne": "CLOSED"}}
    ).to_list(length=None)
    candidates = []
    for document in documents:
        incident = Incident.from_document(document)
        distance = haversine_meters(latitude, longitude, incident.latitude, incident.longitude)
        if distance <= settings.DEDUP_RADIUS_METERS:
            candidates.append(
                DuplicateCandidate(
                    incident_id=incident.id,
                    incident_code=incident.incident_code,
                    category=incident.category,
                    title=incident.title,
                    distance_m=round(distance / 10) * 10,
                )
            )
    return sorted(candidates, key=lambda candidate: candidate.distance_m)


@router.post("", response_model=ReportCreated, status_code=status.HTTP_201_CREATED)
async def create_report(payload: CreateReportRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    try:
        category = IssueCategory(payload.category)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Unsupported issue category.") from exc

    if category not in SUPPORTED_REPORT_CATEGORIES and category != IssueCategory.OTHER:
        raise HTTPException(status_code=422, detail="This issue category is not currently supported.")

    report_count = 1
    duplicate_linked = False
    report_analysis = analyze_description(payload.description_en, payload.input_language)
    needs_review = (
        not report_analysis.is_valid_civic_issue or report_analysis.category != category
    )
    incident = None
    if payload.merge_incident_id:
        document = await db.incidents.find_one({"_id": payload.merge_incident_id})
        if document is None:
            raise HTTPException(status_code=404, detail="Duplicate candidate was not found.")
        incident = Incident.from_document(document)
        distance = haversine_meters(
            payload.latitude, payload.longitude, incident.latitude, incident.longitude
        )
        if (
            incident.category != category.value
            or incident.status == "CLOSED"
            or distance > settings.DEDUP_RADIUS_METERS
        ):
            raise HTTPException(
                status_code=409,
                detail="The selected incident is not an eligible same-category nearby candidate.",
            )
        updated = await db.incidents.find_one_and_update(
            {"_id": incident.id, "status": {"$ne": "CLOSED"}},
            {"$inc": {"report_count": 1}, "$set": {"updated_at": datetime.now(timezone.utc)}},
            return_document=ReturnDocument.AFTER,
        )
        if updated is None:
            raise HTTPException(status_code=409, detail="The selected incident is no longer open.")
        incident = Incident.from_document(updated)
        report_count = incident.report_count
        duplicate_linked = True
        severity = calculate_severity(
            estimate_hazard(category, incident.description_en),
            corroboration=corroboration_score(report_count),
        )
        await db.incidents.update_one(
            {"_id": incident.id},
            {"$set": {
                "severity_score": severity.final_score,
                "priority": severity.priority.value,
                "score_breakdown": severity.model_dump(mode="json"),
            }},
        )
        incident.severity_score = severity.final_score
        incident.priority = severity.priority.value
        incident.score_breakdown = severity.model_dump(mode="json")
    else:
        severity = calculate_severity(
            estimate_hazard(category, payload.description_en),
            corroboration=corroboration_score(report_count),
        )
        now = datetime.now(timezone.utc)
        initial_timeline = [
            {
                "from": "",
                "to": "SUBMITTED",
                "event": "RECEIVED",
                "reason": "A resident submitted this request.",
                "actor": "Resident",
                "timestamp": now.isoformat(),
            },
            {
                "from": "SUBMITTED",
                "to": "NEEDS_REVIEW" if needs_review else "SUBMITTED",
                "event": "ROUTED",
                "reason": f"Request routed to {CATEGORY_DEPARTMENTS[category].value}.",
                "actor": "Civic Eye routing",
                "department": CATEGORY_DEPARTMENTS[category].value,
                "timestamp": now.isoformat(),
            },
        ]
        incident = Incident(
            incident_code=f"CIVIC-{now.year}-{uuid4().hex[:8].upper()}",
            category=category.value,
            pollution_subtype=payload.pollution_subtype if category == IssueCategory.POLLUTION else None,
            title=payload.title,
            description_en=payload.description_en,
            latitude=payload.latitude,
            longitude=payload.longitude,
            city=(payload.city or "Not specified").strip() or "Not specified",
            department=CATEGORY_DEPARTMENTS[category].value,
            status="NEEDS_REVIEW" if needs_review else "SUBMITTED",
            priority=severity.priority.value,
            severity_score=severity.final_score,
            score_breakdown=severity.model_dump(mode="json"),
            report_count=1,
            sla_due_at=now + timedelta(hours=severity.sla_hours),
            timeline=initial_timeline,
        )
        await db.incidents.insert_one(incident.to_document())

    report = CitizenReport(
        incident_id=incident.id,
        input_language=payload.input_language,
        original_transcript=payload.original_transcript,
        description_en=payload.description_en,
    )
    await db.citizen_reports.insert_one(report.to_document())
    return ReportCreated(
        report_id=report.id,
        incident_id=incident.id,
        incident_code=incident.incident_code,
        status=incident.status,
        report_count=report_count,
        duplicate_linked=duplicate_linked,
        is_demo=False,
        needs_review=needs_review,
        category=incident.category,
        latitude=incident.latitude,
        longitude=incident.longitude,
        city=incident.city,
    )
