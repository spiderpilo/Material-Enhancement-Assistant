from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.document_model import CourseContentRecord


class CreateProjectRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)


class UpdateProjectRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class ProjectMaterialRecord(CourseContentRecord):
    model_config = ConfigDict(extra="ignore")

    uploaded_at: Optional[datetime] = None


class ProjectSummary(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: Optional[int] = None
    project_uuid: str
    name: str
    owner_user_id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    material_count: int = 0
    last_updated: Optional[datetime] = None


class ProjectRecord(ProjectSummary):
    materials: list[ProjectMaterialRecord] = Field(default_factory=list)


class ListProjectsResponse(BaseModel):
    projects: list[ProjectSummary] = Field(default_factory=list)
