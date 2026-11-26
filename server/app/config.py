"""运行环境开关（生产/开发行为差异集中在此，避免散落 os.getenv）。"""
import os


def _flag(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip().lower()


# APP_ENV 优先，其次 ENV；未设置按开发环境处理
ENV = _flag("APP_ENV") or _flag("ENV") or "dev"
IS_PROD = ENV in ("prod", "production")

# 生产环境是否暴露 /docs、/redoc、/openapi.json（默认关闭）
EXPOSE_DOCS = _flag("EXPOSE_DOCS") in ("1", "true", "yes", "on")
DOCS_ENABLED = EXPOSE_DOCS or not IS_PROD
