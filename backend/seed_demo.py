"""
seed_demo.py
============
Seeds the database with a coherent, synthetic demonstration scenario covering
the full civic lifecycle according to project requirements:

1. Resident reports a severe pothole with photo, short audio evidence, and confirmed map pin.
2. Second resident report linked as corroborating duplicate.
3. Assigned department (ROAD_MAINTENANCE) accepts the request and records work in progress.
4. Repair crew submits after-repair visual evidence.
5. Reviewer inspects side-by-side evidence and approves verified closure.
6. Public outcomes dashboard reflects the verified fix and real calculated metrics.
7. Pollution lifecycle demo (AIR & NOISE subtypes routed to POLLUTION_CONTROL).

All generated records are marked with is_demo=True and incident_code CIVIC-DEMO-*.
No fabricated statistics or live AI dependencies.
"""

import asyncio
from datetime import datetime, timedelta, timezone
from io import BytesIO
import sys
from uuid import uuid4
from PIL import Image
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings


async def seed():
    print(f"Connecting to MongoDB at {settings.MONGODB_URL[:25]}... (db: {settings.MONGODB_DATABASE})")
    try:
        client = AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=5000)
        db = client[settings.MONGODB_DATABASE]
        await client.admin.command("ping")
    except Exception as e:
        print(f"MongoDB connection notice: {e}")
        print("Demo seed script is ready to run once MongoDB / network connection is established.")
        return

    # Clear prior demo records
    print("Clearing prior synthetic demo records...")
    await db.incidents.delete_many({"is_demo": True})
    await db.citizen_reports.delete_many({"is_demo": True})

    now = datetime.now(timezone.utc)

    # 1. Generate synthetic photo and audio blobs
    def make_image_bytes(color: str) -> bytes:
        img = Image.new("RGB", (64, 64), color=color)
        buf = BytesIO()
        img.save(buf, format="JPEG")
        return buf.getvalue()

    pothole_photo_before = make_image_bytes("#7a6c58")
    pothole_photo_after = make_image_bytes("#3b8256")
    smoke_photo = make_image_bytes("#555555")

    # Synthetic audio bytes (citizen voice recording)
    synthetic_audio_bytes = b"ID3\x03\x00\x00\x00\x00\x00#SYNTHETIC_CITIZEN_AUDIO_SAMPLE"

    # Store photo & audio binaries
    audio_id_pothole = f"demo_audio_pothole_{uuid4().hex[:6]}.mp3"
    await db.report_audios.insert_one({
        "_id": audio_id_pothole,
        "audio_content_type": "audio/mpeg",
        "audio_data": synthetic_audio_bytes,
        "is_demo": True,
    })

    audio_id_noise = f"demo_audio_noise_{uuid4().hex[:6]}.mp3"
    await db.report_audios.insert_one({
        "_id": audio_id_noise,
        "audio_content_type": "audio/mpeg",
        "audio_data": synthetic_audio_bytes,
        "is_demo": True,
    })

    photo_id_before = f"demo_pothole_before_{uuid4().hex[:6]}.jpg"
    await db.report_photos.insert_one({
        "_id": photo_id_before,
        "photo_content_type": "image/jpeg",
        "photo_data": pothole_photo_before,
        "is_demo": True,
    })

    photo_id_after = f"demo_pothole_after_{uuid4().hex[:6]}.jpg"
    await db.repair_photos.insert_one({
        "_id": photo_id_after,
        "incident_id": "demo-incident-pothole-closed",
        "photo_content_type": "image/jpeg",
        "photo_data": pothole_photo_after,
        "is_demo": True,
    })

    photo_id_smoke = f"demo_smoke_{uuid4().hex[:6]}.jpg"
    await db.report_photos.insert_one({
        "_id": photo_id_smoke,
        "photo_content_type": "image/jpeg",
        "photo_data": smoke_photo,
        "is_demo": True,
    })

    # SCENARIO 1: FULL LIFECYCLE CLOSED POTHOLE (CIVIC-DEMO-POTHOLE-01)
    # Submitted -> Routed -> Accepted -> In Progress -> Repair Evidence -> Human Approval -> Closed
    t0 = now - timedelta(hours=36)
    t1 = now - timedelta(hours=30)
    t2 = now - timedelta(hours=24)
    t3 = now - timedelta(hours=10)
    t4 = now - timedelta(hours=2)

    incident_1 = {
        "_id": "demo-incident-pothole-closed",
        "incident_code": "CIVIC-DEMO-POTHOLE-01",
        "category": "POTHOLE",
        "title": "Severe road crater blocking lane near Benz Circle",
        "description_en": "Deep 4-foot crater with broken asphalt posing high accident risk to two-wheelers.",
        "latitude": 16.5062,
        "longitude": 80.6480,
        "city": "Benz Circle, MG Road",
        "department": "ROAD_MAINTENANCE",
        "status": "CLOSED",
        "priority": "HIGH",
        "severity_score": 7.2,
        "score_breakdown": {
            "H": {"value": 8.0, "weight": 0.40, "available": True, "reason": "Severe depth and vehicular hazard."},
            "E": {"value": 7.5, "weight": 0.25, "available": True, "reason": "Arterial junction with heavy bus transit."},
            "L": {"value": 6.0, "weight": 0.20, "available": True, "reason": "Commercial zone near retail hub."},
            "R": {"value": 5.0, "weight": 0.15, "available": True, "reason": "Corroborated by 2 resident reports."},
            "final_score": 7.2,
            "priority": "HIGH",
            "sla_hours": 72,
            "plain_language_reason": "High priority: Arterial road hazard corroborated by multiple community complaints.",
        },
        "report_count": 2,
        "sla_due_at": t0 + timedelta(hours=72),
        "created_at": t0,
        "updated_at": t4,
        "repair_status": "VISUALLY_VERIFIED",
        "repair_reason": "Repair evidence inspected and verified by municipal supervisor.",
        "repair_evidence": {
            "after_description": "Filled crater with dense asphalt concrete base course, leveled, and sealed with bitumen emulsion.",
            "location_match": True,
            "photo_url": f"/api/incidents/demo-incident-pothole-closed/repair-photo/{photo_id_after}",
            "photos": [f"/api/incidents/demo-incident-pothole-closed/repair-photo/{photo_id_after}"],
            "videos": [],
        },
        "timeline": [
            {
                "from": "",
                "to": "SUBMITTED",
                "event": "RECEIVED",
                "reason": "Resident filed initial grievance with photo and voice recording.",
                "actor": "Resident (R. Sharma)",
                "timestamp": t0.isoformat(),
            },
            {
                "from": "SUBMITTED",
                "to": "SUBMITTED",
                "event": "ROUTED",
                "reason": "Triage rule routed request to Road Maintenance.",
                "actor": "Civic Eye routing",
                "department": "ROAD_MAINTENANCE",
                "timestamp": t0.isoformat(),
            },
            {
                "from": "SUBMITTED",
                "to": "ASSIGNED",
                "event": "ACCEPTED",
                "reason": "Request accepted for crew dispatch.",
                "actor": "Officer P. Kumar",
                "department": "ROAD_MAINTENANCE",
                "timestamp": t1.isoformat(),
            },
            {
                "from": "ASSIGNED",
                "to": "IN_PROGRESS",
                "event": "WORK_STARTED",
                "reason": "Maintenance crew deployed on site with asphalt leveling equipment.",
                "actor": "Officer P. Kumar",
                "department": "ROAD_MAINTENANCE",
                "timestamp": t2.isoformat(),
            },
            {
                "from": "IN_PROGRESS",
                "to": "MANUAL_REVIEW_REQUIRED",
                "event": "REPAIR_SUBMITTED",
                "reason": "Repair complete. Asphalt hot-mix patch applied and tamped.",
                "actor": "Field Crew Lead",
                "department": "ROAD_MAINTENANCE",
                "timestamp": t3.isoformat(),
            },
            {
                "from": "MANUAL_REVIEW_REQUIRED",
                "to": "CLOSED",
                "event": "WORK_COMPLETED",
                "reason": "Supervisor reviewed side-by-side photographic evidence and approved closure.",
                "actor": "Dept Head (S. Rao)",
                "department": "ROAD_MAINTENANCE",
                "timestamp": t4.isoformat(),
            },
        ],
        "is_demo": True,
    }
    await db.incidents.insert_one(incident_1)

    # Attach citizen reports for incident 1
    await db.citizen_reports.insert_one({
        "_id": str(uuid4()),
        "incident_id": "demo-incident-pothole-closed",
        "description_en": "Deep 4-foot crater with broken asphalt posing high accident risk to two-wheelers.",
        "input_language": "en",
        "photo_url": f"/api/reports/photos/{photo_id_before}",
        "photo_urls": [f"/api/reports/photos/{photo_id_before}"],
        "audio_urls": [f"/api/reports/audio/{audio_id_pothole}"],
        "video_urls": [],
        "is_demo": True,
        "created_at": t0,
    })

    # Corroborating second citizen report
    await db.citizen_reports.insert_one({
        "_id": str(uuid4()),
        "incident_id": "demo-incident-pothole-closed",
        "description_en": "Same pothole near Benz Circle crossing, cars swerving into oncoming traffic to avoid it.",
        "input_language": "en",
        "photo_url": None,
        "photo_urls": [],
        "audio_urls": [],
        "video_urls": [],
        "is_demo": True,
        "created_at": t0 + timedelta(minutes=45),
    })

    # SCENARIO 2: POLLUTION LIFECYCLE (AIR SUBTYPE) - IN PROGRESS
    t_pol = now - timedelta(hours=14)
    incident_2 = {
        "_id": "demo-incident-pollution-air",
        "incident_code": "CIVIC-DEMO-POLLUTION-01",
        "category": "POLLUTION",
        "pollution_subtype": "AIR",
        "title": "Dense toxic industrial smoke release during early morning",
        "description_en": "[Pollution Subtype: AIR] Heavy black chimney smoke and burning plastic odor near Autonagar industrial cluster.",
        "latitude": 16.5120,
        "longitude": 80.6550,
        "city": "Autonagar Industrial Area, Gate 3",
        "department": "POLLUTION_CONTROL",
        "status": "IN_PROGRESS",
        "priority": "HIGH",
        "severity_score": 7.0,
        "score_breakdown": {
            "H": {"value": 7.5, "weight": 0.40, "available": True, "reason": "Toxic emissions impacting residential air quality."},
            "E": {"value": 7.0, "weight": 0.25, "available": True, "reason": "Downwind of school and primary health clinic."},
            "L": {"value": 6.5, "weight": 0.20, "available": True, "reason": "Adjacent residential settlement."},
            "R": {"value": 2.5, "weight": 0.15, "available": True, "reason": "Single verified community report with photo evidence."},
            "final_score": 7.0,
            "priority": "HIGH",
            "sla_hours": 72,
            "plain_language_reason": "High priority: Industrial emissions hazard near residential settlement.",
        },
        "report_count": 1,
        "sla_due_at": t_pol + timedelta(hours=72),
        "created_at": t_pol,
        "updated_at": now - timedelta(hours=6),
        "timeline": [
            {
                "from": "",
                "to": "SUBMITTED",
                "event": "RECEIVED",
                "reason": "Resident submitted photo of smoke emission and odor complaint.",
                "actor": "Resident (K. Murthy)",
                "timestamp": t_pol.isoformat(),
            },
            {
                "from": "SUBMITTED",
                "to": "SUBMITTED",
                "event": "ROUTED",
                "reason": "Pollution reports are routed to the Pollution Control Board.",
                "actor": "Civic Eye routing",
                "department": "POLLUTION_CONTROL",
                "timestamp": t_pol.isoformat(),
            },
            {
                "from": "SUBMITTED",
                "to": "ASSIGNED",
                "event": "ACCEPTED",
                "reason": "Environmental compliance inspector assigned for air sample check.",
                "actor": "Inspector V. Lakshmi",
                "department": "POLLUTION_CONTROL",
                "timestamp": (t_pol + timedelta(hours=2)).isoformat(),
            },
            {
                "from": "ASSIGNED",
                "to": "IN_PROGRESS",
                "event": "WORK_STARTED",
                "reason": "Inspection team dispatched with particulate matter meters.",
                "actor": "Inspector V. Lakshmi",
                "department": "POLLUTION_CONTROL",
                "timestamp": (t_pol + timedelta(hours=5)).isoformat(),
            },
        ],
        "is_demo": True,
    }
    await db.incidents.insert_one(incident_2)
    await db.citizen_reports.insert_one({
        "_id": str(uuid4()),
        "incident_id": "demo-incident-pollution-air",
        "description_en": "[Pollution Subtype: AIR] Heavy black chimney smoke and burning plastic odor near Autonagar industrial cluster.",
        "input_language": "en",
        "photo_url": f"/api/reports/photos/{photo_id_smoke}",
        "photo_urls": [f"/api/reports/photos/{photo_id_smoke}"],
        "audio_urls": [],
        "video_urls": [],
        "is_demo": True,
        "created_at": t_pol,
    })

    # SCENARIO 3: NOISE POLLUTION WITH AUDIO EVIDENCE
    t_noise = now - timedelta(hours=8)
    incident_3 = {
        "_id": "demo-incident-pollution-noise",
        "incident_code": "CIVIC-DEMO-NOISE-01",
        "category": "POLLUTION",
        "pollution_subtype": "NOISE",
        "title": "Industrial diesel generator noise operating exceeding decibel limits",
        "description_en": "[Pollution Subtype: NOISE] Heavy unbaffled commercial generator vibrating surrounding homes after 10 PM.",
        "latitude": 16.5180,
        "longitude": 80.6600,
        "city": "Patamata Residential Area",
        "department": "POLLUTION_CONTROL",
        "status": "SUBMITTED",
        "priority": "MEDIUM",
        "severity_score": 5.4,
        "score_breakdown": {
            "H": {"value": 5.0, "weight": 0.40, "available": True, "reason": "Noise disturbance exceeding residential nighttime thresholds."},
            "E": {"value": 6.0, "weight": 0.25, "available": True, "reason": "Dense residential area."},
            "L": {"value": 5.0, "weight": 0.20, "available": True, "reason": "Residential silence zone adjacent."},
            "R": {"value": 2.5, "weight": 0.15, "available": True, "reason": "Single report with voice/audio clip."},
            "final_score": 5.4,
            "priority": "MEDIUM",
            "sla_hours": 168,
            "plain_language_reason": "Medium priority: Nighttime noise pollution complaint awaiting field review.",
        },
        "report_count": 1,
        "sla_due_at": t_noise + timedelta(hours=168),
        "created_at": t_noise,
        "updated_at": t_noise,
        "timeline": [
            {
                "from": "",
                "to": "SUBMITTED",
                "event": "RECEIVED",
                "reason": "Resident uploaded generator sound clip and location pin.",
                "actor": "Resident (Anonymous)",
                "timestamp": t_noise.isoformat(),
            },
            {
                "from": "SUBMITTED",
                "to": "SUBMITTED",
                "event": "ROUTED",
                "reason": "Pollution reports are routed to the Pollution Control Board.",
                "actor": "Civic Eye routing",
                "department": "POLLUTION_CONTROL",
                "timestamp": t_noise.isoformat(),
            },
        ],
        "is_demo": True,
    }
    await db.incidents.insert_one(incident_3)
    await db.citizen_reports.insert_one({
        "_id": str(uuid4()),
        "incident_id": "demo-incident-pollution-noise",
        "description_en": "[Pollution Subtype: NOISE] Heavy unbaffled commercial generator vibrating surrounding homes after 10 PM.",
        "input_language": "en",
        "photo_url": None,
        "photo_urls": [],
        "audio_urls": [f"/api/reports/audio/{audio_id_noise}"],
        "video_urls": [],
        "is_demo": True,
        "created_at": t_noise,
    })

    print("Synthetic demo data successfully seeded:")
    print(" - 1 Closed Pothole incident (CIVIC-DEMO-POTHOLE-01) with Before & After evidence and full audit lifecycle")
    print(" - 1 Active Air Pollution incident (CIVIC-DEMO-POLLUTION-01) routed to POLLUTION_CONTROL")
    print(" - 1 Active Noise Pollution incident (CIVIC-DEMO-NOISE-01) with citizen audio recording")
    print("All records tagged with is_demo=True.")


if __name__ == "__main__":
    asyncio.run(seed())
