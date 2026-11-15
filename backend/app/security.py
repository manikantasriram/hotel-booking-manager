"""Passwords and login tokens.

Passwords are never stored, only an Argon2 hash of them (a one-way scramble). At login we hash
what the user typed and compare. A successful login returns a JWT: a small signed note that
says "user 3, role staff, valid until 18:00". The browser sends it back on every request and
the server checks the signature, so no session needs to be stored on the server.
"""

from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash

from app.config import get_settings

ALGORITHM = "HS256"
_hasher = PasswordHash.recommended()  # Argon2id


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return _hasher.verify(password, hashed)


def create_access_token(user_id: int, role: str) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    claims = {
        "sub": str(user_id),
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expires_minutes),
    }
    return jwt.encode(claims, settings.jwt_secret, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Raises jwt.PyJWTError if the token is forged, malformed or expired."""
    return jwt.decode(token, get_settings().jwt_secret, algorithms=[ALGORITHM])
