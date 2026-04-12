from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional, Union

from sqlalchemy import JSON, Column, Enum as SAEnum, Integer, MetaData, String, Table, insert

from app.config import get_database_engine


metadata = MetaData()


class Profession(str, Enum):
    STUDENT = "student"
    PROFESSOR = "professor"

users_table = Table(
    "users",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("username", String(80), unique=True, nullable=False, index=True),
    Column(
        "profession",
        SAEnum(Profession, name="profession_enum", native_enum=False),
        nullable=False,
        index=True,
    ),
    Column("associated_materials", JSON, nullable=False, default=list),
)


@dataclass
class User:
    """User record backed by the users table."""

    username: str
    profession: Profession
    associated_materials: list[Any] = field(default_factory=list)
    id: Optional[int] = None

    @classmethod
    def create(
        cls,
        username: str,
        profession: Union[str, Profession],
    ) -> "User":
        engine = get_database_engine()
        if engine is None:
            raise RuntimeError("Database connection details are not configured.")

        normalized_profession = profession.value if isinstance(profession, Profession) else profession
        normalized_profession = normalized_profession.strip().lower()

        try:
            profession_enum = Profession(normalized_profession)
        except ValueError as exc:
            raise ValueError("profession must be 'student' or 'professor'.") from exc

        payload = {
            "username": username,
            "profession": profession_enum,
        }

        metadata.create_all(engine)

        with engine.begin() as connection:
            result = connection.execute(insert(users_table).values(**payload))
            user_id = result.inserted_primary_key[0] if result.inserted_primary_key else None

        return cls(id=user_id, **payload)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "username": self.username,
            "profession": self.profession.value,
        }