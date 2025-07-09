#!/bin/bash
# prepare_vector_bucket.sh - Set up Cloud Storage structure for vector data

set -e

PROJECT_ID="data-consumption-layer"
BUCKET_NAME="compliance-assistant-ai-ingestion"

echo "📦 Preparing Cloud Storage for Vector Search data"
echo "Bucket: gs://$BUCKET_NAME"
echo ""

# Create vector-specific directories by creating placeholder files
echo "📁 Creating directory structure..."

# Create placeholder files to establish directory structure
echo "# Vector index data directory for Vertex AI Vector Search" > temp_placeholder.txt

# Vector index data directory (required by Vertex AI Vector Search)
gsutil cp temp_placeholder.txt gs://$BUCKET_NAME/vector-index-data/.placeholder
echo "  ✅ Created gs://$BUCKET_NAME/vector-index-data/"

# Document chunks and embeddings storage
gsutil cp temp_placeholder.txt gs://$BUCKET_NAME/embeddings/.placeholder
echo "  ✅ Created gs://$BUCKET_NAME/embeddings/"

gsutil cp temp_placeholder.txt gs://$BUCKET_NAME/chunks/.placeholder
echo "  ✅ Created gs://$BUCKET_NAME/chunks/"

gsutil cp temp_placeholder.txt gs://$BUCKET_NAME/metadata/.placeholder
echo "  ✅ Created gs://$BUCKET_NAME/metadata/"

# Backup of current documents (before migration)
gsutil cp temp_placeholder.txt gs://$BUCKET_NAME/backup/data-store-docs/.placeholder
echo "  ✅ Created gs://$BUCKET_NAME/backup/data-store-docs/"

# Clean up
rm temp_placeholder.txt

echo "✅ Directory structure created:"
echo "  📁 gs://$BUCKET_NAME/vector-index-data/    # Vector Search index data"
echo "  📁 gs://$BUCKET_NAME/embeddings/           # Generated embeddings"
echo "  📁 gs://$BUCKET_NAME/chunks/               # Document chunks"
echo "  📁 gs://$BUCKET_NAME/metadata/             # Document metadata"
echo "  📁 gs://$BUCKET_NAME/backup/               # Data Store backup"
echo ""

# Create initial empty files to initialize vector index
echo "🔧 Initializing vector index data structure..."

# Create empty JSONL file for initial index
cat > empty_vectors.jsonl << 'EOF'
EOF

gsutil cp empty_vectors.jsonl gs://$BUCKET_NAME/vector-index-data/
rm empty_vectors.jsonl

echo "✅ Vector index data structure initialized"
echo ""
echo "🚀 Ready for document ingestion pipeline!"