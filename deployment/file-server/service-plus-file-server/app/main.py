"""FastAPI file server entry point."""
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import file_settings
from app.routers.files import router as files_router, api_router

app = FastAPI(
    title="Service Plus File Server",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(files_router)
app.include_router(api_router)


@app.get("/test")
async def test_route():
    """Simple test route."""
    return {"message": "File server is running"}


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=file_settings.host,
        port=file_settings.port,
        reload=file_settings.debug if hasattr(file_settings, "debug") else False,
        log_level="info",
    )
