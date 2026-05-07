from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.document_model import CourseContentRecord


class CreateProjectRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)


class UpdateProjectRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class ProjectMaterialRecord(CourseContentRecord):
    model_config = ConfigDict(extra="ignore")

    uploaded_at: datetime | None = None


class ProjectSummary(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int | None = None
    project_uuid: str
    name: str
    owner_user_id: str
    created_at: datetime | None = None
    updated_at: datetime | None = None
    material_count: int = 0
    last_updated: datetime | None = None


class ProjectRecord(ProjectSummary):
    materials: list[ProjectMaterialRecord] = Field(default_factory=list)


class ListProjectsResponse(BaseModel):
    projects: list[ProjectSummary] = Field(default_factory=list)
