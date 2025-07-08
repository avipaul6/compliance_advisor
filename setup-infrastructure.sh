#!/bin/bash
# setup-infrastructure.sh - Complete infrastructure setup script

set -e

# Configuration - UPDATE THESE VALUES
PROJECT_ID="your-gcp-project-id"  # Replace with your actual project ID
REGION="australia-southeast1"
BUCKET_NAME="ofx-compliance-documents"
DATA_STORE_ID="your-data-store-id"  # Replace with your actual data store ID
SERVICE_ACCOUNT_NAME="compliance-assistant-sa"
FUNCTION_NAME="process-document-upload"

echo "🚀 Setting up complete infrastructure for OFX Compliance Assistant"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Bucket: $BUCKET_NAME"

# Set the project
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔧 Enabling required Google Cloud APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable aiplatform.googleapis.com
gcloud services enable discoveryengine.googleapis.com
gcloud services enable storage.googleapis.com
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable eventarc.googleapis.com

# Create service account if it doesn't exist
echo "👤 Setting up service account..."
if ! gcloud iam service-accounts describe "$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com" >/dev/null 2>&1; then
    gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
        --display-name="OFX Compliance Assistant Service Account" \
        --description="Service account for the OFX Compliance Assistant"
fi

SERVICE_ACCOUNT_EMAIL="$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"

# Grant necessary roles
echo "🔑 Granting IAM roles..."
declare -a roles=(
    "roles/aiplatform.user"
    "roles/discoveryengine.editor"
    "roles/storage.objectCreator"
    "roles/storage.objectViewer"
    "roles/storage.objectAdmin"
    "roles/cloudfunctions.invoker"
    "roles/logging.logWriter"
    "roles/monitoring.metricWriter"
    "roles/eventarc.eventReceiver"
    "roles/pubsub.publisher"
)

for role in "${roles[@]}"; do
    echo "Granting $role..."
    gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
        --role="$role" >/dev/null 2>&1 || echo "Role $role may already be assigned"
done

# Create Cloud Storage bucket
echo "📦 Creating Cloud Storage bucket..."
if ! gsutil ls -b gs://$BUCKET_NAME >/dev/null 2>&1; then
    gsutil mb -p $PROJECT_ID -c STANDARD -l $REGION gs://$BUCKET_NAME
    echo "Created bucket: gs://$BUCKET_NAME"
else
    echo "Bucket already exists: gs://$BUCKET_NAME"
fi

# Configure bucket
echo "⚙️ Configuring bucket settings..."
gsutil versioning set on gs://$BUCKET_NAME

# Set lifecycle policy
cat > /tmp/lifecycle.json << EOF
{
  "rule": [
    {
      "action": {"type": "Delete"},
      "condition": {
        "numNewerVersions": 3,
        "isLive": false
      }
    }
  ]
}
EOF

gsutil lifecycle set /tmp/lifecycle.json gs://$BUCKET_NAME
rm /tmp/lifecycle.json

# Set CORS policy for bucket (if needed for direct uploads)
cat > /tmp/cors.json << EOF
[
  {
    "origin": ["*"],
    "method": ["GET", "POST", "PUT", "DELETE", "HEAD"],
    "responseHeader": ["Content-Type", "Access-Control-Allow-Origin"],
    "maxAgeSeconds": 3600
  }
]
EOF

gsutil cors set /tmp/cors.json gs://$BUCKET_NAME
rm /tmp/cors.json

echo "✅ Infrastructure setup completed!"
echo "📝 Configuration summary:"
echo "   Project ID: $PROJECT_ID"
echo "   Region: $REGION"
echo "   Bucket: gs://$BUCKET_NAME"
echo "   Service Account: $SERVICE_ACCOUNT_EMAIL"
echo "   Data Store ID: $DATA_STORE_ID"
echo ""
echo "🔄 Next steps:"
echo "   1. Update your deploy.sh with these values"
echo "   2. Deploy the Cloud Function using deploy-function.sh"
echo "   3. Deploy your Cloud Run service using deploy.sh"