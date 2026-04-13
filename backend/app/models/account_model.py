from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


ProfessionType = Literal["student", "professor"]


class CreateAccountRequest(BaseModel):
    email: str = Field(min_length=3)
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=8)
    profession: ProfessionType


class UserProfileRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int
    username: str
    profession: ProfessionType
    


class CreateAccountResponse(BaseModel):
    auth_user_id: str
    profile: UserProfileRecord


class LoginAccountRequest(BaseModel):
    email: str = Field(min_length=3)
    password: str = Field(min_length=8)


class LoginAccountResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user_id: str
    email: str
    username: str = ""
    profession: str = ""