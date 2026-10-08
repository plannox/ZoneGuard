# Zone Guard

Physical-and-cyber perimeter security prototype (TRL 7 demonstrator). It watches facility zones, ingests access and spatial-telemetry events, applies deterministic security rules and shows incidents to operators on a live map dashboard.

- **Backend:** Python 3.12, FastAPI, SQLite (configuration, users, RBAC, zones, devices) and MongoDB (events and incidents)
- **Frontend:** React 19 + Vite
- **Roles:** Administrator, Security Manager, User Manager, System / Server Manager, Operator, Supervisor / Operations Manager, Read-Only Viewer / Auditor, and the system role Device Agent (used by the event simulator)

> This repository is the **deployment package**. It is generated from the development repository. Report problems or request changes there; do not edit code here.

## Prerequisites

| Component | Version | Notes |
|---|---|---|
| Windows | 10 / 11 | The helper scripts are `.bat` files |
| Python | **3.12, 64-bit (Intel/AMD)** | newer versions such as 3.13/3.14 are not supported yet; 3.12 can be installed next to them |
| Node.js + npm | 20.19+ or 22.12+ | required by Vite 8 |
| MongoDB | running on `localhost:27017` | tested with 8.x; the backend will not start without it |

## Install

```bat
setup.bat
```

The setup asks one more question at the end: whether to load demo data (see below). The setup checks the requirements first (Python 3.12 64-bit, Node.js 20.19+/22.12+ with npm, MongoDB on `localhost:27017`) and shows a summary. **If something is missing it asks before installing anything**, for example "Python is missing or too old. Install Python 3.12 now? [Y/N]", and installs it with `winget` (Windows Package Manager) when you answer Y. MongoDB and some installers ask for administrator approval. If `winget` is not available, or you answer N, the script tells you where to download the software and stops until you run it again.

When the requirements are met it creates `backend\venv`, installs the Python packages, runs `npm ci` in `frontend` (this installs React and Vite) and verifies that both sets of packages work. It needs an internet connection.

Options: `setup.bat -CheckOnly` (report only, change nothing), `setup.bat -DryRun` (show the install commands without running them), `setup.bat -AssumeYes` (answer yes to every question, including the demo data, for unattended installs).

`setup.bat` lives in the project root and starts `setup\setup.ps1` (colour-coded progress: green = OK, yellow = note/outdated, red = missing/failed). Because PowerShell may block scripts, `setup.bat` first reads your PowerShell execution policy, sets it to `Bypass` for the current user only while the setup runs, and restores the previous value when it finishes. If the window is closed in the middle, it prints the one-line command that restores the old value.

**Troubleshooting: "Failed to build pydantic-core ... cargo / Rust".** This means the computer has a Python version for which the pinned packages are not available as ready-made installers (Python 3.13 or newer, or a 32-bit or ARM Windows Python). Zone Guard needs Python 3.12, 64-bit. `setup.bat` detects this, explains it, and offers to install Python 3.12 next to your existing Python (which stays untouched). An existing `backend\venv` created with another Python is rebuilt automatically.

**After a fully successful setup, `setup.bat` and the `setup` folder delete themselves** (so the setup cannot be run twice by accident). After a failed or partial setup, and after `-CheckOnly` or `-DryRun`, nothing is deleted and you can run it again. To get the setup files back, restore them from git (`git checkout -- setup.bat setup`) or download the repository again.

If a tool was just installed and is not found, close the window, open a new one and run `setup.bat` again so the updated `PATH` is picked up.

## Run

```bat
start.bat
```

`start.bat` prepares the database, then opens a window each for the backend (<http://127.0.0.1:8000>), the frontend (<http://localhost:5174>) and the event simulator, and opens the browser. Its own window stays open and lists the generated logins (see below), so you can copy them. `stop.bat` stops everything. MongoDB is never started or stopped by these scripts.

### First login

1. The initial administrator password is generated once. It is printed by the setup (if you loaded the demo data) or by `start.bat` on the first start, listed again at the end of every `start.bat` window, and saved in `backend\data\accounts.txt` (never committed). Copy it.
2. Open <http://localhost:5174>, log in as `admin` with that password.
3. You are asked to set a new password (current policy: at least 12 characters with upper case, lower case, number and special character).
4. Create the other accounts under **Settings > Users**. New users get a temporary password and must change it at first login.

If the administrator password is lost, or the account is locked:

```bat
cd backend
.\venv\Scripts\python.exe tools\reset_admin_password.py
```

The tool asks for a new password (hidden input), unlocks the account and forces a change at next login.

### Demo data (optional)

A fresh installation is empty: no zones, no devices, only the `admin` account. The last step of `setup.bat` asks whether to load demo data. Answer **Y** for a ready demo, **N** for an empty application. The demo data is:

- a sample facility: 10 zones and 9 devices
- one user per role (Administrator is the `admin` account): `security.manager`, `user.manager`, `system.manager`, `operator`, `supervisor`, `viewer`

Each demo user gets a random password. The list is printed once at the end of the setup and saved to `backend\data\accounts.txt` (never committed). Demo users do not have to change their password at first login.

You can load it later (or load only a part) with:

```bat
cd backend
.\venv\Scripts\python.exe tools\load_demo_data.py            zones, devices and users
.\venv\Scripts\python.exe tools\load_demo_data.py --zones    only the facility
.\venv\Scripts\python.exe tools\load_demo_data.py --users    only the demo users
```

It is safe to run again: zones are loaded only while there are none, and existing users are not changed.

### Event simulator (part of the demo)

The simulator generates normal and anomalous access and telemetry events, so the detection rules and the live incident feed can be demonstrated without hardware. **`start.bat` starts it automatically** in its own window ("Zone Guard Simulator") as soon as the backend answers. It runs until you stop it with Ctrl+C or `stop.bat`. To start it again by hand, run `simulator.bat` (the backend must be running).

It needs zones and devices to work with, so load the demo data (see above) or add zones and devices in Settings. Without zones it prints "No zones available" and stops.

**Login.** The simulator uses its own built-in service account `simulator_svc` (role *Device Agent*, which may only send events and read the zone and device lists). Nothing has to be typed: the setup replaces the account's public default password with a random one and saves it in `backend\data\simulator.cred`, which `start.bat` and `simulator.bat` use. If that file is missing, the simulator asks for a username and password.

It picks a random zone and one of these scenarios, in bursts and at random intervals:

| Scenario | Incident that appears |
|---|---|
| Authorized entry | `ROUTINE_ACCESS` (info) |
| Unauthorized zone | `UNAUTHORIZED_ZONE_ACCESS` |
| Biometric mismatch | `BIOMETRIC_MISMATCH` |
| Repeated failures (three denied attempts) | `UNAUTHORIZED_ZONE_ACCESS`, then `REPEATED_ACCESS_FAILURES` |
| Loitering | `EXCESSIVE_DWELL` |
| Tailgating | `TAILGATING_DETECTED` (severity from the zone's clearance level) |
| Event tampering (empty integrity data) | `PAYLOAD_TAMPERING` |
| Normal movement, ambient noise | `NORMAL_MOVEMENT`, `AMBIENT_NOISE_NORMAL` (info) |

A scenario only runs in a zone that has a suitable device (an access reader, a camera, a motion sensor or a microphone), otherwise that round is skipped, so zones with more devices produce more events. The dwell time and the tailgating severity follow **Settings > Security Rules**. The target is `http://127.0.0.1:8000`.

## Configuration

| Item | Default | How to change |
|---|---|---|
| Token signing key | generated on first start, stored in `backend/data/secret.key` | set environment variable `ZG_SECRET_KEY` before starting the backend |
| SQLite database | `backend/zoneguard_config.db` | fixed location |
| MongoDB | `mongodb://localhost:27017`, database `zoneguard_telemetry` | defined in `backend/core/db.py` |
| Ports | backend 8000, frontend 5174 | fixed; the frontend calls `http://localhost:8000` |
| Live feed retention | 48 hours | **Settings > System Settings > General** (1 - 8760 hours). Only the feed window; incidents stay stored in MongoDB |
| Security rules (biometric threshold, dwell time, tailgating severity per clearance level) | seeded defaults | **Settings > Security Rules**; changes apply within about 5 seconds |

The database, `backend/data/` and all logs are runtime data. They are listed in `.gitignore` and must never be committed or published. Back up `zoneguard_config.db` and `backend/data/secret.key` together; without the key every session is invalidated.

## Repository layout

```
backend/        FastAPI application (api, core, services, simulator), requirements.txt
backend/tools/  prepare_database.py, load_demo_data.py, run_simulator.py, reset_admin_password.py
backend/demo_data/  optional demo facility (SQL)
frontend/       React/Vite application
docs/           architecture decision records (ADR-001 to ADR-004) and the zone-map specification
setup.bat  start.bat  stop.bat  simulator.bat
setup/          setup.ps1 (requirements check and installer, started by setup.bat); both are removed after a successful setup
```

Not included on purpose: development tests, helper scripts, evidence-purge and backup stubs, the traceability matrix (being brought up to date) and any database or key material.

## Known limitations of this prototype

These are accepted for a TRL 7 demonstrator and are planned work for later maturity levels.

- **Single machine, plain HTTP.** The frontend has the API address `http://localhost:8000` built in and the backend allows only `localhost` origins. There is no TLS; cookies are marked `Secure` only when the app is served over HTTPS.
- **Run the frontend with `start.bat` (Vite dev server).** `npm run build` currently fails the TypeScript check, and a production bundle would not show the facility-map image on two Settings pages. Both are being fixed in development.
- **MongoDB must be reachable when the backend starts.**
- **Event sources are trusted.** Ingestion endpoints accept any session that has the `event_ingestion` permission (Administrator and Device Agent), but there is no per-source authentication. Adapter authentication (ADR-001), event de-duplication, replay protection and integrity (HMAC) checks are not implemented. The simulator is the only event source in the demo.
- **Rate limit** of 100 requests per minute per IP; several open dashboard tabs can trigger "429 Too Many Requests".
- **Concurrency.** SQLite is used synchronously without WAL mode; intended for one operator plus the simulator.
- **Password policy.** The upper/lower/number/special rules are always enforced; the on/off toggles for them in Settings have no effect. Five failed logins lock an account until an administrator unlocks it.
- **Not implemented:** encryption at rest (ADR-004), evidence purge, backup/restore.
- The demo data contains a zone named "SECURRY LOCATION" (typo in the source data).
