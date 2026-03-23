from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.ai_route import AIRoute
from app.models.location import Location
from app.models.user import User
from app.schemas.route import RouteGenerateRequest, RouteGenerateResponse
from app.services.llm_service import generate_route_with_fallback

router = APIRouter(prefix="/api/routes", tags=["routes"])


@router.post("/generate", response_model=RouteGenerateResponse)
def generate_route(
    payload: RouteGenerateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    locations = db.query(Location).all()
    route_json = generate_route_with_fallback(payload.model_dump(), locations)

    record = AIRoute(user_id=user.id, route_json=route_json, created_at=datetime.utcnow())
    db.add(record)
    db.commit()

    return RouteGenerateResponse(route=route_json)
