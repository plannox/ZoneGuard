import bcrypt

def hash_password(password: str) -> str:
    """Hash a password using bcrypt directly to avoid passlib bugs."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a stored hash using bcrypt directly."""
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

import re
from core.db import get_sqlite_conn

def validate_password_complexity(password: str) -> bool:
    """Validate password against complexity policy: length 6, upper, lower, number, special.
    Uses system settings but enforces hardcoded absolute minimums."""
    
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM system_settings")
    settings = {row['key']: row['value'] for row in cursor.fetchall()}
    conn.close()

    # Enforce minimums (cannot be bypassed)
    min_length = max(6, int(settings.get('pwd_min_length', 6)))
    req_upper = settings.get('pwd_require_upper', 'true') == 'true'
    req_lower = settings.get('pwd_require_lower', 'true') == 'true'
    req_number = settings.get('pwd_require_number', 'true') == 'true'
    req_special = settings.get('pwd_require_special', 'true') == 'true'

    if len(password) < min_length:
        raise ValueError(f"Password must be at least {min_length} characters long.")
    
    # We still enforce the absolute minimums even if admin disabled them
    if not re.search(r"[a-z]", password):
        raise ValueError("Password must contain at least one lowercase letter.")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must contain at least one uppercase letter.")
    if not re.search(r"[0-9]", password):
        raise ValueError("Password must contain at least one number.")
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        raise ValueError("Password must contain at least one special character.")
        
    return True
