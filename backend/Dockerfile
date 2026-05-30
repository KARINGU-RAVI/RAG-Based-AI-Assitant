# ==============================================================================
# Production Dockerfile for RAG Chat Assistant Backend
# ==============================================================================
FROM python:3.12-slim

# Set environment optimizations
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

WORKDIR /app

# Install system dependencies (FAISS cpu requires OpenMP libraries)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend files
COPY . .

# Ensure storage and upload directories exist
RUN mkdir -p storage uploads

EXPOSE 8000

# Start ASGI application
CMD ["python", "main.py"]
