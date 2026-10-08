from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from core.db import init_dbs
from core.observability import add_observability, logger
from core.rate_limit import RateLimitingMiddleware
from core.security import HTTPSRedirectMiddleware, SecureHeadersMiddleware
from core.csrf import CSRFMiddleware
from api import auth_router, ingestion_router, settings_router

app = FastAPI(title="Zone Guard API", version="1.0.0")

# Setup Observability
add_observability(app)

# Setup Security
app.add_middleware(CSRFMiddleware)
app.add_middleware(HTTPSRedirectMiddleware)
app.add_middleware(SecureHeadersMiddleware)

# Setup Rate Limiting
app.add_middleware(RateLimitingMiddleware)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174", "http://localhost:1574", "http://127.0.0.1:1574"], # Explicit origins required with allow_credentials
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(ingestion_router.router)
app.include_router(settings_router.router)

import asyncio
import random
from core.db import get_sqlite_conn

async def device_status_simulator():
    while True:
        await asyncio.sleep(5)
        try:
            conn = get_sqlite_conn()
            cursor = conn.cursor()
            # If operating_mode is AUTO, simulate random online/offline state
            cursor.execute("SELECT id, status FROM devices WHERE operating_mode = 'AUTO'")
            auto_devices = cursor.fetchall()
            for row in auto_devices:
                # 90% chance online, 10% offline
                new_status = 'ONLINE' if random.random() > 0.1 else 'OFFLINE'
                if row['status'] != new_status:
                    cursor.execute("UPDATE devices SET status = ? WHERE id = ?", (new_status, row['id']))
            conn.commit()
            conn.close()
        except Exception as e:
            logger.error(f"Simulator error: {e}")

@app.on_event("startup")
async def startup_event():
    """Initialise the database layers on startup."""
    init_dbs()
    print("Databases initialised.")
    
    # Create indexes for telemetry DB
    from core.db import get_mongo_db
    import pymongo
    db = get_mongo_db()
    await db.access_events.create_index(
        [("subject_id", pymongo.ASCENDING), ("is_authorized", pymongo.ASCENDING), ("occurred_at", pymongo.DESCENDING)],
        background=True
    )
    print("MongoDB indexes created.")
    
    asyncio.create_task(device_status_simulator())
    print("Device simulator started.")

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "Zone Guard Core"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
