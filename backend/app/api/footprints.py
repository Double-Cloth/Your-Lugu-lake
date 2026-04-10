import json
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import csrf_protect, get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.footprint import Footprint
from app.models.footprint_media import FootprintMedia
from app.models.location import Location
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


def _ensure_unspecified_location(db: Session) -> Location:
    location = db.query(Location).filter(Location.name == "未指定景点").first()
    if location is not None:
        return location

    location = Location(
        name="未指定景点",
        description="未提供具体景点信息的打卡记录",
        latitude=0.0,
        longitude=0.0,
        category="other",
        audio_url="",
        qr_code_url="",
    )
    db.add(location)
    db.flush()
    return location


def _resolve_location_for_checkin(
    db: Session,
    location_id: int | None,
    gps_lat: float | None,
    gps_lon: float | None,
    mood_text: str,
) -> Location:
    if location_id is not None:
        location = db.query(Location).filter(Location.id == location_id).first()
        if location is not None:
            return location
        raise ValueError("景点不存在，请检查景点ID")

    if gps_lat is not None and gps_lon is not None:
        candidates = db.query(Location).all()
        if candidates:
            return min(
                candidates,
                key=lambda item: ((float(item.latitude) - gps_lat) ** 2 + (float(item.longitude) - gps_lon) ** 2),
            )

    if str(mood_text or "").strip():
        return _ensure_unspecified_location(db)

    raise ValueError("请至少填写景点信息或心情")


def _save_upload_file(upload_dir: Path, file: UploadFile) -> str:
    original_name = Path(str(file.filename or "upload.jpg")).name
    suffix = Path(original_name).suffix.lower()
    if not suffix or len(suffix) > 10:
        suffix = ".jpg"
    safe_name = f"{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}_{uuid4().hex}{suffix}"
    target = upload_dir / safe_name
    with target.open("wb") as f:
        f.write(file.file.read())
    return f"/uploads/{safe_name}"


def _merge_uploads(photo: UploadFile | None, photos: list[UploadFile] | None) -> list[UploadFile]:
    merged: list[UploadFile] = []
    if photo is not None and str(photo.filename or "").strip():
        merged.append(photo)
    for item in photos or []:
        if item is None:
            continue
        if not str(item.filename or "").strip():
            continue
        merged.append(item)
    return merged


def _build_footprint_payload(row: Footprint, media_map: dict[int, list[str]]) -> dict:
    urls = media_map.get(row.id, [])
    if not urls and row.photo_url:
        urls = [row.photo_url]
    return {
        "id": row.id,
        "user_id": row.user_id,
        "location_id": row.location_id,
        "check_in_time": row.check_in_time.isoformat() if row.check_in_time else None,
        "gps_lat": row.gps_lat,
        "gps_lon": row.gps_lon,
        "mood_text": row.mood_text,
        "photo_url": urls[0] if urls else "",
        "photo_urls": urls,
    }


@router.post("")
def create_footprint(
    location_id: int | None = Form(default=None),
    gps_lat: float | None = Form(default=None),
    gps_lon: float | None = Form(default=None),
    mood_text: str = Form(""),
    qr_content: str | None = Form(default=None),
    photo: UploadFile | None = File(default=None),
    photos: list[UploadFile] | None = File(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        matched_location = _resolve_location_for_checkin(db, location_id, gps_lat, gps_lon, mood_text)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    try:
        _validate_qr_content_for_location(db, matched_location.id, qr_content)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)

    upload_items = _merge_uploads(photo, photos)
    photo_urls: list[str] = []
    for item in upload_items:
        photo_urls.append(_save_upload_file(upload_dir, item))
    primary_photo_url = photo_urls[0] if photo_urls else ""

    footprint = Footprint(
        user_id=user.id,
        location_id=matched_location.id,
        gps_lat=gps_lat if gps_lat is not None else 0.0,
        gps_lon=gps_lon if gps_lon is not None else 0.0,
        mood_text=mood_text,
        photo_url=primary_photo_url,
    )
    db.add(footprint)
    db.flush()

    for url in photo_urls:
        db.add(FootprintMedia(footprint_id=footprint.id, media_url=url))

    db.commit()
    db.refresh(footprint)
    return {
        "id": footprint.id,
        "photo_url": primary_photo_url,
        "photo_urls": photo_urls,
        "mood_text": footprint.mood_text,
        "gps_lat": footprint.gps_lat,
        "gps_lon": footprint.gps_lon,
        "qr_content": str(qr_content or "").strip(),
        "location_id": matched_location.id,
        "location_name": matched_location.name,
    }


@router.get("/me")
def my_footprints(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(Footprint).filter(Footprint.user_id == user.id).order_by(Footprint.id.desc()).all()
    if not rows:
        return []

    footprint_ids = [row.id for row in rows]
    media_rows = (
        db.query(FootprintMedia)
        .filter(FootprintMedia.footprint_id.in_(footprint_ids))
        .order_by(FootprintMedia.id.asc())
        .all()
    )
    media_map: dict[int, list[str]] = {}
    for media in media_rows:
        media_map.setdefault(media.footprint_id, []).append(media.media_url)

    return [_build_footprint_payload(row, media_map) for row in rows]
