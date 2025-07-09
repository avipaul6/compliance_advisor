#!/bin/bash
# update_permissions.sh - Add Vector Search permissions to service account

set -e

PROJECT_ID="data-consumption-layer"
SERVICE_ACCOUNT_NAME="compliance-assistant-sa"
SERVICE_ACCOUNT_EMAIL="$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"

echo "🔐 Updating service account permissions for Vector Search"
echo "Service Account: $SERVICE_ACCOUNT_EMAIL"
echo ""

# Set project
gcloud config set project $PROJECT_ID

# Add Vector Search permissions
echo "➕ Adding Vertex AI Vector Search permissions..."

# Vector Search User - for querying indexes
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/aiplatform.user"

# Vector Search Admin - for managing indexes (if needed)
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/aiplatform.admin"

# Vertex AI Service Agent - for embedding generation
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/aiplatform.serviceAgent"

# Storage Admin - for vector index data bucket access
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/storage.admin"

echo "✅ Permissions updated successfully!"
echo ""
echo "📋 Current permissions for $SERVICE_ACCOUNT_EMAIL:"
gcloud projects get-iam-policy $PROJECT_ID \
    --flatten="bindings[].members" \
    --filter="bindings.members:serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --format="table(bindings.role)"