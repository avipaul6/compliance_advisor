# deploy-vector-function.ps1 - Deploy Cloud Function for Vector Search RAG

# Configuration
$PROJECT_ID = "data-consumption-layer"
$REGION = "us-central1"  # Same as Vector Search region
$BUCKET_NAME = "compliance-assistant-ai-ingestion"
$SERVICE_ACCOUNT_NAME = "compliance-assistant-sa"
$FUNCTION_NAME = "process-document-upload-vector"

# Vector Search Configuration
$VECTOR_INDEX_ENDPOINT_ID = "3802623581267951616"
$VECTOR_INDEX_ID = "2338232422744719360"
$VECTOR_DEPLOYED_INDEX_ID = "compliance_docs_deployed_small"
$VECTOR_SEARCH_REGION = "us-central1"
$EMBEDDING_MODEL = "gemini-embedding-001"

Write-Host "🚀 Deploying Vector Search Cloud Function" -ForegroundColor Cyan
Write-Host "Project: $PROJECT_ID" -ForegroundColor White
Write-Host "Function: $FUNCTION_NAME" -ForegroundColor White
Write-Host "Region: $REGION" -ForegroundColor White
Write-Host "Trigger Bucket: gs://$BUCKET_NAME" -ForegroundColor White

try {
    # Set the project
    gcloud config set project $PROJECT_ID

    $SERVICE_ACCOUNT_EMAIL = "$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"

    # Create cloud function directory if it doesn't exist
    if (!(Test-Path "cloud_function")) {
        Write-Host "📁 Creating cloud_function directory..." -ForegroundColor Yellow
        New-Item -ItemType Directory -Path "cloud_function"
    }

    # Create/update main.py
    Write-Host "📝 Updating main.py..." -ForegroundColor Yellow
    # Copy the updated main.py content to cloud_function/main.py

    # Create requirements.txt
    Write-Host "📝 Creating requirements.txt..." -ForegroundColor Yellow
    @"
functions-framework==3.*
google-cloud-aiplatform==1.38.*
google-cloud-storage==2.*
vertexai==1.38.*
"@ | Out-File -FilePath "cloud_function/requirements.txt" -Encoding UTF8

    # Check if function already exists
    Write-Host "`n🔍 Checking if function exists..." -ForegroundColor Yellow
    $existingFunction = gcloud functions describe $FUNCTION_NAME --region=$REGION 2>$null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "⚠️ Function $FUNCTION_NAME already exists. Updating..." -ForegroundColor Yellow
        $deployCommand = "functions deploy $FUNCTION_NAME --gen2 --runtime=python311 --region=$REGION --source=cloud_function --entry-point=process_document_upload --trigger-bucket=$BUCKET_NAME --service-account=$SERVICE_ACCOUNT_EMAIL --memory=1GB --timeout=540s --max-instances=10"
    } else {
        Write-Host "📦 Creating new function..." -ForegroundColor Yellow
        $deployCommand = "functions deploy $FUNCTION_NAME --gen2 --runtime=python311 --region=$REGION --source=cloud_function --entry-point=process_document_upload --trigger-bucket=$BUCKET_NAME --service-account=$SERVICE_ACCOUNT_EMAIL --memory=1GB --timeout=540s --max-instances=10"
    }

    # Build environment variables for the function
    $envVars = @(
        "PROJECT_ID=$PROJECT_ID",
        "VECTOR_INDEX_ENDPOINT_ID=$VECTOR_INDEX_ENDPOINT_ID",
        "VECTOR_INDEX_ID=$VECTOR_INDEX_ID",
        "VECTOR_DEPLOYED_INDEX_ID=$VECTOR_DEPLOYED_INDEX_ID",
        "VECTOR_SEARCH_REGION=$VECTOR_SEARCH_REGION",
        "EMBEDDING_MODEL=$EMBEDDING_MODEL"
    ) -join ","

    # Deploy the Cloud Function
    Write-Host "`n🏗️ Deploying Cloud Function..." -ForegroundColor Yellow
    Write-Host "This may take 3-5 minutes..." -ForegroundColor Gray

    gcloud functions deploy $FUNCTION_NAME `
        --gen2 `
        --runtime=python311 `
        --region=$REGION `
        --source=cloud_function `
        --entry-point=process_document_upload `
        --trigger-bucket=$BUCKET_NAME `
        --service-account=$SERVICE_ACCOUNT_EMAIL `
        --set-env-vars=$envVars `
        --memory=1GB `
        --timeout=540s `
        --max-instances=10

    if ($LASTEXITCODE -ne 0) {
        throw "Cloud Function deployment failed"
    }

    # Get function details
    Write-Host "`n🔍 Getting function details..." -ForegroundColor Yellow
    $FUNCTION_URL = gcloud functions describe $FUNCTION_NAME --region=$REGION --format='value(serviceConfig.uri)'

    Write-Host "`n✅ Vector Search Cloud Function deployed successfully!" -ForegroundColor Green
    Write-Host "`n📊 Function details:" -ForegroundColor Cyan
    Write-Host "   Name: $FUNCTION_NAME" -ForegroundColor White
    Write-Host "   Region: $REGION" -ForegroundColor White
    Write-Host "   Trigger: gs://$BUCKET_NAME (on object creation)" -ForegroundColor White
    Write-Host "   Service Account: $SERVICE_ACCOUNT_EMAIL" -ForegroundColor White
    Write-Host "   URL: $FUNCTION_URL" -ForegroundColor White
    Write-Host ""
    Write-Host "🎯 Vector Search Configuration:" -ForegroundColor Cyan
    Write-Host "   Endpoint ID: $VECTOR_INDEX_ENDPOINT_ID" -ForegroundColor White
    Write-Host "   Index ID: $VECTOR_INDEX_ID" -ForegroundColor White
    Write-Host "   Embedding Model: $EMBEDDING_MODEL" -ForegroundColor White
    Write-Host ""
    Write-Host "🔄 The function will automatically process documents uploaded to:" -ForegroundColor Cyan
    Write-Host "   gs://$BUCKET_NAME/" -ForegroundColor White
    Write-Host ""
    Write-Host "📝 To test the function:" -ForegroundColor Cyan
    Write-Host "   1. Upload a file: Upload via your app's Company Documents section" -ForegroundColor Gray
    Write-Host "   2. Check logs: gcloud functions logs read $FUNCTION_NAME --region=$REGION" -ForegroundColor Gray
    Write-Host "   3. Check RAG Index: Visit your app's RAG Index tab" -ForegroundColor Gray

} catch {
    Write-Host "`n❌ Deployment failed: $($_.Exception.Message)" -ForegroundColor Red
    
    Write-Host "`n🔧 Troubleshooting steps:" -ForegroundColor Yellow
    Write-Host "   1. Check authentication: gcloud auth list" -ForegroundColor Gray
    Write-Host "   2. Check service account exists:" -ForegroundColor Gray
    Write-Host "      gcloud iam service-accounts describe $SERVICE_ACCOUNT_EMAIL" -ForegroundColor Gray
    Write-Host "   3. Check Cloud Function logs:" -ForegroundColor Gray
    Write-Host "      gcloud functions logs read $FUNCTION_NAME --region=$REGION" -ForegroundColor Gray
}

Write-Host "`nPress Enter to continue..." -ForegroundColor Yellow
Read-Host