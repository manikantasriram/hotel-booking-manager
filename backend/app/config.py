"""App settings, read from environment variables (or a local .env file).

Nothing secret lives in the code: the database URL and the JWT secret come from the
environment, so the same code runs on your laptop, in Docker and on Render.
"""

import os
from functools import lru_cache

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_JWT_SECRET = "dev-only-secret-change-me-in-production-0000"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # e.g. postgresql+psycopg://user:password@localhost:5432/hotels
    database_url: str = "postgresql+psycopg://hotels:hotels@localhost:5432/hotels"
    # Signs the login tokens. Must be a long random string in production.
    jwt_secret: str = Field(DEV_JWT_SECRET, min_length=32)
    jwt_expires_minutes: int = Field(8 * 60, ge=5, le=7 * 24 * 60)
    # Comma-separated list of front-end addresses allowed to call the API.
    cors_origins: str = "http://localhost:5173,http://localhost:8080"
    # Failed sign-ins allowed per client address per minute before the API answers 429.
    login_attempts_per_minute: int = Field(10, ge=1)

    @model_validator(mode="after")
    def refuse_dev_secret_in_production(self) -> "Settings":
        # Render sets RENDER=true on every service. Anyone who knows the public default secret
        # could sign their own admin token, so refuse to start with it there.
        if os.environ.get("RENDER") and self.jwt_secret == DEV_JWT_SECRET:
            raise ValueError("JWT_SECRET must be set to a long random value in production")
        return self

    @field_validator("database_url")
    @classmethod
    def use_psycopg_driver(cls, url: str) -> str:
        # Neon and Render hand out "postgresql://..." or "postgres://...". SQLAlchemy needs to be
        # told which driver to use, so rewrite those to the psycopg (v3) driver.
        for prefix in ("postgres://", "postgresql://"):
            if url.startswith(prefix):
                return "postgresql+psycopg://" + url[len(prefix) :]
        return url

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
