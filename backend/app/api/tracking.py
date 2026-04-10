from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import csrf_protect, get_current_user
from app.db.session import get_db
from app.models.user_tracking_state import UserTrackingState
from app.models.user import User
from app.schemas.tracking import TrackingStateResponse, TrackingStateUpdateRequest

router = APIRouter(prefix="/api/tracking", tags=["tracking"], dependencies=[Depends(csrf_protect)])


def _normalize_tracking_state(state_json: dict | None) -> dict:
    source = state_json if isinstance(state_json, dict) else {}
    gps = source.get("gps") if isinstance(source.get("gps"), dict) else {}
    track_points_source = source.get("track_points") if isinstance(source.get("track_points"), list) else source.get("trackPoints")
    track_points = track_points_source if isinstance(track_points_source, list) else []

    normalized_points: list[dict] = []
    for point in track_points:
        if not isinstance(point, dict):
            continue
        try:
            lat = float(point.get("lat"))
            lon = float(point.get("lon"))
        except (TypeError, ValueError):
            continue
        normalized_points.append({
            "lat": lat,
            "lon": lon,
            "t": int(point.get("t")) if str(point.get("t") or "").isdigit() else None,
        })

    return {
        "tracking": bool(source.get("tracking", False)),
        "gps": {
            "lat": str(gps.get("lat") or ""),
            "lon": str(gps.get("lon") or ""),
        },
        "track_points": normalized_points[-1000:],
    }


def _get_or_create_tracking_state(db: Session, user: User) -> UserTrackingState:
    row = db.query(UserTrackingState).filter(UserTrackingState.user_id == user.id).first()
    if row is None:
        row = UserTrackingState(user_id=user.id, state_json={"tracking": False, "gps": {"lat": "", "lon": ""}, "track_points": []})
        db.add(row)
        db.flush()
    return row


@router.get("/me", response_model=TrackingStateResponse)
def get_my_tracking_state(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = _get_or_create_tracking_state(db, user)
    normalized = _normalize_tracking_state(row.state_json)
    return TrackingStateResponse(
        tracking=normalized["tracking"],
        gps=normalized["gps"],
        track_points=normalized["track_points"],
        updated_at=row.updated_at,
    )


@router.put("/me", response_model=TrackingStateResponse)
def update_my_tracking_state(
    payload: TrackingStateUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = _get_or_create_tracking_state(db, user)
    next_state = {
        "tracking": bool(payload.tracking),
        "gps": {
            "lat": payload.gps.lat,
            "lon": payload.gps.lon,
        },
        "track_points": [
            {
                "lat": point.lat,
                "lon": point.lon,
                "t": point.t if point.t is not None else int(datetime.utcnow().timestamp() * 1000),
            }
            for point in payload.track_points
        ][-1000:],
    }

    row.state_json = next_state
    row.updated_at = datetime.utcnow()
    db.add(row)
    db.commit()
    db.refresh(row)

    normalized = _normalize_tracking_state(row.state_json)
    return TrackingStateResponse(
        tracking=normalized["tracking"],
        gps=normalized["gps"],
        track_points=normalized["track_points"],
        updated_at=row.updated_at,
    )