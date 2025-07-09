# deploy.ps1 - PowerShell deployment script for Cloud Run

# Configuration
$PROJECT_ID = "data-consumption-layer"
$SERVICE_NAME = "ofx-compliance-assistant-v2"
$REGION = "australia-southeast1"  # Deploy in Australia
$DATA_STORE_ID = "compliance-assistant-ofx-datastore-01_1751759736770"
$BUCKET_NAME = "compliance-assistant-ai-ingestion"  # Cloud Storage bucket name

# Vertex AI Configuration (can be different from Cloud Run region)
$VERTEX_AI_LOCATION = "us-central1"  # Your Vertex AI/data store location

Write-Host "🚀 Deploying OFX Compliance Assistant to Cloud Run" -ForegroundColor Cyan
Write-Host "Project: $PROJECT_ID" -ForegroundColor White
Write-Host "Service: $SERVICE_NAME" -ForegroundColor White
Write-Host "Cloud Run Region: $REGION" -ForegroundColor White
Write-Host "Vertex AI Region: $VERTEX_AI_LOCATION" -ForegroundColor White
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
        "discoveryengine.googleapis.com",
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
    
    $envVars = "PROJECT_ID=$PROJECT_ID,DATA_STORE_ID=$DATA_STORE_ID,LOCATION=global,VERTEX_AI_LOCATION=$VERTEX_AI_LOCATION,ENVIRONMENT=production,STORAGE_BUCKET_NAME=$BUCKET_NAME,MAX_FILE_SIZE_MB=10,MAX_BATCH_SIZE=10,LOG_LEVEL=INFO"
    
    gcloud run deploy $SERVICE_NAME `
        --source . `
        --platform managed `
        --region $REGION `
        --allow-unauthenticated `
        --port 8080 `
        --memory 2Gi `
        --cpu 2 `
        --timeout 300 `
        --concurrency 80 `
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

    # Success output
    Write-Host "`n✅ Deployment completed successfully!" -ForegroundColor Green
    Write-Host "`n📊 Deployment Summary:" -ForegroundColor Cyan
    Write-Host "🌐 Service URL: $SERVICE_URL" -ForegroundColor White
    Write-Host "📚 API Documentation: $SERVICE_URL/docs" -ForegroundColor White
    Write-Host "🏥 Health Check: $SERVICE_URL/api/v1/health" -ForegroundColor White
    Write-Host "📁 Document Upload: $SERVICE_URL/api/v1/documents/upload" -ForegroundColor White
    Write-Host ""
    Write-Host "🇦🇺 Deployed in Australia region for optimal user experience" -ForegroundColor White
    Write-Host "🤖 Using Vertex AI in $VERTEX_AI_LOCATION region" -ForegroundColor White  
    Write-Host "📦 Document storage: gs://$BUCKET_NAME" -ForegroundColor White
    Write-Host ""
    Write-Host "🔄 Next steps:" -ForegroundColor Cyan
    Write-Host "   1. Test document upload: curl -X POST '$SERVICE_URL/api/v1/documents/upload' -F 'file=@test.pdf'" -ForegroundColor Gray
    Write-Host "   2. Check Cloud Function logs: gcloud functions logs read process-document-upload --region=us-central1" -ForegroundColor Gray
    Write-Host "   3. Monitor service: $SERVICE_URL" -ForegroundColor Gray
    
    # Optional: Open in browser
    $openBrowser = Read-Host "`nWould you like to open the service in your browser? (y/n)"
    if ($openBrowser -eq 'y' -or $openBrowser -eq 'Y') {
        Start-Process $SERVICE_URL
    }

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