"""审计、药品导入与智能分诊。"""
import io


def test_audit_admin_only(client, doctor, admin):
    assert client.get("/api/admin/audit", headers=doctor).status_code == 403
    r = client.get("/api/admin/audit", headers=admin)
    assert r.status_code == 200
    rows = r.json()
    assert rows and all("ip" in x and "time" in x for x in rows)


def test_import_csv_partial_success(client, admin):
    csv = (
        "通用名,商品名,规格,剂型,单价,医保类别,库存数量\n"
        "导入药A,商A,10mg×12片,片剂,12.50,甲,100\n"
        "导入药B,,20mg×6片,片剂,8.00,乙,50\n"
        "导入药C,商C,5ml,注射剂,十元,甲,10\n"
        "导入药A,商A,10mg×12片,片剂,12.50,甲,100\n"
    )
    files = {"file": ("drugs.csv", io.BytesIO(csv.encode("utf-8")), "text/csv")}
    r = client.post("/api/admin/drugs/import", files=files, headers=admin)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["success"] == 2
    assert len(body["failed"]) == 1 and "单价非法" in body["failed"][0]["reason"]
    assert len(body["duplicates"]) == 1

    # 合法行真的入库
    drugs = client.get("/api/dicts", headers=admin).json()["drugs"]
    assert any(d["generic"] == "导入药A" for d in drugs)


def test_import_requires_admin(client, doctor):
    files = {"file": ("d.csv", io.BytesIO(b"a,b,c,d,1,\xe7\x94\xb2,1\n"), "text/csv")}
    assert client.post("/api/admin/drugs/import", files=files, headers=doctor).status_code == 403


def test_triage_local_and_fallback(client, doctor):
    r = client.post("/api/triage", json={"symptoms": "胸闷心悸，出冷汗"}, headers=doctor)
    assert r.status_code == 200
    body = r.json()
    assert body["dept"] == "心血管内科" and body["urgency"] == "急诊"
    assert "仅供参考" in body["disclaimer"]
    assert body["source"] == "local-rule"

    empty = client.post("/api/triage", json={"symptoms": "   "}, headers=doctor).json()
    assert empty["dept"] == "全科门诊" and empty["source"] == "fallback"


def test_triage_requires_auth(client):
    assert client.post("/api/triage", json={"symptoms": "头痛"}).status_code == 401
