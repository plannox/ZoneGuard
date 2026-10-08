import time
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

# Simple in-memory rate limiting (Token Bucket or fixed window)
# In production, use Redis or Memcached
RATE_LIMIT = 100 # requests
RATE_WINDOW = 60 # seconds

client_requests = {}

class RateLimitingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host if request.client else "127.0.0.1"
        current_time = time.time()
        
        # Clean up old entries
        if client_ip in client_requests:
            client_requests[client_ip] = [t for t in client_requests[client_ip] if current_time - t < RATE_WINDOW]
        else:
            client_requests[client_ip] = []
            
        if len(client_requests[client_ip]) >= RATE_LIMIT:
            return JSONResponse(status_code=429, content={"detail": "Too Many Requests"})
            
        client_requests[client_ip].append(current_time)
        response = await call_next(request)
        return response
