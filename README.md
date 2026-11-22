# Civic Eye

**Transparent Civic Grievance & Infrastructure Triage System.**
Citizens report problems like damaged roads, pollution, or water leaks using photos, videos, or audio. The system rates seriousness, routes reports to the right authority, and shows a public dashboard of complaints and fixes.

---

## Live services

- **Web app:** [civic-eye-zeta.vercel.app](https://civic-eye-zeta.vercel.app/)
- **API:** [civic-eye-oviv.onrender.com](https://civic-eye-oviv.onrender.com/)
- **API health:** [`/health`](https://civic-eye-oviv.onrender.com/health)
- **Interactive API docs:** [`/api/docs`](https://civic-eye-oviv.onrender.com/api/docs)

---

## Key Features & Architectural Capabilities

### 1. Audio Evidence Without AI
- **Browser recording & file upload:** Citizens can record up to 60 seconds of audio directly from their browser microphone or upload sound files (MP3, WAV, OGG, M4A, WEBM; up to 2 files, 10 MB limit each).
- **Separate binary storage:** Stored separately in MongoDB's `report_audios` collection to prevent incident documents from exceeding BSON document size limits.
- **Privacy & staff-only access:** Audio evidence is served strictly via authenticated endpoints (`GET /api/reports/audio/{filename}`) accessible only to logged-in city staff. Audio is never exposed on public maps or public outcomes.
- **Deliberately not AI-powered:** Audio is preserved as verbatim citizen-submitted evidence without AI transcription, classification, or spoof-prone analysis.

### 2. Pollution Reporting & Triage Workflow
- **Pollution categories & subtypes:** Dedicated support for `POLLUTION` grievances with subtypes:
  - `AIR` (Smoke, toxic industrial fumes, burning plastic, dust, odor)
  - `WATER` (Chemical effluents, canal/waterway contamination)
  - `NOISE` (Generators, machinery, nighttime industrial noise)
  - `OTHER` (General environmental contamination)
- **Useful context:** Captures occurrence time, ongoing status, and nearest landmark.
- **Configurable department routing:** Automatically routes pollution reports to `POLLUTION_CONTROL` (with documented `GENERAL` review fallback).
- **Deterministic rule-based classifier:** Fallback classifier categorizes pollution reports and explains routing rationale without requiring external AI credentials.

### 3. Severity & Routing Transparency
- **Transparent scoring formula:**
  $$\text{Score} = 0.40 \cdot H + 0.25 \cdot E + 0.20 \cdot L + 0.15 \cdot R$$
  - $H$ = Hazard severity
  - $E$ = Exposure (traffic/pedestrian volume)
  - $L$ = Location sensitivity (schools, hospitals)
  - $R$ = Corroboration score (diminishing-returns logarithmic scale for duplicate reports)
- **Plain-language explanation:** Resident review card and staff queue display which scoring inputs were available vs. unavailable.
- **Estimates, not promises:** Service targets are visibly labeled as estimates based on priority rating, not guaranteed completion dates.
- **Staff triage correction:** Authorized staff can correct category, department, or priority via `PATCH /api/incidents/{id}/triage`, requiring a mandatory reason and recording every change in the timeline audit trail. Scores never auto-reject or close complaints without human review.

### 4. Location & Submission Reliability
- **Dual location capture:** One-click GPS geolocation with automatic fallback to manual interactive map pin placement (Leaflet) and nearby address/landmark input.
- **Confirmation before submission:** Selected coordinates and neighborhood are prominently displayed before final submit.
- **Zero AI dependency for report submission:** If external AI providers are unavailable, invalid, or unconfigured, the system automatically falls back to deterministic rule classification, labels the result clearly as a rule suggestion, and allows submission to proceed.
- **Official submission receipt:** Upon submission, citizens receive an official receipt card showing the unique incident code (`CIVIC-2026-XXXXXXXX`), category, location, status, audio playback verification, and clear next steps.
- **Idempotent error handling:** Submission errors clearly indicate what failed and confirm whether the report was saved to the database.

### 5. Resolution Proof & Accountability
- **Before & After side-by-side evidence:** Original citizen report media and department repair photos/videos are displayed side-by-side in staff review screens for visual audit.
- **Human-approved closure:** Incidents cannot be closed automatically. A supervisor must inspect the repair evidence, enter their name and review rationale, and explicitly approve closure.
- **Reopen action:** If a repair fails or an issue recurs, authorized staff can reopen closed incidents via `POST /api/incidents/{id}/reopen`. Prior timeline and closure history are preserved.
- **Real public outcomes metrics:** The public dashboard displays live statistics calculated from actual database records:
  - Total community complaints, open issues, and verified closures
  - Overdue service targets (incidents open beyond SLA estimate)
  - Average time-to-resolution (hours calculated from closure audit)
  - Volume breakdown by category and department
  - Date range and category filters
- **Privacy preservation:** Public endpoints round GPS coordinates to 3 decimal places (~110 m precision) and never expose citizen identities, phone numbers, private messages, or audio.

### 6. Synthetic Demo Lifecycle (`seed_demo.py`)
Run the synthetic seed script to demonstrate the full civic grievance lifecycle:
```bash
cd backend
.venv/bin/python seed_demo.py
```
This generates:
1. `CIVIC-DEMO-POTHOLE-01`: Fully resolved pothole with original photo, citizen voice recording, duplicate report corroboration, department acceptance, work start, repair photos, and supervisor closure approval.
2. `CIVIC-DEMO-POLLUTION-01`: Active industrial air pollution incident routed to Pollution Control.
3. `CIVIC-DEMO-NOISE-01`: Nighttime generator noise complaint with citizen audio evidence.

All demo data is labeled `is_demo=True` and kept out of production records.

---

## AI Limitations & Non-AI Design Choices

| Feature | Implementation | Why No AI Used |
| :--- | :--- | :--- |
| **Photo / Video Detection** | Citizen upload + human supervisor review | Visual AI is prone to hallucinations and blocked by provider issues; human oversight is legally required for municipal repairs. |
| **Audio Evidence** | Verbatim audio binary storage & staff playback | No automated transcription or speech analysis; audio is treated as direct citizen testimony. |
| **Incident Closure** | Human supervisor approval button with audit reason | Automated systems must never close or reject complaints without human responsibility. |
| **Text Review (Optional)** | Local deterministic rules + optional LLM assist | System remains 100% operational with deterministic keyword rules when AI credentials are empty or offline. |

---

## Department Access Codes

Staff access codes are confidential server-side secrets configured in `backend/.env`.

In local demo mode (e.g., `?demo=true` or `VITE_DEMO_MODE=true`), the following reference codes are available:

| Department / Role | Demo Access Code | Scope |
| :--- | :--- | :--- |
| **Head of all departments** | `cityteamaccess101` | Citywide queue, triage correction, closure approval |
| **Road Maintenance** | `roadmaintenance101` | Potholes, street surface maintenance |
| **Roads Engineering** | `roadsengineering101` | Structural road repairs, bridges |
| **Municipal Sanitation** | `municipalsanitation101` | Waste collection, street sweeping, dump sites |
| **Water Supply** | `watersupplyaccess101` | Pipe leaks, municipal water distribution |
| **Drainage** | `drainageaccess101` | Open drains, manhole covers, stormwater |
| **Electrical Maintenance** | `electricalmaintenance101` | Streetlights, traffic lights |
| **Pollution Control Board** | `pollutioncontrol101` | Air, water, industrial & noise pollution |
| **General Services** | `generalservices101` | Unclassified civic complaints |

---

## Project Structure

```text
frontend/                 React + Vite web app (JSX)
  src/components/         IssueDetail (Side-by-side, Reopen, Triage), WorkflowPanel, Kpi
  src/pages/              ReportForm (Audio, GPS/Pin, Pollution), Outcomes, Queue, LiveMap
  src/services/           API client with Bearer authentication
  src/styles/             Global responsive CSS
backend/                  FastAPI async service
  app/api/                reports.py, incidents.py, public.py, auth.py
  app/core/               config.py, database.py (Motor MongoDB), security.py
  app/models/             Incident, CitizenReport
  app/schemas/            Pydantic input/output validation models
  app/services/           intelligence.py (Scoring, Deterministic rules, Routing)
  tests/                  pytest test suite (16 test cases)
  seed_demo.py            Synthetic civic lifecycle seed script
```

---

## Running Locally

### Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your MONGODB_URL and access codes
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### Run Tests
```bash
cd backend
.venv/bin/python -m pytest tests/ -v
```

### Frontend
```bash
cd frontend
npm install
npm run build    # Verify production build
npm run dev      # Start dev server on http://localhost:5173
```
