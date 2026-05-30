import time
import asyncio
from typing import Dict, Tuple
from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from app.core.config import settings

class RateLimiterMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        # Store layout: IP -> (tokens, last_refill_timestamp)
        self.clients: Dict[str, Tuple[float, float]] = {}
        self.lock = asyncio.Lock()
        
        # Configure rate limit attributes (calls per window)
        self.rate = settings.RATE_LIMIT_CHAT_MAX_REQUESTS
        self.window = settings.RATE_LIMIT_CHAT_WINDOW_SECONDS
        self.refill_rate = self.rate / self.window  # tokens per second
        self.capacity = self.rate

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Bypass rate limit for health check
        if request.url.path == "/api/health" or request.url.path.endswith("/docs") or request.url.path.endswith("/openapi.json"):
            return await call_next(request)
            
        client_ip = request.client.host if request.client else "unknown"
        current_time = time.time()
        
        async with self.lock:
            if client_ip not in self.clients:
                self.clients[client_ip] = (self.capacity, current_time)
                
            tokens, last_refill = self.clients[client_ip]
            
            # Refill tokens based on elapsed time
            elapsed = current_time - last_refill
            refill_amount = elapsed * self.refill_rate
            tokens = min(self.capacity, tokens + refill_amount)
            
            # Check availability
            if tokens >= 1.0:
                self.clients[client_ip] = (tokens - 1.0, current_time)
            else:
                self.clients[client_ip] = (tokens, current_time)
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "success": False,
                        "error": "Rate limit exceeded. Please wait and try again."
                    }
                )
                
        return await call_next(request)
