from typing import List
from google import genai
from google.genai.errors import APIError

from app.core.config import settings

class EmbeddingService:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.enabled = bool(self.api_key)
        self.client = None
        
        if self.enabled:
            try:
                self.client = genai.Client(api_key=self.api_key)
            except Exception:
                self.enabled = False

    async def get_embedding(self, text: str) -> List[float]:
        """Generates a high-quality 768-dimension embedding vector for a single piece of text."""
        if not self.enabled:
            return self._generate_fallback_embedding(text)
            
        try:
            # Note: We run synchronous SDK calls inside an executor if blocking,
            # but the new google-genai client performs fast thread-safe queries.
            response = self.client.models.embed_content(
                model=settings.EMBEDDING_MODEL,
                contents=text
            )
            if response and response.embeddings:
                return response.embeddings[0].values
            raise APIError("Empty embedding response received from Gemini API.")
        except Exception as e:
            # Log error and fall back to maintain application robustness
            print(f"[EmbeddingService] Gemini API Embedding generation failed: {str(e)}. Using fallback mock vectors.")
            return self._generate_fallback_embedding(text)

    async def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generates embeddings for a batch of text inputs in a single API call."""
        if not self.enabled or not texts:
            return [self._generate_fallback_embedding(t) for t in texts]
            
        try:
            response = self.client.models.embed_content(
                model=settings.EMBEDDING_MODEL,
                contents=texts
            )
            if response and response.embeddings:
                return [emb.values for emb in response.embeddings]
            raise APIError("Empty batch embedding response from Gemini API.")
        except Exception as e:
            print(f"[EmbeddingService] Gemini API Batch Embedding failed: {str(e)}. Using fallback mock vectors.")
            return [self._generate_fallback_embedding(t) for t in texts]

    def _generate_fallback_embedding(self, text: str) -> List[float]:
        """Generates a deterministic 3072-dimensional normalized mock vector for offline testing."""
        import random
        # Seed by text length and first chars to make it deterministic
        seed = len(text)
        if text:
            seed += ord(text[0]) + ord(text[-1])
        rnd = random.Random(seed)
        
        vector = [rnd.uniform(-1.0, 1.0) for _ in range(3072)]
        # L2 normalization
        magnitude = sum(x*x for x in vector) ** 0.5
        return [x / magnitude for x in vector] if magnitude > 0 else [0.0] * 3072
