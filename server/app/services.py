"""业务规则：服务端划价、合理用药审查、诊断文本。金额只认数据库字典价。"""
from sqlalchemy.orm import Session

from .catalog import ICD, INTERACTIONS
from .models import Drug, Material, Treatment


def money(n) -> float:
    return round(float(n or 0) + 1e-9, 2)


def lookup(db: Session, kind: str, code: str):
    if kind == "drug":
        return db.get(Drug, code)
    if kind == "treat":
        return db.get(Treatment, code)
    if kind == "material":
        return db.get(Material, code)
    return None


MAX_QTY = 999          # 单行数量上限：避免 qty 取值把合计推到浮点溢出
MAX_LINES = 150        # 单张处方明细行上限


def price_entries(db: Session, entries) -> tuple[list[dict], float, list[dict]]:
    """entries: [{kind, code, qty, usage}]；返回 (明细行, 合计, 错误)。忽略任何前端传入的价格。

    数量在这里再做一次硬校验（schema 已有 Field 约束，但 price_entries 也会被
    内部调用）：非整数、越界、超大值一律进 errors，不参与合计。
    """
    lines, errors, total = [], [], 0.0
    entries = list(entries or [])
    if len(entries) > MAX_LINES:
        errors.append({"index": -1, "code": "", "reason": f"明细行数超过上限 {MAX_LINES}"})
        return lines, total, errors
    for i, e in enumerate(entries):
        kind = getattr(e, "kind", None) or (e.get("kind") if isinstance(e, dict) else "drug") or "drug"
        code = getattr(e, "code", None) or (e.get("code") if isinstance(e, dict) else None)
        raw_qty = getattr(e, "qty", 1) if not isinstance(e, dict) else e.get("qty", 1)
        try:
            qty = int(raw_qty)
        except (TypeError, ValueError, OverflowError):
            errors.append({"index": i, "code": code, "reason": "数量必须为整数"})
            continue
        usage = getattr(e, "usage", "") if not isinstance(e, dict) else e.get("usage", "")
        obj = lookup(db, kind, code)
        if obj is None:
            errors.append({"index": i, "code": code, "reason": f"项目不存在：{code}"})
            continue
        if qty <= 0 or qty > MAX_QTY:
            errors.append({"index": i, "code": code,
                           "reason": f"数量必须为 1–{MAX_QTY} 的整数（当前 {qty}）"})
            continue
        unit_price = float(obj.price)
        amount = money(unit_price * qty)
        total = money(total + amount)
        lines.append({
            "kind": kind,
            "code": obj.code,
            "name": getattr(obj, "name", None) or getattr(obj, "generic", ""),
            "spec": getattr(obj, "spec", "") or getattr(obj, "unit", ""),
            "unit": getattr(obj, "unit", ""),
            "qty": qty,
            "price": unit_price,
            "amount": amount,
            "ins": getattr(obj, "ins", "自费"),
            "usage": usage or getattr(obj, "usage", ""),
        })
    return lines, total, errors


def diagnosis_text(diags: list[str]) -> str:
    name_map = {i["code"]: i["name"] for i in ICD}
    return "、".join(f"{name_map.get(c, c)}（{c}）" for c in diags or [])


def review(db: Session, patient, items) -> list[dict]:
    """五维审查：过敏、相互作用、剂量、禁忌、重复用药。"""
    issues: list[dict] = []
    seen: dict[str, str] = {}
    drugs = [db.get(Drug, getattr(i, "code", None) or (i.get("code") if isinstance(i, dict) else None)) for i in items or []]
    drugs = [d for d in drugs if d]

    for d in drugs:
        dname = getattr(d, "name", None) or d.generic
        if patient and patient.allergy and d.allergen and patient.allergy == d.allergen:
            issues.append({"level": "danger", "title": "药物过敏",
                           "text": f"患者过敏史【{patient.allergy}】，{dname} 属同类药物，禁用。"})
        diagnosis = getattr(patient, "diagnosis", "") if patient else ""
        if d.contra and patient:
            first = (getattr(patient, "complaint", "") or "")
            if d.contra in (first + (diagnosis or "")):
                issues.append({"level": "danger", "title": "禁忌症", "text": f"{dname} 说明书禁忌：{d.contra}"})
        if patient and patient.age and patient.age < 18 and d.generic == "左氧氟沙星":
            issues.append({"level": "danger", "title": "年龄禁忌", "text": f"左氧氟沙星 18 岁以下禁用，患者 {patient.age} 岁。"})
        if d.generic in seen:
            issues.append({"level": "warn", "title": "重复用药",
                           "text": f"存在成分相同的药物：{dname} 与 {seen[d.generic]}（通用名 {d.generic}）"})
        else:
            seen[d.generic] = dname

        dose_per = 0
        freq = 1
        for i in items or []:
            code = getattr(i, "code", None) or (i.get("code") if isinstance(i, dict) else None)
            if code == d.code:
                dose_per = float(getattr(i, "dose_per", 0) or (i.get("dosePer", 0) if isinstance(i, dict) else 0) or 0)
                freq = {"qd": 1, "bid": 2, "tid": 3, "q8h": 3, "q12h": 2, "st": 1, "prn": 1}.get(
                    (getattr(i, "freq", "") or (i.get("freq") if isinstance(i, dict) else "")), 1)
                break
        if d.max_dose and dose_per and dose_per * freq > d.max_dose * 1.0001:
            issues.append({"level": "warn", "title": "剂量超量",
                           "text": f"{dname} 日剂量 {money(dose_per * freq)}{d.dose_unit}，超过上限 {d.max_dose}{d.dose_unit}。"})

    for i in range(len(drugs)):
        for j in range(i + 1, len(drugs)):
            a, b = drugs[i], drugs[j]
            for rule in INTERACTIONS:
                if {a.generic, b.generic} == {rule["a"], rule["b"]}:
                    issues.append({
                        "level": "danger" if rule["level"] in ("禁忌", "严重") else "warn",
                        "title": f"相互作用 · {rule['level']}",
                        "text": f"{(getattr(a,'name',None) or a.generic)} × {(getattr(b,'name',None) or b.generic)}：{rule['note']}",
                    })
    return issues

