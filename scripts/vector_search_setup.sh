#!/bin/bash
# vector_search_setup.sh - Complete Vertex AI Vector Search infrastructure setup

set -e

# Configuration
PROJECT_ID="data-consumption-layer"
REGION="us-central1"  # Vertex AI Vector Search region
INDEX_NAME="compliance-documents-index"
ENDPOINT_NAME="compliance-vector-endpoint"
BUCKET_NAME="compliance-assistant-ai-ingestion"

echo "🚀 Setting up Vertex AI Vector Search Infrastructure"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Index: $INDEX_NAME"
echo "Endpoint: $ENDPOINT_NAME"
echo ""

# Set project
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable aiplatform.googleapis.com
gcloud services enable storage.googleapis.com

# Create index configuration file
echo "📝 Creating index configuration..."
cat > index-config.json << EOF
{
  "displayName": "$INDEX_NAME",
  "description": "Vector index for compliance document embeddings using gemini-embedding-001",
  "metadata": {
    "contentsDeltaUri": "gs://$BUCKET_NAME/vector-index-data/",
    "config": {
      "dimensions": 3072,
      "approximateNeighborsCount": 150,
      "distanceMeasureType": "COSINE_DISTANCE",
      "algorithmConfig": {
        "treeAhConfig": {
          "leafNodeEmbeddingCount": 500,
          "leafNodesToSearchPercent": 7
        }
      }
    }
  }
}
EOF

# Create the vector index
echo "🏗️ Creating Vertex AI Vector Search Index..."
INDEX_OPERATION=$(gcloud ai indexes create \
    --display-name="$INDEX_NAME" \
    --description="Vector index for compliance document embeddings using gemini-embedding-001" \
    --metadata-file=index-config.json \
    --region=$REGION \
    --format="value(name)")

echo "Index creation started: $INDEX_OPERATION"
echo "⏳ This will take 20-30 minutes. Checking status..."

# Wait for index creation (with timeout)
TIMEOUT=1800  # 30 minutes
ELAPSED=0
INTERVAL=60   # Check every minute

while [ $ELAPSED -lt $TIMEOUT ]; do
    STATUS=$(gcloud ai operations describe $INDEX_OPERATION --region=$REGION --format="value(done)")
    
    if [ "$STATUS" = "True" ]; then
        echo "✅ Index creation completed!"
        INDEX_ID=$(gcloud ai operations describe $INDEX_OPERATION --region=$REGION --format="value(response.name)" | rev | cut -d'/' -f1 | rev)
        echo "Index ID: $INDEX_ID"
        break
    fi
    
    echo "⏳ Still creating index... ($((ELAPSED/60)) minutes elapsed)"
    sleep $INTERVAL
    ELAPSED=$((ELAPSED + INTERVAL))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
    echo "⚠️ Index creation timeout. Check status manually:"
    echo "gcloud ai operations describe $INDEX_OPERATION --region=$REGION"
    exit 1
fi

# Create index endpoint
echo "🔗 Creating Index Endpoint..."
ENDPOINT_OPERATION=$(gcloud ai index-endpoints create \
    --display-name=$ENDPOINT_NAME \
    --description="Endpoint for compliance document vector search" \
    --region=$REGION \
    --format="value(name)")

echo "Endpoint creation started: $ENDPOINT_OPERATION"

# Wait for endpoint creation
ELAPSED=0
while [ $ELAPSED -lt 600 ]; do  # 10 minute timeout for endpoint
    STATUS=$(gcloud ai operations describe $ENDPOINT_OPERATION --region=$REGION --format="value(done)")
    
    if [ "$STATUS" = "True" ]; then
        echo "✅ Endpoint creation completed!"
        ENDPOINT_ID=$(gcloud ai operations describe $ENDPOINT_OPERATION --region=$REGION --format="value(response.name)" | rev | cut -d'/' -f1 | rev)
        echo "Endpoint ID: $ENDPOINT_ID"
        break
    fi
    
    sleep 30
    ELAPSED=$((ELAPSED + 30))
done

if [ $ELAPSED -ge 600 ]; then
    echo "⚠️ Endpoint creation timeout. Check status manually."
    exit 1
fi

# Deploy index to endpoint
echo "🚀 Deploying index to endpoint..."
DEPLOY_OPERATION=$(gcloud ai index-endpoints deploy-index $ENDPOINT_ID \
    --index=$INDEX_ID \
    --deployed-index-id="compliance-docs-deployed" \
    --display-name="Compliance Documents Search" \
    --min-replica-count=1 \
    --max-replica-count=3 \
    --machine-type="e2-standard-2" \
    --region=$REGION \
    --format="value(name)")

echo "Deploy operation started: $DEPLOY_OPERATION"

# Wait for deployment
ELAPSED=0
while [ $ELAPSED -lt 900 ]; do  # 15 minute timeout for deployment
    STATUS=$(gcloud ai operations describe $DEPLOY_OPERATION --region=$REGION --format="value(done)")
    
    if [ "$STATUS" = "True" ]; then
        echo "✅ Index deployment completed!"
        break
    fi
    
    echo "⏳ Deploying index to endpoint... ($((ELAPSED/60)) minutes elapsed)"
    sleep 60
    ELAPSED=$((ELAPSED + 60))
done

# Save configuration
cat > vector-config.env << EOF
# Vertex AI Vector Search Configuration
VECTOR_INDEX_ENDPOINT_ID=$ENDPOINT_ID
VECTOR_INDEX_ID=$INDEX_ID
VECTOR_DEPLOYED_INDEX_ID=compliance-docs-deployed
VECTOR_SEARCH_REGION=$REGION
EMBEDDING_DIMENSIONS=3072
EOF

echo ""
echo "✅ Vertex AI Vector Search setup completed!"
echo "📋 Configuration saved to vector-config.env"
echo ""
echo "🔧 Next steps:"
echo "1. Update your Cloud Run environment variables with these values"
echo "2. Deploy the new RAG-enabled backend code"
echo "3. Start document ingestion pipeline"
echo ""
echo "💾 Important values to save:"
echo "VECTOR_INDEX_ENDPOINT_ID=$ENDPOINT_ID"
echo "VECTOR_INDEX_ID=$INDEX_ID"
echo "VECTOR_DEPLOYED_INDEX_ID=compliance-docs-deployed"
echo ""
echo "🚨 IMPORTANT: Save these IDs! You'll need them for your backend configuration."