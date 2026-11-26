"""系统管理 API：审计日志查询、药品 CSV 批量导入（服务端逐行校验）。"""
import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import AuditLog, Drug, User
from ..security import audit, require_roles

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/audit")
def audit_logs(action: str | None = None, username: str | None = None, date: str | None = None,
               limit: int = 200,
               user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    q = db.query(AuditLog)
    if action:
        q = q.filter(AuditLog.action == action)
    if username:
        q = q.filter(AuditLog.username == username)
    if date:
        q = q.filter(AuditLog.created_at >= datetime.strptime(date, "%Y-%m-%d"))
    rows = q.order_by(AuditLog.id.desc()).limit(max(1, min(limit, 500))).all()
    return [{
        "id": r.id, "time": r.created_at.strftime("%Y-%m-%d %H:%M:%S"), "username": r.username,
        "name": r.name, "role": r.role, "action": r.action, "objectType": r.object_type,
        "objectId": r.object_id, "detail": r.detail, "ip": r.ip,
    } for r in rows]


@router.post("/drugs/import")
async def import_drugs(request: Request, file: UploadFile = File(...), encoding: str = "utf-8",
                       user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    raw = await file.read()
    try:
        text = raw.decode(encoding)
    except (LookupError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail=f"文件编码无法按 {encoding} 解析，请改用 utf-8 或 gbk")

    lines = [l for l in text.replace("\r", "").split("\n") if l.strip()]
    if not lines:
        raise HTTPException(status_code=400, detail="文件为空")
    has_header = any(k in lines[0] for k in ("通用名", "药品名称", "generic"))
    start = 1 if has_header else 0

    ok, failed, duplicates = 0, [], []
    seen: set[tuple[str, str]] = set()
    for idx in range(start, len(lines)):
        cols = [c.strip() for c in next(csv.reader([lines[idx]]))]
        line_no = idx + 1
        if len(cols) < 7:
            failed.append({"line": line_no, "raw": lines[idx], "reason": "列数不足（需 7 列）"})
            continue
        generic, trade, spec, form, price_s, ins, stock_s = cols[:7]
        if not generic or not spec or not form or not price_s or not ins:
            failed.append({"line": line_no, "raw": lines[idx], "reason": "必填项缺失（通用名/规格/剂型/单价/医保类别）"})
            continue
        try:
            price = float(price_s)
            if price <= 0:
                raise ValueError
        except ValueError:
            failed.append({"line": line_no, "raw": lines[idx], "reason": f"单价非法：{price_s}"})
            continue
        try:
            stock = int(float(stock_s or 0))
            if stock < 0:
                raise ValueError
        except ValueError:
            failed.append({"line": line_no, "raw": lines[idx], "reason": f"库存数量非法：{stock_s}"})
            continue
        if ins not in ("甲", "乙", "自费"):
            failed.append({"line": line_no, "raw": lines[idx], "reason": f"医保类别只能是 甲/乙/自费：{ins}"})
            continue
        if (generic, spec) in seen or db.query(Drug).filter(Drug.generic == generic, Drug.spec == spec).first():
            duplicates.append({"line": line_no, "name": generic, "reason": "同通用名同规格已存在"})
            continue
        seen.add((generic, spec))
        code = f"Y9{ok + 1:03d}"
        while db.get(Drug, code):
            code = f"Y9{ok + 1:03d}{len(duplicates) + len(failed)}"
        db.add(Drug(code=code, generic=generic, trade=trade, spec=spec, form=form, unit="盒",
                    price=price, cost=round(price * 0.72, 2), ins=ins, stock=stock, low=max(10, stock // 5),
                    batch="IMP" + datetime.now().strftime("%Y%m%d"), expiry="2027-12-31",
                    usage="遵医嘱", indication="批量导入，待维护", contra="待维护"))
        ok += 1

    audit(db, user, "药品批量导入", "drug", file.filename or "csv",
          f"成功 {ok} 条，失败 {len(failed)} 条，重复 {len(duplicates)} 条", request)
    db.commit()
    return {"success": ok, "failed": failed, "duplicates": duplicates}
