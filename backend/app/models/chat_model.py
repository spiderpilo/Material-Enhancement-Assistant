from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ProjectChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    selected_material_id: int | None = Field(default=None, ge=1)


class ProjectChatSourceRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int
    material_name: str


class ProjectChatResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    answer: str
    selection_mode: Literal["selected", "title_match", "fallback"]
    sources: list[ProjectChatSourceRecord] = Field(default_factory=list)