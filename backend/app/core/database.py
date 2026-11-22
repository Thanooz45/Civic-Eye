from __future__ import annotations

import logging
from typing import AsyncGenerator, Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import settings

logger = logging.getLogger(__name__)
client: Optional[AsyncIOMotorClient] = None
database: Optional[AsyncIOMotorDatabase] = None


async def init_db() -> None:
    """Connect to the configured MongoDB and fail startup if it is unavailable."""
    global client, database
    mongo_client = AsyncIOMotorClient(
        settings.MONGODB_URL,
        serverSelectionTimeoutMS=8000,
        connectTimeoutMS=8000,
    )
    try:
        await mongo_client.admin.command("ping")
        db = mongo_client[settings.MONGODB_DATABASE]
        await db.incidents.create_index("incident_code", unique=True)
        await db.incidents.create_index([("category", 1), ("status", 1)])
        await db.citizen_reports.create_index("incident_id")
    except Exception as exc:
        mongo_client.close()
        logger.exception("MongoDB connection or initialization failed.")
        raise RuntimeError(
            "MongoDB is unavailable. Check the connection string, database user, "
            "network access rules, and SRV DNS, then restart the backend."
        ) from exc

    client = mongo_client
    database = db
    logger.info("Connected to MongoDB database '%s'.", settings.MONGODB_DATABASE)


async def close_db() -> None:
    global client, database
    if client is not None:
        client.close()
    client = None
    database = None


async def get_db() -> AsyncGenerator[AsyncIOMotorDatabase, None]:
    if database is None:
        raise RuntimeError("MongoDB is not initialized. Start the backend after its database is reachable.")
    yield database


def storage_mode() -> str:
    return "mongodb" if database is not None else "unavailable"
