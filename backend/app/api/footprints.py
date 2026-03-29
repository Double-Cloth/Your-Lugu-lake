from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import csrf_protect, get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.footprint import Footprint
from app.models.user import User

router = APIRouter(prefix="/api/footprints", tags=["footprints"], dependencies=[Depends(csrf_protect)])


@router.post("")
def create_footprint(
    location_id: int = Form(...),
    gps_lat: float = Form(...),
    gps_lon: float = Form(...),
    mood_text: str = Form(""),
    photo: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)

    photo_url = ""
    if photo:
        safe_name = f"{datetime.utcnow().timestamp()}_{photo.filename}"
        target = upload_dir / safe_name
        with target.open("wb") as f:
            f.write(photo.file.read())
        photo_url = f"/uploads/{safe_name}"

    footprint = Footprint(
        user_id=user.id,
        location_id=location_id,
        gps_lat=gps_lat,
        gps_lon=gps_lon,
        mood_text=mood_text,
        photo_url=photo_url,
    )
    db.add(footprint)
    db.commit()
    db.refresh(footprint)
    return {"id": footprint.id, "photo_url": footprint.photo_url}


@router.get("/me")
def my_footprints(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(Footprint).filter(Footprint.user_id == user.id).order_by(Footprint.id.desc()).all()
    return rows
