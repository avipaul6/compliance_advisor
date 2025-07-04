from app.services.vertex_ai_service import VertexAIService
from app.services.analysis_service import AnalysisService
from app.services.document_service import DocumentService
from functools import lru_cache

@lru_cache()
def get_vertex_ai_service() -> VertexAIService:
    return VertexAIService()

@lru_cache()
def get_analysis_service() -> AnalysisService:
    return AnalysisService()

@lru_cache()
def get_document_service() -> DocumentService:
    return DocumentService()