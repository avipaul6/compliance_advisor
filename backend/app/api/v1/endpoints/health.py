from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def read_root():
    return {"message": "OFX Compliance Assistant Backend is running!"}

@router.get("/health")
def health_check():
    return {"status": "healthy"}