from datetime import datetime, timedelta
from typing import Optional
import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from fastapi.responses import JSONResponse
from fastapi import Request

from core.db import get_sqlite_conn
from core.auth import verify_password, hash_password, validate_password_complexity

from core.config import SECRET_KEY
ALGORITHM = "HS256"
SESSION_INACTIVITY_MINUTES = 30
SESSION_ABSOLUTE_HOURS = 12
router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

@router.get("/public-settings")
async def get_public_settings():
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM system_settings WHERE key IN ('pwd_reveal_interval', 'pwd_min_length', 'pwd_reveal_toggle_only')")
    settings = {row['key']: row['value'] for row in cursor.fetchall()}
    conn.close()
    return settings

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

class PersonalDetailsUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    title: Optional[str] = None
    phone: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None

def create_access_token(data: dict):
    to_encode = data.copy()
    now = datetime.utcnow()
    to_encode.update({
        "exp": now + timedelta(minutes=SESSION_INACTIVITY_MINUTES),
        "session_start": data.get("session_start", now.timestamp())
    })
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(request: Request):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    token = request.cookies.get("session_token")
    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        session_start: float = payload.get("session_start")
        
        if username is None or session_start is None:
            raise credentials_exception
            
        # Absolute lifetime check
        start_time = datetime.fromtimestamp(session_start)
        if datetime.utcnow() - start_time > timedelta(hours=SESSION_ABSOLUTE_HOURS):
            raise credentials_exception
            
    except jwt.PyJWTError:
        raise credentials_exception
        
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT u.id, u.username, u.must_change_password, u.last_password_change, u.locked, r.name as role_name 
        FROM users u 
        LEFT JOIN roles r ON u.role_id = r.id 
        WHERE u.username = ?
    ''', (username,))
    user = cursor.fetchone()
    conn.close()
    
    if user is None:
        raise credentials_exception
        
    if user['locked']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is locked"
        )
        
    # If the user must change their password, they are not fully authenticated for regular endpoints
    # To allow them to call /change-password, we will just return the user, and normal endpoints 
    # must check `must_change_password`. We'll create another dependency for that.
    return dict(user)

def get_active_user(current_user: dict = Depends(get_current_user)):
    if current_user.get("must_change_password"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Password change required"
        )
    return current_user

def require_permissions(required_perms: list):
    def permission_checker(current_user: dict = Depends(get_active_user)):
        conn = get_sqlite_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT r.permissions, r.name as role_name FROM roles r JOIN users u ON u.role_id = r.id WHERE u.id = ?", (current_user['id'],))
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
            
        if row['role_name'] == 'Administrator':
            return current_user
            
        if not row['permissions']:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
            
        import json
        try:
            user_perms = json.loads(row['permissions'])
        except:
            user_perms = []
            
        for p in required_perms:
            if p not in user_perms:
                raise HTTPException(status_code=403, detail="Insufficient permissions")
                
        return current_user
    return permission_checker

@router.post("/login")
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT u.id, u.username, u.password_hash, u.must_change_password, u.locked, u.failed_login_attempts, 
               u.first_name, u.last_name, u.email, u.title, u.phone, u.address_line1, u.address_line2, 
               u.city, u.state, u.postal_code, u.country,
               r.name as role_name, r.permissions
        FROM users u 
        LEFT JOIN roles r ON u.role_id = r.id 
        WHERE u.username = ?
    ''', (form_data.username,))
    user = cursor.fetchone()

    if not user:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
        
    if user['locked']:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is locked",
        )

    if not verify_password(form_data.password, user['password_hash']):
        # Handle failed attempt
        failed_attempts = (user['failed_login_attempts'] or 0) + 1
        lock_account = False
        
        if failed_attempts >= 5:
            # Check last-usable-administrator protection
            if user['role_name'] == 'Administrator':
                cursor.execute('''
                    SELECT COUNT(*) FROM users u 
                    JOIN roles r ON u.role_id = r.id 
                    WHERE r.name = 'Administrator' AND u.locked = 0 AND u.id != ?
                ''', (user['id'],))
                other_admins_count = cursor.fetchone()[0]
                
                if other_admins_count > 0:
                    lock_account = True
            else:
                lock_account = True
                
        if lock_account:
            cursor.execute("UPDATE users SET failed_login_attempts = ?, locked = 1 WHERE id = ?", (failed_attempts, user['id']))
            conn.commit()
            conn.close()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account locked due to too many failed attempts",
            )
        else:
            cursor.execute("UPDATE users SET failed_login_attempts = ? WHERE id = ?", (failed_attempts, user['id']))
            conn.commit()
            conn.close()
            remaining = max(0, 5 - failed_attempts)
            # If last usable admin, it never locks, so we just say incorrect password.
            if remaining == 0:
                detail_msg = "Incorrect username or password"
            else:
                detail_msg = f"Incorrect username or password. {remaining} attempt(s) remaining before lockout."
                
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=detail_msg,
            )

    # Successful login, reset failed attempts
    if user['failed_login_attempts'] > 0:
        cursor.execute("UPDATE users SET failed_login_attempts = 0 WHERE id = ?", (user['id'],))
        conn.commit()

    # Check expiration (ZG-PWD-013, ZG-PWD-016)
    # Get settings
    cursor.execute("SELECT key, value FROM system_settings")
    settings = {row['key']: row['value'] for row in cursor.fetchall()}
    
    if settings.get('pwd_expiration_enabled') == 'true':
        cursor.execute("SELECT last_password_change FROM users WHERE id = ?", (user['id'],))
        last_change_row = cursor.fetchone()
        if last_change_row and last_change_row[0]:
            from core.timeutil import now_utc, parse_ts
            last_change = parse_ts(last_change_row[0])
            months = int(settings.get('pwd_expiration_months', 6))
            if now_utc() - last_change > timedelta(days=30 * months):
                # Expired! Force change
                cursor.execute("UPDATE users SET must_change_password = 1 WHERE id = ?", (user['id'],))
                conn.commit()
                user = dict(user)
                user['must_change_password'] = 1

    conn.close()

    access_token = create_access_token(data={"sub": form_data.username})
    
    import json
    perms = []
    if user['permissions']:
        try:
            perms = json.loads(user['permissions'])
        except:
            pass

    response = JSONResponse(content={
        "message": "Successfully logged in", 
        "must_change_password": bool(user['must_change_password']),
        "username": user['username'],
        "role": user['role_name'],
        "permissions": perms,
        "first_name": user['first_name'] or "",
        "last_name": user['last_name'] or "",
        "email": user['email'] or "",
        "title": user['title'] or "",
        "phone": user['phone'] or "",
        "address_line1": user['address_line1'] or "",
        "address_line2": user['address_line2'] or "",
        "city": user['city'] or "",
        "state": user['state'] or "",
        "postal_code": user['postal_code'] or "",
        "country": user['country'] or ""
    })
    response.set_cookie(
        key="session_token",
        value=access_token,
        httponly=True,
        secure=request.url.scheme == "https", 
        samesite="lax",
        max_age=SESSION_INACTIVITY_MINUTES * 60
    )
    return response

@router.post("/refresh")
async def refresh_session(request: Request, response: JSONResponse):
    token = request.cookies.get("session_token")
    if not token:
        raise HTTPException(status_code=401)
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        new_token = create_access_token({
            "sub": payload.get("sub"),
            "session_start": payload.get("session_start")
        })
        response = JSONResponse(content={"status": "refreshed"})
        response.set_cookie(
            key="session_token",
            value=new_token,
            httponly=True,
            samesite="lax",
            secure=request.url.scheme == "https"
        )
        return response
    except jwt.PyJWTError:
        raise HTTPException(status_code=401)

@router.post("/logout")
async def logout():
    response = JSONResponse(content={"message": "Logged out"})
    response.delete_cookie("session_token")
    return response

@router.get("/me")
async def get_my_details(current_user: dict = Depends(get_current_user)):
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT first_name, last_name, email, title, phone, address_line1, address_line2, city, state, postal_code, country
        FROM users 
        WHERE id = ?
    ''', (current_user['id'],))
    user = cursor.fetchone()
    conn.close()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    return dict(user)

@router.put("/me")
async def update_my_details(req: PersonalDetailsUpdate, current_user: dict = Depends(get_current_user)):
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE users 
        SET first_name = ?, last_name = ?, email = ?, title = ?, phone = ?, address_line1 = ?, address_line2 = ?, city = ?, state = ?, postal_code = ?, country = ?
        WHERE id = ?
    ''', (
        req.first_name, req.last_name, req.email, req.title, req.phone, req.address_line1, req.address_line2, req.city, req.state, req.postal_code, req.country,
        current_user['id']
    ))
    conn.commit()
    conn.close()
    return {"message": "Personal details updated successfully"}

@router.post("/change-password")
async def change_password(req: ChangePasswordRequest, current_user: dict = Depends(get_current_user)):
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    
    cursor.execute("SELECT password_hash, last_password_change, must_change_password FROM users WHERE id = ?", (current_user['id'],))
    user_record = cursor.fetchone()
    
    if not verify_password(req.old_password, user_record['password_hash']):
        conn.close()
        raise HTTPException(status_code=400, detail="Incorrect old password")
        
    # ZG-PWD-007, ZG-PWD-008: 48-hour voluntary change limit
    # If not forced, check the 48 hours
    if not user_record['must_change_password'] and user_record['last_password_change']:
        from core.timeutil import now_utc, parse_ts
        last_change = parse_ts(user_record['last_password_change'])
        if now_utc() - last_change < timedelta(hours=48):
            conn.close()
            raise HTTPException(status_code=400, detail="Cannot change password voluntarily within 48 hours")
            
    # Validate complexity
    try:
        validate_password_complexity(req.new_password)
    except ValueError as e:
        conn.close()
        raise HTTPException(status_code=400, detail=str(e))
        
    # ZG-PWD-009, ZG-PWD-010: History check (previous 5)
    cursor.execute("SELECT password_hash FROM password_history WHERE user_id = ? ORDER BY id DESC LIMIT 5", (current_user['id'],))
    history = cursor.fetchall()
    for h in history:
        if verify_password(req.new_password, h['password_hash']):
            conn.close()
            raise HTTPException(status_code=400, detail="Cannot reuse any of the previous 5 passwords")
            
    # Change password
    new_hash = hash_password(req.new_password)
    from core.db import set_password
    set_password(cursor, current_user['id'], new_hash, forced=False)
                   
    conn.commit()
    conn.close()
    
    # Invalidate session (logout) to force re-auth per ZG-PWD-017
    response = JSONResponse(content={"message": "Password changed successfully. Please login again."})
    response.delete_cookie("session_token")
    return response
