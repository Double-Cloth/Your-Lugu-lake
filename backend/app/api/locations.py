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
    location = Location(**payload.model_dump())
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
