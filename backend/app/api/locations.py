from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.db.session import get_db
from app.models.location import Location
from app.schemas.location import LocationCreate, LocationOut, LocationUpdate

router = APIRouter(prefix="/api/locations", tags=["locations"])
admin_router = APIRouter(prefix="/api/admin/locations", tags=["admin-locations"])


@router.get("", response_model=list[LocationOut])
def list_locations(db: Session = Depends(get_db)):
    return db.query(Location).order_by(Location.id.asc()).all()


@router.get("/{location_id}", response_model=LocationOut)
def get_location(location_id: int, db: Session = Depends(get_db)):
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")
    return location


@admin_router.post("", response_model=LocationOut, dependencies=[Depends(require_admin)])
def create_location(payload: LocationCreate, db: Session = Depends(get_db)):
    location = Location(**payload.model_dump())
    db.add(location)
    db.commit()
    db.refresh(location)
    return location


@admin_router.put("/{location_id}", response_model=LocationOut, dependencies=[Depends(require_admin)])
def update_location(location_id: int, payload: LocationUpdate, db: Session = Depends(get_db)):
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")

    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(location, key, value)

    db.commit()
    db.refresh(location)
    return location


@admin_router.delete("/{location_id}", dependencies=[Depends(require_admin)])
def delete_location(location_id: int, db: Session = Depends(get_db)):
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")

    db.delete(location)
    db.commit()
    return {"ok": True}
