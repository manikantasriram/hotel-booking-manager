from datetime import date, timedelta

D = date(2030, 1, 10)  # a fixed future date keeps the tests independent of "today"


def book(client, headers, room, check_in=D, nights=2, guests=2, **extra):
    body = {
        "room_type_id": room.id,
        "rate_plan_id": room.rate_plans[0].id,
        "guest_name": "Priya Sharma",
        "guest_email": "priya@example.com",
        "check_in": str(check_in),
        "check_out": str(check_in + timedelta(days=nights)),
        "guests": guests,
        **extra,
    }
    return client.post("/api/bookings", json=body, headers=headers)


def test_booking_prices_the_whole_stay(client, staff, room):
    r = book(client, staff, room, nights=3)
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["nights"] == 3
    assert data["total_price"] == 7500.0  # 3 x 2500
    assert data["status"] == "confirmed"
    assert data["hotel_name"] == "Test Inn"


def test_last_room_cannot_be_double_booked(client, staff, room):
    assert book(client, staff, room).status_code == 201
    r = book(client, staff, room, check_in=D + timedelta(days=1))  # overlaps the first stay
    assert r.status_code == 409
    assert "sold out" in r.json()["detail"]


def test_back_to_back_stays_are_fine(client, staff, room):
    assert book(client, staff, room, nights=2).status_code == 201
    # checks in the morning the first guest checks out
    assert book(client, staff, room, check_in=D + timedelta(days=2)).status_code == 201


def test_availability_counts_the_busiest_night(client, staff, room, db):
    room.total_rooms = 2
    db.commit()
    assert book(client, staff, room, check_in=D, nights=1).status_code == 201  # night of the 10th
    assert book(client, staff, room, check_in=D + timedelta(days=2), nights=1).status_code == 201  # 12th
    # A 4-night stay overlaps both, but only one room is ever taken per night: still available.
    r = client.get(
        f"/api/room-types/{room.id}/availability",
        params={"check_in": str(D), "check_out": str(D + timedelta(days=4))},
        headers=staff,
    )
    assert r.json()["booked"] == 1
    assert book(client, staff, room, nights=4).status_code == 201


def test_cancelling_frees_the_room(client, staff, room):
    first = book(client, staff, room).json()
    assert book(client, staff, room).status_code == 409
    r = client.post(f"/api/bookings/{first['id']}/cancel", headers=staff)
    assert r.json()["status"] == "cancelled"
    assert book(client, staff, room).status_code == 201
    assert client.post(f"/api/bookings/{first['id']}/cancel", headers=staff).status_code == 409


def test_rules_are_enforced(client, staff, room):
    assert book(client, staff, room, guests=3).status_code == 422  # room fits 2
    assert book(client, staff, room, nights=0).status_code == 422  # check-out must be after check-in
    assert book(client, staff, room, rate_plan_id=999).status_code == 422
    assert book(client, staff, room, guest_email="not-an-email").status_code == 422


def test_hotel_with_bookings_cannot_be_deleted(client, staff, admin, room):
    book(client, staff, room)
    assert client.delete(f"/api/hotels/{room.hotel_id}", headers=admin).status_code == 409


def test_filters(client, staff, room):
    book(client, staff, room)
    assert len(client.get("/api/bookings", params={"status": "confirmed"}, headers=staff).json()) == 1
    assert len(client.get("/api/bookings", params={"status": "cancelled"}, headers=staff).json()) == 0
    assert len(client.get("/api/bookings", params={"hotel_id": room.hotel_id}, headers=staff).json()) == 1
