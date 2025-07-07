# Multi-stage Dockerfile for Cloud Run deployment
# Stage 1: Build React frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files first (for better Docker layer caching)
COPY frontend/package*.json ./

# Install ALL dependencies (use npm install to handle lock file mismatches)
RUN npm install

# Copy all frontend files (node_modules excluded by .dockerignore)
COPY frontend/ ./

# Build the React app for production
RUN npm run build

# Stage 2: Python backend with static frontend serving
FROM python:3.11-slim

# Set environment variables for Cloud Run
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PORT=8080
ENV HOST=0.0.0.0

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /bin/bash app

# Create app directory and set ownership
WORKDIR /app
RUN chown app:app /app

# Switch to non-root user
USER app

# Copy Python requirements and install dependencies
COPY --chown=app:app backend/requirements.txt ./
RUN pip install --user --no-cache-dir -r requirements.txt

# Copy backend source code
COPY --chown=app:app backend/ ./

# Copy built frontend from the previous stage
COPY --from=frontend-builder --chown=app:app /app/frontend/dist ./static

# Copy startup script
COPY --chown=app:app docker/start.sh ./start.sh
RUN chmod +x ./start.sh

# Add user pip bin to PATH
ENV PATH="/home/app/.local/bin:$PATH"

# Expose the port
EXPOSE 8080

# Use the startup script
CMD ["./start.sh"]