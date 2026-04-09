import errno
import io
import json
import logging
import re
import secrets
import string
import zipfile
import hashlib
import requests
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import quote

import qrcode
import PyPDF2
from PIL import Image, ImageDraw, ImageFont
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import and_, desc, func
from sqlalchemy.orm import Session

from app.api.deps import csrf_protect, get_current_user, require_admin
from app.core.config import settings
from app.core.security import get_password_hash
from app.db.session import get_db
from app.models.ai_route import AIRoute
from app.models.footprint import Footprint
from app.models.footprint_media import FootprintMedia
from app.models.location import Location
from app.models.qrcode import QrCode
from app.models.user import User
from app.schemas.admin import (
    AdminDashboardStats,
    AdminUserResetPasswordIn,
    AdminUserUpdateIn,
    UserDetailOut,
    FootprintDetailOut,
    UserOut,
    QrCodeOut,
)
from app.services.llm_service import chat

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    dependencies=[Depends(require_admin), Depends(csrf_protect)],
)

KB_PATH = Path("/knowledge-base")
if not KB_PATH.exists():
    KB_PATH = Path(__file__).resolve().parents[3] / "knowledge-base"


def _normalize_category(raw_value: str) -> str:
    value = str(raw_value or "").strip().lower()
    if value in {"nature", "culture"}:
        return value
    return "culture"


def _load_kb_locations() -> list[dict]:
    index_path = KB_PATH / "locations" / "index.json"
    if not index_path.exists():
        return []

    try:
        with index_path.open("r", encoding="utf-8") as f:
            index_data = json.load(f)
    except Exception:
        return []

    entries = index_data.get("locations") if isinstance(index_data, dict) else []
    if not isinstance(entries, list):
        return []

    records: list[dict] = []
    for entry in entries:
        slug = str((entry or {}).get("slug") or "").strip()
        if not slug:
            continue

        info_path = KB_PATH / "locations" / slug / "info.json"
        if not info_path.exists():
            continue

        try:
            with info_path.open("r", encoding="utf-8") as f:
                info = json.load(f)
        except Exception:
            continue

        try:
            latitude = float(info.get("latitude"))
            longitude = float(info.get("longitude"))
        except Exception:
            continue

        name = str(info.get("name") or entry.get("name") or slug).strip()
        if not name:
            continue

        records.append(
            {
                "slug": slug,
                "name": name,
                "description": str(info.get("description") or "").strip(),
                "audio_url": str(info.get("audioUrl") or info.get("audio_url") or "").strip(),
                "category": _normalize_category(str(info.get("category") or "culture")),
                "latitude": latitude,
                "longitude": longitude,
            }
        )

    return records


def _scan_content_for_location(location_id: int) -> str:
    # 与前端扫码解析规则保持一致：/locations/{id}
    return f"/locations/{location_id}"


def _safe_qr_file_name(location_id: int) -> str:
    return f"location_{location_id}.png"


def _load_label_font() -> tuple[ImageFont.FreeTypeFont | ImageFont.ImageFont, bool]:
    font_candidates = [
        # Windows
        "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/simhei.ttf",
        "C:/Windows/Fonts/simsun.ttc",
        # Linux
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
        # macOS
        "/System/Library/Fonts/PingFang.ttc",
    ]

    for path in font_candidates:
        try:
            if Path(path).exists():
                return ImageFont.truetype(path, 26), True
        except Exception:
            continue

    return ImageFont.load_default(), False


def _kb_item_by_name(location_name: str) -> dict | None:
    name = str(location_name or "").strip()
    if not name:
        return None
    for item in _load_kb_locations():
        if item.get("name") == name:
            return item
    return None


def _ensure_location_from_kb_item(item: dict, db: Session) -> Location:
    location = db.query(Location).filter(Location.name == item["name"]).first()
    if location is None:
        location = Location(
            name=item["name"],
            description=item["description"] or item["name"],
            audio_url=item["audio_url"],
            latitude=item["latitude"],
            longitude=item["longitude"],
            category=item["category"],
        )
        db.add(location)
        db.flush()
        return location

    location.description = item["description"] or location.description
    location.audio_url = item["audio_url"] or location.audio_url
    location.latitude = item["latitude"]
    location.longitude = item["longitude"]
    location.category = item["category"]
    return location


def _build_labeled_qr_image(scan_content: str, location_name: str, fallback_label: str = "") -> Image.Image:
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=12,
        border=3,
    )
    qr.add_data(scan_content)
    qr.make(fit=True)
    qr_image = qr.make_image(fill_color="black", back_color="white").convert("RGB")

    label = str(location_name or "").strip()
    if not label:
        return qr_image

    # 避免超长名称撑坏布局
    if len(label) > 20:
        label = f"{label[:19]}..."

    font, has_cjk_font = _load_label_font()
    if not has_cjk_font and any(ord(ch) > 127 for ch in label):
        ascii_fallback = str(fallback_label or "").strip() or "Location"
        label = ascii_fallback

    draw = ImageDraw.Draw(qr_image)
    text_bbox = draw.textbbox((0, 0), label, font=font)
    text_width = text_bbox[2] - text_bbox[0]
    text_height = text_bbox[3] - text_bbox[1]

    padding_top = 16
    padding_bottom = 16
    canvas_width = max(qr_image.width, text_width + 36)
    canvas_height = qr_image.height + padding_top + text_height + padding_bottom

    canvas = Image.new("RGB", (canvas_width, canvas_height), "white")
    qr_x = (canvas_width - qr_image.width) // 2
    canvas.paste(qr_image, (qr_x, 0))

    draw_canvas = ImageDraw.Draw(canvas)
    text_x = (canvas_width - text_width) // 2
    text_y = qr_image.height + padding_top
    draw_canvas.text((text_x, text_y), label, fill="black", font=font)
    return canvas


def _build_qr_meta(location_id: int, location_name: str, slug: str | None = None) -> dict:
    return {
        "type": "location_checkin",
        "location_id": location_id,
        "location_name": location_name,
        "location_slug": slug or "",
        "scan_content": _scan_content_for_location(location_id),
        "generated_at": datetime.utcnow().isoformat(),
    }


# ==================== 仪表板统计 ====================
@router.get("/stats")
def dashboard_stats(db: Session = Depends(get_db)):
    """获取仪表板统计数据"""
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    kb_locations_count = len(_load_kb_locations())
    db_locations_count = db.query(func.count(Location.id)).scalar() or 0

    # 概览数据按业务口径统计：游客=普通用户，打卡=普通游客打卡，景点优先知识库数量。
    user_count = db.query(func.count(User.id)).filter(User.role == "user").scalar() or 0
    footprint_count = (
        db.query(func.count(Footprint.id))
        .join(User, User.id == Footprint.user_id)
        .filter(User.role == "user")
        .scalar()
        or 0
    )
    today_footprint_count = (
        db.query(func.count(Footprint.id))
        .join(User, User.id == Footprint.user_id)
        .filter(User.role == "user", Footprint.check_in_time >= today)
        .scalar()
        or 0
    )

    return {
        "users": user_count,
        "locations": kb_locations_count or db_locations_count,
        "locations_kb": kb_locations_count,
        "locations_db": db_locations_count,
        "footprints": footprint_count,
        "ai_routes": db.query(func.count(AIRoute.id)).scalar() or 0,
        "today_footprints": today_footprint_count,
        "today_checkins": db.query(func.count(User.id)).filter(
            User.role == "user",
            User.created_at >= today
        ).scalar() or 0,
    }


# ==================== 游客管理 ====================
def _build_temporary_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


@router.get("/users")
def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str = Query(""),
    role: str = Query(""),
    db: Session = Depends(get_db),
):
    """获取游客列表（分页、搜索）"""
    query = db.query(User)

    normalized_role = str(role or "").strip().lower()
    if normalized_role in {"user", "admin"}:
        query = query.filter(User.role == normalized_role)
    
    if search:
        query = query.filter(User.username.ilike(f"%{search}%"))
    
    total = query.count()
    users = query.order_by(desc(User.created_at)).offset((page - 1) * per_page).limit(per_page).all()
    
    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "data": [
            {
                "id": u.id,
                "username": u.username,
                "role": u.role,
                "created_at": u.created_at.isoformat(),
                "total_footprints": db.query(func.count(Footprint.id)).filter(Footprint.user_id == u.id).scalar() or 0,
                "total_locations_visited": db.query(func.count(func.distinct(Footprint.location_id))).filter(Footprint.user_id == u.id).scalar() or 0,
                "last_checkin": (
                    db.query(func.max(Footprint.check_in_time)).filter(Footprint.user_id == u.id).scalar()
                ),
                "checkins_last_7_days": db.query(func.count(Footprint.id)).filter(
                    Footprint.user_id == u.id,
                    Footprint.check_in_time >= datetime.utcnow() - timedelta(days=7),
                ).scalar() or 0,
            }
            for u in users
        ],
    }


@router.get("/users/{user_id}")
def get_user_detail(user_id: int, db: Session = Depends(get_db)):
    """获取用户详细信息"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    footprints = (
        db.query(Footprint)
        .filter(Footprint.user_id == user_id)
        .order_by(desc(Footprint.check_in_time))
        .all()
    )
    locations_visited = db.query(func.count(func.distinct(Footprint.location_id))).filter(
        Footprint.user_id == user_id
    ).scalar() or 0
    
    last_checkin_record = db.query(Footprint).filter(Footprint.user_id == user_id).order_by(
        desc(Footprint.check_in_time)
    ).first()
    
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "created_at": user.created_at.isoformat(),
        "total_footprints": len(footprints),
        "total_locations_visited": locations_visited,
        "last_checkin": last_checkin_record.check_in_time.isoformat() if last_checkin_record else None,
        "checkins_last_7_days": db.query(func.count(Footprint.id)).filter(
            Footprint.user_id == user_id,
            Footprint.check_in_time >= datetime.utcnow() - timedelta(days=7),
        ).scalar() or 0,
        "checkins_last_30_days": db.query(func.count(Footprint.id)).filter(
            Footprint.user_id == user_id,
            Footprint.check_in_time >= datetime.utcnow() - timedelta(days=30),
        ).scalar() or 0,
        "footprints": [
            {
                "id": fp.id,
                "location_id": fp.location_id,
                "location_name": (db.query(Location.name).filter(Location.id == fp.location_id).scalar() or ""),
                "check_in_time": fp.check_in_time.isoformat(),
                "gps_lat": fp.gps_lat,
                "gps_lon": fp.gps_lon,
                "mood_text": fp.mood_text,
                "photo_url": fp.photo_url,
            }
            for fp in footprints
        ],
    }


@router.put("/users/{user_id}")
def update_user(user_id: int, payload: AdminUserUpdateIn, db: Session = Depends(get_db), current_admin: User = Depends(get_current_user)):
    """更新用户账号（角色）"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.role is not None:
        next_role = str(payload.role or "").strip().lower()
        if next_role not in {"user", "admin"}:
            raise HTTPException(status_code=400, detail="role must be user or admin")
        if user.id == current_admin.id and next_role != "admin":
            raise HTTPException(status_code=400, detail="不能将当前登录管理员降级")
        user.role = next_role

    db.commit()
    db.refresh(user)
    return {
        "ok": True,
        "user": {
            "id": user.id,
            "username": user.username,
            "role": user.role,
            "created_at": user.created_at.isoformat(),
        },
    }


@router.post("/users/{user_id}/reset-password")
def reset_user_password(
    user_id: int,
    payload: AdminUserResetPasswordIn,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_user),
):
    """管理员重置游客密码。未传 new_password 时自动生成临时密码。"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == current_admin.id:
        raise HTTPException(status_code=400, detail="不能重置当前登录管理员自己的密码")

    raw_password = str(payload.new_password or "").strip()
    if not raw_password:
        raw_password = _build_temporary_password()

    if len(raw_password) < 6 or len(raw_password) > 128:
        raise HTTPException(status_code=400, detail="password length must be 6~128")

    user.password_hash = get_password_hash(raw_password)
    db.commit()
    return {
        "ok": True,
        "user_id": user.id,
        "username": user.username,
        "temporary_password": raw_password,
    }


@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_admin: User = Depends(get_current_user)):
    """删除用户和其关联的打卡记录"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == current_admin.id:
        raise HTTPException(status_code=400, detail="不能删除当前登录管理员")

    if user.role == "admin":
        raise HTTPException(status_code=400, detail="不能在游客管理中删除管理员账号")
    
    # 删除用户的打卡记录
    db.query(Footprint).filter(Footprint.user_id == user_id).delete()
    # 删除用户
    db.delete(user)
    db.commit()
    
    return {"ok": True, "message": f"User {user.username} and related footprints deleted"}


# ==================== 二维码管理 ====================
@router.post("/qrcodes/generate/{location_id}")
def generate_location_qrcode(location_id: int, admin: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """生成打卡二维码并存储到数据库"""
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    kb_item = _kb_item_by_name(location.name)
    if kb_item is None:
        raise HTTPException(status_code=422, detail="该景点不在 knowledge-base 中，禁止生成二维码")

    # 以 knowledge-base 为准同步景点信息
    location = _ensure_location_from_kb_item(kb_item, db)

    qr_dir = Path(settings.upload_dir) / "qrcodes"
    qr_dir.mkdir(parents=True, exist_ok=True)

    qr_data = _build_qr_meta(location.id, location.name, kb_item.get("slug"))
    file_name = _safe_qr_file_name(location.id)
    file_path = qr_dir / file_name

    # 生成可扫码（/locations/{id}）且带景点名称标签的二维码。
    qr_image = _build_labeled_qr_image(qr_data["scan_content"], location.name, kb_item.get("slug", ""))
    qr_image.save(str(file_path), format="PNG")

    # 更新Location表和QrCode表
    location.qr_code_url = f"/uploads/qrcodes/{file_name}"
    db.commit()
    
    # 更新或创建QrCode记录
    qr_code = db.query(QrCode).filter(QrCode.location_id == location_id).first()
    if not qr_code:
        qr_code = QrCode(
            location_id=location_id,
            qr_code_url=location.qr_code_url,
            qr_code_data=json.dumps(qr_data, ensure_ascii=False),
            generated_by=admin.id,
        )
        db.add(qr_code)
    else:
        qr_code.qr_code_url = location.qr_code_url
        qr_code.qr_code_data = json.dumps(qr_data, ensure_ascii=False)
        qr_code.generated_by = admin.id
        qr_code.generated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(qr_code)

    return {"location_id": location.id, "qr_code_url": location.qr_code_url}


@router.post("/qrcodes/generate-from-knowledge-base")
def generate_qrcodes_from_knowledge_base(admin: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """自动读取 knowledge-base 景点并批量生成二维码。"""
    kb_locations = _load_kb_locations()
    if not kb_locations:
        raise HTTPException(status_code=400, detail="No valid locations found in knowledge-base")

    qr_dir = Path(settings.upload_dir) / "qrcodes"
    qr_dir.mkdir(parents=True, exist_ok=True)

    created_locations = 0
    updated_locations = 0
    generated_qrcodes = 0
    items: list[dict] = []

    for item in kb_locations:
        location = db.query(Location).filter(Location.name == item["name"]).first()
        if location is None:
            location = _ensure_location_from_kb_item(item, db)
            created_locations += 1
        else:
            location = _ensure_location_from_kb_item(item, db)
            updated_locations += 1

        qr_payload = _build_qr_meta(location.id, location.name, item["slug"])
        file_name = _safe_qr_file_name(location.id)
        file_path = qr_dir / file_name
        qr_image = _build_labeled_qr_image(qr_payload["scan_content"], location.name, item["slug"])
        qr_image.save(str(file_path), format="PNG")

        location.qr_code_url = f"/uploads/qrcodes/{file_name}"

        qr_code = db.query(QrCode).filter(QrCode.location_id == location.id).first()
        if qr_code is None:
            qr_code = QrCode(
                location_id=location.id,
                qr_code_url=location.qr_code_url,
                qr_code_data=json.dumps(qr_payload, ensure_ascii=False),
                generated_by=admin.id,
                description=f"Auto generated from knowledge-base: {item['slug']}",
                is_active=True,
            )
            db.add(qr_code)
        else:
            qr_code.qr_code_url = location.qr_code_url
            qr_code.qr_code_data = json.dumps(qr_payload, ensure_ascii=False)
            qr_code.generated_by = admin.id
            qr_code.generated_at = datetime.utcnow()
            qr_code.is_active = True

        generated_qrcodes += 1
        items.append(
            {
                "location_id": location.id,
                "location_name": location.name,
                "slug": item["slug"],
                "qr_code_url": location.qr_code_url,
            }
        )

    db.commit()

    return {
        "ok": True,
        "total": len(kb_locations),
        "created_locations": created_locations,
        "updated_locations": updated_locations,
        "generated_qrcodes": generated_qrcodes,
        "items": items,
    }


@router.get("/qrcodes")
def list_qrcodes(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    location_id: int = Query(None),
    is_active: bool = Query(None),
    db: Session = Depends(get_db),
):
    """获取二维码列表"""
    query = db.query(QrCode)
    
    if location_id:
        query = query.filter(QrCode.location_id == location_id)
    
    if is_active is not None:
        query = query.filter(QrCode.is_active == is_active)
    
    total = query.count()
    qrcodes = query.order_by(desc(QrCode.generated_at)).offset((page - 1) * per_page).limit(per_page).all()
    
    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "data": [
            {
                "id": qr.id,
                "location_id": qr.location_id,
                "qr_code_url": qr.qr_code_url,
                "generated_at": qr.generated_at.isoformat(),
                "is_active": qr.is_active,
                "description": qr.description,
                "generated_by": qr.generated_by,
            }
            for qr in qrcodes
        ],
    }


@router.put("/qrcodes/{qrcode_id}")
def update_qrcode(qrcode_id: int, is_active: bool = None, description: str = None, db: Session = Depends(get_db)):
    """更新二维码信息"""
    qr = db.query(QrCode).filter(QrCode.id == qrcode_id).first()
    if not qr:
        raise HTTPException(status_code=404, detail="QrCode not found")
    
    if is_active is not None:
        qr.is_active = is_active
    
    if description is not None:
        qr.description = description
    
    db.commit()
    db.refresh(qr)
    
    return {"ok": True, "qrcode": qr}


@router.get("/qrcodes/batch-export")
def export_all_qrcodes(db: Session = Depends(get_db)):
    """批量导出所有二维码"""
    kb_locations = _load_kb_locations()
    if not kb_locations:
        raise HTTPException(status_code=400, detail="No valid locations found in knowledge-base")

    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for item in kb_locations:
            loc = _ensure_location_from_kb_item(item, db)
            scan_content = _scan_content_for_location(loc.id)
            img = _build_labeled_qr_image(scan_content, loc.name, item["slug"])
            image_bytes = io.BytesIO()
            img.save(image_bytes, format="PNG")
            image_bytes.seek(0)
            # ZIP 文件名使用 ASCII slug，避免不同系统解压出现中文乱码。
            zf.writestr(f"{loc.id}_{item['slug']}.png", image_bytes.getvalue())

    db.commit()

    memory_file.seek(0)
    return StreamingResponse(
        memory_file,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=lugu-location-qrcodes.zip"},
    )


@router.get("/qrcodes/file/{file_name}")
def get_qrcode_file(file_name: str):
    """获取二维码文件"""
    path = Path(settings.upload_dir) / "qrcodes" / file_name
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path)


# ==================== 打卡记录管理 ====================
@router.get("/footprints")
def list_footprints(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user_id: int = Query(None),
    location_id: int = Query(None),
    date_from: str = Query(None),
    date_to: str = Query(None),
    db: Session = Depends(get_db),
):
    """获取打卡记录列表（支持筛选）"""
    query = db.query(Footprint)
    
    if user_id:
        query = query.filter(Footprint.user_id == user_id)
    
    if location_id:
        query = query.filter(Footprint.location_id == location_id)
    
    if date_from:
        try:
            from_date = datetime.fromisoformat(date_from)
            query = query.filter(Footprint.check_in_time >= from_date)
        except:
            pass
    
    if date_to:
        try:
            to_date = datetime.fromisoformat(date_to)
            query = query.filter(Footprint.check_in_time <= to_date)
        except:
            pass
    
    total = query.count()
    footprints = query.order_by(desc(Footprint.check_in_time)).offset((page - 1) * per_page).limit(per_page).all()
    footprint_ids = [fp.id for fp in footprints]
    media_map: dict[int, list[str]] = {}
    if footprint_ids:
        medias = (
            db.query(FootprintMedia)
            .filter(FootprintMedia.footprint_id.in_(footprint_ids))
            .order_by(FootprintMedia.id.asc())
            .all()
        )
        for media in medias:
            media_map.setdefault(media.footprint_id, []).append(media.media_url)
    
    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "data": [
            {
                "id": fp.id,
                "user_id": fp.user_id,
                "location_id": fp.location_id,
                "check_in_time": fp.check_in_time.isoformat(),
                "gps_lat": fp.gps_lat,
                "gps_lon": fp.gps_lon,
                "mood_text": fp.mood_text,
                "photo_url": fp.photo_url,
                "photo_urls": media_map.get(fp.id, [fp.photo_url] if fp.photo_url else []),
            }
            for fp in footprints
        ],
    }


@router.get("/footprints/stats")
def footprints_stats(db: Session = Depends(get_db)):
    """获取打卡统计信息"""
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=30)
    
    return {
        "total": db.query(func.count(Footprint.id)).scalar() or 0,
        "today": db.query(func.count(Footprint.id)).filter(Footprint.check_in_time >= today).scalar() or 0,
        "this_week": db.query(func.count(Footprint.id)).filter(Footprint.check_in_time >= week_ago).scalar() or 0,
        "this_month": db.query(func.count(Footprint.id)).filter(Footprint.check_in_time >= month_ago).scalar() or 0,
        "by_location": dict(
            db.query(
                Location.name,
                func.count(Footprint.id)
            ).join(Footprint, Location.id == Footprint.location_id)
            .group_by(Location.id)
            .order_by(desc(func.count(Footprint.id)))
            .all()
        ),
    }


@router.delete("/footprints/{footprint_id}")
def delete_footprint(footprint_id: int, db: Session = Depends(get_db)):
    """删除打卡记录"""
    footprint = db.query(Footprint).filter(Footprint.id == footprint_id).first()
    if not footprint:
        raise HTTPException(status_code=404, detail="Footprint not found")
    
    db.delete(footprint)
    db.commit()
    
    return {"ok": True, "message": "Footprint deleted"}


def _generate_slug_from_name(name: str) -> str:
    """从景点名称生成slug"""
    # 简单的slug生成：转换为拼音或英文，用-连接
    name = str(name or "").strip()
    if not name:
        return "location"
    
    # 移除特殊字符，保留中文、数字、字母
    slug = re.sub(r'[^\w\u4e00-\u9fff]', '-', name)
    slug = re.sub(r'-+', '-', slug).strip('-').lower()
    
    # 直接用中文拼音的首字母或英文
    # 如果包含中文，则使用transliterate的简单方式
    # 这里我们使用一个映射表
    if any('\u4e00' <= c <= '\u9fff' for c in slug):
        # 简化处理：直接转换为拼音缩写或代码
        result = ""
        for c in slug:
            if '\u4e00' <= c <= '\u9fff':
                # 中文字符 - 使用简单的pinyin近似
                result += c  # 保留中文
            elif c.isalnum() or c == '-':
                result += c
        slug = result
    
    if not slug or slug == '-':
        slug = 'location'
    
    return slug[:50]  # 限制长度


def _extract_json_candidates(raw_text: str) -> list[Any]:
    text = str(raw_text or "").strip()
    if not text:
        return []

    candidates: list[str] = [text]
    fenced = re.findall(r"```(?:json)?\s*([\s\S]*?)\s*```", text, flags=re.IGNORECASE)
    candidates.extend([item.strip() for item in fenced if item.strip()])

    array_match = re.search(r"\[[\s\S]*\]", text)
    if array_match:
        candidates.append(array_match.group(0).strip())

    # Attempt to wrap separated objects in an array if not present
    if "{" in text and "}" in text and not array_match:
        # find all separate JSON objects and wrap them properly
        objects = re.findall(r"\{[\s\S]*?\}", text)
        if objects:
            candidates.append("[" + ",".join(objects) + "]")

    object_match = re.search(r"\{[\s\S]*\}", text)
    if object_match:
        candidates.append(object_match.group(0).strip())

    parsed_results: list[Any] = []
    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
            parsed_results.append(parsed)
        except Exception:
            continue
    return parsed_results


def _split_text_for_ai(file_content: str, max_chars: int = 9000) -> list[str]:
    text = str(file_content or "").strip()
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]

    parts = re.split(r"\n\s*\n+", text)
    chunks: list[str] = []
    current = ""
    for part in parts:
        block = part.strip()
        if not block:
            continue
        candidate = f"{current}\n\n{block}".strip() if current else block
        if len(candidate) <= max_chars:
            current = candidate
            continue

        if current:
            chunks.append(current)
            current = ""

        while len(block) > max_chars:
            chunks.append(block[:max_chars])
            block = block[max_chars:]
        current = block

    if current:
        chunks.append(current)
    return chunks


def _split_dense_text_for_ai(file_content: str, max_chars: int = 1800, min_chunk_chars: int = 300) -> list[str]:
    """针对连续长文（缺少空行）进行二次切分，提升多景点识别率。"""
    text = str(file_content or "").strip()
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]

    # 先按常见句读切分，再按长度聚合。
    units = [u.strip() for u in re.split(r"[。！？!?；;\n]+", text) if u.strip()]
    if not units:
        return _split_text_for_ai(text, max_chars=max_chars)

    chunks: list[str] = []
    current = ""
    for unit in units:
        candidate = f"{current}。{unit}" if current else unit
        if len(candidate) <= max_chars:
            current = candidate
            continue

        if current:
            chunks.append(current)
        current = unit

        # 单句过长时硬切，避免整段被截断遗漏。
        while len(current) > max_chars:
            chunks.append(current[:max_chars])
            current = current[max_chars:]

    if current:
        chunks.append(current)

    # 过短片段向前合并，避免上下文不足导致抽取不稳定。
    merged: list[str] = []
    for chunk in chunks:
        if merged and len(chunk) < min_chunk_chars and len(merged[-1]) + len(chunk) + 1 <= max_chars:
            merged[-1] = f"{merged[-1]}。{chunk}"
        else:
            merged.append(chunk)
    return merged


def _guess_category_from_text(*values: str) -> str:
    text = " ".join([str(v or "") for v in values]).lower()
    nature_keywords = [
        "湖", "山", "岛", "峡谷", "瀑布", "湿地", "森林", "草海", "自然", "日出", "日落", "徒步", "风景", "shore", "lake", "mountain", "island", "nature", "scenic",
    ]
    culture_keywords = [
        "文化", "博物馆", "古镇", "寺", "庙", "遗址", "历史", "民俗", "非遗", "摩梭", "展览", "人文", "architecture", "museum", "culture", "history", "heritage", "temple",
    ]
    nature_score = sum(1 for kw in nature_keywords if kw in text)
    culture_score = sum(1 for kw in culture_keywords if kw in text)
    return "nature" if nature_score > culture_score else "culture"


def _normalize_ai_location_item(item: Any) -> dict | None:
    if not isinstance(item, dict):
        return None

    name = str(item.get("name") or "").strip()
    if not name:
        return None

    description = str(item.get("description") or name).strip()
    introduction = str(item.get("introduction") or description).strip()
    tags = item.get("tags") if isinstance(item.get("tags"), list) else []
    highlights = item.get("highlights") if isinstance(item.get("highlights"), list) else []

    category_raw = str(item.get("category") or "").strip().lower()
    if category_raw not in {"nature", "culture"}:
        category_raw = _guess_category_from_text(name, description, introduction, " ".join([str(t) for t in tags]))

    try:
        latitude = float(item.get("latitude"))
    except Exception:
        latitude = 27.7248

    try:
        longitude = float(item.get("longitude"))
    except Exception:
        longitude = 100.7752

    return {
        "name": name,
        "slug": str(item.get("slug") or _generate_slug_from_name(name)).strip() or _generate_slug_from_name(name),
        "category": category_raw,
        "latitude": latitude,
        "longitude": longitude,
        "description": description,
        "introduction": introduction,
        "highlights": [str(x).strip() for x in highlights if str(x).strip()][:5],
        "bestSeasonToVisit": str(item.get("bestSeasonToVisit") or "全年").strip() or "全年",
        "recommendedDuration": str(item.get("recommendedDuration") or "1-2天").strip() or "1-2天",
        "accommodationTips": str(item.get("accommodationTips") or "").strip(),
        "province": str(item.get("province") or "").strip(),
        "city": str(item.get("city") or "").strip(),
        "district": str(item.get("district") or "").strip(),
        "address": str(item.get("address") or name).strip(),
        "ticketPrice": int(item.get("ticketPrice") or 0),
        "tags": [str(x).strip() for x in tags if str(x).strip()][:8],
    }


def _call_dashscope_for_locations(chunk_text: str, known_names: list[str]) -> list[dict]:
    if not settings.dashscope_api_key:
        return []

    prompt = (
        "你是旅游数据结构化助手。请从输入文本中识别全部景点，可能有多个，必须完整提取。\n"
        "输出只能是 JSON 数组，不要 markdown、不要解释。\n"
        "每项包含必须字段：name, slug, category(nature/culture), latitude, longitude, description, introduction, highlights, "
        "bestSeasonToVisit, recommendedDuration, accommodationTips, province, city, district, address, ticketPrice, tags。\n"
        "非常重要：不能只提取部分内容！若坐标、地址、交通、推荐时长、高亮点等某些字段在文本中缺失，请根据你的知识库常识自动补全（默认泸沽湖周边等），绝不可留空、写未知或省略该字段。\n"
        f"已识别过的景点名（避免重复）: {json.dumps(known_names, ensure_ascii=False)}。\n"
        "输入文本：\n"
        f"{chunk_text}"
    )

    request_payload = {
        "model": settings.dashscope_model,
        "input": {
            "messages": [
                {
                    "role": "user",
                    "content": [{"text": prompt}],
                }
            ]
        },
        "parameters": {"result_format": "message"},
    }

    for _ in range(2):
        try:
            resp = requests.post(
                "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
                headers={
                    "Authorization": f"Bearer {settings.dashscope_api_key}",
                    "Content-Type": "application/json",
                },
                json=request_payload,
                timeout=60,
            )
            resp.raise_for_status()
            payload = resp.json()
            text = (
                payload.get("output", {})
                .get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
            )

            normalized: list[dict] = []
            for parsed in _extract_json_candidates(text):
                if isinstance(parsed, dict):
                    parsed = [parsed]
                if not isinstance(parsed, list):
                    continue
                for item in parsed:
                    normalized_item = _normalize_ai_location_item(item)
                    if normalized_item:
                        normalized.append(normalized_item)
                if normalized:
                    return normalized
            continue
        except Exception as exc:
            error_code = ""
            error_message = ""
            if isinstance(exc, requests.HTTPError) and exc.response is not None:
                try:
                    err = exc.response.json()
                    if isinstance(err, dict):
                        error_code = str(err.get("code") or "")
                        error_message = str(err.get("message") or "")
                except Exception:
                    pass

            if (
                error_code == "InvalidParameter"
                and "url error" in error_message.lower()
                and request_payload.get("model") != "qwen-plus"
            ):
                request_payload["model"] = "qwen-plus"
                continue

            logger.error("DashScope 景点抽取失败: %s", exc)
            return []

    return []


def _parse_locations_from_file_with_ai(file_content: str) -> list[dict]:
    """使用AI解析文件内容并提取景点信息"""

    try:
        chunks = _split_text_for_ai(file_content)
        if not chunks:
            return []

        merged: list[dict] = []
        seen_names: set[str] = set()

        def _merge_items(items: list[dict]) -> None:
            for item in items:
                normalized = _normalize_ai_location_item(item)
                if not normalized:
                    continue
                name_key = normalized["name"].strip().lower()
                if not name_key or name_key in seen_names:
                    continue
                seen_names.add(name_key)
                merged.append(normalized)

        for chunk in chunks:
            extracted = _call_dashscope_for_locations(chunk, sorted(seen_names))
            _merge_items(extracted)

            # 若大块只抽到 0/1 个，通常是模型漏提，执行细粒度二次抽取。
            if len(extracted) <= 1 and len(chunk) > 600:
                sub_chunks = _split_dense_text_for_ai(chunk)
                if len(sub_chunks) > 1:
                    for sub_chunk in sub_chunks:
                        sub_extracted = _call_dashscope_for_locations(sub_chunk, sorted(seen_names))
                        _merge_items(sub_extracted)

        return merged
    except Exception as e:
        logger.error(f"AI解析文件失败: {e}")
        return []


def _clean_location_name(raw_name: str) -> str:
    name = re.sub(r"\s+", " ", str(raw_name or "").strip())
    name = re.sub(r"^[\-\*•#\d\s\.、\)\(]+", "", name)
    name = re.sub(r"[：:].*$", "", name).strip()
    return name


def _extract_candidate_location_names_from_text(file_text: str, max_count: int = 50) -> list[str]:
    text = str(file_text or "")
    if not text.strip():
        return []

    stop_words = {
        "景点", "景点介绍", "景点列表", "路线", "行程", "交通", "住宿", "美食", "注意事项", "总结", "推荐", "参考", "目录"
    }
    candidates: list[str] = []

    patterns = [
        r"(?m)^\s*#{1,6}\s*([^\n#]{2,40})$",
        r"(?m)^\s*(?:\d+[\.|、|\)]|[一二三四五六七八九十]+[、\.])\s*([^\n]{2,40})$",
        r"(?m)^\s*(?:[-*•])\s*([^\n]{2,40})$",
        r"(?m)^\s*【([^】]{2,40})】\s*$",
    ]

    for pattern in patterns:
        for match in re.findall(pattern, text):
            name = _clean_location_name(match)
            if len(name) < 2 or len(name) > 30:
                continue
            if name in stop_words:
                continue
            if any(token in name for token in ["http://", "https://", "@", "。", "；", ","]):
                continue
            candidates.append(name)

    # 当文本是“景点A、景点B、景点C”这类逗号分隔写法时，补充一次行内提取。
    for line in text.splitlines():
        line = line.strip()
        if not line or len(line) > 120:
            continue
        if "、" not in line:
            continue
        parts = [p.strip() for p in re.split(r"[、/|,，]", line) if p.strip()]
        if 2 <= len(parts) <= 8:
            for part in parts:
                name = _clean_location_name(part)
                if 2 <= len(name) <= 20 and name not in stop_words:
                    candidates.append(name)

    deduped: list[str] = []
    seen: set[str] = set()
    for name in candidates:
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(name)
        if len(deduped) >= max_count:
            break
    return deduped


def _build_locations_from_text_fallback(file_text: str, file_name: str = "") -> list[dict]:
    names = _extract_candidate_location_names_from_text(file_text)
    if not names:
        return []

    base_text = str(file_text or "")
    items: list[dict] = []
    for name in names:
        snippet = ""
        idx = base_text.find(name)
        if idx >= 0:
            start = max(0, idx - 80)
            end = min(len(base_text), idx + 220)
            snippet = re.sub(r"\s+", " ", base_text[start:end]).strip()

        description = snippet or f"从文件 {file_name or '未知文件'} 识别到景点：{name}"
        category = _guess_category_from_text(name, description)
        items.append(
            {
                "name": name,
                "slug": _generate_slug_from_name(name),
                "category": category,
                "latitude": 27.7248,
                "longitude": 100.7752,
                "description": description,
                "introduction": description,
                "highlights": ["由文本规则识别，建议后续补充详情"],
                "bestSeasonToVisit": "全年",
                "recommendedDuration": "1-2小时",
                "accommodationTips": "建议根据行程选择周边住宿",
                "province": "云南省",
                "city": "丽江市",
                "district": "宁蒗县",
                "address": name,
                "ticketPrice": 0,
                "tags": ["文件导入", "规则识别"],
            }
        )
    return items

def _generate_next_location_id(db: Session, offset: int = 0) -> int:
    """生成下一个景点ID"""
    db_max_id = db.query(func.max(Location.id)).scalar() or 0

    kb_max_id = 0
    index_path = KB_PATH / "locations" / "index.json"
    if index_path.exists():
        try:
            with index_path.open("r", encoding="utf-8") as f:
                index_data = json.load(f)
            entries = index_data.get("locations", []) if isinstance(index_data, dict) else []
            for item in entries:
                try:
                    kb_max_id = max(kb_max_id, int((item or {}).get("id") or 0))
                except Exception:
                    continue
        except Exception:
            pass

    return max(db_max_id, kb_max_id) + 1 + offset


def _write_location_to_kb(location_data: dict, db: Session, extracted_images: list[bytes] | None = None, offset: int = 0) -> tuple[bool, str]:
    """将景点信息写入知识库"""
    try:
        name = location_data.get("name", "").strip()
        if not name:
            return False, "景点名称不能为空"
        
        # 生成ID和slug
        next_id = _generate_next_location_id(db, offset)
        slug = location_data.get("slug", _generate_slug_from_name(name))
        
        # 创建景点目录
        location_dir = KB_PATH / "locations" / slug
        location_dir.mkdir(parents=True, exist_ok=True)

        # 创建/复用 images 目录，尽量保留既有图片
        images_dir = location_dir / "images"
        images_dir.mkdir(exist_ok=True)

        # 将 PDF 抽取到的图片导入为 webp，按内容哈希去重
        imported_image_count = 0
        for image_bytes in extracted_images or []:
            try:
                with Image.open(io.BytesIO(image_bytes)) as source_image:
                    normalized = source_image.convert("RGB")
                    image_buffer = io.BytesIO()
                    normalized.save(image_buffer, format="WEBP", quality=90)
                normalized_bytes = image_buffer.getvalue()
            except Exception:
                continue

            digest = hashlib.sha1(normalized_bytes).hexdigest()[:16]
            image_name = f"imported-{digest}.webp"
            image_path = images_dir / image_name
            if image_path.exists():
                continue

            with image_path.open("wb") as image_file:
                image_file.write(normalized_bytes)
            imported_image_count += 1

        image_files = sorted(
            [
                p.name
                for p in images_dir.iterdir()
                if p.is_file() and p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"}
            ]
        )
        
        # 生成完整的景点信息JSON
        info_json = {
            "id": next_id,
            "name": name,
            "slug": slug,
            "category": _normalize_category(location_data.get("category", "culture")),
            "latitude": float(location_data.get("latitude", 0)),
            "longitude": float(location_data.get("longitude", 0)),
            "description": location_data.get("description", name),
            "details": {
                "introduction": location_data.get("introduction", location_data.get("description", name)),
                "highlights": location_data.get("highlights", []),
                "bestSeasonToVisit": location_data.get("bestSeasonToVisit", "全年"),
                "recommendedDuration": location_data.get("recommendedDuration", "1-2天"),
                "accommodationTips": location_data.get("accommodationTips", ""),
            },
            "sections": {
                "highlightsTitle": "景点亮点",
                "galleryTitle": "景点图片",
                "visitInfoTitle": "游览信息",
                "locationTitle": "位置信息",
                "transportationTitle": "交通方式",
                "facilitiesTitle": "设施服务",
                "ticketTitle": "票价信息"
            },
            "location": {
                "province": location_data.get("province", ""),
                "city": location_data.get("city", ""),
                "district": location_data.get("district", ""),
                "address": location_data.get("address", name),
            },
            "transportation": {
                "byAir": "",
                "byTrain": "",
                "byBus": "",
            },
            "facilities": {
                "parking": True,
                "restroom": True,
                "foodAndDrink": True,
                "accommodation": True,
                "medicalService": False,
            },
            "ticketInfo": {
                "price": int(location_data.get("ticketPrice", 0)),
                "currency": "CNY",
                "validDays": 1,
                "remark": "票价可能根据季节或政策调整"
            },
            "contact": {
                "phone": "",
                "website": ""
            },
            "tags": location_data.get("tags", []),
            "images": {
                "count": len(image_files),
                "basePath": "images/",
                "files": image_files
            },
            "audioUrl": "",
            "lastUpdated": datetime.now().strftime("%Y-%m-%d")
        }
        
        # 写入info.json
        info_path = location_dir / "info.json"
        with info_path.open("w", encoding="utf-8") as f:
            json.dump(info_json, f, ensure_ascii=False, indent=2)
        
        # 更新locations/index.json
        index_path = KB_PATH / "locations" / "index.json"
        try:
            with index_path.open("r", encoding="utf-8") as f:
                index_data = json.load(f)
        except Exception:
            index_data = {"version": "1.0.0", "locations": []}
        
        # 检查是否已存在
        if not any(item.get("slug") == slug for item in index_data.get("locations", [])):
            if "locations" not in index_data:
                index_data["locations"] = []
            index_data["locations"].append({
                "slug": slug,
                "id": next_id,
                "name": name
            })
        
        index_data["lastUpdated"] = datetime.now().strftime("%Y-%m-%d")
        
        with index_path.open("w", encoding="utf-8") as f:
            json.dump(index_data, f, ensure_ascii=False, indent=2)
        
        if imported_image_count > 0:
            return True, f"景点 '{name}' (ID: {next_id}) 已添加到知识库，并导入 {imported_image_count} 张图片"
        return True, f"景点 '{name}' (ID: {next_id}) 已添加到知识库"
        
    except Exception as e:
        if isinstance(e, OSError) and getattr(e, "errno", None) == errno.EROFS:
            logger.error("写入知识库失败（只读文件系统）: %s", e)
            return False, "写入知识库失败：knowledge-base 当前为只读挂载，请将后端容器的 /knowledge-base 挂载改为可写"
        logger.error(f"写入知识库失败: {e}")
        return False, f"写入知识库失败: {str(e)}"


def _extract_text_and_images_from_pdf(file_bytes: bytes) -> tuple[str, list[bytes]]:
    """从 PDF 文件中提取文本和内嵌图片"""
    try:
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        text_parts = []
        image_parts: list[bytes] = []
        seen_hashes: set[str] = set()

        for page_num in range(len(pdf_reader.pages)):
            page = pdf_reader.pages[page_num]
            text = page.extract_text()
            if text:
                text_parts.append(text)

            page_images = getattr(page, "images", None) or []
            for image_file in page_images:
                raw_image_bytes = getattr(image_file, "data", None)
                if not raw_image_bytes:
                    continue

                image_hash = hashlib.sha1(raw_image_bytes).hexdigest()
                if image_hash in seen_hashes:
                    continue
                seen_hashes.add(image_hash)
                image_parts.append(raw_image_bytes)

        return "\n".join(text_parts), image_parts
    except Exception as e:
        logger.error(f"PDF 内容提取失败: {e}")
        return "", []

@router.post("/locations/import-from-file")
async def import_locations_from_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    上传文件并使用AI自动解析并生成景点信息写入知识库
    
    支持文本格式：txt, md, pdf等
    返回：生成的景点列表和结果
    """
    try:
        # 读取文件内容
        content = await file.read()
        extracted_images: list[bytes] = []
        # 根据文件类型提取文本
        file_name = file.filename or ""
        if file_name.lower().endswith(".pdf"):
            # PDF 文件处理（文本 + 内嵌图片）
            file_text, extracted_images = _extract_text_and_images_from_pdf(content)
            # 图片型PDF可能没有可提取文本：只要图片存在也允许继续导入流程。
            if not file_text.strip() and not extracted_images:
                raise HTTPException(status_code=400, detail="PDF 文件无法提取文本，请确保是有效的 PDF 文件")
        else:
            # 文本文件处理
            try:
                file_text = content.decode("utf-8")
            except UnicodeDecodeError:
                file_text = content.decode("gbk", errors="ignore")

        if not file_text.strip() and not extracted_images:
            raise HTTPException(status_code=400, detail="文件内容为空")
        
        # 使用AI解析文件
        locations = _parse_locations_from_file_with_ai(file_text)

        # AI失败时，使用规则兜底提取多个景点名称，避免“0个导入”。
        if not locations and file_text.strip():
            locations = _build_locations_from_text_fallback(file_text, file_name=file_name)

        # 图片型PDF若无法解析出结构化景点，回退为最小可用景点，确保图片可入库。
        if not locations and extracted_images:
            fallback_name = (Path(file_name).stem or "景点").strip()[:40] or "景点"
            locations = [
                {
                    "name": fallback_name,
                    "slug": _generate_slug_from_name(fallback_name),
                    "category": "culture",
                    "latitude": 27.7248,
                    "longitude": 100.7752,
                    "description": f"从文件 {file_name or '未知文件'} 导入的图文资料",
                    "introduction": "该景点由管理员上传文件自动创建，建议后续在管理后台补充完整信息。",
                    "highlights": ["图片资料已导入"],
                    "bestSeasonToVisit": "全年",
                    "recommendedDuration": "1-2小时",
                    "accommodationTips": "建议根据行程选择周边住宿",
                    "province": "云南省",
                    "city": "丽江市",
                    "district": "宁蒗县",
                    "address": "待补充",
                    "ticketPrice": 0,
                    "tags": ["文件导入"],
                }
            ]

        if not locations:
            raise HTTPException(
                status_code=400,
                detail="未能从文件中提取到景点信息，请确保文件包含可识别的景点名称（可使用标题/编号列表）"
            )
        
        # 逐个写入知识库
        results = []
        for i, location_data in enumerate(locations):
            success, message = _write_location_to_kb(location_data, db, extracted_images=extracted_images, offset=i)
            results.append({
                "name": location_data.get("name"),
                "success": success,
                "message": message
            })
        
        db.commit()
        
        return {
            "ok": True,
            "total": len(locations),
            "results": results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"文件导入失败: {e}")
        raise HTTPException(status_code=500, detail=f"文件导入失败: {str(e)}")
