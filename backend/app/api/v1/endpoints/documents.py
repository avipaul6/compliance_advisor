from fastapi import APIRouter, Depends
from app.models.requests import IngestRequest
from app.models.responses import IngestResponse
from app.services.document_service import DocumentService
from app.core.dependencies import get_document_service

router = APIRouter()

@router.post("/ingest", response_model=IngestResponse)
async def ingest_documents(
    request: IngestRequest,
    document_service: DocumentService = Depends(get_document_service)
):
    return document_service.ingest_documents(request)