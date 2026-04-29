from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.account import router as account_router
from app.api.projects import router as projects_router
from app.api.upload import router as upload_router


app = FastAPI(title="Material Enhancement Assistant Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(account_router)
app.include_router(projects_router)
app.include_router(upload_router)

@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "Welcome to the Backend!"}

@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
