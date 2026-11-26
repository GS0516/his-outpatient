"""认证、授权与审计。"""
import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .db import get_db
from .models import AuditLog, User

SECRET = os.getenv("JWT_SECRET", "dev-only-secret-please-replace-with-32bytes-min")
ALGORITHM = "HS256"
SESSION_HOURS = int(os.getenv("SESSION_HOURS", "8"))

bearer = HTTPBearer(auto_error=False)


def hash_password(raw: str) -> str:
    return bcrypt.hashpw(raw.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(raw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(raw.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def create_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user.id,
        "username": user.username,
        "name": user.name,
        "role": user.role,
        "dept": user.dept,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=SESSION_HOURS)).timestamp()),
    }
    return jwt.encode(payload, SECRET, algorithm=ALGORITHM)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise HTTPException(status_code=401, detail="未登录或登录已过期")
    try:
        payload = jwt.decode(creds.credentials, SECRET, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="令牌无效或已过期")
    user = db.get(User, payload.get("sub"))
    if not user or not user.active:
        raise HTTPException(status_code=401, detail="账号不存在或已停用")
    return user


def require_roles(*roles: str):
    def dependency(user: User = Depends(get_current_user)) -> User:
        if roles and user.role not in roles:
            raise HTTPException(status_code=403, detail=f"当前角色【{user.role}】无权执行该操作")
        return user

    return dependency


def audit(db: Session, user: User | None, action: str, obj_type: str = "", obj_id: str = "",
          detail: str = "", request: Request | None = None) -> None:
    ip = ""
    if request is not None and request.client is not None:
        ip = request.client.host
    db.add(AuditLog(
        user_id=user.id if user else "anonymous",
        username=user.username if user else "anonymous",
        name=user.name if user else "匿名",
        role=user.role if user else "anonymous",
        action=action,
        object_type=obj_type,
        object_id=str(obj_id or ""),
        detail=detail,
        ip=ip or "127.0.0.1",
    ))
