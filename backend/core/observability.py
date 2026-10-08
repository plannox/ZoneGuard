import logging
import json
import uuid
import time
from contextvars import ContextVar
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from fastapi import FastAPI
import traceback

# Context variable to store correlation ID for the current async task
correlation_id_ctx_var: ContextVar[str] = ContextVar("correlation_id", default="")

class StructuredFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            "timestamp": self.formatTime(record, self.datefmt),
            "severity": record.levelname,
            "component": record.name,
            "message": record.getMessage(),
            "correlation_id": correlation_id_ctx_var.get(),
        }
        if record.exc_info:
            log_record["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_record)

def setup_logging():
    logger = logging.getLogger("zoneguard")
    logger.setLevel(logging.INFO)
    
    # Avoid duplicate logs if already configured
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(StructuredFormatter())
        logger.addHandler(handler)
        
    return logger

logger = setup_logging()

class ObservabilityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # 1. Correlation ID
        correlation_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4()))
        token = correlation_id_ctx_var.set(correlation_id)
        
        # 2. Latency instrumentation
        start_time = time.perf_counter()
        
        try:
            response = await call_next(request)
            process_time = time.perf_counter() - start_time
            response.headers["X-Correlation-ID"] = correlation_id
            response.headers["X-Process-Time"] = str(process_time)
            
            # Log successful request
            logger.info(f"{request.method} {request.url.path} completed in {process_time:.4f}s with status {response.status_code}")
            return response
        except Exception as e:
            process_time = time.perf_counter() - start_time
            logger.error(f"{request.method} {request.url.path} failed in {process_time:.4f}s: {str(e)}", exc_info=True)
            raise
        finally:
            correlation_id_ctx_var.reset(token)

def add_observability(app: FastAPI):
    app.add_middleware(ObservabilityMiddleware)
