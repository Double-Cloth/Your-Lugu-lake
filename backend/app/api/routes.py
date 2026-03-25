from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.ai_route import AIRoute
from app.models.location import Location
from app.models.user import User
from app.schemas.route import RouteGenerateRequest, RouteGenerateResponse, ChatRequest, ChatResponse
from app.services.llm_service import generate_route as generate_route_via_llm, chat as chat_via_llm

router = APIRouter(prefix="/api/routes", tags=["routes"])


@router.post("/generate", response_model=RouteGenerateResponse)
def generate_route(
    payload: RouteGenerateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    locations = db.query(Location).all()
    try:
        route_json = generate_route_via_llm(payload.model_dump(), locations)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    record = AIRoute(user_id=user.id, route_json=route_json, created_at=datetime.utcnow())
    db.add(record)
    db.commit()

    return RouteGenerateResponse(route=route_json)


@router.post("/chat", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """通用AI对话端点，支持自定义系统提示词"""
    try:
        reply = chat_via_llm(payload.message, payload.system_prompt)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    return ChatResponse(reply=reply)
