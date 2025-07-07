# backend/app/main.py
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.config import settings
from app.api.v1.api import api_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="OFX Compliance Assistant Backend",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)

# Serve static files (React build) if they exist
static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")
    
    @app.get("/")
    async def serve_react_app():
        """Serve the React application"""
        index_file = os.path.join(static_dir, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        else:
            return {"message": "Frontend not built. Please build the React app first."}
    
    @app.get("/{path:path}")
    async def serve_react_routes(path: str):
        """Catch-all route to serve React app for client-side routing"""
        # Don't intercept API routes
        if path.startswith("api/"):
            return {"error": "API route not found"}
        
        # Serve static files directly
        static_file = os.path.join(static_dir, path)
        if os.path.exists(static_file) and os.path.isfile(static_file):
            return FileResponse(static_file)
        
        # Otherwise serve index.html for React routing
        index_file = os.path.join(static_dir, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        else:
            return {"error": "Frontend not available"}
else:
    @app.get("/")
    async def read_root():
        return {"message": "OFX Compliance Assistant Backend is running! Frontend not deployed."}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)