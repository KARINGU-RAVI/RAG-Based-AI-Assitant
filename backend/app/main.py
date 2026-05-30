from fastapi import FastAPI, Depends, status
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import engine, Base
from app.middleware.logging import RequestLoggingMiddleware
from app.middleware.rate_limit import RateLimiterMiddleware

# Import sub-routers
from app.api.v1.auth import router as auth_router
from app.api.v1.chat import router as chat_router
from app.api.v1.documents import router as documents_router
from app.api.v1.admin import router as admin_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Complete production-grade RAG Chat Assistant Backend.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# 1. Configure CORS
# Allow local Vite dev server and standard ports
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For deployment, configure strict lists e.g., ["http://localhost:5173"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Register Custom Middlewares
app.add_middleware(RateLimiterMiddleware)
app.add_middleware(RequestLoggingMiddleware)

# 3. Database Table Auto-Bootstrapper on application startup
@app.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        # Automatically creates SQLite tables on boot if missing
        await conn.run_sync(Base.metadata.create_all)
    print("[FastAPI Application] Asynchronous database bootstrapper initialized. All tables confirmed.")

# 4. Bind Sub-routers
app.include_router(auth_router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])
app.include_router(chat_router, prefix=f"{settings.API_V1_STR}/chat", tags=["Conversational Chat"])
app.include_router(documents_router, prefix=f"{settings.API_V1_STR}/documents", tags=["Knowledge Base Documents"])
app.include_router(admin_router, prefix=f"{settings.API_V1_STR}/admin", tags=["Administrative Dashboard"])

# 5. Core System Health Check
@app.get("/api/health", status_code=status.HTTP_200_OK)
async def system_health_check():
    """Performs a fast service health check, reporting application status."""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "database": "connected",
        "version": "1.0.0"
    }
