from typing import Literal

from pydantic import BaseModel, ConfigDict


PreviewStatus = Literal["pending", "ready", "failed"]
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
    preview_error: str | None = None
    items: list[CourseContentPreviewItem] = []


class CourseContentRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int
    material_name: str
    access_url: str
    data_size: int
    source_type: SourceType | None = None
    preview_status: PreviewStatus = "pending"
    preview_count: int = 0
