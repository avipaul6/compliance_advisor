#!/bin/bash
# setup-service-account.sh - Create and configure service account for Cloud Run

set -e

PROJECT_ID="your-gcp-project-id"  # Replace with your actual project ID
SERVICE_ACCOUNT_NAME="compliance-assistant-sa"
SERVICE_ACCOUNT_EMAIL="$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"

echo "🔐 Setting up service account for OFX Compliance Assistant"
echo "Project: $PROJECT_ID"
echo "Service Account: $SERVICE_ACCOUNT_EMAIL"

# Set the project
gcloud config set project $PROJECT_ID

# Create service account
echo "👤 Creating service account..."
gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
    --display-name="OFX Compliance Assistant Service Account" \
    --description="Service account for the OFX Compliance Assistant Cloud Run service"

# Grant necessary roles
echo "🔑 Granting IAM roles..."

# Vertex AI roles
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/aiplatform.user"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/discoveryengine.viewer"

# Storage roles (if you need to access Cloud Storage)
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/storage.objectViewer"

# Logging roles
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/logging.logWriter"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/monitoring.metricWriter"

echo "✅ Service account setup completed!"
echo "📝 Use this service account email in your deployment:"
echo "   $SERVICE_ACCOUNT_EMAIL"
echo ""
echo "🔄 Update your deploy.sh script with this service account email."