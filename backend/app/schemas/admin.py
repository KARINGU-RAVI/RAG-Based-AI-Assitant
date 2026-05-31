from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class SystemLogResponse(BaseModel):
    id: int
    level: str
    module: str
    message: str
    details_json: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AnalyticsResponse(BaseModel):
    total_users: int
    total_documents: int
    total_conversations: int
    total_messages: int
    average_similarity_score: float
    total_tokens_used: int

class SystemSettings(BaseModel):
    GEMINI_API_KEY: str
