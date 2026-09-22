from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


PreviewStatus = Literal["pending", "ready", "failed"]
RagStatus = Literal["pending", "ready", "failed"]
SourceType = Literal["pdf", "docx", "pptx"]
PreviewKind = Literal["page", "slide"]


class CourseContentPreviewItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    index: int
    kind: PreviewKind
    label: str
    title: str
    subtitle: str
    image_url: str
    width: int
    height: int


class CourseContentPreviewManifest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    course_content_id: int
    material_name: str
    source_type: SourceType
    preview_status: PreviewStatus
    preview_count: int
    access_url: str
    preview_error: Optional[str] = None
    items: list[CourseContentPreviewItem] = []


class CourseContentRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int
    material_name: str
    access_url: str
    data_size: int
    project_id: Optional[int] = None
    content_sha256: Optional[str] = None
    source_type: Optional[SourceType] = None
    preview_status: PreviewStatus = "pending"
    preview_count: int = 0
    rag_status: Optional[RagStatus] = None
    rag_chunk_count: int = 0
    rag_error: Optional[str] = None


class UpdateCourseContentRequest(BaseModel):
    material_name: str = Field(min_length=1, max_length=180)
