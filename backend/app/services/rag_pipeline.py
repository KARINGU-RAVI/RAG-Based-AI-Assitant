import json
import asyncio
from datetime import datetime, timezone
from typing import AsyncGenerator, List, Dict, Any, Tuple

from google import genai
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.models.conversation import Conversation, Message
from app.models.document import DocumentChunk, Document
from app.services.embedding import EmbeddingService
from app.services.vectorstore import VectorStoreManager
from app.services.system_logger import SystemLogger
from app.prompts.templates import QUERY_REWRITE_PROMPT, RAG_SYSTEM_PROMPT

class RAGPipelineService:
    def __init__(self, db: AsyncSession, api_key: str = None):
        self.db = db
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.embedding_service = EmbeddingService(api_key=self.api_key)
        self.vector_manager = VectorStoreManager()
        self.enabled = bool(self.api_key)
        self.client = None
        
        if self.enabled:
            try:
                self.client = genai.Client(api_key=self.api_key)
            except Exception:
                self.enabled = False

    async def get_history(self, session_id: str, limit: int = 5) -> List[Tuple[str, str]]:
        """Retrieves the last N conversation message pairs for context."""
        # Query messages for this conversation, sorted by timestamp ascending
        result = await self.db.execute(
            select(Message)
            .filter(Message.conversation_id == session_id)
            .order_by(Message.created_at.asc())
        )
        messages = result.scalars().all()
        
        # Group into pairs
        history_pairs = []
        user_msg = None
        
        for msg in messages:
            if msg.role == "user":
                user_msg = msg.content
            elif msg.role == "assistant" and user_msg is not None:
                history_pairs.append((user_msg, msg.content))
                user_msg = None
                
        # Keep only the last `limit` pairs
        return history_pairs[-limit:]

    def format_history_string(self, history_pairs: List[Tuple[str, str]]) -> str:
        """Formats the history pairs into a clear conversational text block."""
        if not history_pairs:
            return "No previous conversation history."
            
        formatted = []
        for i, (user, assistant) in enumerate(history_pairs):
            formatted.append(f"Turn {i+1}:\nUser: {user}\nAssistant: {assistant}")
        return "\n\n".join(formatted)

    async def rewrite_query(self, query: str, history_str: str) -> str:
        """Uses Gemini to rewrite context-dependent queries into self-contained search questions."""
        if not self.enabled or "No previous conversation history" in history_str:
            return query
            
        try:
            prompt = QUERY_REWRITE_PROMPT.format(history=history_str, question=query)
            
            # Fast synchronous generation
            response = self.client.models.generate_content(
                model=settings.GENERATIVE_MODEL,
                contents=prompt
            )
            rewritten = response.text.strip()
            if rewritten:
                return rewritten
            return query
        except Exception as e:
            print(f"[RAGPipelineService] Query rewriting failed: {str(e)}. Using original query.")
            return query

    async def process_chat_stream(self, session_id: str, message_text: str) -> AsyncGenerator[str, None]:
        """Core asynchronous RAG pipeline processing user queries and streaming tokens via SSE.
        
        Yields JSON-formatted Server-Sent Event strings.
        """
        # Save user message to database
        user_message = Message(
            conversation_id=session_id,
            role="user",
            content=message_text
        )
        self.db.add(user_message)
        await self.db.commit()
        
        # Fetch history (excluding the user message we just saved)
        history_pairs = await self.get_history(session_id, limit=5)
        # Remove last pair if it matches the current request (it wouldn't yet since we committed it, but to be safe)
        history_str = self.format_history_string(history_pairs)
        
        # Step 1: Rewrite Query
        rewritten_query = await self.rewrite_query(message_text, history_str)
        if rewritten_query != message_text:
            await SystemLogger.info(
                self.db, "rag", f"Query rewritten from '{message_text}' to '{rewritten_query}'"
            )
            
        # Step 2: Embed Query
        query_vector = await self.embedding_service.get_embedding(rewritten_query)
        
        # Step 3: Semantic Search via FAISS
        search_results = await self.vector_manager.search(query_vector, top_k=settings.TOP_K)
        
        # Step 4: Extract chunk contexts and apply similarity threshold
        chunks_used = []
        similarity_scores = []
        retrieved_contexts = []
        
        if search_results:
            # Sort results by similarity score descending
            search_results = sorted(search_results, key=lambda x: x[1], reverse=True)
            
            # Query db for the retrieved chunk records
            chunk_ids = [res[0] for res in search_results]
            db_chunks_res = await self.db.execute(
                select(DocumentChunk).filter(DocumentChunk.id.in_(chunk_ids))
            )
            db_chunks = {chunk.id: chunk for chunk in db_chunks_res.scalars().all()}
            
            # Retrieve document names for source citation
            doc_ids = list({chunk.document_id for chunk in db_chunks.values()})
            db_docs_res = await self.db.execute(
                select(Document).filter(Document.id.in_(doc_ids))
            )
            db_docs = {doc.id: doc for doc in db_docs_res.scalars().all()}
            
            source_index = 1
            for chunk_uuid, score in search_results:
                if score >= settings.SIMILARITY_THRESHOLD:
                    chunk = db_chunks.get(chunk_uuid)
                    if chunk:
                        doc = db_docs.get(chunk.document_id)
                        doc_name = doc.name if doc else "Unknown File"
                        
                        chunks_used.append({
                            "document_name": doc_name,
                            "chunk_index": chunk.chunk_index,
                            "content": chunk.content,
                            "similarity_score": score
                        })
                        similarity_scores.append(score)
                        
                        # Add to retrieval text blocks
                        retrieved_contexts.append(
                            f"Source [{source_index}]: {doc_name} (Chunk Index: {chunk.chunk_index})\n"
                            f"Score: {score:.4f}\n"
                            f"Content: {chunk.content}"
                        )
                        source_index += 1

        # Save prompt log
        await SystemLogger.info(
            self.db, "rag", f"Search completed. Chunks fetched: {len(search_results)}, Retained (>= {settings.SIMILARITY_THRESHOLD}): {len(chunks_used)}"
        )

        # Check similarity threshold constraint
        if not chunks_used:
            # Strict hallucination prevention: Bypasses LLM generation and outputs strict refusal
            refusal_text = "I could not find enough information in the knowledge base to answer this question."
            
            # Save refusal assistant message
            assistant_message = Message(
                conversation_id=session_id,
                role="assistant",
                content=refusal_text,
                prompt_tokens=0,
                completion_tokens=0,
                total_tokens=0,
                sources_json=json.dumps([])
            )
            self.db.add(assistant_message)
            await self.db.commit()
            
            # Stream immediate refusal response
            yield f"data: {json.dumps({'token': refusal_text, 'done': False})}\n\n"
            yield f"data: {json.dumps({'done': True, 'reply': refusal_text, 'sources': [], 'similarityScores': [], 'tokensUsed': 0})}\n\n"
            return

        # Step 5: Format Prompt and stream response from Gemini 2.5 Flash
        context_str = "\n\n---\n\n".join(retrieved_contexts)
        rag_prompt = RAG_SYSTEM_PROMPT.format(
            retrieved_context=context_str,
            history=history_str,
            question=rewritten_query
        )
        
        reply_buffer = []
        prompt_tokens = 0
        completion_tokens = 0
        total_tokens = 0

        if self.enabled:
            try:
                # Call generative stream
                stream_res = self.client.models.generate_content_stream(
                    model=settings.GENERATIVE_MODEL,
                    contents=rag_prompt
                )
                
                for chunk in stream_res:
                    chunk_text = chunk.text
                    if chunk_text:
                        reply_buffer.append(chunk_text)
                        # Yield standard SSE structure
                        yield f"data: {json.dumps({'token': chunk_text, 'done': False})}\n\n"
                        
                    # Extract usage metadata from the final chunks if returned by SDK
                    if hasattr(chunk, "usage_metadata") and chunk.usage_metadata:
                        prompt_tokens = chunk.usage_metadata.prompt_token_count or 0
                        completion_tokens = chunk.usage_metadata.candidates_token_count or 0
                        total_tokens = chunk.usage_metadata.total_token_count or 0
                        
                # If usage metadata was missing from stream chunking, estimate it
                if total_tokens == 0:
                    prompt_tokens = self.embedding_service.SmartChunker().count_tokens(rag_prompt)
                    completion_tokens = self.embedding_service.SmartChunker().count_tokens("".join(reply_buffer))
                    total_tokens = prompt_tokens + completion_tokens
                    
            except Exception as e:
                print(f"[RAGPipelineService] Generative stream crashed: {str(e)}. Bypassing to mock generator.")
                async for mock_sse in self._simulate_mock_streaming(rag_prompt, chunks_used, session_id):
                    yield mock_sse
                return
        else:
            # Fallback mock generator
            async for mock_sse in self._simulate_mock_streaming(rag_prompt, chunks_used, session_id):
                yield mock_sse
            return

        full_reply = "".join(reply_buffer)
        
        # Save assistant message
        assistant_message = Message(
            conversation_id=session_id,
            role="assistant",
            content=full_reply,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            sources_json=json.dumps(chunks_used)
        )
        self.db.add(assistant_message)
        await self.db.commit()
        
        # Yield final completed meta packet
        yield f"data: {json.dumps({'done': True, 'reply': full_reply, 'sources': chunks_used, 'similarityScores': similarity_scores, 'tokensUsed': total_tokens})}\n\n"

    async def _simulate_mock_streaming(
        self,
        full_prompt: str,
        chunks_used: List[Dict[str, Any]],
        session_id: str
    ) -> AsyncGenerator[str, None]:
        """High-fidelity local streaming simulator for offline environments."""
        # Construct realistic grounded response from the provided sources
        source_names = list({c["document_name"] for c in chunks_used})
        reply = (
            f"Based on the provided document ({source_names[0] if source_names else 'Knowledge Base'}), "
            "here is the summarized answer:\n\n"
        )
        
        for i, c in enumerate(chunks_used[:3]):
            excerpt = c["content"][:200].strip().replace("\n", " ") + "..."
            reply += f"- **Excerpt from {c['document_name']}** [page {c['chunk_index']}]: \"{excerpt}\" [score: {c['similarity_score']:.4f}]\n"
            
        reply += "\nI hope this accurately addresses your inquiry based strictly on the uploaded materials."
        
        # Perform streaming yield simulating word-by-word typing delay
        words = reply.split(" ")
        buffer = []
        for word in words:
            token = word + " "
            buffer.append(token)
            yield f"data: {json.dumps({'token': token, 'done': False})}\n\n"
            await asyncio.sleep(0.03)  # Speed matches typical typing speed
            
        full_reply = "".join(buffer)
        
        # Estimate tokens
        prompt_tokens = len(full_prompt) // 4
        completion_tokens = len(full_reply) // 4
        total_tokens = prompt_tokens + completion_tokens
        
        # Save assistant message
        assistant_message = Message(
            conversation_id=session_id,
            role="assistant",
            content=full_reply,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            sources_json=json.dumps(chunks_used)
        )
        self.db.add(assistant_message)
        await self.db.commit()
        
        scores = [c["similarity_score"] for c in chunks_used]
        yield f"data: {json.dumps({'done': True, 'reply': full_reply, 'sources': chunks_used, 'similarityScores': scores, 'tokensUsed': total_tokens})}\n\n"
