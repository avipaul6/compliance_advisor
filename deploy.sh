#!/bin/bash
# deploy.sh - Deployment script for Cloud Run

set -e

# Configuration
PROJECT_ID="your-gcp-project-id"  # Replace with your actual project ID
SERVICE_NAME="ofx-compliance-assistant"
REGION="australia-southeast1"  # ✅ Deploy in Australia
DATA_STORE_ID="your-data-store-id"  # Replace with your actual data store ID

# Vertex AI Configuration (can be different from Cloud Run region)
VERTEX_AI_LOCATION="us-central1"  # ✅ Your Vertex AI/data store location

echo "🚀 Deploying OFX Compliance Assistant to Cloud Run"
echo "Project: $PROJECT_ID"
echo "Service: $SERVICE_NAME" 
echo "Cloud Run Region: $REGION"
echo "Vertex AI Region: $VERTEX_AI_LOCATION"

# Check if required tools are installed
command -v gcloud >/dev/null 2>&1 || { echo "gcloud CLI is required but not installed. Aborting." >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed. Aborting." >&2; exit 1; }

# Set the project
echo "📋 Setting up Google Cloud project..."
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔧 Enabling required Google Cloud APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable aiplatform.googleapis.com
gcloud services enable discoveryengine.googleapis.com

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
    --set-env-vars="PROJECT_ID=$PROJECT_ID,DATA_STORE_ID=$DATA_STORE_ID,LOCATION=global,VERTEX_AI_LOCATION=$VERTEX_AI_LOCATION,ENVIRONMENT=production" \
    --service-account="compliance-assistant-sa@$PROJECT_ID.iam.gserviceaccount.com"

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)')

echo "✅ Deployment completed successfully!"
echo "🌐 Service URL: $SERVICE_URL"
echo "📊 You can now access your application at: $SERVICE_URL"
echo "🇦🇺 Deployed in Australia region for optimal user experience"
echo "🤖 Using Vertex AI in $VERTEX_AI_LOCATION region"

# Optional: Open the service in browser (uncomment if needed)
# echo "🔗 Opening service in browser..."
# open $SERVICE_URL || xdg-open $SERVICE_URL || echo "Please manually open: $SERVICE_URL"