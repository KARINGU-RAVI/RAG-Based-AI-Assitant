from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, ConfigDict

class ChatRequest(BaseModel):
    sessionId: str = Field(..., description="The unique session/conversation identifier")
    message: str = Field(..., min_length=1, description="The user's query message")

class SourceCitation(BaseModel):
    document_name: str
    chunk_index: int
    content: str
    similarity_score: float

class ChatResponse(BaseModel):
    reply: str
    sources: List[SourceCitation]
    similarityScores: List[float]
    tokensUsed: int

class FeedbackRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="Star rating from 1 to 5")
    text: Optional[str] = Field(None, description="Optional text comments regarding the quality of answer")

class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    total_tokens: Optional[int] = None
    sources_json: Optional[str] = None
    feedback_rating: Optional[int] = None
    feedback_text: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ConversationResponse(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
