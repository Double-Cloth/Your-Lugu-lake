import io
import json
import zipfile
from datetime import datetime, timedelta
from pathlib import Path

import qrcode
from PIL import Image, ImageDraw, ImageFont
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import and_, desc, func
from sqlalchemy.orm import Session

from app.api.deps import csrf_protect, get_current_user, require_admin
from app.core.config import settings
from app.db.session import get_db
from app.models.ai_route import AIRoute
from app.models.footprint import Footprint
from app.models.location import Location
from app.models.qrcode import QrCode
from app.models.user import User
from app.schemas.admin import AdminDashboardStats, UserDetailOut, FootprintDetailOut, UserOut, QrCodeOut

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
@router.get("/users")
def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str = Query(""),
    db: Session = Depends(get_db),
):
    """获取游客列表（分页、搜索）"""
    query = db.query(User)
    
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
                    db.query(desc(Footprint.check_in_time)).filter(Footprint.user_id == u.id).first()
                )
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
    
    footprints = db.query(Footprint).filter(Footprint.user_id == user_id).all()
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
        "footprints": [
            {
                "id": fp.id,
                "location_id": fp.location_id,
                "check_in_time": fp.check_in_time.isoformat(),
                "gps_lat": fp.gps_lat,
                "gps_lon": fp.gps_lon,
                "mood_text": fp.mood_text,
                "photo_url": fp.photo_url,
            }
            for fp in footprints
        ],
    }


@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    """删除用户和其关联的打卡记录"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
