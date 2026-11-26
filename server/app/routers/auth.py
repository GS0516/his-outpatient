"""认证路由：登录（含失败限速与临时锁定）、当前用户。"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import ratelimit
from ..db import get_db
from ..models import User
from ..schemas import LoginIn
from ..security import audit, create_token, get_current_user, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def user_dict(u: User) -> dict:
    return {"id": u.id, "username": u.username, "name": u.name, "role": u.role,
            "dept": u.dept, "title": u.title}


def client_ip(request: Request) -> str:
    """取真实来源 IP：反代场景读 X-Forwarded-For 第一跳，否则用 socket 对端。"""
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()[:64]
    return request.client.host if request.client else "-"


@router.post("/login")
def login(payload: LoginIn, request: Request, db: Session = Depends(get_db)):
    ip = client_ip(request)
    key = ratelimit.make_key(payload.username, ip)

    remain = ratelimit.locked_seconds(key)
    if remain:
        audit(db, None, "登录被锁定拦截", "auth", payload.username, f"剩余 {remain}s", request)
        db.commit()
        raise HTTPException(
            status_code=429,
            detail=f"登录失败次数过多，请 {max(1, remain // 60)} 分钟后再试",
            headers={"Retry-After": str(remain)},
        )

    user = db.query(User).filter(User.username == payload.username.strip()).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        locked = ratelimit.register_failure(key)
        reason = "口令校验未通过" if user else "账号不存在"
        if locked:
            reason += f"；连续失败达 {ratelimit.MAX_FAILS} 次，锁定 {locked}s"
        audit(db, user, "登录失败", "auth", payload.username, reason, request)
        db.commit()
        if locked:
            raise HTTPException(
                status_code=429,
                detail=f"登录失败次数过多，请 {locked // 60} 分钟后再试",
                headers={"Retry-After": str(locked)},
            )
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    if not user.active:
        raise HTTPException(status_code=403, detail="账号已停用")

    ratelimit.reset(key)
    audit(db, user, "登录系统", "auth", user.username, f"角色 {user.role}", request)
    db.commit()
    return {"token": create_token(user), "user": user_dict(user)}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return user_dict(user)
