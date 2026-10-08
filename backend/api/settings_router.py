from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Dict
import sqlite3

from api.auth_router import get_active_user, get_current_user, require_permissions
from core.db import get_sqlite_conn
from core.auth import hash_password, validate_password_complexity

router = APIRouter(prefix="/api/v1", tags=["settings"])

class User(BaseModel):
    username: str
    role: str
    password: str = None
    first_name: str = None
    last_name: str = None
    email: str = None
    phone: str = None
    title: str = None
    address_line1: str = None
    address_line2: str = None
    city: str = None
    state: str = None
    postal_code: str = None
    country: str = None
    locked: bool = False

class Zone(BaseModel):
    name: str
    clearance_level: int
    description: str = ''
    color: str = '#00d2ff'
    location: str = ''
    covered_area: float = 0.0
    geometry: str = ''

class Device(BaseModel):
    zone_id: int
    name: str
    device_type: str
    status: str = 'ONLINE'
    operating_mode: str = 'AUTO'
    x: int = None
    y: int = None

class DeviceType(BaseModel):
    name: str

class Setting(BaseModel):
    key: str
    value: str

class Role(BaseModel):
    id: int
    name: str
    description: str

def role_rank(role_name: str) -> int:
    if role_name == 'Administrator': return 100
    if role_name == 'Security Manager': return 90
    if role_name == 'User Manager': return 80
    return 10

def assert_can_manage(actor_role: str, target_role: str):
    if target_role == 'Administrator' and actor_role != 'Administrator':
        raise HTTPException(status_code=403, detail="Not authorized to manage an Administrator")
    if role_rank(target_role) > role_rank(actor_role):
        raise HTTPException(status_code=403, detail="Cannot manage a role ranked higher than your own")

@router.get("/roles")
async def get_roles(current_user: dict = Depends(require_permissions(['user_management']))):
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, description FROM roles")
    roles = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return roles

@router.get("/users")
async def get_users(current_user: dict = Depends(require_permissions(['user_management']))):
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, role, must_change_password, first_name, last_name, email, phone, title, address_line1, address_line2, city, state, postal_code, country, locked FROM users")
    users = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return users

@router.post("/users")
async def create_user(user: User, current_user: dict = Depends(require_permissions(['user_management']))):
    if current_user['role_name'] not in ['Administrator', 'User Manager']:
        raise HTTPException(status_code=403, detail="Not authorized to manage users")
    if role_rank(user.role) > role_rank(current_user['role_name']):
        raise HTTPException(status_code=403, detail="Cannot assign a role higher than your own")
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id FROM roles WHERE name = ?", (user.role,))
    role_row = cursor.fetchone()
    if not role_row:
        conn.close()
        raise HTTPException(status_code=422, detail="Unknown role")
    role_id = role_row[0]

    generated_password = None
    if user.password:
        pw_to_set = user.password
    else:
        import secrets
        import string
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*()"
        pw_to_set = "A1!" + ''.join(secrets.choice(alphabet) for _ in range(16))
        generated_password = pw_to_set

    try:
        validate_password_complexity(pw_to_set)
    except ValueError as e:
        conn.close()
        raise HTTPException(status_code=400, detail=str(e))

    pw_hash = hash_password(pw_to_set)

    import sqlite3
    try:
        cursor.execute(
            "INSERT INTO users (username, password_hash, role, role_id, first_name, last_name, email, phone, title, address_line1, address_line2, city, state, postal_code, country, locked, must_change_password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (user.username, pw_hash, user.role, role_id, user.first_name, user.last_name, user.email, user.phone, user.title, user.address_line1, user.address_line2, user.city, user.state, user.postal_code, user.country, user.locked, 1) # ZG-PWD-001
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=409, detail="User already exists")

    conn.close()
    response_data = {"status": "success"}
    if generated_password:
        response_data["temporary_password"] = generated_password
    return response_data

@router.put("/users/{user_id}")
async def update_user(user_id: int, user: User, current_user: dict = Depends(require_permissions(['user_management']))):
    if current_user['role_name'] not in ['Administrator', 'User Manager']:
        raise HTTPException(status_code=403, detail="Not authorized to manage users")
        
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    
    cursor.execute("SELECT role, locked FROM users WHERE id = ?", (user_id,))
    target_user_row = cursor.fetchone()
    if not target_user_row:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")
        
    try:
        assert_can_manage(current_user['role_name'], target_user_row['role'])
        assert_can_manage(current_user['role_name'], user.role)
    except HTTPException as e:
        conn.close()
        raise e
        
    if target_user_row['role'] == 'Administrator':
        if user.locked or user.role != 'Administrator':
            cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'Administrator' AND locked = 0 AND id != ?", (user_id,))
            other_admins = cursor.fetchone()[0]
            if other_admins == 0:
                conn.close()
                raise HTTPException(status_code=400, detail="Cannot lock or change role of the last usable administrator")

    if user.password:
        try:
            validate_password_complexity(user.password)
        except ValueError as e:
            conn.close()
            raise HTTPException(status_code=400, detail=str(e))
        
        pw_hash = hash_password(user.password)
        from core.db import set_password
        set_password(cursor, user_id, pw_hash, forced=True)
            
    cursor.execute("SELECT id FROM roles WHERE name = ?", (user.role,))
    role_row = cursor.fetchone()
    role_id = role_row[0] if role_row else None

    cursor.execute("UPDATE users SET username = ?, role = ?, role_id = ?, first_name = ?, last_name = ?, email = ?, phone = ?, title = ?, address_line1 = ?, address_line2 = ?, city = ?, state = ?, postal_code = ?, country = ?, locked = ? WHERE id = ?", 
                   (user.username, user.role, role_id, user.first_name, user.last_name, user.email, user.phone, user.title, user.address_line1, user.address_line2, user.city, user.state, user.postal_code, user.country, user.locked, user_id))
    conn.commit()
    conn.close()
    return {"status": "success"}

@router.delete("/users/{user_id}")
async def delete_user(user_id: int, current_user: dict = Depends(require_permissions(['user_management']))):
    if current_user['role_name'] not in ['Administrator', 'User Manager']:
        raise HTTPException(status_code=403, detail="Not authorized to delete users")
    if user_id == current_user['id']:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    
    cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,))
    target_user_row = cursor.fetchone()
    if not target_user_row:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")
        
    try:
        assert_can_manage(current_user['role_name'], target_user_row['role'])
    except HTTPException as e:
        conn.close()
        raise e
        
    if target_user_row['role'] == 'Administrator':
        cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'Administrator' AND locked = 0 AND id != ?", (user_id,))
        other_admins = cursor.fetchone()[0]
        if other_admins == 0:
            conn.close()
            raise HTTPException(status_code=400, detail="Cannot delete the last usable administrator")
            
    cursor.execute("DELETE FROM password_history WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}

@router.get("/zones")
async def get_zones(current_user: dict = Depends(require_permissions(['zone_management']))):
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    import json
    # Use PRAGMA or just select if it exists to be safe, but we know we added geometry
    cursor.execute("SELECT id, name, clearance_level, description, color, location, covered_area, geometry FROM zones")
    zones = []
    for row in cursor.fetchall():
        z = dict(row)
        if z.get('geometry'):
            try:
                z['geometry'] = json.loads(z['geometry'])
            except Exception:
                z['geometry'] = None
        zones.append(z)
    conn.close()
    return zones

@router.get("/dashboard/zones")
async def get_dashboard_zones(current_user: dict = Depends(require_permissions(['dashboard']))):
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    import json
    cursor.execute("SELECT id, name, clearance_level, description, color, location, covered_area, geometry FROM zones")
    zones = []
    for row in cursor.fetchall():
        z = dict(row)
        if z.get('geometry'):
            try:
                z['geometry'] = json.loads(z['geometry'])
            except Exception:
                z['geometry'] = None
        zones.append(z)
    conn.close()
    return zones

@router.post("/zones")
async def create_zone(zone: Zone, current_user: dict = Depends(require_permissions(['zone_management']))):
    if current_user['role_name'] not in ['Administrator', 'Security Manager']:
        raise HTTPException(status_code=403, detail="Not authorized to manage zones")
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO zones (name, clearance_level, description, color, location, covered_area, geometry) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (zone.name, zone.clearance_level, zone.description, zone.color, zone.location, zone.covered_area, zone.geometry)
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=409, detail="Zone name already exists")
    conn.close()
    return {"status": "success"}

@router.put("/zones/{zone_id}")
async def update_zone(zone_id: int, zone: Zone, current_user: dict = Depends(require_permissions(['zone_management']))):
    if current_user['role_name'] not in ['Administrator', 'Security Manager']:
        raise HTTPException(status_code=403, detail="Not authorized to manage zones")
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute("UPDATE zones SET name = ?, clearance_level = ?, description = ?, color = ?, location = ?, covered_area = ?, geometry = ? WHERE id = ?", (zone.name, zone.clearance_level, zone.description, zone.color, zone.location, zone.covered_area, zone.geometry, zone_id))
    conn.commit()
    conn.close()
    return {"status": "success"}

@router.delete("/zones/{zone_id}")
async def delete_zone(zone_id: int, current_user: dict = Depends(require_permissions(['zone_management']))):
    if current_user['role_name'] not in ['Administrator', 'Security Manager']:
        raise HTTPException(status_code=403, detail="Not authorized to manage zones")
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM zones WHERE id = ?", (zone_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}

@router.get("/devices")
async def get_devices(current_user: dict = Depends(require_permissions(['device_management']))):
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT id, zone_id, name, device_type, status, operating_mode, x, y FROM devices")
    devices = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return devices

@router.get("/dashboard/devices")
async def get_dashboard_devices(current_user: dict = Depends(require_permissions(['dashboard']))):
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT id, zone_id, name, device_type, status, operating_mode, x, y FROM devices")
    devices = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return devices

@router.post("/devices")
async def create_device(device: Device, current_user: dict = Depends(require_permissions(['device_management']))):
    if current_user['role_name'] not in ['Administrator', 'Security Manager']:
        raise HTTPException(status_code=403, detail="Not authorized to manage devices")
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO devices (zone_id, name, device_type, status, operating_mode, x, y) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (device.zone_id, device.name, device.device_type, 'ONLINE' if device.operating_mode == 'AUTO' else 'MAINTENANCE', device.operating_mode, device.x, device.y)
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=409, detail="Device creation failed due to constraint violation")
    conn.close()
    return {"status": "success"}

@router.put("/devices/{device_id}")
async def update_device(device_id: int, device: Device, current_user: dict = Depends(require_permissions(['device_management']))):
    if current_user['role_name'] not in ['Administrator', 'Security Manager']:
        raise HTTPException(status_code=403, detail="Not authorized to manage devices")
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE devices SET zone_id = ?, name = ?, device_type = ?, status = ?, operating_mode = ?, x = ?, y = ? WHERE id = ?",
        (device.zone_id, device.name, device.device_type, 'ONLINE' if device.operating_mode == 'AUTO' else 'MAINTENANCE', device.operating_mode, device.x, device.y, device_id)
    )
    conn.commit()
    conn.close()
    return {"status": "success"}

@router.delete("/devices/{device_id}")
async def delete_device(device_id: int, current_user: dict = Depends(require_permissions(['device_management']))):
    if current_user['role_name'] not in ['Administrator', 'Security Manager']:
        raise HTTPException(status_code=403, detail="Not authorized to manage devices")
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM devices WHERE id = ?", (device_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}
@router.get("/device-types")
async def get_device_types(current_user: dict = Depends(require_permissions(['device_management']))):
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name FROM device_types")
    types = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return types

@router.post("/device-types")
async def create_device_type(dt: DeviceType, current_user: dict = Depends(require_permissions(['device_management']))):
    if current_user['role_name'] not in ['Administrator', 'Security Manager']:
        raise HTTPException(status_code=403, detail="Not authorized")
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO device_types (name) VALUES (?)", (dt.name,))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=409, detail="Device type already exists")
    conn.close()
    return {"status": "success"}

@router.put("/device-types/{type_id}")
async def update_device_type(type_id: int, dt: DeviceType, current_user: dict = Depends(require_permissions(['device_management']))):
    if current_user['role_name'] not in ['Administrator', 'Security Manager']:
        raise HTTPException(status_code=403, detail="Not authorized")
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE device_types SET name = ? WHERE id = ?", (dt.name, type_id))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=409, detail="Device type already exists")
    conn.close()
    return {"status": "success"}

@router.delete("/device-types/{type_id}")
async def delete_device_type(type_id: int, current_user: dict = Depends(require_permissions(['device_management']))):
    if current_user['role_name'] not in ['Administrator', 'Security Manager']:
        raise HTTPException(status_code=403, detail="Not authorized")
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    
    # Check if any devices are using this type
    cursor.execute("SELECT name FROM device_types WHERE id = ?", (type_id,))
    dt_row = cursor.fetchone()
    if dt_row:
        type_name = dt_row['name']
        cursor.execute("SELECT COUNT(*) FROM devices WHERE device_type = ?", (type_name,))
        count = cursor.fetchone()[0]
        if count > 0:
            conn.close()
            raise HTTPException(status_code=400, detail=f"Cannot delete device type '{type_name}' because it is currently assigned to {count} device(s). Please change the device type for these devices before deleting.")

    cursor.execute("DELETE FROM device_types WHERE id = ?", (type_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}



@router.get("/system-settings")
async def get_system_settings(current_user: dict = Depends(require_permissions(['system_settings']))):
    if current_user['role_name'] != 'Administrator':
        raise HTTPException(status_code=403, detail="Administrator only")
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM system_settings")
    settings = {row['key']: row['value'] for row in cursor.fetchall()}
    conn.close()
    return settings

@router.put("/system-settings")
async def update_system_settings(settings: List[Setting], current_user: dict = Depends(require_permissions(['system_settings']))):
    if current_user['role_name'] != 'Administrator':
        raise HTTPException(status_code=403, detail="Administrator only")

    VALID_KEYS = {
        'pwd_expiration_enabled': (bool, None),
        'pwd_expiration_months': (int, 1),
        'pwd_min_length': (int, 6),
        'pwd_reveal_interval': (int, 0),
        'pwd_reveal_toggle_only': (bool, None),
        'pwd_require_upper': (bool, None),
        'pwd_require_lower': (bool, None),
        'pwd_require_number': (bool, None),
        'pwd_require_special': (bool, None),
        'feed_retention_hours': (int, 1)
    }
    # Upper bounds (server-side) for integer settings that need one
    MAX_VALUES = {'feed_retention_hours': 8760}  # one year

    conn = get_sqlite_conn()
    cursor = conn.cursor()
    for setting in settings:
        if setting.key not in VALID_KEYS:
            continue
            
        val_type, min_val = VALID_KEYS[setting.key]
        if val_type == bool:
            if setting.value not in ['true', 'false']:
                raise HTTPException(status_code=400, detail=f"Invalid boolean value for {setting.key}")
        elif val_type == int:
            try:
                int_val = int(setting.value)
                if min_val is not None and int_val < min_val:
                    raise HTTPException(status_code=400, detail=f"{setting.key} must be at least {min_val}")
                max_val = MAX_VALUES.get(setting.key)
                if max_val is not None and int_val > max_val:
                    raise HTTPException(status_code=400, detail=f"{setting.key} must be at most {max_val}")
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid integer value for {setting.key}")

        cursor.execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)", (setting.key, setting.value))

    conn.commit()
    conn.close()
    return {"status": "success"}

class ClearanceRule(BaseModel):
    level: int
    biometric_threshold: float
    max_dwell_time: int
    tailgating_severity: str

@router.get("/clearance-rules")
async def get_clearance_rules(current_user: dict = Depends(require_permissions(['security_rules']))):
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT level, biometric_threshold, max_dwell_time, tailgating_severity FROM clearance_rules ORDER BY level ASC")
    rules = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rules

@router.put("/clearance-rules/{level}")
async def update_clearance_rule(level: int, rule: ClearanceRule, current_user: dict = Depends(require_permissions(['security_rules']))):
    if current_user['role_name'] not in ['Administrator', 'Security Manager']:
        raise HTTPException(status_code=403, detail="Not authorized")
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE clearance_rules SET biometric_threshold = ?, max_dwell_time = ?, tailgating_severity = ? WHERE level = ?",
        (rule.biometric_threshold, rule.max_dwell_time, rule.tailgating_severity, level)
    )
    conn.commit()
    conn.close()
    return {"status": "success"}
