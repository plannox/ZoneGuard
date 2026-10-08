import os
import uuid
import random
from datetime import datetime, timezone
import asyncio
import httpx
import getpass
from pathlib import Path

# Simulator configuration
BASE_URL = "http://127.0.0.1:8000/api/v1"

# Login of the service account (simulator_svc) saved by the installer / tools/prepare_database.py:
# line 1 = username, line 2 = password. Nothing has to be typed when this file exists.
CRED_FILE = Path(__file__).resolve().parent.parent / "data" / "simulator.cred"

# Device types of a facility that count as access readers (besides card / reader / access in the name)
ACCESS_DEVICE_KEYWORDS = ["card", "reader", "access", "biometric", "rfid", "mantrap"]


def load_credentials():
    """Credentials in this order: environment variables, saved credential file, interactive prompt."""
    username = os.environ.get("ZG_SIMULATOR_USER")
    password = os.environ.get("ZG_SIMULATOR_PASS")
    if (not username or not password) and CRED_FILE.exists():
        lines = CRED_FILE.read_text(encoding="utf-8").splitlines()
        if len(lines) >= 2:
            username = username or lines[0].strip()
            password = password or lines[1].strip()
    if not username:
        username = input("Enter simulator username [simulator_svc]: ") or "simulator_svc"
    if not password:
        password = getpass.getpass("Enter simulator password: ")
    return username, password

class ScenarioEngine:
    def __init__(self, seed: int = 42):
        self.seed = seed
        random.seed(self.seed)
        self.client = httpx.AsyncClient(base_url=BASE_URL)
        self.zones = []
        self.zone_map = {}
        self.devices = []

    async def authenticate(self, username, password):
        form_data = {"username": username, "password": password}
        response = await self.client.post("/auth/login", data=form_data)
        if response.status_code == 200:
            csrf_token = self.client.cookies.get("csrf_token")
            if csrf_token:
                self.client.headers.update({"X-CSRF-Token": csrf_token})
            print("Simulator authenticated successfully.")
            return True
        else:
            print("Simulator authentication failed.")
            return False

    async def fetch_zones_and_devices(self):
        z_res = await self.client.get("/ingestion/zones")
        if z_res.status_code == 200:
            zones_data = z_res.json()
            self.zones = [z["name"] for z in zones_data]
            for z in zones_data:
                self.zone_map[z["id"]] = z["name"]
                self.zone_map[z["name"]] = z["id"]
            print(f"Loaded zones: {self.zones}")
        else:
            print("Failed to load zones.")
            
        d_res = await self.client.get("/ingestion/devices")
        if d_res.status_code == 200:
            self.devices = d_res.json()
            print(f"Loaded {len(self.devices)} devices.")
        else:
            print("Failed to load devices.")

    def get_device_for_zone(self, zone_name, required_type_keywords):
        zone_id = self.zone_map.get(zone_name)
        if not zone_id: return None
        
        zone_devs = [d for d in self.devices if str(d["zone_id"]) == str(zone_id)]
        valid_devs = [d for d in zone_devs if any(k in (d.get("device_type") or "").lower() for k in required_type_keywords)]
        
        if valid_devs:
            return random.choice(valid_devs)
        return None

    async def emit_access_event(self, subject_id: str, zone_id: str, is_authorized: bool, source_id: str, match_confidence: float = 0.99, integrity: str = "valid_hmac"):
        event = {
            "event_id": str(uuid.uuid4()),
            "source_id": source_id,
            "occurred_at": datetime.utcnow().isoformat(),
            "subject_id": subject_id,
            "zone_id": zone_id,
            "match_confidence": match_confidence,
            "is_authorized": is_authorized,
            "integrity_metadata": integrity
        }
        res = await self.client.post("/access-events", json=event)
        if res.status_code >= 400:
            print(f"[ERROR] access-events {res.status_code}: {res.text}")
        else:
            print(f"[OK] access-events -> {subject_id} at {zone_id} (auth={is_authorized}) via {source_id}")

    async def emit_telemetry(self, entity_id: str, zone_id: str, source_id: str, dwell_time: int = 0):
        obs = {
            "event_id": str(uuid.uuid4()),
            "source_id": source_id,
            "occurred_at": datetime.utcnow().isoformat(),
            "entity_id": entity_id,
            "current_zone_id": zone_id,
            "payload": {"dwell_time_seconds": dwell_time}
        }
        res = await self.client.post("/telemetry", json=obs)
        if res.status_code >= 400:
            print(f"[ERROR] telemetry {res.status_code}: {res.text}")
        else:
            print(f"[OK] telemetry -> {entity_id} at {zone_id} (dwell={dwell_time}s) via {source_id}")

    async def run_scenario_authorized_entry(self, zone):
        dev = self.get_device_for_zone(zone, ACCESS_DEVICE_KEYWORDS)
        if not dev: return False
        
        subject = f"EMP_{random.randint(100, 999)}"
        await self.emit_access_event(subject, zone, True, dev["name"])
        
        cam = self.get_device_for_zone(zone, ["cctv", "cam"])
        if cam:
            await self.emit_telemetry(subject, zone, cam["name"], dwell_time=10)
        return True

    async def run_scenario_biometric_mismatch(self, zone):
        dev = self.get_device_for_zone(zone, ACCESS_DEVICE_KEYWORDS)
        if not dev: return False
        subject = f"EMP_{random.randint(100, 999)}"
        await self.emit_access_event(subject, zone, True, dev["name"], match_confidence=0.65)
        return True

    async def run_scenario_unauthorized_zone(self, zone):
        dev = self.get_device_for_zone(zone, ACCESS_DEVICE_KEYWORDS)
        if not dev: return False
        subject = f"EMP_{random.randint(100, 999)}"
        await self.emit_access_event(subject, zone, False, dev["name"])
        return True

    async def run_scenario_loitering(self, zone):
        dev = self.get_device_for_zone(zone, ["cctv", "cam"])
        if not dev: return False
        subject = f"EMP_{random.randint(100, 999)}"
        await self.emit_telemetry(subject, zone, dev["name"], dwell_time=400)
        return True

    async def run_scenario_tampering(self, zone):
        dev = self.get_device_for_zone(zone, ACCESS_DEVICE_KEYWORDS + ["cctv", "cam", "pir", "mic"])
        if not dev: return False
        subject = f"EMP_{random.randint(100, 999)}"
        await self.emit_access_event(subject, zone, True, dev["name"], integrity="")
        return True

    async def run_scenario_tailgating(self, zone):
        dev = self.get_device_for_zone(zone, ["cctv", "cam"])
        if not dev: return False
        subject = f"EMP_{random.randint(100, 999)}"
        obs = {
            "event_id": str(uuid.uuid4()),
            "source_id": dev["name"],
            "occurred_at": datetime.utcnow().isoformat(),
            "entity_id": subject,
            "current_zone_id": zone,
            "payload": {"dwell_time_seconds": 5, "entity_count": random.randint(2, 4)}
        }
        res = await self.client.post("/telemetry", json=obs)
        if res.status_code < 400:
            print(f"[OK] telemetry -> {subject} at {zone} (TAILGATING) via {dev['name']}")
        return True

    async def run_scenario_movement(self, zone):
        dev = self.get_device_for_zone(zone, ["pir", "motion"])
        if not dev: return False
        obs = {
            "event_id": str(uuid.uuid4()),
            "source_id": dev["name"],
            "occurred_at": datetime.utcnow().isoformat(),
            "entity_id": "movement_detected",
            "current_zone_id": zone,
            "payload": {"dwell_time_seconds": 1, "entity_count": 1, "type": "motion"}
        }
        res = await self.client.post("/telemetry", json=obs)
        if res.status_code < 400:
            print(f"[OK] telemetry -> NORMAL MOVEMENT at {zone} via {dev['name']}")
        return True

    async def run_scenario_noise(self, zone):
        dev = self.get_device_for_zone(zone, ["mic", "audio"])
        if not dev: return False
        obs = {
            "event_id": str(uuid.uuid4()),
            "source_id": dev["name"],
            "occurred_at": datetime.utcnow().isoformat(),
            "entity_id": "noise_detected",
            "current_zone_id": zone,
            "payload": {"dwell_time_seconds": 1, "entity_count": 1, "type": "audio", "db_level": random.randint(40, 70)}
        }
        res = await self.client.post("/telemetry", json=obs)
        if res.status_code < 400:
            print(f"[OK] telemetry -> AMBIENT NOISE ({obs['payload']['db_level']}dB) at {zone} via {dev['name']}")
        return True

    async def run_scenario_repeated_failures(self, zone):
        dev = self.get_device_for_zone(zone, ACCESS_DEVICE_KEYWORDS)
        if not dev: return False
        subject = f"EMP_{random.randint(100, 999)}"
        for i in range(3):
            await self.emit_access_event(subject, zone, False, dev["name"])
            await asyncio.sleep(0.5)
        return True

    async def execute_all(self):
        username, password = load_credentials()

        if not await self.authenticate(username, password):
            return
            
        await self.fetch_zones_and_devices()
        if not self.zones:
            print("No zones available to run scenarios. Please configure zones first.")
            return
            
        print("Simulator is now running continuously. Press Ctrl+C to stop.")
        
        scenarios = [
            ("AUTHORIZED_ENTRY", self.run_scenario_authorized_entry),
            ("UNAUTHORIZED_ZONE", self.run_scenario_unauthorized_zone),
            ("BIOMETRIC_MISMATCH", self.run_scenario_biometric_mismatch),
            ("LOITERING", self.run_scenario_loitering),
            ("TAILGATING", self.run_scenario_tailgating),
            ("EVENT_TAMPERING", self.run_scenario_tampering),
            ("REPEATED_FAILURES", self.run_scenario_repeated_failures),
            ("MOVEMENT", self.run_scenario_movement),
            ("AMBIENT_NOISE", self.run_scenario_noise)
        ]
        
        weights = [40, 10, 5, 5, 5, 5, 5, 15, 10] 
        
        try:
            while True:
                is_burst = random.random() < 0.3
                burst_count = random.randint(2, 5) if is_burst else 1
                
                for _ in range(burst_count):
                    zone = random.choice(self.zones)
                    name, func = random.choices(scenarios, weights=weights, k=1)[0]
                    
                    success = await func(zone)
                    if success:
                        if is_burst:
                            await asyncio.sleep(random.uniform(0.1, 0.8))
                
                await asyncio.sleep(random.uniform(2.0, 8.0))
        except (asyncio.CancelledError, KeyboardInterrupt):
            pass
        finally:
            print("Shutting down simulator...")
            await self.client.aclose()

if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(line_buffering=True)
    engine = ScenarioEngine()
    asyncio.run(engine.execute_all())
