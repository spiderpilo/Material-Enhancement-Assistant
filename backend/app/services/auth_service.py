"""Password auth and JWT sessions backed by the ``auth_users`` table.

Replaces Supabase GoTrue. Password hashes migrated from ``auth.users.encrypted_password``
are bcrypt, so existing users keep their passwords. Tokens are HS256 JWTs signed with
``JWT_SECRET``; tokens issued by Supabase are not accepted.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import bcrypt
import jwt
import psycopg2.extras

from app.config import get_auth_settings
from app.services import db
from app.services.errors import (
    AuthenticationError,
    DataServiceError,
    InvalidCredentialsError,
    MissingConfigError,
)


BCRYPT_ROUNDS = 10
JWT_ALGORITHM = "HS256"
JWT_AUDIENCE = "authenticated"
JWT_ISSUER = "material-enhancement-assistant"

TokenType = Literal["access", "refresh"]


@dataclass(frozen=True)
class AuthUser:
    id: str
    email: str
    user_metadata: dict[str, Any]


@dataclass(frozen=True)
class IssuedTokens:
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=BCRYPT_ROUNDS)).decode("utf-8")


def insert_auth_user(
    cursor: psycopg2.extras.RealDictCursor,
    *,
    email: str,
    password: str,
    user_metadata: dict[str, Any],
) -> AuthUser:
    """Insert an auth user using the caller's transaction cursor."""
    normalized_email = normalize_email(email)
    cursor.execute(
        """
        INSERT INTO public.auth_users (email, encrypted_password, user_metadata, email_confirmed_at)
        VALUES (%s, %s, %s, now())
        ON CONFLICT DO NOTHING
        RETURNING id, email, user_metadata
        """,
        (normalized_email, hash_password(password), db.json_param(user_metadata)),
    )
    row = cursor.fetchone()
    if row is None:
        raise DataServiceError("A user with this email address has already been registered")

    return _build_auth_user(db.normalize_rows([row])[0])


def authenticate(*, email: str, password: str) -> AuthUser:
    row = db.fetch_one(
        """
        SELECT id, email, encrypted_password, user_metadata
        FROM public.auth_users
        WHERE email = %s AND deleted_at IS NULL
        """,
        (normalize_email(email),),
    )
    encrypted_password = row.get("encrypted_password") if row else None

    if not isinstance(encrypted_password, str) or not encrypted_password:
        raise InvalidCredentialsError("Incorrect email or password")

    try:
        password_matches = bcrypt.checkpw(password.encode("utf-8"), encrypted_password.encode("utf-8"))
    except ValueError:
        password_matches = False

    if not password_matches:
        raise InvalidCredentialsError("Incorrect email or password")

    db.execute(
        "UPDATE public.auth_users SET last_sign_in_at = now() WHERE id = %s::uuid",
        (row["id"],),
    )
    return _build_auth_user(row)


def issue_tokens(user: AuthUser) -> IssuedTokens:
    settings = _get_settings()
    return IssuedTokens(
        access_token=_encode_token(user, "access", settings.access_token_ttl_seconds, settings.jwt_secret),
        refresh_token=_encode_token(user, "refresh", settings.refresh_token_ttl_seconds, settings.jwt_secret),
    )


def resolve_token(token: str, *, expected_type: TokenType = "access") -> AuthUser:
    """Verify a JWT and return the current auth user row it belongs to."""
    if not token.strip():
        raise AuthenticationError("Sign in required.")

    settings = _get_settings()
    try:
        claims = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[JWT_ALGORITHM],
            audience=JWT_AUDIENCE,
            issuer=JWT_ISSUER,
            options={"require": ["exp", "iat", "sub"]},
        )
    except jwt.PyJWTError as exc:
        raise AuthenticationError("Sign in required.") from exc

    if claims.get("typ") != expected_type:
        raise AuthenticationError("Sign in required.")

    user_id = claims.get("sub")
    try:
        uuid.UUID(str(user_id))
    except ValueError as exc:
        raise AuthenticationError("Sign in required.") from exc

    row = db.fetch_one(
        """
        SELECT id, email, user_metadata
        FROM public.auth_users
        WHERE id = %s::uuid AND deleted_at IS NULL
        """,
        (user_id,),
    )
    if row is None:
        raise AuthenticationError("Sign in required.")

    return _build_auth_user(row)


def _encode_token(user: AuthUser, token_type: TokenType, ttl_seconds: int, secret: str) -> str:
    issued_at = datetime.now(timezone.utc)
    claims = {
        "sub": user.id,
        "email": user.email,
        "aud": JWT_AUDIENCE,
        "iss": JWT_ISSUER,
        "role": "authenticated",
        "typ": token_type,
        "iat": issued_at,
        "exp": issued_at + timedelta(seconds=ttl_seconds),
        "jti": str(uuid.uuid4()),
    }
    if token_type == "access":
        claims["user_metadata"] = user.user_metadata

    return jwt.encode(claims, secret, algorithm=JWT_ALGORITHM)


def _build_auth_user(row: dict[str, Any]) -> AuthUser:
    user_metadata = row.get("user_metadata")
    return AuthUser(
        id=str(row["id"]),
        email=str(row.get("email") or ""),
        user_metadata=user_metadata if isinstance(user_metadata, dict) else {},
    )


def _get_settings():
    try:
        return get_auth_settings()
    except ValueError as exc:
        raise MissingConfigError(str(exc)) from exc
