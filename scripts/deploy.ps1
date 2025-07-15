# FIXED deploy.ps1 - PowerShell deployment script for Cloud Run

# Configuration
$PROJECT_ID = "data-consumption-layer"
$SERVICE_NAME = "ofx-compliance-assistant-v3"
$REGION = "australia-southeast1"  # Deploy in Australia
$BUCKET_NAME = "compliance-assistant-ai-ingestion"  # Cloud Storage bucket name

# Vector Search Configuration - CORRECTED IDs
$VECTOR_INDEX_ENDPOINT_ID = "3802623581267951616"
$VECTOR_INDEX_ID = "6888416158760828928"  # ← FIXED: The one with 93 vectors
$VECTOR_DEPLOYED_INDEX_ID = "compliance_docs_streaming_working"  # ← FIXED
$VECTOR_SEARCH_REGION = "us-central1"

Write-Host "🚀 Deploying OFX Compliance Assistant to Cloud Run" -ForegroundColor Cyan
Write-Host "Project: $PROJECT_ID" -ForegroundColor White
Write-Host "Service: $SERVICE_NAME" -ForegroundColor White
Write-Host "Cloud Run Region: $REGION" -ForegroundColor White
Write-Host "Vector Search Region: $VECTOR_SEARCH_REGION" -ForegroundColor White
Write-Host "Vector Index ID: $VECTOR_INDEX_ID (with 93 vectors)" -ForegroundColor Green
Write-Host "Storage Bucket: $BUCKET_NAME" -ForegroundColor White

try {
    # Check if required tools are installed
    Write-Host "`n🔍 Checking required tools..." -ForegroundColor Yellow

    if (!(Get-Command gcloud -ErrorAction SilentlyContinue)) {
        throw "gcloud CLI is required but not installed. Please install Google Cloud SDK."
    }

    if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
        throw "Docker is required but not installed. Please install Docker Desktop."
    }

    Write-Host "✅ Required tools found" -ForegroundColor Green

    # Set the project
    Write-Host "`n📋 Setting up Google Cloud project..." -ForegroundColor Yellow
    gcloud config set project $PROJECT_ID
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to set project. Please check authentication: gcloud auth login"
    }

    # Enable required APIs
    Write-Host "`n🔧 Enabling required Google Cloud APIs..." -ForegroundColor Yellow
    $apis = @(
        "cloudbuild.googleapis.com",
        "run.googleapis.com", 
        "aiplatform.googleapis.com",
        "storage.googleapis.com"
    )

    foreach ($api in $apis) {
        Write-Host "Enabling $api..." -ForegroundColor Gray
        gcloud services enable $api
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Failed to enable $api, but continuing..."
        }
    }

    # Verify bucket exists
    Write-Host "`n📦 Verifying Cloud Storage bucket..." -ForegroundColor Yellow
    $bucketCheck = gsutil ls -b "gs://$BUCKET_NAME" 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "❌ Bucket gs://$BUCKET_NAME does not exist! Please run setup-infrastructure.sh first or create the bucket manually."
    }
    Write-Host "✅ Bucket verified: gs://$BUCKET_NAME" -ForegroundColor Green

    # Build and deploy with Cloud Build
    Write-Host "`n🏗️ Building and deploying with Cloud Build..." -ForegroundColor Yellow
    Write-Host "This may take 5-10 minutes..." -ForegroundColor Gray

    # CORRECTED env vars with the right Vector Search IDs
    $envVars = "PROJECT_ID=$PROJECT_ID,ENVIRONMENT=production,STORAGE_BUCKET_NAME=$BUCKET_NAME,VERTEX_AI_LOCATION=us-central1,VECTOR_INDEX_ENDPOINT_ID=$VECTOR_INDEX_ENDPOINT_ID,VECTOR_INDEX_ID=$VECTOR_INDEX_ID,VECTOR_DEPLOYED_INDEX_ID=$VECTOR_DEPLOYED_INDEX_ID,VECTOR_SEARCH_REGION=$VECTOR_SEARCH_REGION,EMBEDDING_MODEL=gemini-embedding-001,GENERATION_MODEL=gemini-2.5-flash,EMBEDDING_DIMENSIONS=3072,CHUNK_SIZE=1000,CHUNK_OVERLAP=200,RETRIEVAL_TOP_K=10,MAX_FILE_SIZE_MB=10,MAX_BATCH_SIZE=10,LOG_LEVEL=INFO"

    gcloud run deploy $SERVICE_NAME `
        --source . `
        --platform managed `
        --region $REGION `
        --allow-unauthenticated `
        --port 8080 `
        --memory 4Gi `
        --cpu 2 `
        --timeout 600 `
        --concurrency 50 `
        --max-instances 10 `
        --set-env-vars=$envVars `
        --service-account="compliance-assistant-sa@$PROJECT_ID.iam.gserviceaccount.com"

    if ($LASTEXITCODE -ne 0) {
        throw "Cloud Run deployment failed"
    }

    # Get the service URL
    Write-Host "`n🔍 Getting service URL..." -ForegroundColor Yellow
    $SERVICE_URL = (gcloud run services describe $SERVICE_NAME --region $REGION --format='value(status.url)')

    if (!$SERVICE_URL) {
        throw "Failed to get service URL"
    }

    # Test the deployment
    Write-Host "`n🧪 Testing deployment..." -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri "$SERVICE_URL/api/v1/health" -Method GET -TimeoutSec 30 -ErrorAction Stop
        $statusCode = $response.StatusCode

        if ($statusCode -eq 200) {
            Write-Host "✅ Health check passed!" -ForegroundColor Green
        } else {
            Write-Host "⚠️ Health check returned HTTP $statusCode" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "⚠️ Health check failed: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "Check logs: gcloud run services logs read $SERVICE_NAME --region $REGION" -ForegroundColor Gray
    }

    # Test RAG index endpoint
    Write-Host "`n🔍 Testing RAG Index endpoint..." -ForegroundColor Yellow
    try {
        $ragResponse = Invoke-WebRequest -Uri "$SERVICE_URL/api/v1/rag/index-stats" -Method GET -TimeoutSec 30 -ErrorAction Stop
        if ($ragResponse.StatusCode -eq 200) {
            Write-Host "✅ RAG Index endpoint working!" -ForegroundColor Green
        }
    } catch {
        Write-Host "⚠️ RAG Index test failed: $($_.Exception.Message)" -ForegroundColor Yellow
    }

    # Success output
    Write-Host "`n✅ Deployment completed successfully!" -ForegroundColor Green
    Write-Host "`n📊 Deployment Summary:" -ForegroundColor Cyan
    Write-Host "🌐 Service URL: $SERVICE_URL" -ForegroundColor White
    Write-Host "📚 API Documentation: $SERVICE_URL/docs" -ForegroundColor White
    Write-Host "🏥 Health Check: $SERVICE_URL/api/v1/health" -ForegroundColor White
    Write-Host "📊 RAG Index Stats: $SERVICE_URL/api/v1/rag/index-stats" -ForegroundColor White
    Write-Host "📋 Indexed Documents: $SERVICE_URL/api/v1/rag/indexed-documents" -ForegroundColor White
    Write-Host ""
    Write-Host "🎯 Vector Search Configuration (CORRECTED):" -ForegroundColor Cyan
    Write-Host "   📊 Index ID: $VECTOR_INDEX_ID (with 93 vectors)" -ForegroundColor Green
    Write-Host "   🔗 Endpoint ID: $VECTOR_INDEX_ENDPOINT_ID" -ForegroundColor White
    Write-Host "   🚀 Deployed Index: $VECTOR_DEPLOYED_INDEX_ID" -ForegroundColor White
    Write-Host ""
    Write-Host "🎉 Your RAG Index tab should now show 93 indexed documents!" -ForegroundColor Green

} catch {
    Write-Host "`n❌ Deployment failed: $($_.Exception.Message)" -ForegroundColor Red

    Write-Host "`n🔧 Troubleshooting steps:" -ForegroundColor Yellow
    Write-Host "   1. Check authentication: gcloud auth login" -ForegroundColor Gray
    Write-Host "   2. Check project access: gcloud projects describe $PROJECT_ID" -ForegroundColor Gray  
    Write-Host "   3. Check service account: gcloud iam service-accounts describe compliance-assistant-sa@$PROJECT_ID.iam.gserviceaccount.com" -ForegroundColor Gray
    Write-Host "   4. Check logs: gcloud builds log --region=$REGION" -ForegroundColor Gray

} finally {
    Write-Host "`nPress Enter to continue..." -ForegroundColor Yellow
    Read-Host
}

# ===========================================
# FIXED deploy_rag.ps1 - Same corrections
# ===========================================

# deploy_rag.ps1 - Deploy RAG-enabled backend to Cloud Run (PowerShell)
param(
    [string]$ProjectId = "data-consumption-layer",
    [string]$ServiceName = "ofx-compliance-assistant-v3",
    [string]$Region = "australia-southeast1",
    [string]$BucketName = "compliance-assistant-ai-ingestion",
    [string]$VectorIndexEndpointId = "3802623581267951616",
    [string]$VectorIndexId = "6888416158760828928",  # ← FIXED: The one with 93 vectors
    [string]$VectorDeployedIndexId = "compliance_docs_streaming_working",  # ← FIXED
    [string]$VectorSearchRegion = "us-central1",
    [string]$EmbeddingModel = "gemini-embedding-001",
    [string]$GenerationModel = "gemini-2.5-flash"
)

Write-Host "🚀 Deploying OFX Compliance Assistant with RAG to Cloud Run" -ForegroundColor Green
Write-Host "✅ CORRECTED Vector Index ID: $VectorIndexId (with 93 vectors)" -ForegroundColor Green

# ... rest of script with corrected environment variables ...