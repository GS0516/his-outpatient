"""门诊医生工作站 API（第三章）。"""
from datetime import datetime
from random import randint

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..catalog import EXAM_ITEMS, ICD, LAB_ITEMS
from ..db import get_db
from ..models import Drug, Exam, LabOrder, Material, Patient, Prescription, RxItem, Template, Treatment, User, Visit
from ..schemas import ItemIn, TemplateIn, VisitIn, VoidIn
from ..security import audit, get_current_user, require_roles
from ..services import diagnosis_text, money, price_entries, review

router = APIRouter(prefix="/api", tags=["clinic"])


# ---------------------------------------------------------------- 序列化
def patient_dict(p: Patient) -> dict:
    return {
        "id": p.id, "mrn": p.mrn, "card": p.card, "name": p.name, "sex": p.sex, "age": p.age,
        "phone": p.phone, "idMasked": p.id_masked, "idTail": p.id_tail, "ins": p.ins,
        "allergy": p.allergy or "", "status": p.status, "dept": p.dept, "doctor": p.doctor,
        "complaint": p.complaint or "", "present": p.present or "", "past": p.past or "",
        "exam": p.exam or "", "temp": p.temp, "pulse": p.pulse, "bp": p.bp,
    }


def visit_dict(v: Visit) -> dict:
    return {
        "id": v.id, "patientId": v.patient_id, "patient": v.patient_name, "date": v.date,
        "time": v.time, "dept": v.dept, "doctor": v.doctor, "complaint": v.complaint,
        "present": v.present, "past": v.past, "exam": v.exam, "note": v.note,
        "diagnosis": v.diagnosis, "diags": v.diags or [], "total": v.total, "status": v.status,
    }


def rx_dict(r: Prescription) -> dict:
    return {
        "id": r.id, "visitId": r.visit_id, "patientId": r.patient_id, "patient": r.patient_name,
        "doctor": r.doctor, "diagnosis": r.diagnosis, "total": r.total, "status": r.status,
        "voidReason": r.void_reason, "createdAt": r.created_at,
        "items": [{"code": i.code, "name": i.name, "spec": i.spec, "qty": i.qty,
                   "price": i.price, "amount": i.amount, "usage": i.usage} for i in r.items],
    }


def lab_dict(l: LabOrder) -> dict:
    return {"id": l.id, "patientId": l.patient_id, "visitId": l.visit_id, "items": l.items or [],
            "specimen": l.specimen, "status": l.status, "results": l.results or [], "createdAt": l.created_at}


def exam_dict(e: Exam) -> dict:
    return {"id": e.id, "patientId": e.patient_id, "visitId": e.visit_id, "item": e.item,
            "part": e.part, "status": e.status, "createdAt": e.created_at}


def template_dict(t: Template) -> dict:
    return {"id": t.id, "name": t.name, "owner": t.owner, "dept": t.dept,
            "items": t.items or [], "note": t.note}


# ---------------------------------------------------------------- 字典与患者
@router.get("/dicts")
def dicts(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    def drug(d: Drug):
        return {"code": d.code, "name": d.generic + ("（" + d.trade + "）" if d.trade else ""),
                "generic": d.generic, "trade": d.trade, "spec": d.spec, "form": d.form,
                "unit": d.unit, "price": d.price, "ins": d.ins, "stock": d.stock,
                "allergen": d.allergen, "maxDose": d.max_dose, "doseUnit": d.dose_unit,
                "usage": d.usage, "indication": d.indication, "contra": d.contra}

    return {
        "icd": ICD,
        "drugs": [drug(d) for d in db.query(Drug).order_by(Drug.code).all()],
        "treatments": [{"code": t.code, "name": t.name, "unit": t.unit, "price": t.price, "ins": t.ins}
                       for t in db.query(Treatment).order_by(Treatment.code).all()],
        "materials": [{"code": m.code, "name": m.name, "spec": m.spec, "unit": m.unit,
                       "price": m.price, "ins": m.ins}
                      for m in db.query(Material).order_by(Material.code).all()],
        "labItems": LAB_ITEMS,
        "examItems": EXAM_ITEMS,
    }


@router.get("/patients")
def patients(status: str | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(Patient)
    if status:
        q = q.filter(Patient.status == status)
    return [patient_dict(p) for p in q.order_by(Patient.id).all()]


@router.get("/patients/{pid}")
def patient(pid: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = db.get(Patient, pid)
    if not p:
        raise HTTPException(status_code=404, detail="患者不存在")
    return patient_dict(p)


@router.get("/patients/{pid}/history")
def history(pid: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    visits = db.query(Visit).filter(Visit.patient_id == pid).order_by(Visit.date.desc()).all()
    rxs = db.query(Prescription).filter(Prescription.patient_id == pid).all()
    labs = db.query(LabOrder).filter(LabOrder.patient_id == pid).all()
    exams = db.query(Exam).filter(Exam.patient_id == pid).all()
    return {"visits": [visit_dict(v) for v in visits], "prescriptions": [rx_dict(r) for r in rxs],
            "labs": [lab_dict(l) for l in labs], "exams": [exam_dict(e) for e in exams]}


@router.get("/patients/{pid}/trend")
def trend(pid: str, code: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    points = []
    for lab in db.query(LabOrder).filter(LabOrder.patient_id == pid).all():
        for r in lab.results or []:
            if r.get("code") == code:
                points.append({"date": (lab.created_at or "")[:10], "v": r.get("v")})
    points.sort(key=lambda x: x["date"])
    item = next((i for i in LAB_ITEMS if i["code"] == code), None)
    return {"points": points, "item": item}


# ---------------------------------------------------------------- 划价与审查（服务端）
@router.post("/review")
def review_items(payload: VisitIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    patient = db.get(Patient, payload.patient_id)
    entries = list(payload.items) + list(payload.treatments) + list(payload.materials)
    for t in payload.treatments:
        t.kind = "treat"
    for m in payload.materials:
        m.kind = "material"
    lines, total, errors = price_entries(db, entries)
    issues = review(db, patient, payload.items) if patient else []
    return {"lines": lines, "total": total, "errors": errors, "issues": issues}


# ---------------------------------------------------------------- 提交门诊病历
@router.post("/visits", status_code=201)
def create_visit(payload: VisitIn, request: Request,
                 user: User = Depends(require_roles("doctor")), db: Session = Depends(get_db)):
    patient = db.get(Patient, payload.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="患者不存在")
    if not payload.complaint.strip():
        raise HTTPException(status_code=400, detail="主诉不能为空")
    if not payload.diagnoses:
        raise HTTPException(status_code=400, detail="请至少录入一条诊断")

    for t in payload.treatments:
        t.kind = "treat"
    for m in payload.materials:
        m.kind = "material"
    entries = list(payload.items) + list(payload.treatments) + list(payload.materials)
    if not entries:
        raise HTTPException(status_code=400, detail="处方与处置均为空，无法提交")

    lines, total, errors = price_entries(db, entries)
    if errors:
        raise HTTPException(status_code=400, detail="明细有误：" + "；".join(e["reason"] for e in errors))

    stamp = datetime.now()
    suffix = f"{stamp.strftime('%Y%m%d%H%M%S')}{randint(10, 99)}"
    visit_id = "V" + suffix
    diag = diagnosis_text(payload.diagnoses)

    try:
        visit = Visit(
            id=visit_id, patient_id=patient.id, patient_name=patient.name,
            date=stamp.strftime("%Y-%m-%d"), time=stamp.strftime("%Y-%m-%d %H:%M"),
            dept=patient.dept, doctor=user.name, complaint=payload.complaint,
            present=payload.present, past=payload.past, exam=payload.exam, note=payload.note,
            diagnosis=diag, diags=payload.diagnoses, total=total, status="已提交",
        )
        db.add(visit)

        rx = None
        drug_lines = [l for l in lines if l["kind"] == "drug"]
        if drug_lines:
            rx = Prescription(
                id="RX" + suffix, visit_id=visit_id, patient_id=patient.id, patient_name=patient.name,
                doctor=user.name, diagnosis=diag, total=total, status="待收费",
                created_at=stamp.strftime("%Y-%m-%d %H:%M"),
            )
            db.add(rx)
            for l in drug_lines:
                db.add(RxItem(prescription_id=rx.id, code=l["code"], name=l["name"], spec=l["spec"],
                              qty=l["qty"], price=l["price"], amount=l["amount"], usage=l["usage"]))

        for code in payload.labs:
            db.add(LabOrder(id=f"LB{suffix}{code[-1]}", patient_id=patient.id, visit_id=visit_id,
                            items=[code], specimen="全血", status="待采样", results=[],
                            created_at=stamp.strftime("%Y-%m-%d %H:%M")))
        for i, e in enumerate(payload.exams):
            db.add(Exam(id=f"EX{suffix}{i}", patient_id=patient.id, visit_id=visit_id,
                        item=e.item, part=e.part, status="待检查", created_at=stamp.strftime("%Y-%m-%d %H:%M")))

        patient.status = "已完成"
        audit(db, user, "提交门诊病历与处方", "visit", visit_id,
              f"{diag}；明细 {len(lines)} 项，合计 {total}；检验 {len(payload.labs)}、检查 {len(payload.exams)}",
              request)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:  # 事务回滚，避免半条记录
        db.rollback()
        raise HTTPException(status_code=500, detail=f"提交失败：{exc}")

    db.refresh(visit)
    return {"visit": visit_dict(visit), "prescription": rx_dict(rx) if rx else None,
            "labs": len(payload.labs), "exams": len(payload.exams)}


# ---------------------------------------------------------------- 作废
@router.post("/prescriptions/{rx_id}/void")
def void_prescription(rx_id: str, payload: VoidIn, request: Request,
                      user: User = Depends(require_roles("doctor")), db: Session = Depends(get_db)):
    rx = db.get(Prescription, rx_id)
    if not rx:
        raise HTTPException(status_code=404, detail="处方不存在")
    if rx.status != "待收费":
        raise HTTPException(status_code=409, detail=f"该处方状态不允许作废：{rx.status}")
    rx.status = "已作废"
    rx.void_reason = payload.reason or "未填写原因"
    rx.void_by = user.name
    rx.void_at = datetime.now().strftime("%Y-%m-%d %H:%M")
    audit(db, user, "作废处方", "prescription", rx.id, payload.reason, request)
    db.commit()
    return rx_dict(rx)


# ---------------------------------------------------------------- 模板
@router.get("/templates")
def templates(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return [template_dict(t) for t in db.query(Template).order_by(Template.id).all()]


@router.post("/templates", status_code=201)
def create_template(payload: TemplateIn, request: Request,
                    user: User = Depends(require_roles("doctor")), db: Session = Depends(get_db)):
    if not payload.name.strip() or not payload.items:
        raise HTTPException(status_code=400, detail="模板名称与明细不能为空")
    t = Template(id=f"TPL{randint(1000, 9999)}", name=payload.name, owner=user.name, dept=user.dept,
                 items=[i.model_dump(by_alias=True) for i in payload.items], note=payload.note,
                 created_at=datetime.now().strftime("%Y-%m-%d %H:%M"))
    db.add(t)
    audit(db, user, "保存医嘱模板", "template", t.id, payload.name, request)
    db.commit()
    return template_dict(t)


@router.delete("/templates/{tid}")
def delete_template(tid: str, request: Request,
                    user: User = Depends(require_roles("doctor")), db: Session = Depends(get_db)):
    t = db.get(Template, tid)
    if not t:
        raise HTTPException(status_code=404, detail="模板不存在")
    if t.owner != user.name:
        raise HTTPException(status_code=403, detail="只能删除本人创建的模板")
    db.delete(t)
    audit(db, user, "删除医嘱模板", "template", tid, t.name, request)
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- 工作台
@router.get("/dashboard")
def dashboard(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    today = datetime.now().strftime("%Y-%m-%d")
    return {
        "waiting": db.query(Patient).filter(Patient.status == "待诊").count(),
        "done": db.query(Patient).filter(Patient.status == "已完成").count(),
        "visitsToday": db.query(Visit).filter(Visit.date == today).count(),
        "rxPending": db.query(Prescription).filter(Prescription.status == "待收费").count(),
        "labsPending": db.query(LabOrder).filter(LabOrder.status.in_(["待采样", "检验中"])).count(),
        "examsPending": db.query(Exam).filter(Exam.status == "待检查").count(),
    }
