"""Start the event simulator with the saved simulator login.

    cd backend
    .\\venv\\Scripts\\python.exe tools\\run_simulator.py

Reads backend/data/simulator.cred (written by tools/prepare_database.py) and passes it to the simulator
through the environment, so no password has to be typed or passed through a batch file. If the file is
missing the simulator asks for a username and password itself.

The simulator itself (backend/simulator/engine.py) is the development copy and is not modified here.
It picks "access" devices by looking for card / reader / access in the device type name, which the
device types of the demo facility (BIOMETRIC, RFID, MANTRAP) do not contain, so no access scenario
would ever run. This launcher teaches it that those three types are access devices.
"""
import asyncio
import importlib.util
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
CRED_FILE = BACKEND_DIR / "data" / "simulator.cred"
ENGINE_FILE = BACKEND_DIR / "simulator" / "engine.py"

if "ZG_SIMULATOR_USER" not in os.environ and "ZG_SIMULATOR_PASS" not in os.environ:
    lines = CRED_FILE.read_text(encoding="utf-8").splitlines() if CRED_FILE.exists() else []
    if len(lines) >= 2:
        os.environ["ZG_SIMULATOR_USER"], os.environ["ZG_SIMULATOR_PASS"] = lines[0], lines[1]
    else:
        print("No saved simulator login found - the simulator will ask for one.")

os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))
sys.stdout.reconfigure(line_buffering=True)

spec = importlib.util.spec_from_file_location("zg_simulator_engine", ENGINE_FILE)
engine = importlib.util.module_from_spec(spec)
spec.loader.exec_module(engine)

_original = engine.ScenarioEngine.get_device_for_zone


def _get_device_for_zone(self, zone_name, required_type_keywords):
    keywords = list(required_type_keywords)
    if any(k in ("card", "reader", "access") for k in keywords):
        keywords += ["biometric", "rfid", "mantrap"]
    return _original(self, zone_name, keywords)


engine.ScenarioEngine.get_device_for_zone = _get_device_for_zone

if __name__ == "__main__":
    asyncio.run(engine.ScenarioEngine().execute_all())
