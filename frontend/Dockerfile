# ==============================================================================
# Production Dockerfile for RAG Chat Assistant Frontend
# Multi-stage build for lightweight Nginx distributions
# ==============================================================================

# --- Stage 1: Build virtual assets ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Stage 2: Serve optimized Nginx static resources ---
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
