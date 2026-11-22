# CIVIC EYE Hackathon Product and Technical Specification
**Track:** Civic Pulse — Transparent Civic Grievance & Infrastructure Triage  
**Tagline:** Report. Detect. Prioritize. Resolve. Verify.

## Executive summary

CIVIC EYE is a civic accountability platform that turns resident evidence into prioritized municipal work and checks repair evidence before a case can be publicly closed. Its differentiator is a human-governed proof-of-resolution loop: report, understand, cluster, prioritize, route, repair, verify, publish.

Hackathon objective: deliver one dependable end-to-end pothole journey in Vijayawada, with the same workflow demonstrated for garbage, water leakage and open drains. The demo must show an incomplete repair being flagged, a genuine repair being recommended for closure, and an authorized human confirming the final outcome.

Winning thesis: CIVIC EYE does not count complaints as outcomes. It links evidence to action and makes the quality of the claimed fix visible.

## Problem, users and value

Residents face scattered complaint channels, unclear ownership and little proof that a reported hazard was fixed. Municipal teams face duplicate, vague and poorly prioritized reports. The public cannot distinguish a status update from a verified outcome.

| User | Primary job | Value delivered |
| --- | --- | --- |
| Resident | Report evidence, track progress, confirm or dispute a fix | Simple multilingual reporting and a transparent timeline |
| Officer | Review a ranked queue, assign work, submit repair proof | Less duplicate triage and an auditable repair workflow |
| Department administrator | Configure teams and service targets; review escalations | Operational visibility and human review controls |
| Public visitor | Explore anonymized incidents and verified outcomes | Accountability without exposing reporter identity |

The platform is not just a pothole detector. The flagship use case demonstrates a reusable civic workflow; four categories are in scope for the hackathon MVP. Payments, contractor billing, native apps and live government ERP integration are roadmap items.

## Hackathon scope and priorities

| Priority | Build / demonstrate |
| --- | --- |
| P0 — must work | Mobile-first citizen report; image + optional text/voice + location; structured issue analysis; review-before-submit; nearby duplicate candidate and explicit merge; explainable priority; department queue; status history; repair evidence upload; verified / rejected / manual-review outcomes; human approval; public map/detail view; labeled demo data. |
| P1 — if time permits | Telugu and English voice workflow; citizen confirm/dispute; officer assignment; SLA countdown; public analytics and before/after view; CSV or GeoJSON export. |
| Roadmap | Hindi and additional languages; robust video; OTP; production-grade identity administration; PostGIS/pgvector; background job queue; notifications; ward-level fairness analytics; live integrations. |

Lock the polished path to one seed scenario: a pothole near Benz Circle. Three other categories should use the shared pipeline with lighter validation. Prefer a small complete product over disconnected screens or a broad stack of unfinished features.

Choose one implementation stack and keep it consistent: Next.js + TypeScript frontend, FastAPI + Pydantic backend, SQLAlchemy with SQLite for the local demo (PostgreSQL/PostGIS as production path), and local demo storage behind a storage interface. Use Leaflet + OpenStreetMap and Recharts. Use regular CSS or Tailwind consistently; do not mix styling systems. Keep the Gemini API on the server. If credentials are unavailable, switch visibly to deterministic demo mode.

## End-to-end product journey

| Step | Experience and system behavior |
| --- | --- |
| 1. Report | Resident selects/takes a photo, optionally records a short voice note or types a description, grants GPS or moves a map pin, then reviews the proposed report. |
| 2. Understand | AI proposes category, title, description, hazard cues, language/transcript and department. Schema validation and evidence-quality checks run before display. User may edit text/category. Unclear or non-civic evidence goes to review. |
| 3. Cluster | Show nearby same-category candidates with distance and reason. Resident or officer confirms merge when confidence is uncertain. Preserve each submission as a separate report linked to one incident. |
| 4. Prioritize and route | Compute a transparent, deterministic score from model-proposed hazard features plus available context. Show score breakdown, missing inputs and department-routing reason. |
| 5. Act | Officer queue sorts by priority, age/SLA and corroborating report volume. Officer assigns work and records status changes with actor and timestamp. |
| 6. Prove | Officer submits an after photo with capture time and location metadata where available. System checks same-scene evidence, issue visibility, image quality and location consistency. |
| 7. Review and publish | AI recommends visually verified, rejected or manual review. Authorized reviewer confirms closure. Residents can confirm or dispute. Public view updates with anonymized, approved evidence. |

Core status flow: SUBMITTED → VALIDATED or NEEDS_REVIEW → ASSIGNED → IN_PROGRESS → REPAIR_SUBMITTED → VISUALLY_VERIFIED / VERIFICATION_REJECTED / MANUAL_REVIEW → CLOSED after authorized approval. A dispute can reopen the incident. Keep SLA_BREACHED as a computed flag or event, not a terminal status.

## AI and decision rules

### Issue analysis

Accept image, optional text and optional audio. Preserve the original-language transcript separately from any translation. Return schema-validated fields: valid_civic_issue, category, concise title, description, language, original_transcript, normalized_summary, severity features, recommended department, evidence quality, uncertainty flags and reasoning. AI outputs are proposals, never authoritative facts.

### Priority score

Use a configurable 0–100 score with visible component values: 30% hazard severity, 20% road importance, 15% proximity to sensitive sites, 15% unique corroborating reports (log-scaled), 10% age against SLA and 10% weather risk. If a component is unavailable, mark it unknown and renormalize over known weights; do not silently score missing data as zero. Initial bands: Critical 80+, High 60–79, Medium 40–59, Low below 40. These are starting assumptions, not validated policy.

### Duplicate detection

First find open candidate incidents within a configurable 150 m radius using Haversine distance. Rank candidates using category, text similarity and (if implemented) image embeddings. Distance alone never proves identity. Auto-merge only above a documented high threshold; otherwise ask for confirmation or send to review. Keep individual reports, reporter counts and merge history. Apply corroboration boosts with diminishing returns; do not let report volume alone manufacture criticality.

### Department routing

Use an administrator-editable rules table: pothole → Road Maintenance; damaged road → Roads Engineering; garbage → Sanitation; water leak → Water Supply; open drain/manhole → Drainage; streetlight → Electrical Maintenance. Return the matching rule and allow authorized reassignment with an audit reason.

### Repair verification

Compare original and after evidence for same issue, scene/location consistency, visible improvement, completeness and image quality. Outcomes: VISUALLY_VERIFIED, VERIFICATION_REJECTED or MANUAL_REVIEW. Do not invent confidence percentages or claim forensic certainty. A model verdict is a recommendation based on available images; only an authorized person can close the incident. Record reasoning and evidence references.

## Architecture and data

For the hackathon, use a synchronous request path if it is more reliable; show stage-by-stage progress in the UI. Keep analysis and storage behind service interfaces so a queue or cloud storage can be added later. A production architecture can move model work to Celery/Redis workers, use PostgreSQL/PostGIS/pgvector, object storage and WebSockets.

| Entity | Key information |
| --- | --- |
| users / roles | UUID, role, name, department/ward where relevant; protect private contact data |
| departments | Name, routing rules, service targets |
| incidents | Public code, category, location, status, priority score + breakdown, department, report count, SLA due time, created/updated timestamps |
| citizen_reports | Incident link, optional reporter, language, original transcript, normalized description, submitted time |
| media | Private object key, type, uploader, capture metadata, privacy derivative, retention state |
| assignments / status_events | Officer/crew, target date, actor, from/to status, reason and timestamp |
| ai_analyses | Model/provider or demo mode, schema output, warnings, prompt/version and timestamp |
| repair_verifications | Before/after references, outcome, reasoning, location check, reviewer and approval history |
| disputes / audit_logs | Dispute reason and resolution; append-only record of sensitive changes |

Use UUIDs internally and a readable public code such as CIVIC-2026-0001. Store exact coordinates privately; round public coordinates to street level. Public API returns only approved, anonymized fields. Seed records must be explicitly marked DEMO / SYNTHETIC.

## API and interface contract

| Endpoint | Purpose |
| --- | --- |
| POST /api/reports/analyze | Analyze uploaded evidence and return editable preview; never create a final incident by itself. |
| POST /api/reports | Confirm report, create/link incident and preserve report record. |
| GET /api/incidents | Authenticated filtered/paginated officer queue. |
| GET /api/incidents/{id} | Incident, evidence references, score breakdown and event timeline subject to role. |
| PATCH /api/incidents/{id}/status | Authorized status transition with reason and audit event. |
| POST /api/incidents/{id}/assign | Assign department/officer/crew and target date. |
| POST /api/incidents/{id}/repair-evidence | Upload repair evidence and trigger verification. |
| POST /api/incidents/{id}/approve-resolution | Authorized human closure after review. |
| POST /api/incidents/{id}/dispute | Citizen confirmation/dispute with optional new evidence. |
| GET /api/public/incidents.geojson | Anonymized, rounded public map features. |
| GET /api/public/stats | Public-safe aggregate metrics. |

Validate requests and responses with Pydantic; use consistent error shapes, file size/type limits and pagination. Require role checks on every officer/admin action. Public endpoints must not expose private transcripts, exact coordinates, faces, plates, contact information or internal notes.

## Screens and interaction design

| Screen | Must-have content |
| --- | --- |
| Citizen portal (mobile-first) | Three-tap report goal; camera/gallery; short voice/text; Telugu/English choice; GPS/map pin; AI preview and edits; duplicate nudge; submit receipt; incident timeline; confirm/dispute repair. |
| Officer console (desktop-first) | KPI strip; ranked queue and filters; incident evidence/transcript; score explanation; duplicates; department/SLA; assignment/status actions; after-photo capture/upload; verification result and override reason. |
| Public accountability dashboard | Leaflet map with category/status filters and clustering; counts for open/in-progress/overdue/verified; anonymized detail; approved before/after; rejected verification count; department/ward metrics only when sample sizes are meaningful. |
| Admin (minimum viable) | Department and SLA configuration; review queue; role controls if authentication is implemented; audit history and dispute review. |

Use deep navy and teal for trust, amber/red for urgency and green for approved outcomes. Pair every color with a label and icon. Meet readable contrast, keyboard navigation, screen-reader labels, loading/empty/error states and low-bandwidth behavior. Compress uploads client-side where practical. Public markers use approximate location.

## Privacy, safety and reliability

Require consent for location and evidence use. Treat uploads, text and model output as untrusted. Keep keys server-side; validate file types/size; rate-limit submission; use secure storage and access checks. Strip EXIF from public derivatives; blur faces and number plates where feasible. Do not imply blurring or authenticity checks exist unless implemented.

Record model/provider, demo-vs-live mode and decision version. Retry invalid structured output once, then fall back to rules or manual review. If AI or network fails, preserve the draft and explain the fallback. Keep a human path for uncertain analysis, contested verification and status overrides. Never let AI alone authorize public closure.

Do not claim municipal integration, real incidents, model accuracy, latency or detection performance without evidence. Use the public map only for synthetic/approved data. Do not use a weather score unless a real source is connected; otherwise mark it unavailable.

## Demo plan and judging narrative

| Time | Show |
| --- | --- |
| 0:00–0:30 | State the problem and thesis: complaint systems record submissions; CIVIC EYE follows the evidence through to the fix. |
| 0:30–1:15 | Submit a pothole report near Benz Circle with image and Telugu voice; show AI preview, transcript/translation and editable summary. |
| 1:15–1:45 | Submit a second nearby report; show candidate match, human-confirmed merge, report count and updated score breakdown. |
| 1:45–2:15 | Switch to officer queue; show priority reason, assigned department and status timeline. |
| 2:15–3:00 | Upload an incomplete repair image; show a grounded rejection/manual-review explanation. Upload the genuine pair; show visual-verification recommendation. |
| 3:00–3:30 | Show authorized human approval and public map/detail updating to verified, with anonymized before/after evidence. |
| Backup | Have deterministic, clearly labeled demo responses and seeded synthetic data ready. If a live API fails, disclose demo mode; never present cached output as a live model result. |

Judge-facing proof points: complete workflow, meaningful civic impact, transparent prioritization, careful duplicate handling, a verification feature with human control, privacy-aware public transparency and an honest demo. Present measured results only from a documented evaluation set.

## Build sequence and acceptance checklist

| Phase | Deliverable |
| --- | --- |
| 1. Foundation | Repository, run instructions, database schema, seed data labels, upload path and core screens. |
| 2. Citizen flow | Report form, location, analysis preview, validation, incident creation and tracking. |
| 3. Intelligence | Department rules, explainable score, duplicate candidate/merge and event history. |
| 4. Officer and verification | Ranked queue, assignment/status, repair upload, three verification outcomes and human approval. |
| 5. Public and polish | Anonymized map, incident detail, useful aggregate metrics, accessibility/error states and rehearsed demo. |

Definition of done: a fresh local setup can run the demo; a citizen can submit and track an evidence-backed report; four categories map through the shared workflow; at least one confirmed duplicate is linked without losing individual reports; priority and routing reasons are visible; officer actions are audited; repair verification supports pass, reject and manual review; authorized approval is required to close; public data is anonymized and updates; seed data and simulated AI are clearly labeled.

Suggested evaluation measures (report observed values, not targets as achievements): end-to-end demo completion rate; report-to-preview time; duplicate match precision on a small labeled set; verification agreement on curated before/after cases; number of manual-review cases; public page load on the demo network. Document test set size and limitations.

## Pitch

CIVIC EYE turns civic complaints into accountable work. It helps residents report with evidence, helps departments act on the most urgent issues, and asks for proof before a repair is called done.

Tagline: Report. Detect. Prioritize. Resolve. Verify.
