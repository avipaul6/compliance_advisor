from fastapi import APIRouter, Depends, HTTPException
from app.models.requests import ChatRequest
from app.models.responses import ChatResponse
from app.services.vertex_ai_service import VertexAIService
from app.core.dependencies import get_vertex_ai_service

router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
async def chat_with_bot(
    request: ChatRequest,
    vertex_ai_service: VertexAIService = Depends(get_vertex_ai_service)
):
    try:
        # Search for context
        context, grounding = vertex_ai_service.search_documents(request.message)
        
        # Generate response
        response_text = vertex_ai_service.chat_with_context(
            request.message, 
            [msg.dict() for msg in request.history],
            context
        )
        
        return ChatResponse(text=response_text, grounding=grounding)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))