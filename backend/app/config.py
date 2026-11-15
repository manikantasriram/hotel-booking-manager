"""App settings, read from environment variables (or a local .env file).

Nothing secret lives in the code: the database URL and the JWT secret come from the
environment, so the same code runs on your laptop, in Docker and on Render.
"""

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # e.g. postgresql+psycopg://user:password@localhost:5432/hotels
    database_url: str = "postgresql+psycopg://hotels:hotels@localhost:5432/hotels"
    # Signs the login tokens. Must be a long random string in production.
    jwt_secret: str = "dev-only-secret-change-me-in-production-0000"
    jwt_expires_minutes: int = 8 * 60
    # Comma-separated list of front-end addresses allowed to call the API.
    cors_origins: str = "http://localhost:5173,http://localhost:8080"

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
