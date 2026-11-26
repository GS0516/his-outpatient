"""认证路由：登录、当前用户。"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..schemas import LoginIn
from ..security import audit, create_token, get_current_user, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def user_dict(u: User) -> dict:
    return {"id": u.id, "username": u.username, "name": u.name, "role": u.role,
            "dept": u.dept, "title": u.title}


@router.post("/login")
def login(payload: LoginIn, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username.strip()).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        audit(db, user, "登录失败", "auth", payload.username, "口令校验未通过", request)
        db.commit()
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    if not user.active:
        raise HTTPException(status_code=403, detail="账号已停用")
    audit(db, user, "登录系统", "auth", user.username, f"角色 {user.role}", request)
    db.commit()
    return {"token": create_token(user), "user": user_dict(user)}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return user_dict(user)
