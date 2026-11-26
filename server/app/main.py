"""HIS · 门诊医生工作站 API（FastAPI + SQLite）。
同时支持两种部署形态：
  1) 前后端分离：只提供 /api/*（web 由 Vercel / nginx 托管）
  2) 单服务：若存在前端构建产物（web/dist 或 STATIC_DIR），一并托管并做 SPA 回退

生产（APP_ENV=prod）默认关闭 /docs、/redoc、/openapi.json，并统一注入安全响应头。
"""
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from .config import DOCS_ENABLED, IS_PROD
from .db import Base, SessionLocal, engine
from .routers import admin, ai, auth, clinic
from .seed import seed, weak_accounts

log = logging.getLogger("his")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed(db)
        weak = weak_accounts(db)
        if weak:
            log.warning("=" * 72)
            log.warning("检测到账号仍在使用演示口令：%s —— 请立即改密或停用。", "、".join(weak))
            if IS_PROD:
                log.warning("生产环境不应保留演示口令；本次启动继续服务，但请按部署手册完成初始化改密。")
            log.warning("=" * 72)
    yield


app = FastAPI(
    title="HIS · 门诊医生工作站",
    version="3.0.0",
    lifespan=lifespan,
    docs_url="/docs" if DOCS_ENABLED else None,
    redoc_url="/redoc" if DOCS_ENABLED else None,
    openapi_url="/openapi.json" if DOCS_ENABLED else None,
)

origins = [o.strip() for o in os.getenv("ALLOW_ORIGINS", "http://localhost:5173,http://localhost:8080").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in origins if o != "*"] or ["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
    response.headers.setdefault(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; connect-src 'self'; font-src 'self'; "
        "object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    )
    if IS_PROD:
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        if request.url.path.startswith("/api/"):     # 只有接口禁缓存，静态资源照常走浏览器缓存
            response.headers.setdefault("Cache-Control", "no-store")
    return response


app.include_router(auth.router)
app.include_router(clinic.router)
app.include_router(admin.router)
app.include_router(ai.router)


@app.get("/api/health")
def health():
    db_ok = True
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        db_ok = False
    body = {"status": "ok" if db_ok else "degraded"}
    if not IS_PROD:                      # 生产不对外暴露组件与版本
        body.update({"app": "his", "version": "3.0.0", "db": db_ok})
    return body


# ---------------------------------------------------------------- 静态前端（可选）
def _static_dir() -> Path:
    env = os.getenv("STATIC_DIR", "").strip()
    if env:
        return Path(env).resolve()
    return (Path(__file__).resolve().parents[2] / "web" / "dist").resolve()


STATIC_DIR = _static_dir()
if (STATIC_DIR / "index.html").exists():
    assets = STATIC_DIR / "assets"
    if assets.exists():
        app.mount("/assets", StaticFiles(directory=str(assets)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        # 接口与文档路由不参与 SPA 回退：未命中就 404，避免把 index.html 当作 /docs 的响应
        if full_path.startswith("api/") or full_path in ("openapi.json", "docs", "redoc"):
            raise HTTPException(status_code=404, detail="Not Found")
        candidate = (STATIC_DIR / full_path).resolve()
        if full_path and candidate.is_file() and STATIC_DIR in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(STATIC_DIR / "index.html")
