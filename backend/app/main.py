import logging

from fastapi import FastAPI
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.account import router as account_router
from app.api.projects import router as projects_router
from app.api.quiz import router as quiz_router
from app.api.upload import router as upload_router
from app.config import get_app_version, get_cors_allowed_origins
from app.services import db
from app.services.errors import DataServiceError, MissingConfigError


logger = logging.getLogger(__name__)


OPENAPI_TAGS = [
    {
        "name": "Authentication",
        "description": (
            "Create an account or log in to get an access token and a refresh token. "
            "In Swagger UI, click **Authorize** and paste the `access_token` to call protected endpoints."
        ),
    },
    {"name": "Projects", "description": "Projects owned by the signed-in user."},
    {"name": "Course materials", "description": "Uploaded PDF, DOCX, and PPTX sources, their files, and page previews."},
    {"name": "Project chat", "description": "Questions answered from a project's materials, with stored history."},
    {"name": "Generated materials", "description": "Slide decks and other outputs generated from project materials."},
    {"name": "Quiz", "description": "Quiz generation from project materials."},
    {"name": "System", "description": "Service status. No authentication required."},
]

app = FastAPI(
    title="Material Enhancement Assistant API",
    description=(
        "Backend for the Material Enhancement Assistant. Every endpoint except those under "
        "Authentication (create account, log in, refresh) and System requires a bearer access token."
    ),
    openapi_tags=OPENAPI_TAGS,
    swagger_ui_parameters={"persistAuthorization": True, "tagsSorter": "none", "operationsSorter": "none"},
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(account_router)
app.include_router(projects_router)
app.include_router(quiz_router)
app.include_router(upload_router)

@app.get("/", tags=["System"], summary="Service banner")
async def root() -> dict[str, str]:
    return {"message": "Welcome to the Backend!"}

@app.get("/health", tags=["System"], summary="Health check")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "version": get_app_version()}


@app.get(
    "/health/db",
    tags=["System"],
    summary="Database connectivity check",
    responses={503: {"description": "The database is unreachable or not configured."}},
)
async def database_health_check() -> JSONResponse:
    # Not the platform health check: a Neon blip should not restart the container.
    try:
        await run_in_threadpool(db.fetch_one, "SELECT 1")
    except (DataServiceError, MissingConfigError) as exc:
        logger.warning("Database health check failed: %s", exc)
        return JSONResponse({"status": "unavailable"}, status_code=503)
    return JSONResponse({"status": "ok"})
