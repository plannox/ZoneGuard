"""Reset the password of an existing account (default: admin) and unlock it.

Use this when the administrator password is lost or the account is locked.

    cd backend
    .\\venv\\Scripts\\python.exe tools\\reset_admin_password.py [username]

The new password is read from a hidden prompt. For non-interactive use set the
environment variable ZG_NEW_PASSWORD instead. The password must satisfy the current
password policy. The account must change the password again at the next login.
"""
import getpass
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.auth import hash_password, validate_password_complexity  # noqa: E402
from core.db import get_sqlite_conn, set_password  # noqa: E402


def main() -> int:
    username = sys.argv[1] if len(sys.argv) > 1 else "admin"

    new_password = os.environ.get("ZG_NEW_PASSWORD")
    if not new_password:
        new_password = getpass.getpass(f"New password for '{username}': ")
        if new_password != getpass.getpass("Repeat new password: "):
            print("Passwords do not match. Nothing changed.")
            return 1

    try:
        validate_password_complexity(new_password)
    except ValueError as exc:
        print(f"Password rejected: {exc}")
        return 1

    conn = get_sqlite_conn()
    try:
        cursor = conn.cursor()
        row = cursor.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if row is None:
            print(f"User '{username}' not found. Nothing changed.")
            return 1
        set_password(cursor, row["id"], hash_password(new_password), forced=True)
        cursor.execute("UPDATE users SET locked = 0, failed_login_attempts = 0 WHERE id = ?", (row["id"],))
        conn.commit()
    finally:
        conn.close()

    print(f"Password for '{username}' reset and account unlocked. A password change is required at next login.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
