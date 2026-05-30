import os
import json
import logging
from typing import List, Dict, Any
from pypdf import PdfReader
from docx import Document as DocxDocument
import tiktoken

from app.core.config import settings

logger = logging.getLogger("RAG_DocumentParser")

# Initialize token encoding safely
try:
    token_encoding = tiktoken.get_encoding("cl100k_base")
except Exception:
    logger.warning("Tiktoken encoding 'cl100k_base' could not be loaded. Falling back to word-count estimations.")
    token_encoding = None

class DocumentParser:
    @staticmethod
    def parse(file_path: str, extension: str) -> str:
        """Parses a document file on disk and returns its complete plain text content."""
        extension = extension.lower()
        if extension == ".txt":
            return DocumentParser._parse_txt(file_path)
        elif extension == ".pdf":
            return DocumentParser._parse_pdf(file_path)
        elif extension == ".docx":
            return DocumentParser._parse_docx(file_path)
        elif extension == ".json":
            return DocumentParser._parse_json(file_path)
        else:
            raise ValueError(f"Unsupported file extension: {extension}")

    @staticmethod
    def _parse_txt(file_path: str) -> str:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()

    @staticmethod
    def _parse_pdf(file_path: str) -> str:
        reader = PdfReader(file_path)
        text_parts = []
        for i, page in enumerate(reader.pages):
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
        return "\n\n".join(text_parts)

    @staticmethod
    def _parse_docx(file_path: str) -> str:
        doc = DocxDocument(file_path)
        text_parts = [para.text for para in doc.paragraphs if para.text.strip()]
        return "\n\n".join(text_parts)

    @staticmethod
    def _parse_json(file_path: str) -> str:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return json.dumps(data, indent=2)


class SmartChunker:
    def __init__(self, chunk_size: int = None, chunk_overlap: int = None):
        self.chunk_size = chunk_size or settings.CHUNK_SIZE
        self.chunk_overlap = chunk_overlap or settings.CHUNK_OVERLAP

    def count_tokens(self, text: str) -> int:
        """Counts the token count of a given text block, falling back to estimations if offline."""
        if token_encoding:
            return len(token_encoding.encode(text))
        # Estimation: 1 token ~= 4 characters or 0.75 words
        return max(1, int(len(text) / 4))

    def split_text(self, text: str) -> List[Dict[str, Any]]:
        """Splits text into chunks recursively on paragraphs, newlines, sentences, and words.
        
        Returns a list of dictionaries containing:
          - 'text': Chunk string
          - 'tokens': Chunk token count
        """
        if not text.strip():
            return []
            
        paragraphs = text.split("\n\n")
        chunks = []
        
        current_chunk = []
        current_tokens = 0
        
        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
                
            para_tokens = self.count_tokens(para)
            
            # If a single paragraph is smaller than the budget, compile it
            if current_tokens + para_tokens <= self.chunk_size:
                current_chunk.append(para)
                current_tokens += para_tokens
            else:
                # If paragraph itself exceeds chunk size, split it more granularly
                if para_tokens > self.chunk_size:
                    # Flush current chunk first
                    if current_chunk:
                        chunks.append(self._build_chunk(current_chunk))
                        current_chunk = []
                        current_tokens = 0
                        
                    # Split paragraph into sentences
                    sentences = para.replace("! ", ". ").replace("? ", ". ").split(". ")
                    for sentence in sentences:
                        sentence = sentence.strip()
                        if not sentence:
                            continue
                        sentence += "."
                        sentence_tokens = self.count_tokens(sentence)
                        
                        if sentence_tokens > self.chunk_size:
                            # Split by words
                            words = sentence.split(" ")
                            sub_chunk = []
                            sub_tokens = 0
                            for word in words:
                                word_tokens = self.count_tokens(word + " ")
                                if sub_tokens + word_tokens <= self.chunk_size:
                                    sub_chunk.append(word)
                                    sub_tokens += word_tokens
                                else:
                                    if sub_chunk:
                                        chunks.append({
                                            "text": " ".join(sub_chunk),
                                            "tokens": sub_tokens
                                        })
                                    sub_chunk = [word]
                                    sub_tokens = word_tokens
                            if sub_chunk:
                                current_chunk = [" ".join(sub_chunk)]
                                current_tokens = sub_tokens
                        else:
                            if current_tokens + sentence_tokens <= self.chunk_size:
                                current_chunk.append(sentence)
                                current_tokens += sentence_tokens
                            else:
                                chunks.append(self._build_chunk(current_chunk))
                                # Handle overlap: seed with last sentences
                                overlap_chunk = []
                                overlap_tokens = 0
                                for prev_s in reversed(current_chunk):
                                    prev_s_tok = self.count_tokens(prev_s)
                                    if overlap_tokens + prev_s_tok <= self.chunk_overlap:
                                        overlap_chunk.insert(0, prev_s)
                                        overlap_tokens += prev_s_tok
                                    else:
                                        break
                                current_chunk = overlap_chunk + [sentence]
                                current_tokens = overlap_tokens + sentence_tokens
                else:
                    chunks.append(self._build_chunk(current_chunk))
                    
                    # Handle overlap: take last paragraphs that fit overlap
                    overlap_chunk = []
                    overlap_tokens = 0
                    for prev_p in reversed(current_chunk):
                        prev_p_tok = self.count_tokens(prev_p)
                        if overlap_tokens + prev_p_tok <= self.chunk_overlap:
                            overlap_chunk.insert(0, prev_p)
                            overlap_tokens += prev_p_tok
                        else:
                            break
                    current_chunk = overlap_chunk + [para]
                    current_tokens = overlap_tokens + para_tokens
                    
        if current_chunk:
            chunks.append(self._build_chunk(current_chunk))
            
        return chunks

    def _build_chunk(self, paragraph_list: List[str]) -> Dict[str, Any]:
        combined_text = "\n\n".join(paragraph_list)
        return {
            "text": combined_text,
            "tokens": self.count_tokens(combined_text)
        }
