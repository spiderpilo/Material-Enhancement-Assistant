from dataclasses import dataclass

from pydantic import BaseModel, ConfigDict, Field


@dataclass(frozen=True)
class QuizSourceMaterial:
    id: int
    name: str
    text: str


class QuizGenerateRequest(BaseModel):
    material_ids: list[int] = Field(min_length=1, max_length=12)
    question_count: int = Field(default=12, ge=12, le=12)


class QuizOption(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    label: str
    text: str
    explanation: str


class QuizQuestion(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    prompt: str
    options: list[QuizOption] = Field(min_length=4, max_length=4)
    correct_option_id: str
    explanation: str


class GeneratedQuiz(BaseModel):
    model_config = ConfigDict(extra="ignore")

    quiz_id: str
    title: str
    source_count: int
    questions: list[QuizQuestion] = Field(min_length=12, max_length=12)
