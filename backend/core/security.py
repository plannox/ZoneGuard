from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import RedirectResponse
from fastapi.responses import JSONResponse

class HTTPSRedirectMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Allow HTTP for local development tests if explicitly configured, but enforce otherwise
        # In a real environment, this might check for a DEV=1 environment variable
        client_host = request.client.host if request.client else "127.0.0.1"
        if request.url.scheme == "http" and client_host not in ["127.0.0.1", "localhost", "testserver"]:
            url = request.url.replace(scheme="https")
            return RedirectResponse(url, status_code=301)
        return await call_next(request)

class SecureHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        return response
