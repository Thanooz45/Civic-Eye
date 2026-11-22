import asyncio
from copy import deepcopy
from io import BytesIO

from fastapi import UploadFile
from PIL import Image

from app.ai.schemas import IssueCategory
from app.api.public import public_incidents_geojson
from app.api.incidents import ResolutionApproval, StatusUpdate, approve_resolution, submit_repair_evidence, update_status
from app.api.reports import create_report, find_duplicate_candidates
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

    def find(self, query=None):
        query = query or {}
        return Cursor([doc for doc in self.documents.values() if self.matches(doc, query)])

    async def find_one(self, query):
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
        self.repair_photos = Collection()


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
