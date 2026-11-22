# Deploy Civic Eye

Civic Eye runs as two services: the React frontend on Vercel and the FastAPI
backend on Render. MongoDB stores report records and uploaded report images.
Gemini and Groq credentials stay on the backend.

## 1. Push the project to a Git provider

Commit the source and push it to GitHub, GitLab, or Bitbucket. Keep
`backend/.env` out of version control. `backend/.env.example` contains only
placeholders and is a reference, not a runtime configuration file.

## 2. Create the backend on Render

Create a Blueprint from the repository root and select `render.yaml`. Render
builds the service from `backend/` and starts FastAPI on its assigned port.
`CORS_ORIGINS` is set to `https://civic-eye-zeta.vercel.app`. Provide these
values when Render prompts for them:

The Blueprint selects Render's free plan to avoid starting a paid service
without your approval. Render's free web services sleep after 15 minutes idle
and can take about a minute to wake. Upgrade the service to a paid plan before
relying on it for public users. See [Render free service limits](https://render.com/docs/free).

- `MONGODB_URL`: the MongoDB Atlas connection string for the production database.
- `AI_API_KEY`: Gemini key (optional when Groq is available).
- `GROQ_API_KEY`: Groq key used for automated report review when Groq is selected.

Render generates `SECRET_KEY` and `CITY_TEAM_ACCESS_CODE`; the latter is the
department-head code with citywide visibility. The Blueprint prompts for a
separate department secret for each of these settings: `CIVIC_DEPT_ROAD_MAINTENANCE_ACCESS_CODE`,
`CIVIC_DEPT_ROADS_ENGINEERING_ACCESS_CODE`,
`CIVIC_DEPT_MUNICIPAL_SANITATION_ACCESS_CODE`,
`CIVIC_DEPT_WATER_SUPPLY_ACCESS_CODE`, `CIVIC_DEPT_DRAINAGE_ACCESS_CODE`,
`CIVIC_DEPT_ELECTRICAL_MAINTENANCE_ACCESS_CODE`, and
`CIVIC_DEPT_GENERAL_ACCESS_CODE`. Use unique secrets of at least 16 characters
and deliver each one only to its department through a private channel. Demo
codes are shown only in the local development build; they are omitted from the
production frontend. Never reuse the local demo codes for staff accounts.
Allow the Render service's outbound addresses in MongoDB Atlas Network Access.
The backend fails startup if it cannot reach MongoDB; it does not write reports
to a local substitute.

After the service deploys, confirm its `/health` endpoint reports
`"database_mode":"mongodb"`. Copy the service's HTTPS base URL, without a
trailing slash.

## 3. Create the frontend on Vercel

Import the same repository as a Vercel project and set **Root Directory** to
`frontend`. Vercel detects Vite; the build command is `npm run build` and the
output directory is `dist`. Add this environment variable for Production:

- `VITE_API_BASE`: `https://civic-eye-oviv.onrender.com`.

Deploy the frontend and copy its production HTTPS origin. Vite embeds
`VITE_API_BASE` at build time, so redeploy after changing it.

## 4. Allow the frontend in Render

The backend allows the exact Vercel production origin, and the frontend points
to the Render API. If either service URL changes, update both settings and
redeploy the affected service.

## Local development

For local development, follow `start.txt`. Local settings belong in
`backend/.env`; frontend settings may be placed in `frontend/.env.local`.
