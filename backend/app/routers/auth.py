from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select

from app.config import get_settings
from app.deps import DB, StaffUser
from app.models import User
from app.ratelimit import FailedLoginLimiter
from app.schemas import Token, UserOut
from app.security import create_access_token, verify_password_or_dummy

router = APIRouter(prefix="/api/auth", tags=["auth"])

login_limiter = FailedLoginLimiter(get_settings().login_attempts_per_minute)


@router.post(
    "/login",
    response_model=Token,
    responses={401: {"description": "Wrong email or password"}, 429: {"description": "Too many failed attempts"}},
)
def login(request: Request, db: DB, form: Annotated[OAuth2PasswordRequestForm, Depends()]) -> Token:
    """Exchange email + password for a token. (The form field is called `username` by the
    OAuth2 standard; we put the email in it.)"""
    client = request.client.host if request.client else "unknown"
    wait = login_limiter.acquire(client)  # counts as a failure unless released below
    if wait:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Too many failed sign-in attempts. Try again in {wait} seconds.",
            headers={"Retry-After": str(wait)},
        )

    user = db.scalar(select(User).where(User.email == form.username.strip().lower()))
    hashed = user.hashed_password if user is not None and user.is_active else None
    # Same message (and about the same time) whether the email or the password is wrong,
    # so attackers can't tell which.
    if not verify_password_or_dummy(form.password, hashed) or user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    login_limiter.release(client)
    return Token(access_token=create_access_token(user.id, user.role.value))


@router.get("/me", response_model=UserOut)
def me(user: StaffUser) -> User:
    return user
