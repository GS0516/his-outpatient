"""门诊业务：划价、审查、提交事务、作废、模板、趋势。"""
import pytest


def visit_payload(patient_id="P202611001", **over):
    data = {
        "patientId": patient_id,
        "complaint": "咳嗽咳痰 5 天，发热 1 天",
        "present": "受凉后起病",
        "past": "高血压 10 年",
        "exam": "双肺呼吸音粗",
        "note": "多饮水，3 天后复诊",
        "diagnoses": ["J18.900"],
        "items": [
            {"code": "Y0002", "qty": 2, "usage": "静滴 2g 每日一次", "dosePer": 2, "freq": "qd"},
            {"code": "Y0009", "qty": 1, "usage": "口服 10ml 每日三次"},
        ],
        "treatments": [{"code": "T03", "qty": 1}],
        "materials": [{"code": "M02", "qty": 2}],
        "labs": ["L01", "L05"],
        "exams": [{"item": "胸部正位DR", "part": "胸部"}],
    }
    data.update(over)
    return data


def test_dicts_contain_catalog(client, doctor):
    r = client.get("/api/dicts", headers=doctor)
    assert r.status_code == 200
    d = r.json()
    assert len(d["drugs"]) >= 15
    assert len(d["icd"]) >= 20
    assert len(d["labItems"]) == 10
    assert any(x["form"] == "胶囊剂" for x in d["drugs"])


def test_patients_and_masked_id(client, doctor):
    r = client.get("/api/patients", headers=doctor)
    assert r.status_code == 200
    p = next(x for x in r.json() if x["id"] == "P202611001")
    assert p["idMasked"].startswith("430102********")
    assert "phone" in p and "*" in p["phone"]


def test_price_ignores_client_price(client, doctor):
    payload = visit_payload()
    payload["items"] = [{"code": "Y0001", "qty": 2, "price": 0.01}]
    payload["treatments"] = []
    payload["materials"] = []
    r = client.post("/api/review", json=payload, headers=doctor)
    assert r.status_code == 200
    assert r.json()["total"] == 37.0  # 18.50 × 2


def test_review_detects_allergy_and_interaction(client, doctor):
    payload = visit_payload(patient_id="P202611001", items=[{"code": "Y0001", "qty": 1}])
    issues = client.post("/api/review", json=payload, headers=doctor).json()["issues"]
    assert any(i["title"] == "药物过敏" for i in issues)

    payload = visit_payload(items=[{"code": "Y0002", "qty": 1}, {"code": "Y0027", "qty": 1}])
    issues = client.post("/api/review", json=payload, headers=doctor).json()["issues"]
    assert any("相互作用" in i["title"] and i["level"] == "danger" for i in issues)


def test_visit_requires_complaint_diag_and_items(client, doctor):
    headers = doctor
    assert client.post("/api/visits", json=visit_payload(complaint="  "), headers=headers).status_code == 400
    assert client.post("/api/visits", json=visit_payload(diagnoses=[]), headers=headers).status_code == 400
    body = visit_payload(items=[], treatments=[], materials=[])
    assert client.post("/api/visits", json=body, headers=headers).status_code == 400


def test_admin_cannot_prescribe(client, admin):
    r = client.post("/api/visits", json=visit_payload(), headers=admin)
    assert r.status_code == 403


def test_submit_visit_transaction(client, doctor, admin):
    r = client.post("/api/visits", json=visit_payload(), headers=doctor)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["visit"]["total"] == pytest.approx(116.5)
    assert body["prescription"]["status"] == "待收费"
    assert len(body["prescription"]["items"]) == 2
    assert body["labs"] == 2 and body["exams"] == 1

    # 患者状态更新、处方可查、审计留痕（管理员可见）
    p = client.get("/api/patients/P202611001", headers=doctor).json()
    assert p["status"] == "已完成"
    logs = client.get("/api/admin/audit", headers=admin).json()
    assert any(x["action"] == "提交门诊病历与处方" for x in logs)

    # 作废 → 再次作废 409
    rx_id = body["prescription"]["id"]
    assert client.post(f"/api/prescriptions/{rx_id}/void", json={"reason": "患者要求换药"}, headers=doctor).status_code == 200
    assert client.post(f"/api/prescriptions/{rx_id}/void", json={"reason": "再次"}, headers=doctor).status_code == 409


def test_void_forbidden_for_admin(client, doctor, admin):
    r = client.post("/api/visits", json=visit_payload(patient_id="P202611009"), headers=doctor)
    rx_id = r.json()["prescription"]["id"]
    assert client.post(f"/api/prescriptions/{rx_id}/void", json={"reason": "x"}, headers=admin).status_code == 403


def test_templates_crud(client, doctor, admin):
    payload = {"name": "测试模板", "items": [{"code": "Y0007", "qty": 1, "usage": "必要时"}], "note": ""}
    r = client.post("/api/templates", json=payload, headers=doctor)
    assert r.status_code == 201, r.text
    tid = r.json()["id"]
    assert any(t["id"] == tid for t in client.get("/api/templates", headers=doctor).json())
    assert client.delete(f"/api/templates/{tid}", headers=doctor).status_code == 200
    assert client.delete(f"/api/templates/{tid}", headers=doctor).status_code == 404


def test_history_and_trend(client, doctor):
    h = client.get("/api/patients/P202611001/history", headers=doctor).json()
    assert len(h["visits"]) >= 2
    t = client.get("/api/patients/P202611001/trend", params={"code": "L01"}, headers=doctor).json()
    assert len(t["points"]) >= 2
    assert t["item"]["short"] == "WBC"

