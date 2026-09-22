from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class SlideDeckOutlineSlide(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str
    bullets: list[str] = Field(default_factory=list)
    speaker_notes: str = ""


class SlideDeckOutline(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str
    subtitle: Optional[str] = None
    slides: list[SlideDeckOutlineSlide] = Field(default_factory=list)
