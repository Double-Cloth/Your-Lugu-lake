from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
import json
from pathlib import Path
import shutil
from datetime import datetime

from app.api.deps import csrf_protect, require_admin
from app.core.config import settings
from app.db.session import get_db
from app.models.footprint import Footprint
from app.models.location import Location
from app.models.qrcode import QrCode
from app.schemas.location import LocationCreate, LocationOut, LocationUpdate

router = APIRouter(prefix="/api/locations", tags=["locations"])
admin_router = APIRouter(prefix="/api/admin/locations", tags=["admin-locations"])

def _resolve_kb_path() -> Path:
    """Resolve knowledge-base path for docker and local deployments."""
    candidates = [
        Path("/knowledge-base"),
        Path("/app/knowledge-base"),
        Path(__file__).resolve().parents[3] / "knowledge-base",
    ]
    for path in candidates:
        if path.exists() and path.is_dir():
            return path
    return candidates[0]


# 知识库路径配置
KB_PATH = _resolve_kb_path()


def _normalize_category(raw_value: str) -> str:
    value = str(raw_value or "").strip().lower()
    return value if value in {"culture", "nature"} else "culture"


def _load_kb_locations() -> list[dict]:
    index_path = KB_PATH / "locations" / "index.json"
    if not index_path.exists():
        return []

    with index_path.open("r", encoding="utf-8") as f:
        index_data = json.load(f)

    entries = index_data.get("locations") if isinstance(index_data, dict) else []
    if not isinstance(entries, list):
        return []

    result: list[dict] = []
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
            latitude = float(info.get("latitude"))
            longitude = float(info.get("longitude"))
        except Exception:
            continue

        name = str(info.get("name") or (entry or {}).get("name") or slug).strip()
        if not name:
            continue

        result.append(
            {
                "slug": slug,
                "name": name,
                "description": str(info.get("description") or "").strip(),
                "audio_url": str(info.get("audioUrl") or info.get("audio_url") or "").strip(),
                "latitude": latitude,
                "longitude": longitude,
                "category": _normalize_category(str(info.get("category") or "culture")),
            }
        )

    return result


def _delete_qrcode_file(qr_url: str) -> bool:
    normalized = str(qr_url or "").strip()
    if not normalized:
        return False

    relative_path = normalized.lstrip("/")
    if relative_path.startswith("uploads/"):
        relative_path = relative_path[len("uploads/"):]

    file_path = Path(settings.upload_dir) / relative_path
    if not file_path.exists() or not file_path.is_file():
        return False

    try:
        file_path.unlink()
        return True
    except Exception:
        return False


def _load_kb_index(index_path: Path) -> dict:
    if not index_path.exists():
        return {"version": "1.0.0", "locations": []}

    try:
        with index_path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return {"version": "1.0.0", "locations": []}
        if not isinstance(data.get("locations"), list):
            data["locations"] = []
        return data
    except Exception:
        return {"version": "1.0.0", "locations": []}


def _save_kb_index(index_path: Path, data: dict) -> None:
    data["lastUpdated"] = datetime.now().strftime("%Y-%m-%d")
    with index_path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _resolve_kb_slug_for_location(location: Location) -> str | None:
    index_path = KB_PATH / "locations" / "index.json"
    data = _load_kb_index(index_path)
    entries = data.get("locations", [])

    for entry in entries:
        if not isinstance(entry, dict):
            continue
        if entry.get("id") == location.id:
            slug = str(entry.get("slug") or "").strip()
            if slug:
                return slug

    for entry in entries:
        if not isinstance(entry, dict):
            continue
        if str(entry.get("name") or "").strip() == location.name:
            slug = str(entry.get("slug") or "").strip()
            if slug:
                return slug

    # 兜底：扫描目录读取 info.json 按名称/ID 匹配
    locations_root = KB_PATH / "locations"
    if not locations_root.exists() or not locations_root.is_dir():
        return None

    for subdir in locations_root.iterdir():
        if not subdir.is_dir():
            continue
        info_path = subdir / "info.json"
        if not info_path.exists():
            continue
        try:
            with info_path.open("r", encoding="utf-8") as f:
                info = json.load(f)
            if info.get("id") == location.id or str(info.get("name") or "").strip() == location.name:
                return subdir.name
        except Exception:
            continue

    return None


def _handle_remove_readonly(func, path, exc):
    import os
    import stat
    import errno
    excvalue = exc[1]
    if hasattr(excvalue, 'errno') and excvalue.errno == errno.EACCES:
        os.chmod(path, stat.S_IRWXU | stat.S_IRWXG | stat.S_IRWXO)  # 0777
        func(path)
    else:
        raise

def _delete_location_from_kb(location: Location, preferred_slug: str | None = None) -> dict:
    index_path = KB_PATH / "locations" / "index.json"
    data = _load_kb_index(index_path)
    slug = str(preferred_slug or "").strip() or _resolve_kb_slug_for_location(location)

    removed_index = False
    if data.get("locations"):
        original_len = len(data["locations"])
        if slug:
            data["locations"] = [
                entry
                for entry in data["locations"]
                if not (
                    isinstance(entry, dict)
                    and str(entry.get("slug") or "").strip() == slug
                )
            ]
        else:
            data["locations"] = [
                entry
                for entry in data["locations"]
                if not (
                    isinstance(entry, dict)
                    and (
                        entry.get("id") == location.id
                        or str(entry.get("name") or "").strip() == location.name
                    )
                )
            ]
        removed_index = len(data["locations"]) != original_len

    removed_dir = False
    if slug:
        target_dir = KB_PATH / "locations" / slug
        if target_dir.exists() and target_dir.is_dir():
            shutil.rmtree(target_dir, onerror=_handle_remove_readonly)
            removed_dir = True

    # 始终在确有变化或者目录发生删除时进行回写处理（防止只删部分失败的情况）
    if removed_index:
        _save_kb_index(index_path, data)

    return {
        "slug": slug,
        "removed_index": removed_index,
        "removed_dir": removed_dir,
    }


@router.get("", response_model=list[LocationOut])
def list_locations(db: Session = Depends(get_db)):
    return db.query(Location).order_by(Location.id.asc()).all()


@router.get("/knowledge-base/{slug}")
def get_knowledge_base_location(slug: str):
    """
    获取知识库景点详细信息
    
    Args:
        slug: 景点标识 (如 'lugu-lake')
    
    Returns:
        景点详细信息 JSON
    """
    try:
        info_path = KB_PATH / "locations" / slug / "info.json"
        if not info_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail=f"Knowledge base location not found: {slug}"
            )
        
        with open(info_path, "r", encoding="utf-8") as f:
            location_data = json.load(f)
        
        return location_data
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid JSON in knowledge base location: {slug}"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error loading knowledge base location: {str(e)}"
        )


@router.get("/knowledge-base/index")
def get_knowledge_base_locations_index():
    """Return knowledge-base locations index for frontend fallback in deployment."""
    index_path = KB_PATH / "locations" / "index.json"
    if not index_path.exists():
        return {"version": "1.0.0", "locations": []}

    try:
        with index_path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return {"version": "1.0.0", "locations": []}
        if not isinstance(data.get("locations"), list):
            data["locations"] = []
        return data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error loading knowledge base index: {str(e)}",
        )


@router.get("/knowledge-base/{slug}/images")
def get_knowledge_base_location_images(slug: str):
    """
    获取知识库景点的图片列表
    
    Args:
        slug: 景点标识
    
    Returns:
        图片文件名列表
    """
    try:
        images_path = KB_PATH / "locations" / slug / "images"
        if not images_path.exists():
            return {"images": []}
        
        image_files = sorted([
            f.name for f in images_path.iterdir()
            if f.is_file() and f.suffix.lower() in ['.jpg', '.jpeg', '.png', '.webp']
        ])
        
        return {
            "slug": slug,
            "images": image_files,
            "basePath": f"/knowledge-base/locations/{slug}/images/"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error loading images for location: {str(e)}"
        )


@router.get("/{location_id}", response_model=LocationOut)
def get_location(location_id: int, db: Session = Depends(get_db)):
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")
    return location


@admin_router.post("", response_model=LocationOut, dependencies=[Depends(require_admin), Depends(csrf_protect)])
def create_location(payload: LocationCreate, db: Session = Depends(get_db)):
    # 严格遵守 knowledge-base：只允许创建知识库中存在的景点，且字段以知识库为准。
    kb_locations = _load_kb_locations()
    target_name = str(payload.name or "").strip()
    match = next((item for item in kb_locations if item["name"] == target_name), None)
    if not match:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="景点必须来自 knowledge-base，请先同步知识库景点。",
        )

    existing = db.query(Location).filter(Location.name == match["name"]).first()
    if existing:
        existing.description = match["description"] or existing.description
        existing.audio_url = match["audio_url"] or existing.audio_url
        existing.latitude = match["latitude"]
        existing.longitude = match["longitude"]
        existing.category = match["category"]
        db.commit()
        db.refresh(existing)
        return existing

    location = Location(
        name=match["name"],
        description=match["description"] or match["name"],
        audio_url=match["audio_url"],
        latitude=match["latitude"],
        longitude=match["longitude"],
        category=match["category"],
        qr_code_url="",
    )
    db.add(location)
    db.commit()
    db.refresh(location)
    return location


@admin_router.put("/{location_id}", response_model=LocationOut, dependencies=[Depends(require_admin), Depends(csrf_protect)])
def update_location(location_id: int, payload: LocationUpdate, db: Session = Depends(get_db)):
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")

    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(location, key, value)

    db.commit()
    db.refresh(location)
    return location


@admin_router.delete("/{location_id}", dependencies=[Depends(require_admin), Depends(csrf_protect)])
def delete_location(
    location_id: int,
    kb_slug: str = Query(default=""),
    db: Session = Depends(get_db),
):
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")

    qr_record = db.query(QrCode).filter(QrCode.location_id == location.id).first()
    qr_urls = []
    if location.qr_code_url:
        qr_urls.append(location.qr_code_url)
    if qr_record and qr_record.qr_code_url:
        qr_urls.append(qr_record.qr_code_url)

    deleted_qr_files = 0
    for qr_url in set(qr_urls):
        if _delete_qrcode_file(qr_url):
            deleted_qr_files += 1

    # 避免外键冲突：先删除关联表，再删除景点。
    deleted_footprints = db.query(Footprint).filter(Footprint.location_id == location.id).delete()
    deleted_qrcodes = db.query(QrCode).filter(QrCode.location_id == location.id).delete()

    try:
        kb_deleted = _delete_location_from_kb(location, preferred_slug=kb_slug)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除知识库内容失败: {str(exc)}",
        )

    db.delete(location)
    db.commit()
    return {
        "ok": True,
        "deleted": {
            "location_id": location_id,
            "location_name": location.name,
            "footprints": int(deleted_footprints or 0),
            "qrcode_records": int(deleted_qrcodes or 0),
            "qrcode_files": deleted_qr_files,
            "knowledge_base": kb_deleted,
        },
    }
