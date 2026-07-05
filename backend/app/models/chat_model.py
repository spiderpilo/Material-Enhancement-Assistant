from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class ProjectChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    selected_material_id: Optional[int] = Field(default=None, ge=1)


class ProjectChatSourceRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int
    material_name: str
    chunk_count: Optional[int] = None
    top_similarity: Optional[float] = None


class ProjectChatResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    answer: str
    selection_mode: Literal["selected", "title_match", "fallback", "rag", "rag_selected", "rag_unavailable"]
    sources: list[ProjectChatSourceRecord] = Field(default_factory=list)
