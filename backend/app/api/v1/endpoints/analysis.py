from fastapi import APIRouter, Depends, HTTPException
from app.models.requests import GapReviewRequest, DeepDiveRequest, DraftRequest
from app.models.responses import SavedAnalysis, DraftResponse
from app.services.analysis_service import AnalysisService
from app.core.dependencies import get_analysis_service

router = APIRouter()

@router.post("/generate/gap-review", response_model=SavedAnalysis)
async def generate_gap_review(
    request: GapReviewRequest,
    analysis_service: AnalysisService = Depends(get_analysis_service)
):
    try:
        return analysis_service.generate_gap_review(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate/deep-dive", response_model=SavedAnalysis)
async def generate_deep_dive(
    request: DeepDiveRequest,
    analysis_service: AnalysisService = Depends(get_analysis_service)
):
    try:
        return analysis_service.generate_deep_dive(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate/draft", response_model=DraftResponse)
async def generate_draft(
    request: DraftRequest,
    analysis_service: AnalysisService = Depends(get_analysis_service)
):
    try:
        draft_text = analysis_service.generate_draft(request)
        return DraftResponse(newDraft=draft_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))