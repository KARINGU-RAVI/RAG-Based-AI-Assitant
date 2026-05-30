from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import List

from app.core.database import get_db
from app.api.deps import get_current_admin
from app.models.user import User
from app.models.document import Document
from app.models.conversation import Conversation, Message
from app.models.logs import SystemLog
from app.schemas.admin import SystemLogResponse, AnalyticsResponse

router = APIRouter()

@router.get("/logs", response_model=List[SystemLogResponse])
async def get_system_logs(
    limit: int = 100,
    offset: int = 0,
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves raw system logs for auditing and system health monitoring. Restricted to admins."""
    result = await db.execute(
        select(SystemLog)
        .order_by(SystemLog.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return result.scalars().all()

@router.get("/analytics", response_model=AnalyticsResponse)
async def get_system_analytics(
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Computes global operational metrics and aggregate counts for the Admin Dashboard."""
    # 1. Total users
    res_users = await db.execute(select(func.count()).select_from(User))
    total_users = res_users.scalar() or 0
    
    # 2. Total documents
    res_docs = await db.execute(select(func.count()).select_from(Document))
    total_documents = res_docs.scalar() or 0
    
    # 3. Total conversations
    res_convs = await db.execute(select(func.count()).select_from(Conversation))
    total_conversations = res_convs.scalar() or 0
    
    # 4. Total messages
    res_msgs = await db.execute(select(func.count()).select_from(Message))
    total_messages = res_msgs.scalar() or 0
    
    # 5. Token aggregates (Prompt and Completion)
    res_tokens = await db.execute(select(func.sum(Message.total_tokens)))
    total_tokens_used = res_tokens.scalar() or 0
    
    # 6. Average similarity scores (Parsed from assistant source logs)
    res_sources = await db.execute(
        select(Message.sources_json).filter(Message.role == "assistant", Message.sources_json.isnot(None))
    )
    all_sources = res_sources.scalars().all()
    
    total_score = 0.0
    score_count = 0
    
    import json
    for sources_str in all_sources:
        try:
            sources = json.loads(sources_str)
            for src in sources:
                if "similarity_score" in src:
                    total_score += float(src["similarity_score"])
                    score_count += 1
        except Exception:
            continue
            
    avg_score = (total_score / score_count) if score_count > 0 else 0.0
    
    return AnalyticsResponse(
        total_users=total_users,
        total_documents=total_documents,
        total_conversations=total_conversations,
        total_messages=total_messages,
        average_similarity_score=avg_score,
        total_tokens_used=total_tokens_used
    )
