import time
import logging
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

logger = logging.getLogger("RAG_RequestLogger")

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        start_time = time.time()
        
        # Capture request path and method
        path = request.url.path
        method = request.method
        
        try:
            response = await call_next(request)
            process_time_ms = (time.time() - start_time) * 1000
            
            logger.info(
                f"{method} {path} - Completed with Status: {response.status_code} in {process_time_ms:.2f}ms"
            )
            return response
        except Exception as e:
            process_time_ms = (time.time() - start_time) * 1000
            logger.error(
                f"{method} {path} - Failed due to Exception: {str(e)} after {process_time_ms:.2f}ms",
                exc_info=True
            )
            raise e
