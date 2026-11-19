"""Test setup: every test gets a fresh in-memory SQLite database, so tests are fast, never touch
your real data and can run in any order."""

from collections.abc import Iterator
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app
from app.models import Hotel, RatePlan, Role, RoomType, User
from app.routers.auth import login_limiter
from app.security import hash_password


@pytest.fixture(autouse=True)
def _fresh_login_limit() -> Iterator[None]:
    """Failed sign-ins in one test must not count against the next."""
    login_limiter.reset()
    yield
    login_limiter.reset()


@pytest.fixture
def db() -> Iterator[Session]:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)

    @event.listens_for(engine, "connect")
    def _fk_on(conn, _):  # SQLite ignores foreign keys unless asked
        conn.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, expire_on_commit=False)()
    yield session
    session.close()


@pytest.fixture
def client(db: Session) -> Iterator[TestClient]:
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _user(db: Session, email: str, role: Role) -> User:
    user = User(email=email, full_name=email.split("@")[0], role=role, hashed_password=hash_password("pass-1234"))
    db.add(user)
    db.commit()
    return user


def _token(client: TestClient, email: str) -> dict[str, str]:
    r = client.post("/api/auth/login", data={"username": email, "password": "pass-1234"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
def admin(db: Session, client: TestClient) -> dict[str, str]:
    _user(db, "admin@test.dev", Role.ADMIN)
    return _token(client, "admin@test.dev")


@pytest.fixture
def staff(db: Session, client: TestClient) -> dict[str, str]:
    _user(db, "staff@test.dev", Role.STAFF)
    return _token(client, "staff@test.dev")


@pytest.fixture
def room(db: Session) -> RoomType:
    """A hotel with ONE double room, so sold-out cases are easy to set up."""
    hotel = Hotel(name="Test Inn", city="Pune", address="1 Main Rd", stars=3)
    rt = RoomType(name="Double", capacity=2, total_rooms=1)
    rt.rate_plans = [RatePlan(name="Room only", price_per_night=Decimal("2500.00"))]
    hotel.room_types = [rt]
    db.add(hotel)
    db.commit()
    return rt
