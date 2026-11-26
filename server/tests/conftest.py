"""pytest 夹具：使用独立临时 SQLite，启动时建表并注入种子数据。"""
import os
import pathlib
import tempfile

import pytest

TEST_DB = pathlib.Path(tempfile.gettempdir()) / f"his_test_{os.getpid()}.db"
if TEST_DB.exists():
    TEST_DB.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB}"
os.environ["JWT_SECRET"] = "test-secret-32-bytes-long-for-hs256!!"
# 固定为开发环境：否则生产开关会让种子口令随机化、文档路由关闭
os.environ["APP_ENV"] = "dev"
os.environ.pop("ENV", None)
os.environ.pop("EXPOSE_DOCS", None)
os.environ["SEED_DOCTOR_PASSWORD"] = "Doctor@123"
os.environ["SEED_ADMIN_PASSWORD"] = "Admin@123"

from fastapi.testclient import TestClient  # noqa: E402

from app import ratelimit  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _clean_ratelimit():
    ratelimit.clear_all()
    yield
    ratelimit.clear_all()


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


def token(client, username, password):
    r = client.post("/api/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def doctor(client):
    return {"Authorization": f"Bearer {token(client, 'doctor', 'Doctor@123')}"}


@pytest.fixture(scope="session")
def admin(client):
    return {"Authorization": f"Bearer {token(client, 'admin', 'Admin@123')}"}

