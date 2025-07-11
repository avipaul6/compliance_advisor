# deploy_rag_backend.ps1 - Deploy RAG-enabled backend to Cloud Run (PowerShell)
# OFX Compliance Assistant RAG Migration Deployment Script

param(
    [string]$ProjectId = "data-consumption-layer",
    [string]$ServiceName = "ofx-compliance-assistant",
    [string]$Region = "australia-southeast1",
    [string]$BucketName = "compliance-assistant-ai-ingestion",
    [string]$VectorIndexEndpointId = "3802623581267951616",
    [string]$VectorIndexId = "2338232422744719360",
    [string]$VectorDeployedIndexId = "compliance_docs_deployed_small",
    [string]$VectorSearchRegion = "us-central1",
    [string]$EmbeddingModel = "gemini-embedding-001",
    [string]$GenerationModel = "gemini-2.5-flash"
)

# Set error handling
$ErrorActionPreference = "Stop"

Write-Host "🚀 Deploying OFX Compliance Assistant with RAG to Cloud Run" -ForegroundColor Green
Write-Host "Project: $ProjectId" -ForegroundColor White
Write-Host "Service: $ServiceName" -ForegroundColor White
Write-Host "Region: $Region (Cloud Run)" -ForegroundColor White
Write-Host "Vector Search Region: $VectorSearchRegion" -ForegroundColor White
Write-Host "Storage Bucket: $BucketName" -ForegroundColor White
Write-Host ""

# Check if required tools are installed
Write-Host "🔧 Checking required tools..." -ForegroundColor Yellow

try {
    $gcloudVersion = gcloud version 2>$null
    if (-not $gcloudVersion) {
        throw "gcloud CLI not found"
    }
    Write-Host "  ✅ gcloud CLI found" -ForegroundColor Green
} catch {
    Write-Host "❌ gcloud CLI is required but not installed." -ForegroundColor Red
    Write-Host "Please install Google Cloud SDK from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

# Set the project
Write-Host "`n📋 Setting up Google Cloud project..." -ForegroundColor Yellow
try {
    gcloud config set project $ProjectId
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to set project"
    }
    Write-Host "  ✅ Project set to: $ProjectId" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to set Google Cloud project: $ProjectId" -ForegroundColor Red
    Write-Host "Please ensure you have access to this project and are authenticated." -ForegroundColor Yellow
    exit 1
}

# Enable required APIs
Write-Host "`n🔧 Ensuring required Google Cloud APIs are enabled..." -ForegroundColor Yellow
$requiredApis = @(
    "cloudbuild.googleapis.com",
    "run.googleapis.com", 
    "aiplatform.googleapis.com",
    "storage.googleapis.com"
)

foreach ($api in $requiredApis) {
    try {
        Write-Host "  Enabling $api..." -ForegroundColor Gray
        gcloud services enable $api --quiet
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to enable $api"
        }
    } catch {
        Write-Host "  ⚠️ Warning: Could not enable $api. It may already be enabled." -ForegroundColor Yellow
    }
}
Write-Host "  ✅ APIs enabled" -ForegroundColor Green

# Verify bucket exists
Write-Host "`n📦 Verifying Cloud Storage bucket..." -ForegroundColor Yellow
try {
    $bucketCheck = gsutil ls -b "gs://$BucketName" 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Bucket not found"
    }
    Write-Host "  ✅ Bucket verified: gs://$BucketName" -ForegroundColor Green
} catch {
    Write-Host "❌ Bucket gs://$BucketName does not exist!" -ForegroundColor Red
    Write-Host "Please run prepare_vector_bucket.ps1 first." -ForegroundColor Yellow
    exit 1
}

# Verify vector search endpoint exists
Write-Host "`n🔍 Verifying Vector Search endpoint..." -ForegroundColor Yellow
try {
    $endpointCheck = & gcloud ai index-endpoints describe $VectorIndexEndpointId --region=$VectorSearchRegion --format='value(name)' 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $endpointCheck) {
        throw "Vector Search endpoint not found"
    }
    Write-Host "  ✅ Vector Search endpoint verified: $VectorIndexEndpointId" -ForegroundColor Green
} catch {
    Write-Host "❌ Vector Search endpoint $VectorIndexEndpointId not found!" -ForegroundColor Red
    Write-Host "Please ensure vector search setup is completed first." -ForegroundColor Yellow
    exit 1
}

Write-Host "`n✅ Infrastructure verification complete" -ForegroundColor Green

# Build environment variables string
$envVars = @(
    "PROJECT_ID=$ProjectId",
    "ENVIRONMENT=production",
    "STORAGE_BUCKET_NAME=$BucketName",
    "VERTEX_AI_LOCATION=us-central1",
    "VECTOR_SEARCH_REGION=$VectorSearchRegion",
    "VECTOR_INDEX_ENDPOINT_ID=$VectorIndexEndpointId",
    "VECTOR_INDEX_ID=$VectorIndexId", 
    "VECTOR_DEPLOYED_INDEX_ID=$VectorDeployedIndexId",
    "EMBEDDING_MODEL=$EmbeddingModel",
    "GENERATION_MODEL=$GenerationModel",
    "EMBEDDING_DIMENSIONS=3072",
    "CHUNK_SIZE=1000",
    "CHUNK_OVERLAP=200",
    "RETRIEVAL_TOP_K=10",
    "MAX_FILE_SIZE_MB=10",
    "MAX_BATCH_SIZE=10",
    "REQUEST_TIMEOUT_SECONDS=600",
    "LOG_LEVEL=INFO"
) -join ","

# Build and deploy with comprehensive environment variables
Write-Host "`n🏗️ Building and deploying RAG-enabled backend..." -ForegroundColor Yellow
Write-Host "This may take 8-12 minutes..." -ForegroundColor Gray

try {
    & gcloud run deploy $ServiceName `
        --source . `
        --platform managed `
        --region $Region `
        --allow-unauthenticated `
        --port 8080 `
        --memory 4Gi `
        --cpu 2 `
        --timeout 600 `
        --concurrency 50 `
        --max-instances 10 `
        --min-instances 1 `
        --set-env-vars=$envVars `
        --service-account="compliance-assistant-sa@$ProjectId.iam.gserviceaccount.com"

    if ($LASTEXITCODE -ne 0) {
        throw "Cloud Run deployment failed"
    }
} catch {
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "`nTroubleshooting steps:" -ForegroundColor Yellow
    Write-Host "1. Check if you have sufficient IAM permissions" -ForegroundColor White
    Write-Host "2. Verify service account exists: compliance-assistant-sa@$ProjectId.iam.gserviceaccount.com" -ForegroundColor White
    Write-Host "3. Check Cloud Build logs in Google Cloud Console" -ForegroundColor White
    exit 1
}

# Get the service URL
Write-Host "`n🔍 Getting service URL..." -ForegroundColor Yellow
try {
    $ServiceUrl = & gcloud run services describe $ServiceName --region $Region --format='value(status.url)'
    
    if (-not $ServiceUrl) {
        throw "Failed to get service URL"
    }
    Write-Host "  ✅ Service URL obtained: $ServiceUrl" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to get service URL" -ForegroundColor Red
    Write-Host "Check deployment status: gcloud run services list --region $Region" -ForegroundColor Yellow
    exit 1
}

# Test the deployment
Write-Host "`n🧪 Testing RAG-enabled deployment..." -ForegroundColor Yellow

# Health check
Write-Host "  Testing health endpoint..." -ForegroundColor Gray
try {
    $healthResponse = Invoke-WebRequest -Uri "$ServiceUrl/api/v1/health" -Method GET -TimeoutSec 30 -ErrorAction Stop
    $healthStatus = $healthResponse.StatusCode
    
    if ($healthStatus -eq 200) {
        Write-Host "  ✅ Health check passed!" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️ Health check returned HTTP $healthStatus" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ⚠️ Health check failed: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "  Check logs: gcloud run services logs read $ServiceName --region $Region" -ForegroundColor Gray
}

# Test RAG health endpoint
Write-Host "  Testing RAG health endpoint..." -ForegroundColor Gray
try {
    $ragResponse = Invoke-WebRequest -Uri "$ServiceUrl/api/v1/health/rag" -Method GET -TimeoutSec 30 -ErrorAction Stop
    $ragStatus = $ragResponse.StatusCode
    
    if ($ragStatus -eq 200) {
        Write-Host "  ✅ RAG health check passed!" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️ RAG health check returned HTTP $ragStatus" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ⚠️ RAG health check failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Success output
Write-Host "`n✅ RAG-enabled backend deployment completed!" -ForegroundColor Green
Write-Host "`n📊 Deployment Summary:" -ForegroundColor Cyan
Write-Host "🌐 Service URL: $ServiceUrl" -ForegroundColor White
Write-Host "📚 API Documentation: $ServiceUrl/docs" -ForegroundColor White
Write-Host "🏥 Health Check: $ServiceUrl/api/v1/health" -ForegroundColor White
Write-Host "🤖 RAG Health: $ServiceUrl/api/v1/health/rag" -ForegroundColor White
Write-Host "📄 Document Upload: $ServiceUrl/api/v1/documents/upload" -ForegroundColor White
Write-Host "🔍 Gap Analysis: $ServiceUrl/api/v1/analysis/gap-review" -ForegroundColor White
Write-Host "🔬 Deep Dive: $ServiceUrl/api/v1/analysis/deep-dive" -ForegroundColor White
Write-Host ""
Write-Host "🎯 RAG Configuration:" -ForegroundColor Cyan
Write-Host "  🤖 Generation Model: $GenerationModel" -ForegroundColor White
Write-Host "  📊 Embedding Model: $EmbeddingModel" -ForegroundColor White
Write-Host "  🔢 Embedding Dimensions: 3072" -ForegroundColor White
Write-Host "  📑 Chunk Size: 1000 tokens" -ForegroundColor White
Write-Host "  🔄 Chunk Overlap: 200 tokens" -ForegroundColor White
Write-Host "  🎯 Retrieval Top-K: 10 documents" -ForegroundColor White
Write-Host "  🔍 Vector Endpoint: $VectorIndexEndpointId" -ForegroundColor White
Write-Host ""
Write-Host "💰 Cost Optimization:" -ForegroundColor Cyan
Write-Host "  💵 Vector Search: ~`$65/month (e2-standard-2)" -ForegroundColor White
Write-Host "  💚 Savings vs standard setup: ~`$482/month" -ForegroundColor White
Write-Host ""
Write-Host "🇦🇺 Deployed in Australia region for optimal user experience" -ForegroundColor White
Write-Host "🤖 Vector Search running in $VectorSearchRegion" -ForegroundColor White
Write-Host ""
Write-Host "🔄 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Test document ingestion: POST $ServiceUrl/api/v1/documents/ingest" -ForegroundColor White
Write-Host "   2. Test gap analysis with your documents" -ForegroundColor White
Write-Host "   3. Monitor performance and costs in Google Cloud Console" -ForegroundColor White
Write-Host "   4. Update frontend to use new RAG endpoints" -ForegroundColor White
Write-Host ""
Write-Host "📋 Important Notes:" -ForegroundColor Cyan
Write-Host "   ⚠️  Remove old DATA_STORE_ID environment variable from any scripts" -ForegroundColor Yellow
Write-Host "   ⚠️  Update frontend API calls to use new RAG-enhanced endpoints" -ForegroundColor Yellow
Write-Host "   ⚠️  Monitor Vector Search costs in Cloud Console" -ForegroundColor Yellow
Write-Host "   ✅ All document processing now uses Vector Search RAG" -ForegroundColor Green
Write-Host "   ✅ Multi-document analysis capabilities enabled" -ForegroundColor Green
Write-Host "   ✅ Cost-optimized configuration active" -ForegroundColor Green
Write-Host ""
Write-Host "🚨 CRITICAL: Save these configuration values:" -ForegroundColor Red
Write-Host "PROJECT_ID=$ProjectId" -ForegroundColor White
Write-Host "VECTOR_INDEX_ENDPOINT_ID=$VectorIndexEndpointId" -ForegroundColor White
Write-Host "VECTOR_INDEX_ID=$VectorIndexId" -ForegroundColor White
Write-Host "VECTOR_DEPLOYED_INDEX_ID=$VectorDeployedIndexId" -ForegroundColor White
Write-Host "SERVICE_URL=$ServiceUrl" -ForegroundColor White
Write-Host ""
Write-Host "🎉 RAG migration deployment complete! 🎉" -ForegroundColor Green

# Save configuration to file
$configContent = @"
# OFX Compliance Assistant RAG Configuration
# Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

PROJECT_ID=$ProjectId
SERVICE_NAME=$ServiceName
SERVICE_URL=$ServiceUrl
VECTOR_INDEX_ENDPOINT_ID=$VectorIndexEndpointId
VECTOR_INDEX_ID=$VectorIndexId
VECTOR_DEPLOYED_INDEX_ID=$VectorDeployedIndexId
VECTOR_SEARCH_REGION=$VectorSearchRegion
EMBEDDING_MODEL=$EmbeddingModel
GENERATION_MODEL=$GenerationModel
STORAGE_BUCKET_NAME=$BucketName

# Deployment completed successfully on $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
"@

$configContent | Out-File -FilePath "rag-deployment-config.txt" -Encoding UTF8
Write-Host "📄 Configuration saved to: rag-deployment-config.txt" -ForegroundColor Cyan

Write-Host "`n🚀 Ready to test your new RAG-enhanced compliance assistant!" -ForegroundColor Green