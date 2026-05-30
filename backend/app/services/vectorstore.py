import os
import json
import asyncio
import numpy as np
import faiss
from typing import List, Dict, Tuple, Optional
from app.core.config import settings

class VectorStoreManager:
    _instance = None
    _lock = asyncio.Lock()

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(VectorStoreManager, cls).__new__(cls, *args, **kwargs)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
            
        self.dimension = 3072  # Gemini gemini-embedding-001 dimension
        self.index = None
        self.id_map: Dict[str, str] = {}  # Maps FAISS integer string index -> SQL Chunk UUID
        self.index_path = settings.vector_index_path
        self.map_path = settings.vector_map_path
        
        # Load existing index if it exists on disk
        self.load()
        self._initialized = True

    def _normalize_vectors(self, vectors: np.ndarray) -> np.ndarray:
        """Applies L2 normalization to vectors to guarantee Inner Product queries yield Cosine Similarity."""
        norms = np.linalg.norm(vectors, axis=1, keepdims=True)
        # Avoid division by zero
        norms = np.where(norms == 0, 1.0, norms)
        return vectors / norms

    def save(self) -> None:
        """Saves the active FAISS index binary and the integer-to-UUID dictionary map to disk."""
        if self.index is not None:
            os.makedirs(os.path.dirname(self.index_path), exist_ok=True)
            faiss.write_index(self.index, str(self.index_path))
            with open(self.map_path, "w", encoding="utf-8") as f:
                json.dump(self.id_map, f, indent=2)
            print(f"[VectorStoreManager] Successfully saved index and ID map to disk. Count: {len(self.id_map)}")

    def load(self) -> None:
        """Loads the FAISS index binary and ID map from disk. Initializes an empty index if missing."""
        if os.path.exists(self.index_path) and os.path.exists(self.map_path):
            try:
                self.index = faiss.read_index(str(self.index_path))
                with open(self.map_path, "r", encoding="utf-8") as f:
                    self.id_map = json.load(f)
                print(f"[VectorStoreManager] Loaded existing index and ID map. Chunk Count: {len(self.id_map)}")
                return
            except Exception as e:
                print(f"[VectorStoreManager] Failed to load index from disk: {str(e)}. Initializing empty index.")
                
        # Initialize an empty Inner Product index
        self.index = faiss.IndexFlatIP(self.dimension)
        self.id_map = {}
        print("[VectorStoreManager] Initialized a new empty FAISS IndexFlatIP index.")

    async def add_documents(self, chunk_uuids: List[str], embeddings: List[List[float]]) -> None:
        """Adds a list of document chunk UUIDs and their embeddings to the FAISS index."""
        if not chunk_uuids or not embeddings:
            return
            
        async with self._lock:
            # Convert list of floats to float32 numpy array
            vectors = np.array(embeddings, dtype=np.float32)
            normalized_vectors = self._normalize_vectors(vectors)
            
            # Record current offset
            start_idx = self.index.ntotal
            
            # Add to FAISS index
            self.index.add(normalized_vectors)
            
            # Map index positions to UUIDs
            for i, uuid_str in enumerate(chunk_uuids):
                faiss_id = str(start_idx + i)
                self.id_map[faiss_id] = uuid_str
                
            self.save()

    async def search(self, query_embedding: List[float], top_k: int = 5) -> List[Tuple[str, float]]:
        """Queries the vector index using cosine similarity.
        
        Returns a list of Tuple[Chunk_UUID, Similarity_Score].
        """
        if self.index is None or self.index.ntotal == 0:
            return []
            
        async with self._lock:
            # Format query vector
            q_vector = np.array([query_embedding], dtype=np.float32)
            q_vector_normalized = self._normalize_vectors(q_vector)
            
            # Search
            scores, indices = self.index.search(q_vector_normalized, min(top_k, self.index.ntotal))
            
            results = []
            if len(indices) > 0:
                for score, idx in zip(scores[0], indices[0]):
                    idx_str = str(idx)
                    if idx_str in self.id_map:
                        chunk_uuid = self.id_map[idx_str]
                        # Inner product on L2 normalized vectors outputs exactly Cosine Similarity
                        # Ensure score is float
                        results.append((chunk_uuid, float(score)))
                        
            return results

    async def delete_document(self, document_id: str, all_active_chunks: List[Tuple[str, List[float]]]) -> None:
        """Deletes a document by re-indexing all other active document chunks.
        
        This prevents vector index fragmentation and maintains absolute integrity.
        'all_active_chunks' is a list of Tuple[chunk_uuid, embedding_vector] for all other documents.
        """
        async with self._lock:
            print(f"[VectorStoreManager] Reindexing vector store after document delete: {document_id}")
            self.index = faiss.IndexFlatIP(self.dimension)
            self.id_map = {}
            
            if all_active_chunks:
                uuids = [item[0] for item in all_active_chunks]
                embeddings = [item[1] for item in all_active_chunks]
                
                vectors = np.array(embeddings, dtype=np.float32)
                normalized_vectors = self._normalize_vectors(vectors)
                
                self.index.add(normalized_vectors)
                for i, chunk_uuid in enumerate(uuids):
                    self.id_map[str(i)] = chunk_uuid
                    
            self.save()

    async def reindex(self, all_chunks: List[Tuple[str, List[float]]]) -> None:
        """Completely rebuilds the index from scratch with a fresh dataset of [chunk_uuid, embedding]."""
        async with self._lock:
            print("[VectorStoreManager] Full reindex triggered.")
            self.index = faiss.IndexFlatIP(self.dimension)
            self.id_map = {}
            
            if all_chunks:
                uuids = [item[0] for item in all_chunks]
                embeddings = [item[1] for item in all_chunks]
                
                vectors = np.array(embeddings, dtype=np.float32)
                normalized_vectors = self._normalize_vectors(vectors)
                
                self.index.add(normalized_vectors)
                for i, chunk_uuid in enumerate(uuids):
                    self.id_map[str(i)] = chunk_uuid
                    
            self.save()
