import os
import secrets
import tempfile
from pathlib import Path

# Resolve base paths based on this file's location
CORE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CORE_DIR.parent
DATA_DIR = BACKEND_DIR / "data"

SQLITE_DB_PATH = str(BACKEND_DIR / "zoneguard_config.db")

def get_secret_key() -> str:
    # 1. Environment variable
    env_key = os.environ.get("ZG_SECRET_KEY")
    if env_key:
        return env_key

    # 2. Persisted key file
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    key_file_path = DATA_DIR / "secret.key"
    
    if key_file_path.exists():
        try:
            key = key_file_path.read_text(encoding="utf-8").strip()
            if not key:
                raise ValueError("Key file is empty.")
            return key
        except Exception as e:
            raise RuntimeError(f"Failed to read secret key from {key_file_path}: {e}. Please fix the file or remove it to regenerate.")
    
    # 3. Generate one
    new_key = secrets.token_urlsafe(48)
    
    # Write safely using temp file to avoid race conditions
    fd, temp_path = tempfile.mkstemp(dir=str(DATA_DIR), prefix=".secret.key.tmp")
    with os.fdopen(fd, 'w', encoding="utf-8") as f:
        f.write(new_key)
        
    # Attempt to rename atomically
    try:
        os.replace(temp_path, str(key_file_path))
        # Best-effort secure permissions
        try:
            os.chmod(str(key_file_path), 0o600)
        except Exception:
            pass
        return new_key
    except Exception:
        # If replace failed (e.g., race condition and another process created it)
        os.unlink(temp_path)
        if key_file_path.exists():
            return key_file_path.read_text(encoding="utf-8").strip()
        raise

SECRET_KEY = get_secret_key()
