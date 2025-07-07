#!/bin/bash
# docker/start.sh - Startup script for Cloud Run

set -e

echo "🚀 Starting OFX Compliance Assistant on Cloud Run"
echo "Port: ${PORT:-8080}"
echo "Environment: ${ENVIRONMENT:-production}"
echo "User: $(whoami)"
echo "Working Directory: $(pwd)"

# Add user pip bin to PATH if not already there
export PATH="/home/app/.local/bin:$PATH"

# Start the FastAPI application with Gunicorn
exec python -m gunicorn app.main:app \
    --bind 0.0.0.0:${PORT:-8080} \
    --workers 2 \
    --worker-class uvicorn.workers.UvicornWorker \
    --timeout 120 \
    --keep-alive 5 \
    --max-requests 1000 \
    --max-requests-jitter 100 \
    --log-level info \
    --access-logfile - \
    --error-logfile -