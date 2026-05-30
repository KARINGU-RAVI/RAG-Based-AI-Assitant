import pytest
from app.services.document_parser import SmartChunker
from app.services.rag_pipeline import RAGPipelineService
from sqlalchemy.ext.asyncio import AsyncSession

def test_smart_chunker_splitting():
    """Checks that recursive token splitters partition paragraphs and estimate tokens correctly."""
    chunker = SmartChunker(chunk_size=100, chunk_overlap=10)
    
    # Large paragraph mock text
    large_text = "\n\n".join([f"This is paragraph turn {i} explaining RAG business workflows." for i in range(15)])
    chunks = chunker.split_text(large_text)
    
    assert len(chunks) > 1
    # Verify that no chunk exceeds the 100 token size threshold
    for c in chunks:
        assert c["tokens"] <= 100
        assert len(c["text"]) > 0

@pytest.mark.asyncio
async def test_rag_pipeline_threshold_refusal(db: AsyncSession):
    """Verifies that queries with no matching documents correctly trigger the hallucination cutoff refusal."""
    # Create an empty vector store reindex
    from app.services.vectorstore import VectorStoreManager
    manager = VectorStoreManager()
    await manager.reindex([])
    
    # Instantiate RAG pipeline orchestrator
    rag_service = RAGPipelineService(db)
    
    # Process queries
    session_id = "test-session-id-pipeline"
    query = "What is the secret access code of the administrative office?"
    
    # Extract streamed generator events
    events = []
    async for event in rag_service.process_chat_stream(session_id, query):
        events.append(event)
        
    assert len(events) >= 2
    # Verify first SSE event starts streaming the strict grounded refusal message
    first_event_str = events[0]
    assert "data: " in first_event_str
    
    first_payload = json_loads_sse(first_event_str)
    assert first_payload["token"] == "I could not find enough information in the knowledge base to answer this question."
    
    # Verify final completed meta packet is streamed correctly
    final_event_str = events[-1]
    final_payload = json_loads_sse(final_event_str)
    assert final_payload["done"] is True
    assert final_payload["reply"] == "I could not find enough information in the knowledge base to answer this question."
    assert len(final_payload["sources"]) == 0
    assert final_payload["tokensUsed"] == 0

def json_loads_sse(sse_str: str) -> dict:
    """Helper to convert raw SSE line 'data: {...}' back into JSON dict."""
    clean_line = sse_str.strip()
    if clean_line.startswith("data: "):
        return json.loads(clean_line[6:])
    return {}

import json
