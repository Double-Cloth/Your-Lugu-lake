from pathlib import Path
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.api.auth import router as auth_router
from app.api.admin import router as admin_router
from app.api.footprints import router as footprint_router
from app.api.locations import admin_router as admin_location_router
from app.api.locations import router as location_router
from app.api.routes import router as route_router
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine, wait_for_db
from app.services.llm_service import warmup_knowledge_vector_store
from app import models  # noqa: F401

app = FastAPI(title=settings.app_name)
logger = logging.getLogger(__name__)


def _is_production_env() -> bool:
    return str(settings.app_env or "").strip().lower() in {"prod", "production"}


def _has_weak_secret_key() -> bool:
    secret = str(settings.secret_key or "").strip()
    return (not secret) or secret in {"change-me", "change-me-to-a-long-random-secret"} or len(secret) < 32


def _validate_security_configuration() -> None:
    issues: list[str] = []
    is_prod = _is_production_env()

    if _has_weak_secret_key():
        if is_prod:
            issues.append("SECRET_KEY 过弱或仍为默认值")
        else:
            logger.warning("当前 SECRET_KEY 仍为弱值，仅建议本地开发使用")

    if settings.enforce_csrf and not str(settings.csrf_header_name or "").strip():
        issues.append("CSRF header 名称不能为空")

    if is_prod and not settings.session_cookie_secure:
        issues.append("生产环境必须启用 SESSION_COOKIE_SECURE")

    if str(settings.session_cookie_samesite or "").strip().lower() == "none" and not settings.session_cookie_secure:
        issues.append("SESSION_COOKIE_SAMESITE=none 时必须启用 SESSION_COOKIE_SECURE")

    if is_prod and str(settings.cors_origins or "").strip() == "*":
        issues.append("生产环境禁止 CORS_ORIGINS=*")

    if is_prod and str(settings.allowed_hosts or "").strip() == "*":
        issues.append("生产环境禁止 ALLOWED_HOSTS=*")

    if is_prod and settings.password_transport_encryption_enabled:
        if not str(settings.password_transport_private_key_pem or "").strip():
            issues.append("生产环境启用密码传输加密时必须配置 PASSWORD_TRANSPORT_PRIVATE_KEY_PEM")
        if settings.password_transport_allow_plaintext_fallback:
            issues.append("生产环境应关闭 PASSWORD_TRANSPORT_ALLOW_PLAINTEXT_FALLBACK")

    if issues:
        raise RuntimeError("安全配置不满足生产要求: " + "；".join(issues))


_validate_security_configuration()

allowed_origins = [item.strip() for item in settings.cors_origins.split(",") if item.strip()]
allow_all_origins = "*" in allowed_origins
allowed_hosts = [item.strip() for item in settings.allowed_hosts.split(",") if item.strip()] or ["*"]

if allow_all_origins:
    # Cookie-based auth cannot use wildcard CORS with credentials.
    allowed_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "geolocation=(self), microphone=(), camera=()")
    if request.url.path.startswith("/api/"):
        response.headers.setdefault("Cache-Control", "no-store")
    return response


@app.on_event("startup")
def on_startup() -> None:
    wait_for_db(max_attempts=30, delay_seconds=2.0)
    Base.metadata.create_all(bind=engine)
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    try:
        warmup_knowledge_vector_store()
    except Exception as exc:  # pragma: no cover - startup resilience path
        logger.warning("Warm up knowledge vector store failed: %s", exc)


app.include_router(auth_router)
app.include_router(location_router)
app.include_router(admin_location_router)
app.include_router(admin_router)
app.include_router(route_router)
app.include_router(footprint_router)


@app.get("/health")
def health():
    return {"status": "ok"}


app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")
