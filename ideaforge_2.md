# CIVIC EYE: Ultimate Master Specification

**Winning edition.** Merges the ChatGPT master spec, the Gemini demo-first spec, and the earlier product spec into one build-ready document.

* **Track 1:** Civic Pulse, Digital Governance & Public Information
* **Problem 2:** Transparent Civic Grievance & Infrastructure Triage
* **Tagline:** *Don't just report the problem. Prove it is solved.*

---

## 1. Executive Summary

**CIVIC EYE** is a closed-loop civic intelligence platform. Citizens report with a photo, a voice note, and GPS. AI understands the evidence, merges duplicates, scores urgency, and routes it to the right department. When an officer claims a repair, AI audits the repair evidence instead of trusting a status update, and a human authority gives final approval before the public map turns green.

* **Core loop:** `Report` $\rightarrow$ `Detect` $\rightarrow$ `Deduplicate` $\rightarrow$ `Prioritize` $\rightarrow$ `Route` $\rightarrow$ `Repair` $\rightarrow$ `Audit` $\rightarrow$ `Human approval` $\rightarrow$ `Public proof`
* **The one sentence to remember:** CIVIC EYE transforms citizen complaints into verified civic outcomes using multimodal AI, geospatial intelligence, and visual proof-of-resolution.
* **The winning moment:** An officer uploads a photo of the same unfixed pothole; CIVIC EYE rejects it with a visible reason, then accepts a genuine repair photo.

---

## 2. Why This Wins (Judge Lens)

| Typical Judging Criterion | How CIVIC EYE Answers It |
| :--- | :--- |
| **Problem relevance** | Real, daily, local pain: potholes, garbage, leaks, open drains in Vijayawada and Amaravati |
| **Innovation** | Proof-of-Resolution Engine: AI audits repairs; most teams only collect complaints |
| **Technical depth** | Multimodal AI, geospatial deduplication, embeddings, explainable scoring, async pipeline |
| **Working demo** | One reliable end-to-end journey, seeded data, deterministic demo mode as a safety net |
| **Impact and scale** | Measurable: time to assignment, duplicates removed, rejected repairs, ward leaderboards |
| **Responsible AI** | Human approval, no invented confidence numbers, privacy blurring, audit log |
| **Presentation** | Three-minute story with a dramatic rejection moment |

---

## 3. What We Combined and the Decisions We Made

The three source specs agree on the vision but disagree on details. These are the resolutions:

| Topic | ChatGPT Spec | Gemini Spec | Final Decision |
| :--- | :--- | :--- | :--- |
| **Frontend** | React + Vite, plain CSS | Next.js, Tailwind | $\text{React} + \text{Vite} + \text{TypeScript} + \text{Tailwind}$. Fast to build; a single-page app with role-based routes is enough |
| **Database** | PostgreSQL + PostGIS + pgvector | SQLite or Supabase | PostgreSQL (Docker or Supabase) with PostGIS and pgvector. Python Haversine fallback so the demo never depends on spatial extensions |
| **Duplicate radius** | $150\text{ m}$, plus embeddings | $150\text{ m}$, Haversine only | $150\text{ m}$ configurable, with category, status, and embedding checks. Distance alone must not merge two different potholes |
| **Verification output** | Categorical, no invented confidence | Shows confidence percentages | Categorical verdict plus an evidence checklist. No fabricated confidence percentages. Model-reported percentages are not calibrated and would not survive a judge's question |
| **Resolution** | Human approval required | AI verification unlocks publish | AI recommends, authorized human approves. Strongest responsible-AI story |
| **SLA breach** | Status | Status value | Computed flag, not a status. An incident can be `IN_PROGRESS` and overdue at once |
| **AI model** | Gemini | Gemini 2.5 Flash | Provider-agnostic AI layer with the model set by an environment variable, so the model can change without code changes |
| **Roles** | 5 roles | 3 tabs | 5 roles in the backend, 3 headline screens plus admin in the UI |
| **Seed data** | Synthetic, labelled | Realistic seed script | Realistic but visibly labelled as `DEMO DATA` |

---

## 4. Users & Roles (RBAC)

| Role | Capabilities |
| :--- | :--- |
| **Citizen** | Register or OTP login, submit evidence, preview AI analysis, track status, confirm or dispute a repair, see own history |
| **Municipal Officer** | See assigned incidents, update status, add notes, upload repair evidence, run verification, see verdicts |
| **Department Admin** | Assign and reassign, change priority with a logged reason, set deadlines, review failed or uncertain verifications, approve closure |
| **Super Admin** | Users, departments, wards, routing rules, scoring weights, audit logs, system analytics |
| **Public Visitor** | Read-only map, anonymized details, verified before/after, department performance, open data download |

---

## 5. Scope

* **Supported categories:** Potholes / damaged roads, garbage accumulation, water leakage, open drains / manholes. *(Broken streetlights are a roadmap extra.)*
* **Rule:** The pothole journey is perfect first. Other categories reuse the same pipeline.
* **Out of scope:** Real government portal integration, payments, native apps, live municipal ERP, languages beyond Telugu, Hindi, and English. Do not claim any of these.

---

## 6. End-to-End User Journey

1. **Report:** Citizen uploads a photo, records a Telugu voice note, GPS is captured.
2. **Analyze:** AI classifies the issue, estimates hazard, transcribes and translates the voice note, and drafts a clean English complaint.
3. **Confirm:** Citizen reviews category, description, location, severity reason, and department, and sees any possible duplicates.
4. **Deduplicate:** Nearby same-category reports are matched. Strong match: merged. Uncertain: flagged for review.
5. **Score and route:** Transparent severity score, SLA clock, department assignment.
6. **Act:** Officer sees it ranked, assigns a crew, citizen is notified.
7. **Prove:** Officer uploads an after-photo captured in-app with GPS and timestamp.
8. **Audit:** Deterministic checks plus multimodal comparison produce a verdict.
9. **Approve:** Authorized human approves or overrides with a reason.
10. **Publish:** Public map turns green; before/after shown; citizens can confirm or dispute.

---

## 7. Functional Modules

### Module A: Citizen Portal (mobile-first)

| ID | Feature | Detail |
| :--- | :--- | :--- |
| **A1** | Auth | Register, login, JWT, hashed passwords, profile. OTP-style quick login optional |
| **A2** | Dashboard | Counts of submitted, open, in progress, resolved; recent activity |
| **A3** | Evidence upload | JPG, PNG, WebP images (up to 3), short MP4, drag-and-drop with preview, compression before upload |
| **A4** | Voice complaint | Browser mic recording or audio upload, up to $60\text{ s}$, Telugu / Hindi / English selector with auto language detection |
| **A5** | Location | Use My GPS, draggable map pin, landmark presets (Benz Circle, MG Road, Auto Nagar, Gollapudi, Patamata, Bhavanipuram), reverse-geocoded label |
| **A6** | AI preview | Category, description, severity with explanation, department, possible duplicates; editable before confirming |
| **A7** | Duplicate nudge | *"A similar issue was reported $40\text{ m}$ away. Add your report to it?"* |
| **A8** | Tracking | Incident ID like `CIVIC-2026-0001`, timeline, assigned department, repair evidence, verification result |
| **A9** | Notifications | In-app center; web push, SMS, or WhatsApp as stretch |
| **A10** | Confirm or dispute | After repair: *Confirm fixed*, or *Still not fixed* with a new photo |
| **A11** | Demo shortcuts | Three sample-loader buttons (Pothole, Garbage, Water leak) for fast, reliable demos |

**Pipeline progress states shown to the user:**
`Scanning image` $\rightarrow$ `Processing voice` $\rightarrow$ `Checking nearby reports` $\rightarrow$ `Scoring severity` $\rightarrow$ `Done`

---

### Module B: AI Intelligence Engine

* **B1. Image intelligence:** A multimodal model classifies the issue, describes visible damage, estimates hazard, rejects irrelevant images, and explains why. An optional fine-tuned YOLO detector supplies bounding boxes for potholes.
* **B2. Audio intelligence:** Voice $\rightarrow$ speech recognition (Whisper or the model's audio input; Bhashini as an alternative for Telugu) $\rightarrow$ language detection $\rightarrow$ transcript $\rightarrow$ translation $\rightarrow$ information extraction. Store the original transcript and English translation separately.
* **B3. Structured output:** All model output is JSON, validated with Pydantic. Invalid output triggers a retry, then a rules-based fallback or manual review.

```json
{
  "is_valid_civic_issue": true,
  "category": "POTHOLE",
  "title": "Deep pothole near Benz Circle",
  "description_en": "Large pothole on a busy road, risk to two-wheelers",
  "hazard_severity": 9,
  "department": "ROAD_MAINTENANCE",
  "input_language": "te",
  "original_transcript": "...",
  "recommended_action": "Inspect and patch road surface",
  "evidence_validity": "LIKELY_VALID"
}
```

> AI output is a suggestion, never a verified fact. Irrelevant, unclear, or spam images are rejected or sent to manual review.

* **B4. Severity scoring (transparent, configurable):**

$$S = 0.40 H + 0.25 E + 0.20 L + 0.15 R$$

*(Calculated on a $0$ to $10$ scale)*

| Symbol | Meaning |
| :--- | :--- |
| $H$ | Hazard severity (size, depth cues, open manhole worse than shallow pothole) |
| $E$ | Exposure to people and traffic (road type, junction, bus route) |
| $L$ | Location sensitivity (school, hospital, market within $200\text{ m}$) |
| $R$ | Corroboration (unique reporters, log-scaled; weather risk can add to this term) |

| Score | Priority | Default SLA |
| :--- | :--- | :--- |
| $7.5 \text{ to } 10$ | **CRITICAL** | 24 hours |
| $5.0 \text{ to } 7.4$ | **HIGH** | 72 hours |
| $3.0 \text{ to } 4.9$ | **MEDIUM** | 7 days |
| $0 \text{ to } 2.9$ | **LOW** | 14 days |

Every score stores its breakdown and a plain-language reason. Missing information never silently lowers priority; it routes to review. Weights are initial assumptions that admins can tune, and they are stated as assumptions in the pitch.

* **B5. Geospatial duplicate detection:**
  1. Fetch open incidents of the same category within $150\text{ m}$ (configurable) using PostGIS, with Haversine as a fallback.
  2. Compare image embeddings (CLIP) and text embeddings (Sentence Transformers).
  3. Decide:
     * **Strong match:** Link the report to the incident, increment `report_count`, recompute urgency, keep each citizen's own report intact.
     * **Uncertain match:** Flag for manual review and ask the citizen.
     * **No match:** Create a new incident.
  4. Never merge two different potholes just because they are close.

* **B6. Department routing:** Configurable table with an explanation of why.

| Category | Default Department |
| :--- | :--- |
| Pothole / damaged road | Roads & Buildings (Road Maintenance) |
| Garbage | Municipal Sanitation |
| Water leakage | Water Supply / Water Works |
| Open drain / manhole | Stormwater & Drainage |

---

### Module C: Officer Console (desktop-first)

| ID | Feature |
| :--- | :--- |
| **C1** | **KPI strip:** Assigned, critical, open, in progress, pending verification, verified, overdue |
| **C2** | **Priority queue:** Sorted by priority, then report count, then SLA time left; filters: All, Critical, Needs re-work (failed audit), Resolved |
| **C3** | **Incident workspace:** Original photos, English summary plus original transcript, GPS, duplicate history, score breakdown, internal notes |
| **C4** | **Assignment (admin):** Assign, reassign, change priority with reason, set deadline, escalate overdue |
| **C5** | **Repair upload:** In-app camera capture, repair description, GPS and timestamp stamped; original and repair evidence stored separately |
| **C6** | **Verification panel:** Verdict banner, evidence checklist, annotated before/after, re-upload option |
| **C7** | **Override with reason:** Contesting an AI verdict routes to admin review and is logged |

---

### Module D: Proof-of-Resolution Engine (signature feature)

* **D1. Pipeline:**
  `Before image + After image` $\rightarrow$ `Deterministic checks` $\rightarrow$ `Visual comparison` $\rightarrow$ `Verdict` $\rightarrow$ `Human review if uncertain` $\rightarrow$ `Authorized approval`

* **D2. Deterministic checks (cheap, reliable, explainable):**

| Check | Rule |
| :--- | :--- |
| **Capture integrity** | After-photo captured in-app with server timestamp; gallery uploads or stale EXIF flagged |
| **Geofence** | After-photo GPS within a configurable distance (default $30\text{ m}$) of the incident |
| **Image quality** | Blur and darkness checks; too poor goes to manual review |
| **Not a reuse** | Perceptual hash compared with earlier uploads to catch recycled photos |

* **D3. Visual comparison (multimodal model, strict JSON):**
  * **Auditor prompt:** *"You are an impartial municipal infrastructure auditor. Compare Image 1 (BEFORE) showing `{category}`: `{title}` with Image 2 (AFTER) submitted as proof of repair. Decide whether Image 2 shows the same physical location (road markings, kerbs, poles, buildings, surface texture), and whether the specific hazard is fully resolved. If unsure, say so. Return only JSON."*

```json
{
  "incident_id": "CIVIC-2026-0001",
  "verification_status": "VISUALLY_VERIFIED",
  "same_issue_identified": true,
  "location_consistency": "MATCHED",
  "visible_improvement": true,
  "remaining_damage": false,
  "image_quality": "ADEQUATE",
  "evidence_strength": "STRONG",
  "reasoning": "The original pothole is no longer visible; surface is level with fresh material.",
  "requires_human_approval": true
}
```

* **D4. Outcomes:**

| Verdict | Meaning | What Happens |
| :--- | :--- | :--- |
| `VISUALLY_VERIFIED` | Same place, defect appears resolved | Goes to authorized approval |
| `VERIFICATION_REJECTED` | Defect still visible, or evidence does not support repair | Incident reopened, officer sees annotated reason |
| `REJECTED: LOCATION MISMATCH` | Scene or GPS does not match | Reopened and flagged for audit |
| `MANUAL_REVIEW_REQUIRED` | Unclear, poor image, or uncertain location | Admin reviews; no forced yes or no |

> **Honesty rules:** The UI shows an evidence checklist and strength (Strong / Moderate / Weak), not a made-up percentage. An AI result never closes an incident by itself; an authorized human does. Verdicts are described as *visual verification*, not proof of physical repair quality.

* **D5. Verification history stored:** Original evidence, repair evidence, checks run, AI comparison and explanation, verdict, officer, reviewer, timestamps, and the approval trail.

---

### Module E: Public Accountability Dashboard (no login)

| Area | Detail |
| :--- | :--- |
| **Map (Leaflet + OpenStreetMap, ~65% width)** | Pins: red pulsing = Critical or overdue, orange = High, yellow = Medium, grey = Low, green shield = approved resolution. Clustering, search, category, priority, status filters, optional $150\text{ m}$ radius overlay |
| **Transparency drawer (~35%)** | Click a pin: anonymized description, merged report count, timeline, response time, before/after slider, audit stamp |
| **Analytics** | Total, active, in progress, verified resolved, overdue, average resolution time, category distribution, hotspots |
| **Leaderboard** | Department and ward resolution speed and verification pass rate |
| **Rejected-repair log** | Transparent count of repairs that failed audit |
| **Open data** | CSV and GeoJSON export |

> Never expose contact details, private documents, or sensitive metadata. The header ticker (e.g., active incidents, critical, verified rate) is computed from the database, and seeded numbers are labelled as demo.

---

### Module F: Admin Console

Users, officers, departments, wards, routing table, scoring weights, SLA rules, dispute queue, audit-log viewer, and a fairness panel that shows resolution time by ward to detect neglected areas.

---

## 8. System Architecture

```text
[Citizen PWA]   [Officer Console]   [Public Dashboard]   [Admin]
       \               |                    |              /
        +--------------+--------------------+-------------+
                                 |
               React + Vite + TypeScript + Tailwind
                                 |
                         REST + WebSocket
                                 |
                     FastAPI backend (Python)
     +-------------------+-------------------+-------------------+
     |                   |                   |                   |
[Auth/RBAC]         [Incidents]       [Verification]        [Notifier]
     |                   |                   |                   |
     +-------------------+-------------------+-------------------+
                                 |
            Background jobs (Celery + Redis, or FastAPI 
                    background tasks for MVP)
     +-------------------+-------------------+-------------------+
     |                   |                   |                   |
  [Vision]            [Speech]         [Dedup+Score]       [Repair audit]
     |                   |                   |                   |
     +-------------------+-------------------+-------------------+
                                 |
                 PostgreSQL + PostGIS + pgvector
                                 |
           Object storage (Supabase / MinIO / local)
```

**Design principle:** Uploads return immediately, AI jobs run asynchronously, and the UI updates over WebSocket as each stage completes so the demo feels live.

---

## 9. Technology Stack

| Layer | Choice |
| :--- | :--- |
| **Frontend** | React, Vite, TypeScript, Tailwind CSS, React Router, Lucide, Recharts |
| **Maps** | Leaflet + React-Leaflet, OpenStreetMap tiles, marker clustering |
| **Backend** | Python, FastAPI, Uvicorn, Pydantic, SQLAlchemy, Alembic |
| **Database** | PostgreSQL with PostGIS and pgvector (Supabase or Docker) |
| **AI (primary)** | Multimodal LLM via a provider-agnostic wrapper (Gemini Flash-class model by default; model name from `AI_MODEL` env var) |
| **Speech** | Whisper or the model's audio input; Bhashini optional for Telugu |
| **Embeddings** | CLIP (images), Sentence Transformers (text) |
| **Detection (optional)** | YOLOv8 fine-tuned on public road-damage data |
| **Storage** | Supabase Storage, or local `/uploads` for development |
| **Realtime** | WebSocket |
| **Testing** | Pytest, Playwright, Postman collection |
| **Deployment** | Docker Compose locally; Vercel (frontend) + Render (backend) + Supabase |

**Secrets:** All API keys and database credentials stay in backend environment variables. Never in frontend code.

---

## 10. Database Design

UUID primary keys, PostGIS geography columns with spatial indexes, foreign keys, unique constraints, and append-only history for audit-relevant events.

| Table | Key Fields |
| :--- | :--- |
| `users` | `id`, `role`, `name`, `email` or `phone`, `password_hash`, `ward_id` |
| `departments` | `id`, `name`, `code`, `contact`, `routing_categories` |
| `officers` | `id`, `user_id`, `department_id`, `active` |
| `incidents` | `id`, `incident_code`, `category`, `title`, `description_en`, `geom`, `address_label`, `severity_score`, `score_breakdown` (JSON), `priority`, `status`, `department_id`, `assigned_officer_id`, `report_count`, `sla_due_at`, `is_demo`, `created_at`, `updated_at` |
| `citizen_reports` | `id`, `incident_id`, `user_id` (nullable), `input_language`, `original_transcript`, `translated_text`, `image_embedding`, `created_at` |
| `incident_media` | `id`, `incident_id`, `report_id`, `kind` (before / after / audio / video), `storage_path`, `public_derivative_path`, `gps`, `captured_at`, `phash` |
| `incident_assignments` | `id`, `incident_id`, `officer_id`, `assigned_by`, `target_date`, `notes` |
| `incident_updates` | `id`, `incident_id`, `from_status`, `to_status`, `actor_id`, `note`, `created_at` |
| `ai_analyses` | `id`, `report_id`, `model`, `raw_json`, `validated_json`, `created_at` |
| `repair_verifications` | `id`, `incident_id`, `after_media_id`, `checks` (JSON), `verdict`, `reasoning`, `evidence_strength`, `reviewer_id`, `approval_status`, `created_at` |
| `notifications` | `id`, `user_id`, `incident_id`, `type`, `read_at` |
| `audit_logs` | `id`, `actor_id`, `action`, `entity`, `before`, `after`, `created_at` |

* **Status flow:** `OPEN` $\rightarrow$ `ASSIGNED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `REPAIR_SUBMITTED` $\rightarrow$ `VERIFICATION_REJECTED` (back to `IN_PROGRESS`) | `MANUAL_REVIEW` | `VISUALLY_VERIFIED` $\rightarrow$ `RESOLVED_APPROVED`, with overdue computed from `sla_due_at`.
* **Demo labelling:** Every seeded row has `is_demo = true` and the UI shows a `DEMO DATA` badge.

---

## 11. API Specification

All endpoints validate with Pydantic, return consistent error objects, support pagination, and use auth middleware.

| Area | Endpoint | Purpose |
| :--- | :--- | :--- |
| **Auth** | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` | Accounts and session |
| **Reports** | `POST /api/reports/analyze` | Upload evidence, get AI preview (no incident yet) |
| **Reports** | `POST /api/reports` | Confirm and create or merge; returns incident and dedup result |
| **Incidents** | `GET /api/incidents` | Filters: status, priority, category, ward, bbox; sorted by priority and report count |
| **Incidents** | `GET /api/incidents/{id}` | Detail with timeline |
| **Incidents** | `GET /api/incidents/nearby` | Nearby incidents by lat, lng, radius |
| **Incidents** | `POST /api/incidents/{id}/assign` | Assign or reassign |
| **Incidents** | `PATCH /api/incidents/{id}/status` | Workflow update |
| **Repair** | `POST /api/incidents/{id}/repair-evidence` | Upload after-photo and description |
| **Repair** | `POST /api/incidents/{id}/verify` | Run audit, returns verdict JSON |
| **Repair** | `POST /api/incidents/{id}/approve-resolution` | Authorized human closure |
| **Citizen** | `POST /api/incidents/{id}/dispute` | Citizen or officer dispute |
| **Public** | `GET /api/public/map`, `GET /api/public/analytics`, `GET /api/public/incidents.geojson` | Dashboard and open data |
| **Officer** | `GET /api/officer/dashboard` | KPIs |
| **Realtime** | `WS /ws/incidents/{id}` | Live stage updates |

---

## 12. Frontend Pages and Components

* **Public:** `LandingPage`, `Login`, `Register`, `PublicDashboard`
* **Citizen:** `CitizenDashboard`, `ReportIssue`, `AIAnalysis`, `MyComplaints`, `ComplaintDetails`, `CitizenProfile`
* **Officer:** `OfficerDashboard`, `AssignedIncidents`, `IncidentDetails`, `UploadRepairEvidence`, `VerificationHistory`
* **Admin:** `AdminDashboard`, `ManageOfficers`, `ManageDepartments`, `IncidentManagement`, `AuditLogs`
* **Shared:** `Navbar`, `Sidebar`, `InteractiveMap`, `IncidentCard`, `SeverityBadge`, `StatusTimeline`, `NotificationCenter`, `BeforeAfterComparison` (slider), `AnalyticsCharts`, `ProtectedRoute`, `DemoBadge`

---

## 13. UI/UX Direction

* **Feel:** Premium smart-city command platform. Deep navy dashboards for officers, light neutral citizen portal, electric blue primary actions, teal accents, amber and red for urgency, green for verified. Restrained gradients, subtle motion.
* **Three taps to report:** Camera, voice, submit.
* **Language-first:** Telugu / Hindi / English switcher everywhere; English default.
* **Never colour alone:** Status uses colour, icon, and text.
* **Required states:** Loading, empty, error, success, permission denied, upload progress, AI processing, verification pending.
* **Wow elements:** Live pipeline progress, pulsing critical pins, before/after slider, annotated rejection image, ward leaderboard.
* **Accessible and responsive:** WCAG AA contrast, keyboard navigation, screen-reader labels, low-bandwidth image compression.

---

## 14. Security, Privacy & Responsible AI

| Area | Control |
| :--- | :--- |
| **Access** | JWT, role-based access on every endpoint, officers see only their department |
| **Passwords and input** | Hashing, input sanitization, file type and size validation, rate limiting |
| **Media** | Private evidence behind signed URLs; public derivatives strip EXIF; blur faces and number plates |
| **Consent** | Clear notice for location, photos, and voice before first report |
| **Prompt safety** | Treat uploaded media and text as untrusted; an AI response can never authorize a sensitive action |
| **Human oversight** | AI recommends, authorized people decide; disputes always reach a human |
| **Transparency** | Every score and verdict shows reasons; audit log for every status change and AI decision |
| **Fairness** | Admin panel monitors resolution time by ward; weights are configurable and documented |
| **Honesty** | No invented confidence values or accuracy figures; seeded data labelled; no claims of real government integration |
| **Fallback** | If no API key, run a clearly labelled deterministic demo mode; never present simulated output as real AI |

---

## 15. Testing & Measured Accuracy

* **Tests to write:** Pothole classification, garbage classification, Telugu and Hindi transcription, duplicate detected, two different nearby incidents kept separate, severity calculation, department routing, successful / failed / inconclusive verification, unauthorized access, public data privacy, resolution approval, and status history.
* **Evaluation:** Build a small labelled test set (images, audio, before/after pairs). Report real numbers (for example, duplicate precision and recall, verification agreement with human labels). If a number was not measured, do not show it. An honestly reported small test set impresses judges more than a large invented metric.

---

## 16. Demo Data & Assets

| Asset | Quantity |
| :--- | :--- |
| **Civic issue images** | 50 to 100 across four categories |
| **Before/after repair pairs** | 10 to 20 |
| **Voice clips** | 10 to 15 (Telugu, Hindi, English) |
| **Seeded incidents (`seed.py`)** | 30 to 50 across Benz Circle, MG Road, Auto Nagar, Gollapudi, Patamata, Bhavanipuram, report counts from 1 to 14, all labelled `DEMO` |

### Three Verification Scenarios (must be rehearsed)
* **Scenario A, genuine fix:** Same location, defect gone $\rightarrow$ Visually Verified $\rightarrow$ human approval.
* **Scenario B, fake fix:** Defect still visible (`pothole_fake_fix.jpg`) $\rightarrow$ Rejected with reason.
* **Scenario C, inconclusive or wrong place:** Blurred or different location $\rightarrow$ Manual Review or Location Mismatch.

**Test assets:** `pothole_before.jpg`, `pothole_fake_fix.jpg`, `pothole_real_fix.jpg`, `english_voice.mp3`, `telugu_voice.mp3`, `hindi_voice.mp3`.

---

## 17. Three-Minute Demo Script

| Time | Action | What the Judge Sees |
| :--- | :--- | :--- |
| **0:00** | **Hook:** *"Every day someone reports a pothole in our city. Almost nobody sees proof it was fixed."* | Problem framed in one line |
| **0:20** | Citizen uploads pothole photo + Telugu voice note + GPS | Pipeline progress, AI-generated complaint appears |
| **1:00** | Second report from nearby | Duplicate detected, merged, report count rises, score breakdown shown |
| **1:25** | Switch to Officer Console | Incident at top of queue, Critical, SLA timer |
| **1:45** | Upload the fake fix | **REJECTED** with annotated reason, incident stays open |
| **2:15** | Upload the genuine fix | **VISUALLY VERIFIED**, then admin approves |
| **2:35** | Public dashboard | Pin turns green, before/after slider, rejected-repair count |
| **2:50** | **Close:** *"Don't just report the problem. Prove it is solved."* | Memorable ending |

> Rehearse the rejection moment more than anything else. Keep a pre-recorded backup video and cached sample results in case the network fails.

---

## 18. Likely Judge Questions, Strong Answers

| Question | Answer |
| :--- | :--- |
| **"How accurate is it?"** | *"Here are the numbers we measured on our labelled test set, and here is what we have not yet measured."* |
| **"Can officers cheat the AI?"** | Layered checks: in-app capture, geofence, perceptual-hash reuse detection, same-scene comparison, and a human approver. Disputes are logged. |
| **"Why not just trust officers?"** | Status updates are unverified claims; the audit gives independent evidence and a public record. |
| **"What about privacy?"** | Consent notice, blurred faces and plates, EXIF stripped from public images, signed URLs for private evidence. |
| **"What if AI is wrong?"** | It only recommends. Uncertain cases go to manual review and humans approve closure. |
| **"Does this integrate with real systems?"** | Not yet. The architecture exposes clean APIs for integration with existing grievance portals. |
| **"How does it scale?"** | Async job queue, stateless API, PostGIS indexes, pluggable AI provider, ward-level partitioning. |
| **"Business or sustainability model?"** | Municipal SaaS or state-level deployment, priced per ward; open data export supports transparency mandates. |

---

## 19. Build Plan with a Cut Line

| Phase | Deliverable | Priority |
| :--- | :--- | :--- |
| **1. Foundation** | Repo, Docker Compose, schema, auth, role routes, file upload | **Must** |
| **2. Citizen reporting** | Upload, voice, GPS, AI analysis, preview, confirm | **Must** |
| **3. Civic intelligence** | Severity engine, dedup, routing, incident storage | **Must** |
| **4. Officer workflow** | Queue, assignment, status, repair upload | **Must** |
| **5. Proof of resolution** | Deterministic checks, visual audit, verdicts, human approval, history | **Must (the winning feature)** |
| **6. Public accountability** | Map, analytics, filters, before/after slider, leaderboard | **Must** |
| **7. Polish** | Seed data, error states, realtime updates, tests, backup video, slides | **Must** |
| **Stretch** | WhatsApp channel, YOLO bounding boxes, weather-aware scoring, push notifications, extra categories | *Only if time remains* |

* **Cut line:** If time runs short, drop stretch items and the non-pothole categories before touching Phase 5. A reliable rejection moment beats ten half-built features.
* **Suggested four-person split:**
  1. Frontend citizen and public pages
  2. Frontend officer and admin plus design system
  3. Backend, database, and realtime
  4. AI engine, verification, and evaluation

---

## 20. Repository Structure

```text
civic-eye/
├── frontend/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── layouts/
│       ├── hooks/
│       ├── services/
│       ├── context/
│       ├── utils/
│       ├── styles/
│       └── App.tsx
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── ai/
│   │   ├── repositories/
│   │   └── utils/
│   ├── tests/
│   ├── main.py
│   ├── requirements.txt
│   └── .env.example
├── dataset/
│   ├── civic_images/
│   │   ├── potholes/
│   │   ├── garbage/
│   │   ├── water_leakage/
│   │   └── open_drains/
│   ├── repair_pairs/
│   │   ├── before/
│   │   └── after/
│   ├── audio/
│   │   ├── telugu/
│   │   ├── hindi/
│   │   └── english/
│   └── seed_incidents.json
├── docs/
│   ├── architecture.md
│   ├── api_documentation.md
│   └── demo_script.md
├── docker-compose.yml
└── README.md
```

---

## 21. Definition of Done

* [ ] Citizen can register, log in, and submit real image evidence with GPS.
* [ ] Voice transcription works for the demonstrated languages.
* [ ] AI classifies at least four categories, with irrelevant images rejected.
* [ ] Duplicate candidates are found; nearby but different incidents stay separate.
* [ ] Severity is transparent and explained; departments are recommended.
* [ ] Officers manage incidents and upload repair evidence.
* [ ] Verification returns verified, rejected, or manual review, with reasons.
* [ ] Authorized approval is required before public closure.
* [ ] Public dashboard reflects live database changes.
* [ ] Incident history is auditable; all seeded records are labelled.
* [ ] Runs locally from documented setup instructions in under 15 minutes.
* [ ] Demo rehearsed end-to-end at least three times, with a backup video.

---

## 22. Risks & Mitigations

| Risk | Mitigation |
| :--- | :--- |
| **Weak Telugu transcription** | Show transcript for correction; typed-text fallback; pre-test clips |
| **Verification false positives or negatives** | Multiple signals, manual-review lane, human approval, controlled demo set |
| **API outage or latency on stage** | Deterministic labelled demo mode, cached results, backup video |
| **Model cost or rate limits** | Compress images, cache analyses, batch where possible |
| **Scope creep** | Lock four categories; pothole perfection first; follow the cut line |
| **Officer resistance** | Frame as protection for honest workers, with a dispute path |
| **Over-claiming** | Only show measured metrics; label demo data; do not claim government integration |

---

## 23. Master Build Prompt *(paste into your AI coding tool)*

> Act as a senior full-stack architect, AI engineer, and security specialist. Build **CIVIC EYE** as a complete working application following this specification: React + Vite + TypeScript + Tailwind frontend, FastAPI backend, PostgreSQL with PostGIS and pgvector, a provider-agnostic multimodal AI layer, and a public accountability dashboard. Build in the phases of section 19 and run tests after each phase. Prioritize real working functionality over static screens. Validate all AI output with Pydantic. Never invent confidence percentages or performance metrics. Never let an AI result alone authorize public resolution. Provide a clearly labelled deterministic demo mode when no API key exists. Label every seeded record as demo data. Do not claim real government integrations. Deliver source code, database scripts, environment templates, documentation, and a reproducible demo.

**Final pitch line:** *"CIVIC EYE is not a complaint box. It is a proof engine. Don't just report the problem. Prove it is solved."*