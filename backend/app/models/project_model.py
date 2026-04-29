from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.document_model import CourseContentRecord


class CreateProjectRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class UpdateProjectRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class ProjectMaterialRecord(CourseContentRecord):
    model_config = ConfigDict(extra="ignore")

    uploaded_at: datetime | None = None


class ProjectRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int
    name: str
    created_by: str
    owner_auth_user_id: str | None = None
    created_on: datetime | None = None
    materials: list[ProjectMaterialRecord] = Field(default_factory=list)
    material_count: int = 0
    last_updated: datetime | None = None
