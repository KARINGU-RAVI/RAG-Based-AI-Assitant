import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.conversation import Conversation, Message
from app.schemas.chat import ChatRequest, ConversationResponse, MessageResponse, FeedbackRequest
from app.services.rag_pipeline import RAGPipelineService
from app.services.system_logger import SystemLogger

router = APIRouter()

@router.post("/", status_code=status.HTTP_200_OK)
async def chat_message(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Processes chat requests and streams answers token-by-token via Server-Sent Events (SSE)."""
    session_id = payload.sessionId
    message_text = payload.message.strip()
    
    if not message_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message cannot be empty"
        )
        
    # Check if the conversation session already exists, otherwise instantiate a new session
    result = await db.execute(select(Conversation).filter(Conversation.id == session_id))
    conv = result.scalars().first()
    
    if not conv:
        # Generate clean dynamic title (first 30 characters of query)
        title = message_text[:30] + "..." if len(message_text) > 30 else message_text
        conv = Conversation(
            id=session_id,
            title=title,
            user_id=current_user.id
        )
        db.add(conv)
        await db.commit()
        await SystemLogger.info(db, "chat", f"Created new conversation session: {session_id} for user {current_user.username}")
    else:
        # Ensure conversation belongs to current user
        if conv.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this conversation session."
            )
            
    # Instantiate RAG pipeline
    rag_service = RAGPipelineService(db)
    
    async def event_generator():
        try:
            async for sse_event in rag_service.process_chat_stream(session_id, message_text):
                yield sse_event
        except Exception as e:
            # Yield clean error payload in SSE structure
            err_payload = json.dumps({"error": f"An internal RAG error occurred: {str(e)}"})
            yield f"data: {err_payload}\n\n"
            
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream",
            "X-Accel-Buffering": "no"  # Disable proxy buffering (for Nginx)
        }
    )

@router.get("/conversations", response_model=List[ConversationResponse])
async def get_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves all conversation sessions belonging to the authenticated user."""
    result = await db.execute(
        select(Conversation)
        .filter(Conversation.user_id == current_user.id)
        .order_by(Conversation.updated_at.desc())
    )
    return result.scalars().all()

@router.get("/conversations/{session_id}/messages", response_model=List[MessageResponse])
async def get_conversation_messages(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves the full chronological list of messages in a given conversation session."""
    # Ensure conversation belongs to user
    result_conv = await db.execute(select(Conversation).filter(Conversation.id == session_id))
    conv = result_conv.scalars().first()
    
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation session not found"
        )
        
    if conv.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this conversation session"
        )
        
    result_msg = await db.execute(
        select(Message)
        .filter(Message.conversation_id == session_id)
        .order_by(Message.created_at.asc())
    )
    return result_msg.scalars().all()

@router.post("/messages/{message_id}/feedback", status_code=status.HTTP_200_OK)
async def submit_message_feedback(
    message_id: str,
    feedback: FeedbackRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Saves user-submitted star-ratings and textual feedback for specific assistant messages."""
    result = await db.execute(select(Message).filter(Message.id == message_id))
    msg = result.scalars().first()
    
    if not msg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
        
    # Verify ownership of the conversation session
    result_conv = await db.execute(select(Conversation).filter(Conversation.id == msg.conversation_id))
    conv = result_conv.scalars().first()
    
    if not conv or conv.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this message resource"
        )
        
    msg.feedback_rating = feedback.rating
    msg.feedback_text = feedback.text
    
    await db.commit()
    await SystemLogger.info(
        db, "chat", f"User {current_user.username} rated message {message_id} with {feedback.rating} stars."
    )
    
    return {"success": True, "detail": "Feedback recorded successfully."}
