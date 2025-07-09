#!/bin/bash
# update_env_vars.sh - Update Cloud Run with new RAG configuration

set -e

PROJECT_ID="data-consumption-layer"
SERVICE_NAME="ofx-compliance-assistant-v2"
REGION="australia-southeast1"
BUCKET_NAME="compliance-assistant-ai-ingestion"

echo "🔧 Updating Cloud Run environment variables for RAG"
echo "Service: $SERVICE_NAME"
echo ""

# You'll need to replace these with actual values from Step 1
echo "⚠️  IMPORTANT: Replace these placeholders with actual values from vector_search_setup.sh:"
echo ""
read -p "Enter VECTOR_INDEX_ENDPOINT_ID: " VECTOR_INDEX_ENDPOINT_ID
read -p "Enter VECTOR_INDEX_ID: " VECTOR_INDEX_ID

if [ -z "$VECTOR_INDEX_ENDPOINT_ID" ] || [ -z "$VECTOR_INDEX_ID" ]; then
    echo "❌ Missing required vector search IDs. Please run vector_search_setup.sh first."
    exit 1
fi

# Update Cloud Run service with new environment variables
echo "🚀 Updating Cloud Run service..."

gcloud run services update $SERVICE_NAME \
    --region=$REGION \
    --project=$PROJECT_ID \
    --set-env-vars="
PROJECT_ID=$PROJECT_ID,
ENVIRONMENT=production,
STORAGE_BUCKET_NAME=$BUCKET_NAME,
VERTEX_AI_LOCATION=us-central1,
GEMINI_MODEL=gemini-2.5-flash,
EMBEDDING_MODEL=gemini-embedding-001,
EMBEDDING_DIMENSIONS=3072,
VECTOR_INDEX_ENDPOINT_ID=$VECTOR_INDEX_ENDPOINT_ID,
VECTOR_INDEX_ID=$VECTOR_INDEX_ID,
VECTOR_DEPLOYED_INDEX_ID=compliance-docs-deployed,
VECTOR_SEARCH_REGION=us-central1,
CHUNK_SIZE=1000,
CHUNK_OVERLAP=200,
RETRIEVAL_TOP_K=10,
MAX_FILE_SIZE_MB=10,
MAX_BATCH_SIZE=10,
LOG_LEVEL=INFO" \
    --memory=4Gi \
    --cpu=2 \
    --timeout=600

echo "✅ Environment variables updated successfully!"
echo ""
echo "📋 New RAG configuration:"
echo "  🤖 Generation Model: gemini-2.5-flash"
echo "  📊 Embedding Model: gemini-embedding-001"
echo "  🔢 Embedding Dimensions: 3072"
echo "  🔍 Vector Endpoint ID: $VECTOR_INDEX_ENDPOINT_ID"
echo "  📑 Chunk Size: 1000 tokens"
echo "  🔄 Chunk Overlap: 200 tokens"
echo "  🎯 Retrieval Top-K: 10 documents"
echo ""
echo "🚨 CRITICAL: Remove old Data Store variables after migration:"
echo "  ❌ DATA_STORE_ID (will be unused)"
echo "  ❌ LOCATION=global (Vector Search uses us-central1)"