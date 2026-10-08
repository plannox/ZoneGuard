"""Prepare the Zone Guard database for use. Safe to run any number of times.

    cd backend
    .\\venv\\Scripts\\python.exe tools\\prepare_database.py          prepare, then show the generated logins
    .\\venv\\Scripts\\python.exe tools\\prepare_database.py --show   only show the generated logins

What it does:
  1. Creates the database schema and the 'admin' account if they do not exist yet.
     The generated administrator password is printed and saved (see below).
  2. Replaces the well-known default password of the built-in 'simulator_svc' account (it is
     public in the source code) with a random one and saves it to backend/data/simulator.cred,
     which the simulator launcher reads.

Generated logins are saved to backend/data/accounts.txt. That folder is never committed or published.
"""
import contextlib
import io
import re
import secrets
import sqlite3
import string
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from core.auth import hash_password, verify_password  # noqa: E402
from core.config import SQLITE_DB_PATH  # noqa: E402
from core.db import init_sqlite_db  # noqa: E402

DATA_DIR = BACKEND_DIR / "data"
ACCOUNTS_FILE = DATA_DIR / "accounts.txt"
SIMULATOR_CRED_FILE = DATA_DIR / "simulator.cred"
SIMULATOR_USER = "simulator_svc"
SIMULATOR_DEFAULT_PASSWORD = "Sim!Password123"  # seeded by core/db.py; replaced here


def random_password() -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*()"
    return "A1!" + "".join(secrets.choice(alphabet) for _ in range(16))


def save_account(username: str, role: str, password: str, note: str = "") -> None:
    """Append one generated login to accounts.txt (replacing an older line of the same user)."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    lines = []
    if ACCOUNTS_FILE.exists():
        lines = [l for l in ACCOUNTS_FILE.read_text(encoding="utf-8").splitlines() if l.split("\t")[0] != username]
    lines.append("\t".join([username, role, password, note]))
    ACCOUNTS_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")


def init_schema() -> None:
    """Create the schema (and the administrator if missing); remember a newly generated admin password."""
    buffer = io.StringIO()
    with contextlib.redirect_stdout(buffer):
        init_sqlite_db()
    match = re.search(r"INITIAL ADMIN PASSWORD GENERATED: (\S+) !!!", buffer.getvalue())
    if match:
        password = match.group(1)
        save_account("admin", "Administrator", password, "initial password - you must change it at first login")
        print(f"Administrator account created. Initial password (shown only now): {password}")


def rotate_simulator_password(conn: sqlite3.Connection) -> None:
    row = conn.execute("SELECT id, password_hash FROM users WHERE username = ?", (SIMULATOR_USER,)).fetchone()
    if not row:
        return
    if not verify_password(SIMULATOR_DEFAULT_PASSWORD, row[1]):
        return  # already replaced (or changed by an administrator)
    password = random_password()
    new_hash = hash_password(password)
    conn.execute("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?", (new_hash, row[0]))
    conn.execute("INSERT INTO password_history (user_id, password_hash) VALUES (?, ?)", (row[0], new_hash))
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    SIMULATOR_CRED_FILE.write_text(f"{SIMULATOR_USER}\n{password}\n", encoding="utf-8")
    print(f"Replaced the default password of '{SIMULATOR_USER}' (event simulator account) with a random one.")


def show_accounts() -> None:
    if not ACCOUNTS_FILE.exists():
        print("No generated logins are saved yet.")
        return
    print(f"  {'USERNAME':<18}{'ROLE':<34}{'PASSWORD':<24}NOTE")
    for line in ACCOUNTS_FILE.read_text(encoding="utf-8").splitlines():
        parts = (line.split("\t") + ["", "", "", ""])[:4]
        print(f"  {parts[0]:<18}{parts[1]:<34}{parts[2]:<24}{parts[3]}")


def prepare() -> None:
    init_schema()
    conn = sqlite3.connect(SQLITE_DB_PATH)
    try:
        rotate_simulator_password(conn)
        conn.commit()
    finally:
        conn.close()


if __name__ == "__main__":
    if "--show" not in sys.argv[1:]:
        prepare()
        print()
    show_accounts()
