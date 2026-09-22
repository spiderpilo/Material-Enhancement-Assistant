from __future__ import annotations


class MissingConfigError(Exception):
    """Raised when the backend is missing required database, storage, or auth settings."""


class DataServiceError(Exception):
    """Raised when database, storage, or auth operations fail."""


class InvalidCredentialsError(DataServiceError):
    """Raised when login credentials are invalid."""


class AuthenticationError(DataServiceError):
    """Raised when a request is missing valid user authentication."""
