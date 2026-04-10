from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import csrf_protect, get_current_user
from app.db.session import get_db
from app.models.user_tracking_state import UserTrackingState
from app.models.user import User
from app.schemas.tracking import TrackingStateResponse, TrackingStateUpdateRequest
from app.services.tracking_state_service import TRACK_POINTS_LIMIT, merge_track_points, normalize_track_points

router = APIRouter(prefix="/api/tracking", tags=["tracking"], dependencies=[Depends(csrf_protect)])


def _normalize_tracking_state(state_json: dict | None) -> dict:
    source = state_json if isinstance(state_json, dict) else {}
    gps = source.get("gps") if isinstance(source.get("gps"), dict) else {}
    track_points_source = source.get("track_points") if isinstance(source.get("track_points"), list) else source.get("trackPoints")
    normalized_points = normalize_track_points(track_points_source)

    return {
        "tracking": bool(source.get("tracking", False)),
        "gps": {
            "lat": str(gps.get("lat") or ""),
            "lon": str(gps.get("lon") or ""),
        },
        "track_points": normalized_points[-TRACK_POINTS_LIMIT:],
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
    current_state = _normalize_tracking_state(row.state_json)

    incoming_points = normalize_track_points([
        {
            "lat": point.lat,
            "lon": point.lon,
            "t": point.t,
        }
        for point in payload.track_points
    ])

    incoming_lat = str(payload.gps.lat or "").strip()
    incoming_lon = str(payload.gps.lon or "").strip()
    next_gps = {
        "lat": incoming_lat if incoming_lat else str(current_state["gps"].get("lat") or ""),
        "lon": incoming_lon if incoming_lon else str(current_state["gps"].get("lon") or ""),
    }

    next_state = {
        "tracking": bool(payload.tracking),
        "gps": next_gps,
        "track_points": (
            incoming_points[-TRACK_POINTS_LIMIT:]
            if payload.replace_track_points
            else merge_track_points(current_state["track_points"], incoming_points)
        ),
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