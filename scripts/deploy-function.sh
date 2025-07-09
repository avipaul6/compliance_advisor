#!/bin/bash
# deploy-function.sh - Deploy Cloud Function for document processing

set -e

# Configuration - UPDATE THESE VALUES
PROJECT_ID="your-gcp-project-id"
REGION="australia-southeast1"
BUCKET_NAME="ofx-compliance-documents"
DATA_STORE_ID="your-data-store-id"
SERVICE_ACCOUNT_NAME="compliance-assistant-sa"
FUNCTION_NAME="process-document-upload"

echo "🚀 Deploying Cloud Function for document processing"
echo "Project: $PROJECT_ID"
echo "Function: $FUNCTION_NAME"
echo "Region: $REGION"

# Set the project
gcloud config set project $PROJECT_ID

SERVICE_ACCOUNT_EMAIL="$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"

# Create cloud function directory if it doesn't exist
if [ ! -d "cloud_function" ]; then
    echo "📁 Creating cloud_function directory..."
    mkdir -p cloud_function
fi

# Create requirements.txt for Cloud Function
cat > cloud_function/requirements.txt << EOF
functions-framework==3.*
google-cloud-discoveryengine==0.11.*
google-cloud-storage==2.*
EOF

# Create main.py if it doesn't exist (use the code from the artifact)
if [ ! -f "cloud_function/main.py" ]; then
    echo "⚠️  cloud_function/main.py not found!"
    echo "Please copy the Cloud Function code from the documentation into cloud_function/main.py"
    echo "Then run this script again."
    exit 1
fi

# Update the PROJECT_ID and DATA_STORE_ID in main.py
echo "📝 Updating configuration in main.py..."
sed -i.bak "s/PROJECT_ID = os.getenv(\"PROJECT_ID\", \"your-gcp-project-id\")/PROJECT_ID = os.getenv(\"PROJECT_ID\", \"$PROJECT_ID\")/g" cloud_function/main.py
sed -i.bak "s/DATA_STORE_ID = os.getenv(\"DATA_STORE_ID\", \"your-vertex-ai-search-data-store-id\")/DATA_STORE_ID = os.getenv(\"DATA_STORE_ID\", \"$DATA_STORE_ID\")/g" cloud_function/main.py
rm -f cloud_function/main.py.bak

# Deploy the Cloud Function
echo "🏗️ Deploying Cloud Function..."
cd cloud_function

gcloud functions deploy $FUNCTION_NAME \
    --gen2 \
    --runtime=python311 \
    --region=$REGION \
    --source=. \
    --entry-point=process_document_upload \
    --trigger-bucket=$BUCKET_NAME \
    --service-account=$SERVICE_ACCOUNT_EMAIL \
    --set-env-vars="PROJECT_ID=$PROJECT_ID,DATA_STORE_ID=$DATA_STORE_ID,LOCATION=global" \
    --memory=1GB \
    --timeout=540s \
    --max-instances=10 \
    --ingress-settings=internal-only

cd ..

# Get function details
FUNCTION_URL=$(gcloud functions describe $FUNCTION_NAME --region=$REGION --format='value(serviceConfig.uri)')

echo "✅ Cloud Function deployed successfully!"
echo "📊 Function details:"
echo "   Name: $FUNCTION_NAME"
echo "   Region: $REGION"
echo "   Trigger: gs://$BUCKET_NAME (on object creation)"
echo "   Service Account: $SERVICE_ACCOUNT_EMAIL"
echo "   URL: $FUNCTION_URL"
echo ""
echo "🔄 The function will automatically process documents uploaded to:"
echo "   gs://$BUCKET_NAME/"
echo ""
echo "📝 To test the function:"
echo "   gsutil cp test-document.pdf gs://$BUCKET_NAME/company/"
echo "   gcloud functions logs read $FUNCTION_NAME --region=$REGION"