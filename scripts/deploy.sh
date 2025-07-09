#!/bin/bash
# deploy.sh - Updated deployment script for Cloud Run with storage integration

set -e

# Configuration - UPDATE THESE VALUES
PROJECT_ID="your-gcp-project-id"  # Replace with your actual project ID
SERVICE_NAME="ofx-compliance-assistant"
REGION="australia-southeast1"  # ✅ Deploy in Australia
DATA_STORE_ID="your-data-store-id"  # Replace with your actual data store ID
BUCKET_NAME="ofx-compliance-documents"  # Cloud Storage bucket name

# Vertex AI Configuration (can be different from Cloud Run region)
VERTEX_AI_LOCATION="us-central1"  # ✅ Your Vertex AI/data store location

echo "🚀 Deploying OFX Compliance Assistant to Cloud Run"
echo "Project: $PROJECT_ID"
echo "Service: $SERVICE_NAME" 
echo "Cloud Run Region: $REGION"
echo "Vertex AI Region: $VERTEX_AI_LOCATION"
echo "Storage Bucket: $BUCKET_NAME"

# Check if required tools are installed
command -v gcloud >/dev/null 2>&1 || { echo "gcloud CLI is required but not installed. Aborting." >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed. Aborting." >&2; exit 1; }

# Set the project
echo "📋 Setting up Google Cloud project..."
gcloud config set project $PROJECT_ID

# Enable required APIs (in case they're not already enabled)
echo "🔧 Ensuring required Google Cloud APIs are enabled..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable aiplatform.googleapis.com
gcloud services enable discoveryengine.googleapis.com
gcloud services enable storage.googleapis.com

# Verify bucket exists
echo "📦 Verifying Cloud Storage bucket..."
if ! gsutil ls -b gs://$BUCKET_NAME >/dev/null 2>&1; then
    echo "❌ Bucket gs://$BUCKET_NAME does not exist!"
    echo "Please run setup-infrastructure.sh first or create the bucket manually."
    exit 1
fi

# Build and deploy with Cloud Build
echo "🏗️ Building and deploying with Cloud Build..."
gcloud run deploy $SERVICE_NAME \
    --source . \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --port 8080 \
    --memory 2Gi \
    --cpu 2 \
    --timeout 300 \
    --concurrency 80 \
    --max-instances 10 \
    --set-env-vars="PROJECT_ID=$PROJECT_ID,DATA_STORE_ID=$DATA_STORE_ID,LOCATION=global,VERTEX_AI_LOCATION=$VERTEX_AI_LOCATION,ENVIRONMENT=production,STORAGE_BUCKET_NAME=$BUCKET_NAME,MAX_FILE_SIZE_MB=10,MAX_BATCH_SIZE=10,LOG_LEVEL=INFO" \
    --service-account="compliance-assistant-sa@$PROJECT_ID.iam.gserviceaccount.com"

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)')

# Test the deployment
echo "🧪 Testing deployment..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SERVICE_URL/api/v1/health" || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Health check passed!"
else
    echo "⚠️ Health check failed (HTTP $HTTP_STATUS). Check logs:"
    echo "   gcloud run services logs read $SERVICE_NAME --region $REGION"
fi

echo "✅ Deployment completed!"
echo "🌐 Service URL: $SERVICE_URL"
echo "📊 API Documentation: $SERVICE_URL/docs"
echo "🏥 Health Check: $SERVICE_URL/api/v1/health"
echo "📁 Document Upload: $SERVICE_URL/api/v1/documents/upload"
echo ""
echo "🇦🇺 Deployed in Australia region for optimal user experience"
echo "🤖 Using Vertex AI in $VERTEX_AI_LOCATION region"
echo "📦 Document storage: gs://$BUCKET_NAME"
echo ""
echo "🔄 Next steps:"
echo "   1. Test document upload: curl -X POST '$SERVICE_URL/api/v1/documents/upload' -F 'file=@test.pdf'"
echo "   2. Check Cloud Function logs: gcloud functions logs read process-document-upload --region=$REGION"
echo "   3. Monitor service: $SERVICE_URL"

# Optional: Open the service in browser (uncomment if needed)
# echo "🔗 Opening service in browser..."
# open $SERVICE_URL || xdg-open $SERVICE_URL || echo "Please manually open: $SERVICE_URL"