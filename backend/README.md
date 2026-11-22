# Civic Eye API

FastAPI service for report review, issue routing, and request tracking.

## Local run

Use Python 3.13. Install dependencies into a local virtual environment and start from this directory:

```sh
python3.13 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

The populated `.env` file supplies MongoDB, Gemini, and Groq settings. Do not
replace it with `.env.example`; the example contains placeholders. MongoDB is
required. The server stops on database connection failure rather than saving
reports to a local file. Review tries Groq first and falls back to Gemini when both
keys are configured.

Report records, status history, and uploaded report photos are stored in
MongoDB. Public report creation is anonymous. City-team status, acceptance, and
resolution actions require a signed-in city-team session.

API documentation is available at `/api/docs` while the service is running.
