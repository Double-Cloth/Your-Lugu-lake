import json
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import csrf_protect, get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.footprint import Footprint
from app.models.qrcode import QrCode
from app.models.user import User

router = APIRouter(prefix="/api/footprints", tags=["footprints"], dependencies=[Depends(csrf_protect)])


def _validate_qr_content_for_location(db: Session, location_id: int, qr_content: str | None) -> None:
    qr_text = str(qr_content or "").strip()
    if not qr_text:
        return

    qr_record = db.query(QrCode).filter(QrCode.location_id == location_id).first()
    if qr_record is None or not qr_record.is_active:
        raise ValueError("该景点未找到有效的管理员二维码")

    try:
        qr_payload = json.loads(qr_record.qr_code_data or "{}")
    except json.JSONDecodeError as exc:
        raise ValueError("管理员二维码数据损坏") from exc

    expected_scan_content = str(qr_payload.get("scan_content") or "").strip()
    if expected_scan_content != qr_text:
        raise ValueError("扫码内容与管理员生成的二维码不一致")


@router.post("")
def create_footprint(
    location_id: int = Form(...),
    gps_lat: float = Form(...),
    gps_lon: float = Form(...),
    mood_text: str = Form(""),
    qr_content: str | None = Form(default=None),
    photo: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        _validate_qr_content_for_location(db, location_id, qr_content)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

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
