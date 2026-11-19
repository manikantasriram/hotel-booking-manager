from datetime import date, timedelta

import pytest
from pydantic import ValidationError

from app.config import DEV_JWT_SECRET, Settings

D = date(2030, 1, 10)


def book(client, headers, room, check_in=D, nights=2):
    body = {
        "room_type_id": room.id,
        "rate_plan_id": room.rate_plans[0].id,
        "guest_name": "Priya Sharma",
        "guest_email": "priya@example.com",
        "check_in": str(check_in),
        "check_out": str(check_in + timedelta(days=nights)),
        "guests": 2,
    }
    return client.post("/api/bookings", json=body, headers=headers)


def test_repeated_failed_logins_are_slowed_down(client, staff):
    for _ in range(10):
        r = client.post("/api/auth/login", data={"username": "staff@test.dev", "password": "wrong"})
        assert r.status_code == 401
    # even the right password waits now, so guessing can't continue
    r = client.post("/api/auth/login", data={"username": "staff@test.dev", "password": "pass-1234"})
    assert r.status_code == 429
    assert int(r.headers["Retry-After"]) > 0


def test_unknown_email_gets_the_same_answer(client):
    r = client.post("/api/auth/login", data={"username": "nobody@test.dev", "password": "pass-1234"})
    assert r.status_code == 401
    assert r.json()["detail"] == "Incorrect email or password"


def test_huge_passwords_are_refused(client, staff):
    r = client.post("/api/auth/login", data={"username": "staff@test.dev", "password": "x" * 10_000})
    assert r.status_code == 401


def test_default_secret_is_refused_in_production(monkeypatch):
    monkeypatch.setenv("RENDER", "true")
    monkeypatch.setenv("JWT_SECRET", DEV_JWT_SECRET)
    with pytest.raises(ValidationError):
        Settings()
    monkeypatch.setenv("JWT_SECRET", "a-long-random-production-secret-for-the-test-123")
    assert Settings().jwt_secret.startswith("a-long")


def test_short_secret_is_refused(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "short")
    with pytest.raises(ValidationError):
        Settings()


def test_check_in_cannot_be_in_the_past(client, staff, room):
    r = book(client, staff, room, check_in=date.today() - timedelta(days=5))
    assert r.status_code == 422
    assert "past" in r.text


def test_room_count_cannot_drop_below_bookings(client, staff, admin, room, db):
    room.total_rooms = 3
    db.commit()
    assert book(client, staff, room).status_code == 201
    assert book(client, staff, room).status_code == 201  # 2 of 3 rooms taken on the same nights
    body = {"name": room.name, "capacity": room.capacity}
    r = client.put(f"/api/room-types/{room.id}", json={**body, "total_rooms": 1}, headers=admin)
    assert r.status_code == 409
    r = client.put(f"/api/room-types/{room.id}", json={**body, "total_rooms": 2}, headers=admin)
    assert r.status_code == 200


def test_cancelling_a_missing_booking_is_404(client, staff):
    assert client.post("/api/bookings/999/cancel", headers=staff).status_code == 404


def test_security_headers(client):
    r = client.get("/api/health")
    assert r.headers["X-Content-Type-Options"] == "nosniff"
    assert r.headers["X-Frame-Options"] == "DENY"
