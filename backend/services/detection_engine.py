import asyncio
from datetime import datetime, timedelta
import time
import logging
import uuid
from core.db import get_mongo_db, get_sqlite_conn
from core.timeutil import now_utc

# Constants for detection (fallbacks for unknown zones)
BIOMETRIC_THRESHOLD = 0.85
REPEATED_ACCESS_MINUTES = 5
REPEATED_ACCESS_COUNT = 3
MAX_DWELL_TIME = 300
TAILGATING_SEVERITY = 'CRITICAL'

_zone_rules_cache = None
_zone_rules_cache_time = 0

def _fetch_zone_rules_from_db():
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT level, biometric_threshold, max_dwell_time, tailgating_severity FROM clearance_rules")
    rules = {row['level']: dict(row) for row in cursor.fetchall()}
    
    cursor.execute("SELECT id, name, clearance_level FROM zones")
    zones = {}
    for row in cursor.fetchall():
        zones[str(row['id'])] = row['clearance_level']
        zones[row['name']] = row['clearance_level']
        
    conn.close()
    return {'rules': rules, 'zones': zones}

async def get_zone_rule(zone_identifier):
    global _zone_rules_cache, _zone_rules_cache_time
    now = time.time()
    if not _zone_rules_cache or now - _zone_rules_cache_time > 5:
        _zone_rules_cache = await asyncio.to_thread(_fetch_zone_rules_from_db)
        _zone_rules_cache_time = now
        
    if not zone_identifier:
        return None
        
    zones = _zone_rules_cache['zones']
    rules = _zone_rules_cache['rules']
    
    level = zones.get(str(zone_identifier))
    if level is not None:
        return rules.get(level)
    return None

async def create_incident(incident_type: str, severity: str, event: dict, details: str):
    db = get_mongo_db()
    incident = {
        "incident_id": str(uuid.uuid4()),
        "type": incident_type,
        "severity": severity,
        "status": "DETECTED",
        "occurred_at": event.get("occurred_at", datetime.utcnow()),
        "source_event_id": event.get("event_id"),
        "source_device_id": event.get("source_id"),
        "subject_id": event.get("subject_id") or event.get("entity_id"),
        "zone_id": event.get("zone_id") or event.get("current_zone_id"),
        "details": details,
        "state_history": [{
            "state": "DETECTED",
            "timestamp": datetime.utcnow(),
            "actor": "system",
            "reason": "Deterministic rule triggered"
        }]
    }
    await db.incidents.insert_one(incident)
    return incident

async def evaluate_access_event(event_dict: dict):
    # Rule 1: Integrity violation
    if not event_dict.get("integrity_metadata"):
        await create_incident(
            "PAYLOAD_TAMPERING", "CRITICAL", event_dict, 
            "Missing or invalid event integrity metadata."
        )
        return

    # Rule 2: Biometric mismatch
    zone_id = event_dict.get("zone_id") or event_dict.get("current_zone_id")
    rule = await get_zone_rule(zone_id)
    
    if rule:
        threshold = rule['biometric_threshold']
    else:
        threshold = BIOMETRIC_THRESHOLD
        if zone_id:
            logging.warning(f"Unknown zone: {zone_id}. Applying fallback rules.")

    confidence = event_dict.get("match_confidence", 1.0)
    if confidence < threshold:
        await create_incident(
            "BIOMETRIC_MISMATCH", "HIGH", event_dict, 
            f"Biometric confidence ({confidence}) below threshold ({threshold})."
        )
    
    # Rule 3: Unauthorized Zone
    if not event_dict.get("is_authorized"):
        await create_incident(
            "UNAUTHORIZED_ZONE_ACCESS", "HIGH", event_dict, 
            "Subject lacks clearance for the requested zone."
        )
        
        # Rule 6: Repeated access failures
        db = get_mongo_db()
        subject_id = event_dict.get("subject_id")
        if subject_id:
            window_start = now_utc() - timedelta(minutes=REPEATED_ACCESS_MINUTES)
            recent_failures = await db.access_events.count_documents({
                "subject_id": subject_id,
                "is_authorized": False,
                "occurred_at": {"$gte": window_start}
            })
            
            # The current event is already inserted before evaluation, so a count of 
            # REPEATED_ACCESS_COUNT includes the current event.
            # We raise one incident per further failure (one per event at or above the count).
            if recent_failures >= REPEATED_ACCESS_COUNT:
                await create_incident(
                    "REPEATED_ACCESS_FAILURES", "HIGH", event_dict,
                    "Subject has repeated unauthorized access attempts."
                )
    else:
        # Routine access event (INFO)
        if confidence >= threshold:
            await create_incident(
                "ROUTINE_ACCESS", "INFO", event_dict,
                "Subject granted routine access."
            )

async def evaluate_telemetry_event(obs_dict: dict):
    db = get_mongo_db()
    
    zone_id = obs_dict.get("zone_id") or obs_dict.get("current_zone_id")
    rule = await get_zone_rule(zone_id)
    
    if rule:
        dwell_limit = rule['max_dwell_time']
        tailgating_sev = rule['tailgating_severity']
    else:
        dwell_limit = MAX_DWELL_TIME
        tailgating_sev = TAILGATING_SEVERITY
        if zone_id:
            logging.warning(f"Unknown zone: {zone_id}. Applying fallback rules.")
            
    payload = obs_dict.get("payload", {})
    if payload and payload.get("dwell_time_seconds", 0) > dwell_limit:
        await create_incident(
            "EXCESSIVE_DWELL", "MEDIUM", obs_dict, 
            f"Subject exceeded maximum dwell time ({dwell_limit}s) in zone."
        )
        
    # Rule 4: Tailgating
    if payload and payload.get("entity_count", 1) > 1:
        await create_incident(
            "TAILGATING_DETECTED", tailgating_sev, obs_dict,
            "Multiple physical entities detected following a single valid authorization."
        )

    # Routine telemetry (INFO)
    if payload:
        p_type = payload.get("type")
        if p_type == "motion" and payload.get("entity_count", 1) <= 1 and payload.get("dwell_time_seconds", 0) <= dwell_limit:
            await create_incident(
                "NORMAL_MOVEMENT", "INFO", obs_dict,
                "Routine movement detected."
            )
        elif p_type == "audio":
            db_level = payload.get("db_level", 0)
            if db_level < 85: # Normal noise threshold
                await create_incident(
                    "AMBIENT_NOISE_NORMAL", "INFO", obs_dict,
                    f"Routine ambient noise detected ({db_level}dB)."
                )
