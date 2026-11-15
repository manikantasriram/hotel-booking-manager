def test_login_and_me(client, staff):
    r = client.get("/api/auth/me", headers=staff)
    assert r.status_code == 200
    assert r.json()["role"] == "staff"
    assert "hashed_password" not in r.json()


def test_wrong_password_is_rejected(client, staff):
    r = client.post("/api/auth/login", data={"username": "staff@test.dev", "password": "nope"})
    assert r.status_code == 401


def test_endpoints_need_a_token(client):
    assert client.get("/api/hotels").status_code == 401
    assert client.get("/api/hotels", headers={"Authorization": "Bearer forged.token.here"}).status_code == 401


def test_only_admins_manage_hotels(client, staff, admin):
    body = {"name": "New Hotel", "city": "Goa", "address": "Beach Rd", "stars": 4}
    assert client.post("/api/hotels", json=body, headers=staff).status_code == 403
    r = client.post("/api/hotels", json=body, headers=admin)
    assert r.status_code == 201
    assert r.json()["name"] == "New Hotel"


def test_hotel_validation(client, admin):
    r = client.post("/api/hotels", json={"name": "", "city": "Goa", "address": "x", "stars": 9}, headers=admin)
    assert r.status_code == 422


def test_blank_names_are_rejected(client, admin):
    body = {"name": "   ", "city": "Goa", "address": "Beach Rd", "stars": 4}
    assert client.post("/api/hotels", json=body, headers=admin).status_code == 422
