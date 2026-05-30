import os
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

# Root directory of the backend
BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "Production RAG Chat Assistant"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./rag_assistant.db"
    
    # JWT Authentication
    JWT_SECRET_KEY: str = "supersecretkeychangeinproduction1234567890!@#"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    
    # AI Config
    GEMINI_API_KEY: str = ""
    EMBEDDING_MODEL: str = "models/gemini-embedding-001"
    GENERATIVE_MODEL: str = "gemini-2.5-flash"
    
    # Vector Index Storage
    VECTOR_STORAGE_DIR: str = str(BASE_DIR / "storage")
    VECTOR_INDEX_NAME: str = "vector_store.index"
    VECTOR_MAP_NAME: str = "id_map.json"
    
    # Upload limits
    UPLOAD_DIR: str = str(BASE_DIR / "uploads")
    MAX_FILE_SIZE_BYTES: int = 15 * 1024 * 1024  # 15 MB
    ALLOWED_EXTENSIONS: List[str] = [".pdf", ".txt", ".docx", ".json"]
    
    # RAG parameters
    TOP_K: int = 5
    SIMILARITY_THRESHOLD: float = 0.60
    CHUNK_SIZE: int = 400  # Target tokens
    CHUNK_OVERLAP: int = 50  # Overlap tokens
    
    # Security/Rate Limiting
    RATE_LIMIT_CHAT_MAX_REQUESTS: int = 60
    RATE_LIMIT_CHAT_WINDOW_SECONDS: int = 60
    RATE_LIMIT_UPLOAD_MAX_REQUESTS: int = 10
    RATE_LIMIT_UPLOAD_WINDOW_SECONDS: int = 60

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def vector_index_path(self) -> Path:
        return Path(self.VECTOR_STORAGE_DIR) / self.VECTOR_INDEX_NAME

    @property
    def vector_map_path(self) -> Path:
        return Path(self.VECTOR_STORAGE_DIR) / self.VECTOR_MAP_NAME

settings = Settings()

# Ensure critical storage and upload directories exist
os.makedirs(settings.VECTOR_STORAGE_DIR, exist_ok=True)
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
