from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Dict, Any

from api.auth_router import get_current_user, require_permissions
from core.db import get_mongo_db, get_sqlite_conn
from datetime import timedelta
from services.detection_engine import evaluate_access_event, evaluate_telemetry_event

router = APIRouter(prefix="/api/v1", tags=["ingestion"])

# Canonical Event Models
class AccessEvent(BaseModel):
    event_id: str
    source_id: str
    occurred_at: datetime
    subject_id: str
    zone_id: str
    match_confidence: float
    is_authorized: bool
    payload: Optional[Dict[str, Any]] = None
    integrity_metadata: str

class SpatialObservation(BaseModel):
    event_id: str
    source_id: str
    occurred_at: datetime
    entity_id: str
    current_zone_id: str
    payload: Optional[Dict[str, Any]] = None

@router.post("/access-events", status_code=status.HTTP_201_CREATED)
async def ingest_access_event(event: AccessEvent, current_user: dict = Depends(require_permissions(['event_ingestion']))):
    """
    Ingest a canonical AccessEvent.
    Triggers deterministic security rules.
    """
    db = get_mongo_db()
    event_dict = event.model_dump()
    event_dict["received_at"] = datetime.utcnow()
    
    await db.access_events.insert_one(event_dict)
    
    # Trigger Detection Engine (Layer 1 - Deterministic Rules)
    await evaluate_access_event(event_dict)
    
    return {"status": "accepted", "event_id": event.event_id}

@router.post("/telemetry", status_code=status.HTTP_201_CREATED)
async def ingest_telemetry(observation: SpatialObservation, current_user: dict = Depends(require_permissions(['event_ingestion']))):
    """
    Ingest a canonical SpatialObservation.
    """
    db = get_mongo_db()
    obs_dict = observation.model_dump()
    obs_dict["received_at"] = datetime.utcnow()
    
    await db.spatial_observations.insert_one(obs_dict)
    
    # Trigger Correlation Engine
    await evaluate_telemetry_event(obs_dict)
    
    return {"status": "accepted", "event_id": observation.event_id}

@router.get("/ingestion/zones")
async def get_ingestion_zones(current_user: dict = Depends(require_permissions(['event_ingestion']))):
    """
    Retrieve minimal zone list for ingestion agents.
    """
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name FROM zones")
    zones = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return zones

@router.get("/ingestion/devices")
async def get_ingestion_devices(current_user: dict = Depends(require_permissions(['event_ingestion']))):
    """
    Retrieve minimal devices list for ingestion agents.
    """
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, device_type, zone_id, status FROM devices")
    devices = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return devices

DEFAULT_FEED_RETENTION_HOURS = 48

def get_feed_retention_hours() -> int:
    """Hours of incident history shown in the live feed (system setting 'feed_retention_hours').
    Only the display window; incidents themselves stay stored in the telemetry database."""
    conn = get_sqlite_conn()
    try:
        row = conn.execute("SELECT value FROM system_settings WHERE key = 'feed_retention_hours'").fetchone()
    finally:
        conn.close()
    try:
        hours = int(row['value']) if row else DEFAULT_FEED_RETENTION_HOURS
    except (TypeError, ValueError):
        return DEFAULT_FEED_RETENTION_HOURS
    return hours if hours > 0 else DEFAULT_FEED_RETENTION_HOURS

@router.get("/incidents")
async def get_incidents(current_user: dict = Depends(require_permissions(['dashboard']))):
    """
    Retrieve recent security incidents within the configured feed retention window.
    """
    cutoff = datetime.utcnow() - timedelta(hours=get_feed_retention_hours())

    db = get_mongo_db()
    cursor = db.incidents.find({
        "status": {"$in": ["DETECTED", "OPEN", "INVESTIGATING"]},
        "occurred_at": {"$gte": cutoff}
    }).sort("occurred_at", -1)

    incidents = await cursor.to_list(length=1000)

    # Convert ObjectId to string for JSON serialization
    for inc in incidents:
        inc["_id"] = str(inc["_id"])

    return incidents
