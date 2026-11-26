"""安全加固回归：数量边界、科室级越权、登录锁定、安全响应头、审计参数、上传上限。"""
import io

from app import ratelimit


def review_payload(qty, patient="P202611001"):
    return {"patientId": patient, "complaint": "x", "diagnoses": ["J06.900"],
            "items": [{"code": "Y0001", "qty": qty}]}


def test_qty_bounds_rejected(client, doctor):
    for qty in (0, -1, 1000, 10 ** 20):
        r = client.post("/api/review", json=review_payload(qty), headers=doctor)
        assert r.status_code == 422, f"qty={qty} 应被拒，实际 {r.status_code} {r.text}"
    ok = client.post("/api/review", json=review_payload(999), headers=doctor)
    assert ok.status_code == 200
    assert ok.json()["total"] == round(18.5 * 999, 2)


def test_visit_qty_overflow_blocked(client, doctor):
    payload = {"patientId": "P202611001", "complaint": "x", "diagnoses": ["J06.900"],
               "items": [{"code": "Y0001", "qty": 10 ** 30}]}
    assert client.post("/api/visits", json=payload, headers=doctor).status_code == 422


def test_patient_scope_by_dept(client, doctor, admin):
    # 医生看不到其他科室患者
    assert client.get("/api/patients/P202611003", headers=doctor).status_code == 404
    assert client.get("/api/patients/P202611007/history", headers=doctor).status_code == 404
    rows = client.get("/api/patients", headers=doctor).json()
    assert rows and all(p["dept"] == "内科" for p in rows)

    # 医生不能在别人科室患者上开方
    payload = {"patientId": "P202611003", "complaint": "x", "diagnoses": ["J06.900"],
               "items": [{"code": "Y0001", "qty": 1}]}
    assert client.post("/api/visits", json=payload, headers=doctor).status_code == 404
    assert client.post("/api/review", json=payload, headers=doctor).status_code == 404

    # 管理员只读全量
    assert len(client.get("/api/patients", headers=admin).json()) >= 5


def test_login_lockout_after_failures(client):
    ratelimit.clear_all()
    user = "lockprobe"
    codes = []
    for i in range(6):
        r = client.post("/api/auth/login", json={"username": user, "password": f"bad{i}"})
        codes.append(r.status_code)
    assert codes[:ratelimit.MAX_FAILS - 1] == [401] * (ratelimit.MAX_FAILS - 1)
    assert codes[ratelimit.MAX_FAILS - 1] == 429
    assert codes[-1] == 429
    assert "Retry-After" in r.headers
    ratelimit.clear_all()


def test_lockout_does_not_block_other_accounts(client, doctor):
    # 上一条测试锁定的是 lockprobe 自己，正常账号不受影响
    assert client.get("/api/auth/me", headers=doctor).status_code == 200


def test_security_headers(client):
    h = client.get("/api/health").headers
    assert h["X-Frame-Options"] == "DENY"
    assert h["X-Content-Type-Options"] == "nosniff"
    assert "frame-ancestors 'none'" in h["Content-Security-Policy"]
    assert h["Referrer-Policy"] == "no-referrer"


def test_audit_bad_date_is_400(client, admin):
    assert client.get("/api/admin/audit", params={"date": "notadate"}, headers=admin).status_code == 400


def test_import_size_limit(client, admin):
    big = "通用名,商品名,规格,剂型,单价,医保类别,库存数量\n" + "药,商,1片,片剂,1,甲,1\n" * 120000
    files = {"file": ("big.csv", io.BytesIO(big.encode("utf-8")), "text/csv")}
    assert client.post("/api/admin/drugs/import", files=files, headers=admin).status_code == 413


def test_docs_enabled_in_dev(client):
    assert client.get("/docs").status_code == 200
    assert client.get("/openapi.json").status_code == 200


def test_visit_id_unique_under_burst(client, doctor):
    """同一秒内连续提交不能撞主键（原实现 14 位秒级 + 两位随机，冲突即 500）。"""
    ids = set()
    for _ in range(5):
        r = client.post("/api/visits", json={
            "patientId": "P202611001", "complaint": "压测主诉", "diagnoses": ["J06.900"],
            "items": [{"code": "Y0007", "qty": 1}]}, headers=doctor)
        assert r.status_code == 201, r.text
        ids.add(r.json()["visit"]["id"])
    assert len(ids) == 5
