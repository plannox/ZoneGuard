"""Load the optional demo data into the database: the demo facility (zones, devices, device
types) and one demo account for every role except Administrator.

    cd backend
    .\\venv\\Scripts\\python.exe tools\\load_demo_data.py            zones, devices and demo users
    .\\venv\\Scripts\\python.exe tools\\load_demo_data.py --zones    only the facility
    .\\venv\\Scripts\\python.exe tools\\load_demo_data.py --users    only the demo users

It can run before the backend has ever been started: it first prepares the database (see
tools/prepare_database.py: schema, the administrator account, the simulator account).
It is safe to run again: zones are loaded only into an empty zone table, and a demo user that
already exists is left untouched.

Demo accounts get a random password each, printed once and saved to backend/data/accounts.txt
(that folder is never committed). They do not have to change it at first login, to keep the demo smooth.
"""
import sqlite3
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from core.auth import hash_password, validate_password_complexity  # noqa: E402
from core.config import SQLITE_DB_PATH  # noqa: E402
from prepare_database import ACCOUNTS_FILE, prepare, random_password, save_account  # noqa: E402

SQL_FILE = BACKEND_DIR / "demo_data" / "demo_zones_devices.sql"

# (username, role, first name, last name, title)
DEMO_USERS = [
    ("security.manager", "Security Manager", "Sasha", "Kovac", "Head of Security"),
    ("user.manager", "User Manager", "Una", "Horvat", "Account Administrator"),
    ("system.manager", "System / Server Manager", "Sam", "Novak", "Systems Engineer"),
    ("operator", "Operator", "Olga", "Ruzic", "Control Room Operator"),
    ("supervisor", "Supervisor / Operations Manager", "Sven", "Babic", "Shift Supervisor"),
    ("viewer", "Read-Only Viewer / Auditor", "Vera", "Juric", "Internal Auditor"),
]


def make_password() -> str:
    password = random_password()
    validate_password_complexity(password)
    return password


def load_zones(conn: sqlite3.Connection) -> None:
    if conn.execute("SELECT COUNT(*) FROM zones").fetchone()[0] > 0:
        print("Zones already exist - facility not loaded.")
        return
    conn.executescript(SQL_FILE.read_text(encoding="utf-8"))
    zones = conn.execute("SELECT COUNT(*) FROM zones").fetchone()[0]
    devices = conn.execute("SELECT COUNT(*) FROM devices").fetchone()[0]
    print(f"Loaded {zones} zones and {devices} devices.")


def load_users(conn: sqlite3.Connection) -> None:
    created = []
    for username, role, first, last, title in DEMO_USERS:
        if conn.execute("SELECT 1 FROM users WHERE username = ?", (username,)).fetchone():
            print(f"User '{username}' already exists - left untouched.")
            continue
        role_row = conn.execute("SELECT id FROM roles WHERE name = ?", (role,)).fetchone()
        if not role_row:
            print(f"Role '{role}' not found - user '{username}' skipped.")
            continue
        password = make_password()
        pw_hash = hash_password(password)
        cursor = conn.execute(
            "INSERT INTO users (username, password_hash, role, role_id, first_name, last_name, email, title, "
            "locked, must_change_password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)",
            (username, pw_hash, role, role_row[0], first, last, f"{username}@zoneguard.example", title),
        )
        conn.execute("INSERT INTO password_history (user_id, password_hash) VALUES (?, ?)", (cursor.lastrowid, pw_hash))
        created.append((username, role, password))
    if not created:
        return

    print(f"\nCreated {len(created)} demo accounts (one per role). Passwords are shown only now:\n")
    print(f"  {'USERNAME':<18}{'ROLE':<34}PASSWORD")
    for username, role, password in created:
        print(f"  {username:<18}{role:<34}{password}")
    for username, role, password in created:
        save_account(username, role, password, "demo account")
    print(f"\n  Also saved to {ACCOUNTS_FILE} (never commit or publish this file).")


def main() -> int:
    flags = {a for a in sys.argv[1:] if a.startswith("--")}
    unknown = flags - {"--zones", "--users", "--all"}
    if unknown:
        print(f"Unknown option(s): {', '.join(sorted(unknown))}. Use --zones, --users or --all.")
        return 2
    want_zones = bool(flags & {"--zones", "--all"}) or not flags
    want_users = bool(flags & {"--users", "--all"}) or not flags

    prepare()
    print()

    conn = sqlite3.connect(SQLITE_DB_PATH)
    try:
        if want_zones:
            load_zones(conn)
        if want_users:
            load_users(conn)
        conn.commit()
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
