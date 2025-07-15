# cloud_function/main.py - EXACT Google example pattern with minimal logging
import functions_framework
from google.cloud import aiplatform
from google.cloud import storage
import PyPDF2
import io
import hashlib
import vertexai
from vertexai.language_models import TextEmbeddingModel
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Config
PROJECT_ID = "data-consumption-layer"
LOCATION = "us-central1"
INDEX_NAME = "6888416158760828928"
EMBEDDING_MODEL = "gemini-embedding-001"

# Initialize - EXACT Google pattern
vertexai.init(project=PROJECT_ID, location=LOCATION)
aiplatform.init(project=PROJECT_ID, location=LOCATION)

@functions_framework.cloud_event
def process_document_upload(cloud_event):
    print("🚀 Function started")
    
    # Get file info
    data = cloud_event.data
    bucket_name = data["bucket"]
    file_name = data["name"]
    print(f"📁 Processing: {file_name}")
    
    # Skip if not PDF or already processed
    if not file_name.endswith('.pdf'):
        print("⏭️ Skipping non-PDF")
        return {"status": "skipped"}
    
    # Get file
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(file_name)
    
    # Check if processed
    blob.reload()
    if (blob.metadata or {}).get("rag_processed") == "true":
        print("⏭️ Already processed")
        return {"status": "already_processed"}
    
    print("📄 Extracting PDF text")
    # Extract text
    pdf_content = blob.download_as_bytes()
    pdf_file = io.BytesIO(pdf_content)
    pdf_reader = PyPDF2.PdfReader(pdf_file)
    text = "".join(page.extract_text() for page in pdf_reader.pages)
    
    # Chunk text
    chunks = [text[i:i+1000] for i in range(0, len(text), 800)]
    print(f"🔪 Created {len(chunks)} chunks")
    
    # Generate embeddings
    embedding_model = TextEmbeddingModel.from_pretrained(EMBEDDING_MODEL)
    print("🤖 Initialized embedding model")
    
    # Create index instance - EXACT Google pattern
    my_index = aiplatform.MatchingEngineIndex(index_name=INDEX_NAME)
    print("🔗 Connected to Vector Search index")
    
    # Process chunks - EXACT Google pattern
    datapoints = []
    doc_id = hashlib.md5(file_name.encode()).hexdigest()[:16]
    
    for i, chunk in enumerate(chunks[:5]):  # Process first 5 chunks only
        if not chunk.strip():
            continue
            
        print(f"🧠 Processing chunk {i+1}/5")
        # Generate embedding
        response = embedding_model.get_embeddings([chunk[:8000]])
        if response and len(response) > 0:
            embedding_vector = response[0].values
            
            # Create datapoint - CORRECT version
            from google.cloud.aiplatform_v1.types import index
            datapoints.append(
                index.IndexDatapoint(
                    datapoint_id=f"{doc_id}_chunk_{i}",
                    feature_vector=embedding_vector
                )
            )
            print(f"✅ Created datapoint {i+1}")
    
    print(f"📤 Upserting {len(datapoints)} datapoints to Vector Search")
    # Upsert - EXACT Google pattern
    my_index.upsert_datapoints(datapoints=datapoints)
    print("✅ Upsert successful")
    
    # Mark processed
    blob.metadata = {**(blob.metadata or {}), "rag_processed": "true"}
    blob.patch()
    print("💾 Marked as processed")
    
    print("🎉 Function completed successfully")
    return {"status": "success", "chunks": len(datapoints)}