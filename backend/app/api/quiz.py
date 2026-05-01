import logging

from fastapi import APIRouter, Header, HTTPException

from app.models.quiz_model import GeneratedQuiz, QuizGenerateRequest
from app.services.llm_service import GeminiServiceError, MissingAPIKeyError, generate_quiz
from app.services.supabase_service import (
    AuthenticationError,
    MissingSupabaseConfigError,
    ProjectNotFoundError,
    SupabaseServiceError,
    get_course_content_texts_for_user,
)


router = APIRouter()
logger = logging.getLogger(__name__)


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sign in required.")

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Sign in required.")

    return token


@router.post("/quiz/generate", response_model=GeneratedQuiz)
def generate_quiz_from_materials(
    payload: QuizGenerateRequest,
    authorization: str | None = Header(default=None),
) -> GeneratedQuiz:
    try:
        materials = get_course_content_texts_for_user(
            access_token=_extract_bearer_token(authorization),
            material_ids=payload.material_ids,
        )
        return generate_quiz(
            materials=materials,
            question_count=payload.question_count,
        )
    except MissingSupabaseConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AuthenticationError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except MissingAPIKeyError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except (GeminiServiceError, SupabaseServiceError) as exc:
        logger.warning("Quiz generation failed: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
