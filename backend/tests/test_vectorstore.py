import os
import shutil
import pytest
from app.services.vectorstore import VectorStoreManager

@pytest.fixture(autouse=True)
def cleanup_vector_directories():
    """Ensures test storage directories are clean before and after vector store runs."""
    from app.core.config import settings
    storage_dir = settings.VECTOR_STORAGE_DIR
    if os.path.exists(storage_dir):
        shutil.rmtree(storage_dir)
    os.makedirs(storage_dir, exist_ok=True)
    yield
    if os.path.exists(storage_dir):
        shutil.rmtree(storage_dir)

@pytest.mark.asyncio
async def test_vectorstore_lifecycle():
    """Validates full life-cycle operations: additions, normalized search queries, and local serializations."""
    # Instantiate singleton manager
    manager = VectorStoreManager()
    
    # 1. Add chunks and vector embeddings
    chunk_uuids = ["chunk-1", "chunk-2"]
    # 768-dimensional float arrays
    mock_emb_1 = [1.0] + [0.0] * 767
    mock_emb_2 = [0.0, 1.0] + [0.0] * 766
    
    await manager.add_documents(chunk_uuids, [mock_emb_1, mock_emb_2])
    
    # Verify index counts
    assert manager.index.ntotal == 2
    assert "0" in manager.id_map
    assert manager.id_map["0"] == "chunk-1"
    
    # 2. Search query mapping exactly matching emb 1
    search_q = [1.0] + [0.0] * 767
    results = await manager.search(search_q, top_k=1)
    
    assert len(results) == 1
    # First returned chunk must be chunk-1 because similarity score is 1.0 (exact match)
    assert results[0][0] == "chunk-1"
    assert results[0][1] > 0.99  # Score close to 1.0
    
    # 3. Test reindexing operations
    all_chunks = [
        ("chunk-revised-1", [0.0, 0.0, 1.0] + [0.0] * 765)
    ]
    await manager.reindex(all_chunks)
    assert manager.index.ntotal == 1
    assert manager.id_map["0"] == "chunk-revised-1"
