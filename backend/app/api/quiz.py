import logging

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import FORBIDDEN_ERROR, PROJECT_ERRORS, UPSTREAM_ERRORS, require_access_token, unauthorized

from app.models.quiz_model import GeneratedQuiz, QuizGenerateRequest
from app.services.llm_service import GeminiServiceError, MissingAPIKeyError
from app.services.data_service import (
    AuthenticationError,
    MissingConfigError,
    ProjectAccessDeniedError,
    ProjectNotFoundError,
    DataServiceError,
    generate_quiz_for_user,
)


router = APIRouter()
logger = logging.getLogger(__name__)


@router.post(
    "/quiz/generate",
    response_model=GeneratedQuiz,
    tags=["Quiz"],
    summary="Generate a quiz",
    description='Generates a multiple-choice quiz from selected project materials and saves it to the project.',
    responses={**PROJECT_ERRORS, **FORBIDDEN_ERROR, **UPSTREAM_ERRORS},
)
def generate_quiz_from_materials(
    payload: QuizGenerateRequest,
    access_token: str = Depends(require_access_token),
) -> GeneratedQuiz:
    try:
        return generate_quiz_for_user(
            access_token=access_token,
            project_uuid=payload.project_uuid,
            material_ids=payload.material_ids,
            question_count=payload.question_count,
        )
    except MissingConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AuthenticationError as exc:
        raise unauthorized(str(exc)) from exc
    except ProjectAccessDeniedError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except MissingAPIKeyError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except (GeminiServiceError, DataServiceError) as exc:
        logger.warning("Quiz generation failed: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
