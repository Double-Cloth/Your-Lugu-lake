from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import json
from pathlib import Path

from app.api.deps import csrf_protect, require_admin
from app.db.session import get_db
from app.models.location import Location
from app.schemas.location import LocationCreate, LocationOut, LocationUpdate

router = APIRouter(prefix="/api/locations", tags=["locations"])
admin_router = APIRouter(prefix="/api/admin/locations", tags=["admin-locations"])

# 知识库路径配置
KB_PATH = Path("/app/knowledge-base")  # Docker 环境
if not KB_PATH.exists():
    KB_PATH = Path(__file__).resolve().parents[3] / "knowledge-base"  # 本地开发环境


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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error loading knowledge base location: {str(e)}"
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
def delete_location(location_id: int, db: Session = Depends(get_db)):
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")

    db.delete(location)
    db.commit()
    return {"ok": True}
