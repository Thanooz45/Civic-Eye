# Civic Eye

**A clearer way for residents and city teams to report, coordinate, and follow local issues.**

Civic Eye connects community reports with the teams responsible for resolving them. Residents can submit a location and evidence, follow progress, and see completed outcomes. Department staff can review their queue, coordinate with other teams, and record repair evidence before a closure is approved.

## Live services

- **Web app:** [civic-eye-zeta.vercel.app](https://civic-eye-zeta.vercel.app/)
- **API:** [civic-eye-oviv.onrender.com](https://civic-eye-oviv.onrender.com/)
- **API health:** [`/health`](https://civic-eye-oviv.onrender.com/health)
- **Interactive API docs:** [`/api/docs`](https://civic-eye-oviv.onrender.com/api/docs)

## What it does

- Submit a report with a description, location, and photos or short videos.
- Review and route reports into the city issue queue.
- Track status, priority, department, and community report totals.
- View geolocated reports on a live map and search complaint history.
- Let department teams exchange direct messages and attachments, including urgent coordination.
- Record repair notes and after-work evidence; a staff member approves a public closure.
- Share verified outcomes and community-level counts on the landing page.
- Use AI-assisted **text** review to organize report descriptions. Photo AI detection is not included.

## How the app is organized

```text
frontend/                 React + Vite web app
  src/components/         Shared interface components
  src/context/            Session state
  src/hooks/              Reusable UI hooks
  src/pages/              Landing, reporting, queue, map, messages, outcomes
  src/services/           API client
  src/styles/             Global and page styles
backend/                  FastAPI service
  app/api/                Reports, incidents, public data, authentication
  app/core/               Settings, database, and security
  app/models/             MongoDB document models
  app/services/            Report intelligence and AI text review
render.yaml               Render Blueprint
frontend/vercel.json      Vercel SPA routing and security headers
DEPLOYMENT.md             Deployment walkthrough
```

The frontend is hosted on Vercel. The backend runs on Render and stores reports, incidents, messages, and uploaded evidence in MongoDB. Local `.env` files and `.ourenv` are ignored by Git; use the `.env.example` files as templates only.

## Run locally

### Requirements

- Python 3.11 or newer
- Node.js 20.19+ or 22.12+
- npm
- A reachable MongoDB database (MongoDB Atlas works)
- A Groq API key for AI-assisted text review; Gemini can be configured as a fallback

### 1. Configure the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env` and set `MONGODB_URL`, `SECRET_KEY`, staff access codes, and the AI provider keys you intend to use. Use unique access codes of at least 16 characters. The backend requires MongoDB at startup and does not silently save production reports to a local substitute.

Start the API from the `backend/` directory:

```bash
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Start the frontend

In a second terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open <http://127.0.0.1:5173>. Vite proxies `/api` requests to the local backend at port `8000`. For local development on another device on the same network, start Vite with a LAN-accessible host and open the computer’s LAN address from that device.

## Department sign-in

Select **Department / head**, enter the staff member’s name, then enter the access code assigned to that team. The code determines whether the session belongs to a department or the citywide head. Department sessions see their department’s queue; **Head of all departments** can see the citywide queue.

The sign-in screen includes reference codes for the current demo setup. They are visible to site visitors and must not be used with real government data. For a real deployment, replace them with private, unique codes and remove or disable the reference-code list before launch.

## Deployment

Deployment-specific instructions are in [DEPLOYMENT.md](DEPLOYMENT.md). The current production wiring is:

- Vercel project root: `frontend`
- Vercel build command: `npm run build`
- Vercel output directory: `dist`
- Vercel environment variable: `VITE_API_BASE=https://civic-eye-oviv.onrender.com`
- Render service root: `backend`
- Render build command: `pip install -r requirements.txt`
- Render start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Render `CORS_ORIGINS`: `https://civic-eye-zeta.vercel.app`

Keep Gemini, Groq, MongoDB, JWT, and staff access secrets on the backend. Never add them to `VITE_*` frontend variables, commit them, or paste them into a public issue. Vite embeds `VITE_API_BASE` at build time, so redeploy the frontend after changing it. Redeploy the backend after changing CORS or backend settings.

## Useful checks

- API status: `GET /health`
- API documentation: `/api/docs`
- Production frontend build: run `npm ci && npm run build` from `frontend/`
- Local setup details: [`start.txt`](start.txt)

## License

No license is currently included. Add a license before redistributing or reusing this project outside its current repository.
