import asyncio
import json
from copy import deepcopy
from io import BytesIO
import pytest

from fastapi import UploadFile, HTTPException
from PIL import Image

from app.ai.schemas import IssueCategory
from app.api.public import public_incidents_geojson, public_stats
from app.api.incidents import (
    ResolutionApproval,
    StatusUpdate,
    TriageCorrection,
    ReopenRequest,
    approve_resolution,
    correct_triage,
    get_incident_detail,
    reopen_incident,
    submit_repair_evidence,
    update_status,
)
from app.api.reports import create_report, find_duplicate_candidates, get_report_audio, submit_report_with_evidence
from app.schemas.reports import CreateReportRequest


class Cursor:
    def __init__(self, documents):
        self.documents = documents

    def sort(self, fields):
        for field, direction in reversed(fields):
            self.documents.sort(key=lambda document: document.get(field), reverse=direction < 0)
        return self

    async def to_list(self, length=None):
        return deepcopy(self.documents if length is None else self.documents[:length])


class Collection:
    def __init__(self):
        self.documents = {}

    @staticmethod
    def matches(document, query):
        for key, expected in query.items():
            actual = document.get(key)
            if isinstance(expected, dict) and "$ne" in expected:
                if actual == expected["$ne"]:
                    return False
            elif actual != expected:
                return False
        return True

    def find(self, query=None, projection=None):
        query = query or {}
        return Cursor([doc for doc in self.documents.values() if self.matches(doc, query)])

    async def find_one(self, query, projection=None):
        return next((deepcopy(doc) for doc in self.documents.values() if self.matches(doc, query)), None)

    async def insert_one(self, document):
        self.documents[document["_id"]] = deepcopy(document)

    async def find_one_and_update(self, query, update, return_document=False):
        document = next((doc for doc in self.documents.values() if self.matches(doc, query)), None)
        if document is None:
            return None
        for key, value in update.get("$inc", {}).items():
            document[key] += value
        document.update(update.get("$set", {}))
        return deepcopy(document)

    async def update_one(self, query, update):
        document = next((doc for doc in self.documents.values() if self.matches(doc, query)), None)
        if document is None:
            return
        document.update(update.get("$set", {}))
        for key, value in update.get("$inc", {}).items():
            document[key] += value
        for key, value in update.get("$push", {}).items():
            if isinstance(value, dict) and "$each" in value:
                document.setdefault(key, []).extend(value["$each"])
            else:
                document.setdefault(key, []).append(value)

    async def count_documents(self, query):
        return sum(self.matches(doc, query) for doc in self.documents.values())


class Database:
    def __init__(self):
        self.incidents = Collection()
        self.citizen_reports = Collection()
        self.report_photos = Collection()
        self.report_videos = Collection()
        self.report_audios = Collection()
        self.repair_photos = Collection()
        self.repair_videos = Collection()


def test_reports_require_explicit_merge_and_public_map_rounds_coordinates():
    async def exercise():
        db = Database()
        first = await create_report(
            CreateReportRequest(
                category="POTHOLE",
                title="Deep pothole near Benz Circle",
                description_en="A deep pothole on the road near Benz Circle",
                latitude=16.5062,
                longitude=80.6480,
            ),
            db,
        )
        assert first.duplicate_linked is False
        assert first.report_count == 1

        candidates = await find_duplicate_candidates(
            category=IssueCategory.POTHOLE,
            latitude=16.5063,
            longitude=80.6480,
            db=db,
        )
        assert [candidate.incident_id for candidate in candidates] == [first.incident_id]
        assert candidates[0].distance_m % 10 == 0

        second = await create_report(
            CreateReportRequest(
                category="POTHOLE",
                title="Pothole still on the same road",
                description_en="A pothole on the road near the same junction",
                latitude=16.5063,
                longitude=80.6480,
                merge_incident_id=first.incident_id,
            ),
            db,
        )
        assert second.duplicate_linked is True
        assert second.report_count == 2
        assert await db.citizen_reports.count_documents({}) == 2
        assert await db.incidents.count_documents({}) == 1

        incident = await db.incidents.find_one({"_id": first.incident_id})
        incident["status"] = "CLOSED"
        await db.incidents.update_one({"_id": first.incident_id}, {"$set": {"status": "CLOSED"}})
        public_data = await public_incidents_geojson(db)
        feature = public_data["features"][0]
        assert feature["geometry"]["coordinates"] == [80.648, 16.506]
        assert "latitude" not in feature["properties"]
        assert "longitude" not in feature["properties"]

    asyncio.run(exercise())


def test_repair_recommendation_requires_human_approval_before_public_closure():
    async def exercise():
        db = Database()
        report = await create_report(
            CreateReportRequest(
                category="POTHOLE",
                title="Deep pothole near Benz Circle",
                description_en="A deep pothole on the road near Benz Circle",
                latitude=16.5062,
                longitude=80.6480,
            ),
            db,
        )

        await update_status(
            report.incident_id,
            StatusUpdate(status="ASSIGNED", reason="Department accepted the request.", actor="Priya Kumar"),
            db,
        )
        await update_status(
            report.incident_id,
            StatusUpdate(status="IN_PROGRESS", reason="Repair work started.", actor="Priya Kumar"),
            db,
        )

        image = BytesIO()
        Image.new("RGB", (16, 16), color="green").save(image, format="PNG")
        image.seek(0)
        submitted = await submit_repair_evidence(
            report.incident_id,
            after_description="The road surface is repaired and smooth after filling.",
            photos=[UploadFile(filename="repair.png", file=image, headers={"content-type": "image/png"})],
            videos=[],
            db=db,
        )
        assert submitted["status"] == "MANUAL_REVIEW_REQUIRED"
        assert submitted["requires_human_approval"] is True

        closed = await approve_resolution(
            report.incident_id,
            ResolutionApproval(
                    approved_by="Department Head",
                reason="Reviewed the repair evidence.",
            ),
            db,
        )
        assert closed["status"] == "CLOSED"
        timeline = (await db.incidents.find_one({"_id": report.incident_id}))["timeline"]
        assert next(event for event in timeline if event["event"] == "RECEIVED")["timestamp"]
        assert next(event for event in timeline if event["event"] == "ACCEPTED")["actor"] == "Priya Kumar"
        assert next(event for event in timeline if event["event"] == "WORK_STARTED")["timestamp"]
        assert next(event for event in timeline if event["event"] == "WORK_COMPLETED")["actor"] == "Department Head"
        public_data = await public_incidents_geojson(db)
        assert len(public_data["features"]) == 1

    asyncio.run(exercise())


def test_audio_evidence_is_stored_separately_and_private_to_staff():
    async def exercise():
        db = Database()
        audio_bytes = b"ID3\x03\x00\x00\x00\x00\x00#dummy_audio_data"
        payload_json = json.dumps({
            "category": "POLLUTION",
            "title": "Loud industrial noise at night",
            "description_en": "Industrial generator running with loud noise all night",
            "latitude": 16.5100,
            "longitude": 80.6500,
            "city": "Autonagar",
            "pollution_subtype": "NOISE",
        })
        audio_file = UploadFile(
            filename="noise.mp3",
            file=BytesIO(audio_bytes),
            headers={"content-type": "audio/mpeg"},
        )
        res = await submit_report_with_evidence(
            payload=payload_json,
            photos=[],
            videos=[],
            audios=[audio_file],
            db=db,
        )
        assert len(res["audio_urls"]) == 1
        audio_filename = res["audio_urls"][0].split("/")[-1]

        # Verify stored in separate collection, not inside incident
        stored = await db.report_audios.find_one({"_id": audio_filename})
        assert stored is not None
        assert stored["audio_content_type"] == "audio/mpeg"

        incident = await db.incidents.find_one({"_id": res["incident_id"]})
        assert incident["category"] == "POLLUTION"
        assert incident["department"] == "POLLUTION_CONTROL"
        assert incident["pollution_subtype"] == "NOISE"

        # Public detail does not expose audio
        public_detail = await get_incident_detail(res["incident_id"], db=db, staff=None)
        assert public_detail["audios"] == []

        # Staff detail exposes audio
        staff_user = {"sub": "Officer Rao", "role": "DEPARTMENT_HEAD"}
        staff_detail = await get_incident_detail(res["incident_id"], db=db, staff=staff_user)
        assert len(staff_detail["audios"]) == 1

        # Public audio endpoint rejected without staff auth
        with pytest.raises(HTTPException) as exc_info:
            await get_report_audio(audio_filename, db=db, staff=None)
        assert exc_info.value.status_code == 403

        # Staff audio endpoint serves the audio
        audio_resp = await get_report_audio(audio_filename, db=db, staff=staff_user)
        assert audio_resp.status_code == 200
        assert audio_resp.media_type == "audio/mpeg"

    asyncio.run(exercise())


def test_triage_correction_and_reopen():
    async def exercise():
        db = Database()
        report = await create_report(
            CreateReportRequest(
                category="POTHOLE",
                title="Pothole in residential lane",
                description_en="A deep pothole in the residential lane near market",
                latitude=16.5062,
                longitude=80.6480,
            ),
            db,
        )
        staff_user = {"sub": "Senior Engineer", "role": "DEPARTMENT_HEAD"}

        # Triage correction: category and department change
        corrected = await correct_triage(
            report.incident_id,
            TriageCorrection(
                category="DAMAGED_ROAD",
                reason="Inspection found extensive structural asphalt damage beyond a simple pothole.",
                actor="Senior Engineer",
            ),
            db=db,
            staff=staff_user,
        )
        assert corrected["category"] == "DAMAGED_ROAD"
        assert corrected["department"] == "ROADS_ENGINEERING"
        triage_event = next(e for e in corrected["timeline"] if e["event"] == "TRIAGE_CORRECTED")
        assert "Inspection found extensive structural asphalt damage" in triage_event["reason"]
        assert triage_event["actor"] == "Senior Engineer"

        # Now approve resolution to close
        img = BytesIO()
        Image.new("RGB", (16, 16), color="blue").save(img, format="PNG")
        img.seek(0)
        await submit_repair_evidence(
            report.incident_id,
            after_description="Repaved entire stretch with fresh bitumen.",
            photos=[UploadFile(filename="repair.png", file=img, headers={"content-type": "image/png"})],
            videos=[],
            db=db,
            staff=staff_user,
        )
        await approve_resolution(
            report.incident_id,
            ResolutionApproval(approved_by="Auditor", reason="Verified repair quality."),
            db=db,
            staff=staff_user,
        )
        closed_doc = await db.incidents.find_one({"_id": report.incident_id})
        assert closed_doc["status"] == "CLOSED"

        # Reopen incident with reason
        reopened = await reopen_incident(
            report.incident_id,
            ReopenRequest(
                reason="Citizen reports bitumen cracking again after rain; needs rework.",
                actor="Auditor",
            ),
            db=db,
            staff=staff_user,
        )
        assert reopened["status"] == "IN_PROGRESS"
        reopen_event = next(e for e in reopened["timeline"] if e["event"] == "REOPENED")
        assert "bitumen cracking again" in reopen_event["reason"]

        # Ensure closure event is still present in timeline
        assert any(e["event"] == "WORK_COMPLETED" for e in reopened["timeline"])

    asyncio.run(exercise())


def test_public_stats_metrics_and_filters():
    async def exercise():
        db = Database()
        # Seed 2 incidents: 1 closed, 1 open
        rep1 = await create_report(
            CreateReportRequest(
                category="GARBAGE",
                title="Overflowing trash bin",
                description_en="Overflowing trash bin on corner",
                latitude=16.52,
                longitude=80.62,
            ),
            db,
        )
        rep2 = await create_report(
            CreateReportRequest(
                category="POLLUTION",
                title="Dark smoke from incinerator",
                description_en="Incinerator running dense black smoke",
                latitude=16.53,
                longitude=80.63,
            ),
            db,
        )
        await db.incidents.update_one({"_id": rep1.incident_id}, {"$set": {"status": "CLOSED"}})

        stats = await public_stats(db=db)
        assert stats["total"] == 2
        assert stats["closed"] == 1
        assert stats["open"] == 1
        assert "GARBAGE" in stats["by_category"]
        assert "POLLUTION" in stats["by_category"]

        # Filter by category
        garbage_stats = await public_stats(category="GARBAGE", db=db)
        assert garbage_stats["total"] == 1
        assert garbage_stats["closed"] == 1
        assert garbage_stats["open"] == 0

    asyncio.run(exercise())
