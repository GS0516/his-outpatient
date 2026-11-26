"""HIS · 门诊医生工作站 API（FastAPI + SQLite）。
同时支持两种部署形态：
  1) 前后端分离：只提供 /api/*（web 由 Vercel / nginx 托管）
  2) 单服务：若存在前端构建产物（web/dist 或 STATIC_DIR），一并托管并做 SPA 回退
"""
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from .db import Base, SessionLocal, engine
from .routers import admin, ai, auth, clinic
from .seed import seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed(db)
    yield


app = FastAPI(title="HIS · 门诊医生工作站", version="3.0.0", lifespan=lifespan)

origins = [o.strip() for o in os.getenv("ALLOW_ORIGINS", "http://localhost:5173,http://localhost:8080").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    return {"status": "ok" if db_ok else "degraded", "app": "his", "version": "3.0.0", "db": db_ok}


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
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        candidate = (STATIC_DIR / full_path).resolve()
        if full_path and candidate.is_file() and STATIC_DIR in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(STATIC_DIR / "index.html")
