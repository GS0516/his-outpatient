"""认证与令牌。"""


def test_login_ok(client):
    r = client.post("/api/auth/login", json={"username": "doctor", "password": "Doctor@123"})
    assert r.status_code == 200
    body = r.json()
    assert body["token"].count(".") == 2
    assert body["user"]["role"] == "doctor"

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {body['token']}"})
    assert me.status_code == 200
    assert me.json()["username"] == "doctor"


def test_login_wrong_password(client):
    r = client.post("/api/auth/login", json={"username": "doctor", "password": "wrong"})
    assert r.status_code == 401


def test_me_requires_token(client):
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer forged.token"}).status_code == 401


def test_token_tamper_rejected(client):
    r = client.post("/api/auth/login", json={"username": "admin", "password": "Admin@123"})
    token = r.json()["token"]
    head, payload, sig = token.split(".")
    forged = f"{head}.{payload}.{sig[:-4]}0000"
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {forged}"}).status_code == 401
