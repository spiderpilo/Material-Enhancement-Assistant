from typing import Literal

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
    


class SessionTokens(BaseModel):
    access_token: str = Field(description="Short-lived JWT. Send as `Authorization: Bearer <token>`.")
    refresh_token: str = Field(description="Single-use JWT for POST /refresh-token. Rotates on every use.")
    token_type: Literal["bearer"] = "bearer"
    expires_in: int = Field(description="Access token lifetime in seconds.")
    refresh_expires_in: int = Field(description="Refresh token lifetime in seconds.")


class CurrentUserResponse(BaseModel):
    user_id: str
    email: str
    username: str = ""
    profession: str = ""


class LoginAccountResponse(SessionTokens, CurrentUserResponse):
    pass


class CreateAccountResponse(LoginAccountResponse):
    auth_user_id: str = Field(description="Same as user_id; kept for older clients.")
    profile: UserProfileRecord


class LoginAccountRequest(BaseModel):
    email: str = Field(min_length=3)
    password: str = Field(min_length=8)


class RefreshSessionRequest(BaseModel):
    refresh_token: str = Field(min_length=1, description="Refresh token from login, account creation, or the previous refresh.")
