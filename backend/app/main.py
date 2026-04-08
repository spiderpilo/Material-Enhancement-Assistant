from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_cors_origins
from app.api.upload import router as upload_router


app = FastAPI(title="Material Enhancement Assistant Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(upload_router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
