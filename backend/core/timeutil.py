from datetime import datetime, timezone

def now_utc():
    return datetime.now(timezone.utc)

def parse_ts(value):
    if not value:
        return None
    dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt
