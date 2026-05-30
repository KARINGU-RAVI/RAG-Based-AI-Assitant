import os
import uuid
import shutil
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.document import Document, DocumentChunk
from app.schemas.document import DocumentResponse
from app.services.document_parser import DocumentParser, SmartChunker
from app.services.embedding import EmbeddingService
from app.services.vectorstore import VectorStoreManager
from app.services.system_logger import SystemLogger

router = APIRouter()

async def process_document_background(
    doc_id: str,
    file_path: str,
    file_type: str,
    api_key: str,
    db_session_factory
):
    """Background task to parse, chunk, embed, and index the uploaded document asynchronously."""
    # Obtain a dedicated db session since we are executing in the background
    async with db_session_factory() as db:
        try:
            # Update status to processing
            result = await db.execute(select(Document).filter(Document.id == doc_id))
            doc = result.scalars().first()
            if not doc:
                return
                
            doc.status = "processing"
            await db.commit()
            
            # Step 1: Parse document text
            text = DocumentParser.parse(file_path, file_type)
            
            # Step 2: Split text into smart chunks
            chunker = SmartChunker(
                chunk_size=settings.CHUNK_SIZE,
                chunk_overlap=settings.CHUNK_OVERLAP
            )
            chunks = chunker.split_text(text)
            
            if not chunks:
                doc.status = "failed"
                await db.commit()
                await SystemLogger.error(db, "upload", f"No extractable text chunks found in document: {doc.name}")
                return
                
            # Step 3: Generate embeddings for chunks
            embedding_service = EmbeddingService(api_key=api_key)
            chunk_texts = [c["text"] for c in chunks]
            embeddings = await embedding_service.get_embeddings(chunk_texts)
            
            # Step 4: Save chunk records to SQLite DB
            db_chunks = []
            chunk_uuids = []
            for i, chunk_data in enumerate(chunks):
                chunk_uuid = str(uuid.uuid4())
                chunk_uuids.append(chunk_uuid)
                
                db_chunk = DocumentChunk(
                    id=chunk_uuid,
                    document_id=doc_id,
                    chunk_index=i,
                    content=chunk_data["text"],
                    token_count=chunk_data["tokens"],
                    metadata_json=json.dumps({
                        "document_id": doc_id,
                        "document_name": doc.name,
                        "chunk_id": chunk_uuid,
                        "chunk_index": i,
                        "created_at": datetime.utcnow().isoformat()
                    })
                )
                db_chunks.append(db_chunk)
                db.add(db_chunk)
                
            await db.commit()
            
            # Step 5: Load FAISS and append vectors
            vector_manager = VectorStoreManager()
            await vector_manager.add_documents(chunk_uuids, embeddings)
            
            # Update Document status to completed
            doc.status = "completed"
            await db.commit()
            await SystemLogger.info(db, "upload", f"Successfully ingested and indexed document: {doc.name} ({len(chunks)} chunks)")
            
        except Exception as e:
            # Handle failure and log error
            try:
                result = await db.execute(select(Document).filter(Document.id == doc_id))
                doc = result.scalars().first()
                if doc:
                    doc.status = "failed"
                    await db.commit()
                await SystemLogger.error(db, "upload", f"Failed background ingestion for document {doc_id}: {str(e)}", {"error": str(e)})
            except Exception as inner_e:
                print(f"[DocumentUpload] Critical failed state handler crashed: {str(inner_e)}")

# Ensure datetime and json are accessible in background task
from datetime import datetime
import json

@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Uploads and triggers asynchronous indexing of a document. Supports PDF, TXT, DOCX, and JSON."""
    filename = file.filename
    _, ext = os.path.splitext(filename)
    ext = ext.lower()
    
    # 1. Validation: Allowed formats
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type. Allowed types: {', '.join(settings.ALLOWED_EXTENSIONS)}"
        )
        
    # 2. Validation: Max size estimation (by reading a chunk of spool)
    # Spool file size calculation
    file.file.seek(0, os.SEEK_END)
    file_size = file.file.tell()
    file.file.seek(0)
    
    if file_size > settings.MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum allowed size of {settings.MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB."
        )
        
    # 3. Create a unique secure local file path
    unique_filename = f"{uuid.uuid4()}{ext}"
    dest_path = os.path.join(settings.UPLOAD_DIR, unique_filename)
    
    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # 4. Create document record in database
    db_doc = Document(
        name=filename,
        file_path=dest_path,
        file_type=ext,
        file_size=file_size,
        status="pending",
        user_id=current_user.id
    )
    
    db.add(db_doc)
    await db.commit()
    await db.refresh(db_doc)
    
    await SystemLogger.info(
        db, "upload", f"User {current_user.username} uploaded file: {filename}. Registered as document ID: {db_doc.id}"
    )
    
    # 5. Trigger Background task parsing, chunking, and embedding.
    # Pass AsyncSessionLocal factory to background tasks to obtain secure SQLite thread sessions
    from app.core.database import AsyncSessionLocal
    background_tasks.add_task(
        process_document_background,
        db_doc.id,
        dest_path,
        ext,
        settings.GEMINI_API_KEY,
        AsyncSessionLocal
    )
    
    return db_doc

@router.get("/", response_model=List[DocumentResponse])
async def get_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves all active documents uploaded by the users."""
    result = await db.execute(
        select(Document).order_by(Document.created_at.desc())
    )
    return result.scalars().all()

@router.delete("/{document_id}", status_code=status.HTTP_200_OK)
async def delete_document(
    document_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Deletes a document from the database, cascading chunks, and schedules a FAISS re-indexing task."""
    result = await db.execute(select(Document).filter(Document.id == document_id))
    doc = result.scalars().first()
    
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
        
    # Delete file from local storage if exists
    if os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception as e:
            print(f"[DocumentDelete] Failed to erase physical file: {str(e)}")
            
    # Perform SQLite deletion
    await db.delete(doc)
    await db.commit()
    
    await SystemLogger.info(
        db, "upload", f"User {current_user.username} deleted document {doc.name} (ID: {document_id}). Triggering FAISS reindexing."
    )
    
    # Async Background Task: Reindex FAISS vector store
    async def reindex_after_deletion(api_key: str, db_session_factory):
        async with db_session_factory() as db_session:
            try:
                # Fetch all active chunks across other documents
                result_chunks = await db_session.execute(select(DocumentChunk))
                remaining_chunks = result_chunks.scalars().all()
                
                # Re-generate or gather embeddings for remaining chunks
                # To be fast, if we had embeddings saved in DB we would use them.
                # Since we don't store raw embeddings in SQLite (to keep SQLite compact), we can re-extract/re-embed them.
                # Given flat FAISS size is small, we just re-embed remaining chunk texts.
                all_active_chunks = []
                if remaining_chunks:
                    emb_svc = EmbeddingService(api_key=api_key)
                    texts = [c.content for c in remaining_chunks]
                    embeddings = await emb_svc.get_embeddings(texts)
                    
                    for chunk, emb in zip(remaining_chunks, embeddings):
                        all_active_chunks.append((chunk.id, emb))
                        
                vector_manager = VectorStoreManager()
                await vector_manager.reindex(all_active_chunks)
                await SystemLogger.info(db_session, "vectorstore", "FAISS store reindexed successfully after document deletion.")
            except Exception as e:
                await SystemLogger.error(
                    db_session, "vectorstore", f"Failed reindexing vector store after deletion of doc {document_id}: {str(e)}"
                )

    from app.core.database import AsyncSessionLocal
    background_tasks.add_task(
        reindex_after_deletion,
        settings.GEMINI_API_KEY,
        AsyncSessionLocal
    )
    
    return {"success": True, "detail": "Document deletion scheduled successfully."}
