"""
CIVIC EYE — FastAPI Application Entry Point
============================================
Registers all routers, configures CORS, mounts WebSocket handlers,
and wires up startup/shutdown lifecycle events.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
from pathlib import Path
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import close_db, init_db, storage_mode
from app.api import auth, public, reports, incidents

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("civiceye")


# ---------------------------------------------------------------------------
# Lifespan (startup / shutdown)
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Connect to MongoDB on startup and close the client on shutdown."""
    logger.info("CIVIC EYE backend starting up …")
    try:
        await init_db()
        logger.info("Database initialized (%s).", storage_mode())
        logger.info("AI review provider configured: %s (%s)", settings.AI_PROVIDER, settings.AI_MODEL)
        yield
    finally:
        await close_db()
        logger.info("CIVIC EYE backend shutting down.")


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------
def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description=(
            "CIVIC EYE — Civic Accountability Platform. "
            "Report. Detect. Prioritize. Resolve. Verify."
        ),
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    # -----------------------------------------------------------------------
    # CORS
    # -----------------------------------------------------------------------
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # -----------------------------------------------------------------------
    # API Routers
    # -----------------------------------------------------------------------
    API_PREFIX = "/api"

    app.include_router(reports.router, prefix=f"{API_PREFIX}/reports", tags=["Reports"])
    app.include_router(public.router, prefix=f"{API_PREFIX}/public", tags=["Public"])
    app.include_router(incidents.router, prefix=f"{API_PREFIX}/incidents", tags=["Incidents"])
    app.include_router(auth.router, prefix=f"{API_PREFIX}/auth", tags=["Authentication"])

    # -----------------------------------------------------------------------
    # Health check
    # -----------------------------------------------------------------------
    @app.get("/health", tags=["Health"])
    async def health():
        return {
            "status": "ok",
            "app": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "ai_provider": settings.AI_PROVIDER,
            "demo_mode": False,
            "database_mode": storage_mode(),
        }

    frontend_dir = Path(__file__).resolve().parent.parent / "frontend" / "dist"
    if frontend_dir.exists():
        app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")

    return app


app = create_app()
