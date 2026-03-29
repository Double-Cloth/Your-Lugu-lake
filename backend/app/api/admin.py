import io
import zipfile
from pathlib import Path

import qrcode
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import csrf_protect, require_admin
from app.core.config import settings
from app.db.session import get_db
from app.models.ai_route import AIRoute
from app.models.footprint import Footprint
from app.models.location import Location
from app.models.user import User

router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    dependencies=[Depends(require_admin), Depends(csrf_protect)],
)


@router.get("/stats")
def dashboard_stats(db: Session = Depends(get_db)):
    return {
        "users": db.query(func.count(User.id)).scalar() or 0,
        "locations": db.query(func.count(Location.id)).scalar() or 0,
        "footprints": db.query(func.count(Footprint.id)).scalar() or 0,
        "ai_routes": db.query(func.count(AIRoute.id)).scalar() or 0,
    }


@router.post("/qrcodes/generate/{location_id}")
def generate_location_qrcode(location_id: int, db: Session = Depends(get_db)):
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    qr_dir = Path(settings.upload_dir) / "qrcodes"
    qr_dir.mkdir(parents=True, exist_ok=True)

    content = f"/locations/{location.id}"
    file_name = f"location_{location.id}.png"
    file_path = qr_dir / file_name

    img = qrcode.make(content)
    img.save(str(file_path))

    location.qr_code_url = f"/uploads/qrcodes/{file_name}"
    db.commit()

    return {"location_id": location.id, "qr_code_url": location.qr_code_url}


@router.get("/qrcodes/batch-export")
def export_all_qrcodes(db: Session = Depends(get_db)):
    locations = db.query(Location).order_by(Location.id.asc()).all()
    if not locations:
        raise HTTPException(status_code=400, detail="No locations found")

    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for loc in locations:
            content = f"/locations/{loc.id}"
            img = qrcode.make(content)
            image_bytes = io.BytesIO()
            img.save(image_bytes)
            zf.writestr(f"{loc.id}_{loc.name}.png", image_bytes.getvalue())

    memory_file.seek(0)
    return StreamingResponse(
        memory_file,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=lugu-location-qrcodes.zip"},
    )


@router.get("/qrcodes/file/{file_name}")
def get_qrcode_file(file_name: str):
    path = Path(settings.upload_dir) / "qrcodes" / file_name
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path)
