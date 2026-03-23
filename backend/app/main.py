from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.auth import router as auth_router
from app.api.admin import router as admin_router
from app.api.footprints import router as footprint_router
from app.api.locations import admin_router as admin_location_router
from app.api.locations import router as location_router
from app.api.routes import router as route_router
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app import models  # noqa: F401

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[item.strip() for item in settings.cors_origins.split(",") if item.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)


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
