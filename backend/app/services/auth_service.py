"""Password auth and JWT sessions backed by the ``auth_users`` and ``auth_sessions`` tables.

Replaces Supabase GoTrue. Password hashes migrated from ``auth.users.encrypted_password``
are bcrypt, so existing users keep their passwords. Tokens are HS256 JWTs signed with
``JWT_SECRET``; tokens issued by Supabase are not accepted.

Every sign-in creates one ``auth_sessions`` row (one per browser/client). Both tokens carry
its id as ``sid``:

* access tokens are short-lived and only valid while the session is not revoked, so
  logout takes effect immediately;
* refresh tokens rotate on every use. Only the session's ``current_refresh_jti`` is
  accepted; replaying an older refresh token revokes the whole session.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Any, Literal

import bcrypt
import jwt
import psycopg2.extras

from app.config import get_auth_settings
from app.services import db
from app.services.errors import (
    AccountConflictError,
    AuthenticationError,
    DataServiceError,
    InvalidCredentialsError,
    MissingConfigError,
)


BCRYPT_ROUNDS = 10
JWT_ALGORITHM = "HS256"
JWT_AUDIENCE = "authenticated"
JWT_ISSUER = "material-enhancement-assistant"
MAX_USER_AGENT_LENGTH = 512

TokenType = Literal["access", "refresh"]


@dataclass(frozen=True)
class AuthUser:
    id: str
    email: str
    user_metadata: dict[str, Any]
    session_id: str | None = None


@dataclass(frozen=True)
class IssuedTokens:
    access_token: str
    refresh_token: str
    expires_in: int
    refresh_expires_in: int
    session_id: str
    token_type: str = "bearer"


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=BCRYPT_ROUNDS)).decode("utf-8")


@lru_cache(maxsize=1)
def _dummy_password_hash() -> bytes:
    return hash_password(uuid.uuid4().hex).encode("utf-8")


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
        raise AccountConflictError("A user with this email address has already been registered")

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
        # Spend the same bcrypt time as a real check so response timing does not
        # reveal which emails are registered.
        bcrypt.checkpw(password.encode("utf-8"), _dummy_password_hash())
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


def issue_tokens(
    user: AuthUser,
    *,
    user_agent: str | None = None,
    cursor: psycopg2.extras.RealDictCursor | None = None,
) -> IssuedTokens:
    """Start a new session for ``user`` and return its first token pair.

    Pass ``cursor`` to create the session inside the caller's transaction.
    """
    settings = _get_settings()
    session_id = str(uuid.uuid4())
    refresh_jti = str(uuid.uuid4())
    params = (
        session_id,
        user.id,
        refresh_jti,
        settings.refresh_token_ttl_seconds,
        (user_agent or "")[:MAX_USER_AGENT_LENGTH] or None,
    )
    sql = """
        INSERT INTO public.auth_sessions (id, user_id, current_refresh_jti, expires_at, user_agent)
        VALUES (%s::uuid, %s::uuid, %s::uuid, now() + make_interval(secs => %s), %s)
        """
    if cursor is not None:
        cursor.execute(sql, params)
    else:
        db.execute(sql, params)

    return _encode_token_pair(user, session_id=session_id, refresh_jti=refresh_jti, settings=settings)


def rotate_refresh_token(refresh_token: str) -> tuple[AuthUser, IssuedTokens]:
    """Exchange a refresh token for a new pair, invalidating the presented one."""
    settings = _get_settings()
    claims = _decode_claims(refresh_token, expected_type="refresh", settings=settings)
    session_id, user_id, presented_jti = claims["sid"], claims["sub"], claims["jti"]
    next_jti = str(uuid.uuid4())

    row = db.fetch_one(
        """
        WITH rotated AS (
            UPDATE public.auth_sessions
            SET current_refresh_jti = %(next_jti)s::uuid,
                last_refreshed_at = now(),
                expires_at = now() + make_interval(secs => %(ttl)s)
            WHERE id = %(sid)s::uuid
              AND user_id = %(sub)s::uuid
              AND current_refresh_jti = %(jti)s::uuid
              AND revoked_at IS NULL
              AND expires_at > now()
            RETURNING user_id
        )
        SELECT u.id, u.email, u.user_metadata
        FROM rotated
        JOIN public.auth_users AS u ON u.id = rotated.user_id
        WHERE u.deleted_at IS NULL
        """,
        {
            "next_jti": next_jti,
            "ttl": settings.refresh_token_ttl_seconds,
            "sid": session_id,
            "sub": user_id,
            "jti": presented_jti,
        },
    )
    if row is None:
        # A validly signed token for a live session whose jti is no longer current was
        # already used once: treat it as stolen and end the session for everyone holding it.
        db.execute(
            """
            UPDATE public.auth_sessions
            SET revoked_at = now(), revoked_reason = 'refresh_token_reuse'
            WHERE id = %s::uuid AND user_id = %s::uuid
              AND revoked_at IS NULL AND current_refresh_jti <> %s::uuid
            """,
            (session_id, user_id, presented_jti),
        )
        raise AuthenticationError("Sign in required.")

    user = _build_auth_user(row, session_id=session_id)
    return user, _encode_token_pair(user, session_id=session_id, refresh_jti=next_jti, settings=settings)


def revoke_session(session_id: str, *, reason: str = "logout") -> None:
    db.execute(
        """
        UPDATE public.auth_sessions
        SET revoked_at = now(), revoked_reason = %s
        WHERE id = %s::uuid AND revoked_at IS NULL
        """,
        (reason, session_id),
    )


def resolve_token(token: str) -> AuthUser:
    """Verify an access token and return the user of its still-active session."""
    settings = _get_settings()
    claims = _decode_claims(token, expected_type="access", settings=settings)

    row = db.fetch_one(
        """
        SELECT u.id, u.email, u.user_metadata
        FROM public.auth_sessions AS s
        JOIN public.auth_users AS u ON u.id = s.user_id
        WHERE s.id = %s::uuid
          AND s.user_id = %s::uuid
          AND s.revoked_at IS NULL
          AND s.expires_at > now()
          AND u.deleted_at IS NULL
        """,
        (claims["sid"], claims["sub"]),
    )
    if row is None:
        raise AuthenticationError("Sign in required.")

    return _build_auth_user(row, session_id=claims["sid"])


def _decode_claims(token: str, *, expected_type: TokenType, settings) -> dict[str, Any]:
    if not token or not token.strip():
        raise AuthenticationError("Sign in required.")

    try:
        claims = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[JWT_ALGORITHM],
            audience=JWT_AUDIENCE,
            issuer=JWT_ISSUER,
            options={"require": ["exp", "iat", "sub", "jti"]},
        )
    except jwt.PyJWTError as exc:
        raise AuthenticationError("Sign in required.") from exc

    if claims.get("typ") != expected_type:
        raise AuthenticationError("Sign in required.")

    # Tokens minted before sessions existed carry no sid; they are rejected so every
    # live token can be revoked.
    for claim in ("sub", "sid", "jti"):
        if not _is_uuid(claims.get(claim)):
            raise AuthenticationError("Sign in required.")

    return claims


def _encode_token_pair(user: AuthUser, *, session_id: str, refresh_jti: str, settings) -> IssuedTokens:
    return IssuedTokens(
        access_token=_encode_token(
            user,
            "access",
            settings.access_token_ttl_seconds,
            settings.jwt_secret,
            session_id=session_id,
            jti=str(uuid.uuid4()),
        ),
        refresh_token=_encode_token(
            user,
            "refresh",
            settings.refresh_token_ttl_seconds,
            settings.jwt_secret,
            session_id=session_id,
            jti=refresh_jti,
        ),
        expires_in=settings.access_token_ttl_seconds,
        refresh_expires_in=settings.refresh_token_ttl_seconds,
        session_id=session_id,
    )


def _is_uuid(value: Any) -> bool:
    try:
        uuid.UUID(str(value))
    except ValueError:
        return False
    return True


def _encode_token(
    user: AuthUser,
    token_type: TokenType,
    ttl_seconds: int,
    secret: str,
    *,
    session_id: str,
    jti: str,
) -> str:
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
        "jti": jti,
        "sid": session_id,
    }
    if token_type == "access":
        claims["user_metadata"] = user.user_metadata

    return jwt.encode(claims, secret, algorithm=JWT_ALGORITHM)


def _build_auth_user(row: dict[str, Any], *, session_id: str | None = None) -> AuthUser:
    user_metadata = row.get("user_metadata")
    return AuthUser(
        id=str(row["id"]),
        email=str(row.get("email") or ""),
        user_metadata=user_metadata if isinstance(user_metadata, dict) else {},
        session_id=session_id,
    )


def _get_settings():
    try:
        return get_auth_settings()
    except ValueError as exc:
        raise MissingConfigError(str(exc)) from exc
