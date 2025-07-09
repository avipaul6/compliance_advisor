#!/bin/bash
# create_cheap_vector_index.sh - Create cost-optimized Vector Search setup

set -e

PROJECT_ID="data-consumption-layer"
REGION="us-central1"
INDEX_NAME="compliance-documents-index-small"
ENDPOINT_NAME="compliance-vector-endpoint-small"
BUCKET_NAME="compliance-assistant-ai-ingestion"

echo "🏗️ Creating Cost-Optimized Vector Search Infrastructure"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Index: $INDEX_NAME"
echo "Endpoint: $ENDPOINT_NAME"
echo "💰 Estimated monthly cost: ~$65 (vs $547 with large setup)"
echo ""

# Create index configuration with SHARD_SIZE_SMALL
echo "📝 Creating cost-optimized index configuration..."
cat > index-config-small.json << EOF
{
  "contentsDeltaUri": "gs://$BUCKET_NAME/vector-index-data/",
  "config": {
    "dimensions": 3072,
    "approximateNeighborsCount": 150,
    "distanceMeasureType": "COSINE_DISTANCE",
    "shardSize": "SHARD_SIZE_SMALL",
    "algorithmConfig": {
      "treeAhConfig": {
        "leafNodeEmbeddingCount": 500,
        "leafNodesToSearchPercent": 7
      }
    }
  }
}
EOF

echo "✅ Index configuration created with SHARD_SIZE_SMALL for cost optimization"

# Create the vector index
echo "🏗️ Creating cost-optimized Vector Search Index..."
INDEX_OPERATION=$(gcloud ai indexes create \
    --display-name="$INDEX_NAME" \
    --description="Cost-optimized vector index for compliance documents (SHARD_SIZE_SMALL)" \
    --metadata-file=index-config-small.json \
    --region=$REGION \
    --format="value(name)")

echo "Index creation started: $INDEX_OPERATION"
OPERATION_ID=$(echo "$INDEX_OPERATION" | rev | cut -d'/' -f1 | rev)
echo "Operation ID: $OPERATION_ID"

# Function to check operation status
check_operation_status() {
    local operation_id=$1
    local region=$2
    gcloud ai operations describe $operation_id --region=$region --format="value(done)" 2>/dev/null || echo "false"
}

echo "⏳ Index creation will take 20-30 minutes..."
echo "💡 You can check progress with: gcloud ai operations describe $OPERATION_ID --region=$REGION"
echo ""
echo "⚡ While waiting, the key differences from your expensive setup:"
echo "  💰 Cost: ~$65/month (vs $547/month)"
echo "  🖥️ Machine type: e2-standard-2 (vs e2-standard-16)"
echo "  📊 Shard size: SMALL (vs MEDIUM)"
echo "  🎯 Perfect for: 40-50 compliance documents"
echo ""

# Wait for completion (you can also run this manually later)
TIMEOUT=2700  # 45 minutes
ELAPSED=0
INTERVAL=120  # Check every 2 minutes

while [ $ELAPSED -lt $TIMEOUT ]; do
    STATUS=$(check_operation_status $OPERATION_ID $REGION)
    
    if [ "$STATUS" = "True" ]; then
        echo "✅ Index creation completed!"
        
        # Get the created index ID
        INDEX_FULL_NAME=$(gcloud ai operations describe $OPERATION_ID --region=$REGION --format="value(response.name)")
        INDEX_ID=$(echo "$INDEX_FULL_NAME" | rev | cut -d'/' -f1 | rev)
        echo "New Index ID: $INDEX_ID"
        break
    fi
    
    echo "⏳ Still creating index... ($((ELAPSED/60)) minutes elapsed)"
    sleep $INTERVAL
    ELAPSED=$((ELAPSED + INTERVAL))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
    echo "⚠️ Index creation timeout. Check status manually:"
    echo "gcloud ai operations describe $OPERATION_ID --region=$REGION"
    echo ""
    echo "Once completed, run the endpoint creation part manually."
    exit 1
fi

# Create endpoint
echo "🔗 Creating Index Endpoint..."
ENDPOINT_OPERATION=$(gcloud ai index-endpoints create \
    --display-name=$ENDPOINT_NAME \
    --description="Cost-optimized endpoint for compliance document vector search" \
    --region=$REGION \
    --format="value(name)")

echo "Endpoint creation started: $ENDPOINT_OPERATION"
ENDPOINT_OP_ID=$(echo "$ENDPOINT_OPERATION" | rev | cut -d'/' -f1 | rev)

# Wait for endpoint creation
echo "⏳ Creating endpoint (usually 2-5 minutes)..."
sleep 60

for i in {1..10}; do
    STATUS=$(check_operation_status $ENDPOINT_OP_ID $REGION)
    
    if [ "$STATUS" = "True" ]; then
        echo "✅ Endpoint creation completed!"
        ENDPOINT_FULL_NAME=$(gcloud ai operations describe $ENDPOINT_OP_ID --region=$REGION --format="value(response.name)")
        ENDPOINT_ID=$(echo "$ENDPOINT_FULL_NAME" | rev | cut -d'/' -f1 | rev)
        echo "Endpoint ID: $ENDPOINT_ID"
        break
    fi
    
    echo "   Still creating endpoint... (attempt $i/10)"
    sleep 30
done

# Deploy index to endpoint with cheap machine type
echo "🚀 Deploying index to endpoint with cost-optimized machine type..."
DEPLOY_OPERATION=$(gcloud ai index-endpoints deploy-index $ENDPOINT_ID \
    --index=$INDEX_ID \
    --deployed-index-id="compliance_docs_deployed_small" \
    --display-name="Compliance Documents Search (Cost Optimized)" \
    --min-replica-count=1 \
    --max-replica-count=2 \
    --machine-type="e2-standard-2" \
    --region=$REGION \
    --format="value(name)")

echo "Deploy operation started: $DEPLOY_OPERATION"
echo ""
echo "⏳ Deployment will take 10-15 minutes..."
echo "Check status with: gcloud ai operations describe $(echo $DEPLOY_OPERATION | rev | cut -d'/' -f1 | rev) --region=$REGION"

# Clean up
rm -f index-config-small.json

# Save new configuration
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
CONFIG_FILE="vector-config-optimized-${TIMESTAMP}.env"

cat > $CONFIG_FILE << EOF
# Cost-Optimized Vertex AI Vector Search Configuration - Created $(date)
# Monthly Cost: ~$65 (vs $547 for large setup)
PROJECT_ID=$PROJECT_ID
VECTOR_INDEX_ENDPOINT_ID=$ENDPOINT_ID
VECTOR_INDEX_ID=$INDEX_ID
VECTOR_DEPLOYED_INDEX_ID=compliance_docs_deployed_small
VECTOR_SEARCH_REGION=$REGION
EMBEDDING_MODEL=gemini-embedding-001
EMBEDDING_DIMENSIONS=3072
GENERATION_MODEL=gemini-2.5-flash
SHARD_SIZE=SHARD_SIZE_SMALL
MACHINE_TYPE=e2-standard-2
ESTIMATED_MONTHLY_COST=65
EOF

echo ""
echo "✅ Cost-Optimized Vector Search setup completed!"
echo "📋 Configuration saved to: $CONFIG_FILE"
echo ""
echo "💰 Cost Summary:"
echo "  🔴 Old setup: ~$547/month (e2-standard-16)"
echo "  🟢 New setup: ~$65/month (e2-standard-2)"
echo "  💵 Monthly savings: ~$482"
echo ""
echo "🔧 New configuration values:"
echo "PROJECT_ID=$PROJECT_ID"
echo "VECTOR_INDEX_ENDPOINT_ID=$ENDPOINT_ID"
echo "VECTOR_INDEX_ID=$INDEX_ID"
echo "VECTOR_DEPLOYED_INDEX_ID=compliance_docs_deployed_small"
echo ""
echo "🚨 Next steps:"
echo "1. Wait for deployment to complete (check operation above)"
echo "2. Update your Cloud Run environment variables with new IDs"
echo "3. Deploy your RAG-enabled backend code"
echo ""
echo "🎉 You'll save ~$482/month with this optimized setup!"