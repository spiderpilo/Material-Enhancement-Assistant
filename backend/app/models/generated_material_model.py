from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class GeneratedMaterialRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int | None = None
    uuid: str
    created_at: datetime
    input_token: int | None = None
    output_token: int | None = None
    project_uuid: str
    name: str | None = None
    file_location: str
    tool_type: str
    source_material_ids: list[int] = Field(default_factory=list)
    payload: dict[str, Any] = Field(default_factory=dict)

    @field_validator("source_material_ids", mode="before")
    @classmethod
    def _normalize_source_material_ids(cls, value: Any) -> list[int]:
        if value is None:
            return []
        if not isinstance(value, list):
            return []

        normalized: list[int] = []
        for item in value:
            if isinstance(item, int):
                normalized.append(item)
                continue
            if isinstance(item, str) and item.strip().isdigit():
                normalized.append(int(item.strip()))

        return normalized


class ListGeneratedMaterialsResponse(BaseModel):
    generated_materials: list[GeneratedMaterialRecord] = Field(default_factory=list)


class SlideDeckGenerateRequest(BaseModel):
    material_ids: list[int] = Field(min_length=1, max_length=12)
    slide_count: int = Field(default=10, ge=5, le=30)


class GeneratedMaterialDownloadResponse(BaseModel):
    download_url: str
    file_name: str
