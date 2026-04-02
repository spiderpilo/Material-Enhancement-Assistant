from fastapi import FastAPI

from app.api.upload import router as upload_router


app = FastAPI(title="Material Enhancement Assistant Backend")
app.include_router(upload_router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
