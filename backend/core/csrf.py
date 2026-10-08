import secrets
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.responses import JSONResponse

class CSRFMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method in ["POST", "PUT", "DELETE", "PATCH"]:
            # Exclude login from CSRF check
            if request.url.path != "/api/v1/auth/login":
                csrf_token = request.headers.get("X-CSRF-Token")
                cookie_csrf = request.cookies.get("csrf_token")
                
                if not csrf_token or not cookie_csrf or csrf_token != cookie_csrf:
                    return JSONResponse(status_code=403, content={"detail": "CSRF Token missing or invalid"})
                
        response = await call_next(request)
        
        # Issue a new CSRF token if one doesn't exist
        if "csrf_token" not in request.cookies:
            token = secrets.token_hex(32)
            response.set_cookie(key="csrf_token", value=token, httponly=False, secure=request.url.scheme == "https", samesite="lax")
            
        return response
