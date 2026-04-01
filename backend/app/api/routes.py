from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import csrf_protect, get_current_user
from app.db.session import get_db
from app.models.ai_route import AIRoute
from app.models.chat import ChatMessage, ChatSession
from app.models.location import Location
from app.models.user import User
from app.schemas.route import (
    ChatHistoryResponse,
    ChatMessageItem,
    ChatRequest,
    ChatResponse,
    ChatSessionItem,
    RouteGenerateRequest,
    RouteGenerateResponse,
    SavedRouteItem,
    SavedRoutesResponse,
)
from app.services.llm_service import generate_route as generate_route_via_llm, chat as chat_via_llm

router = APIRouter(prefix="/api/routes", tags=["routes"], dependencies=[Depends(csrf_protect)])


def _build_chat_title(text: str) -> str:
    normalized = text.strip()
    if not normalized:
        return "新对话"
    return f"{normalized[:18]}..." if len(normalized) > 18 else normalized


def _normalize_route_json(route_json: dict | None, requirement: dict | None, created_at: datetime | None) -> dict:
    base = route_json if isinstance(route_json, dict) else {}
    timeline = base.get("timeline") if isinstance(base.get("timeline"), list) else []

    requirement_payload = requirement if isinstance(requirement, dict) else {}
    requirement_text = (
        requirement_payload.get("requirement_text")
        or base.get("requirement")
        or requirement_payload.get("custom_need")
        or ""
    )

    travel_profile = base.get("travel_profile") if isinstance(base.get("travel_profile"), dict) else {}
    if requirement_payload:
        travel_profile = {
            "duration": requirement_payload.get("duration"),
            "group_type": requirement_payload.get("group_type"),
            "preference": requirement_payload.get("preference"),
            "pace": requirement_payload.get("pace"),
        }

    inspiration_template = base.get("inspiration_template") if isinstance(base.get("inspiration_template"), dict) else {}
    if requirement_payload:
        inspiration_template = {
            "id": requirement_payload.get("template_id"),
            "title": requirement_payload.get("template_title"),
        }

    generated_at = (
        base.get("generated_at")
        if isinstance(base.get("generated_at"), str) and base.get("generated_at")
        else (created_at.isoformat() if created_at else datetime.utcnow().isoformat())
    )

    return {
        **base,
        "title": base.get("title") or "AI 文化导览路线",
        "preference": base.get("preference") or requirement_payload.get("preference") or "",
        "timeline": timeline,
        "requirement": requirement_text,
        "custom_need": requirement_payload.get("custom_need") or base.get("custom_need") or "",
        "travel_profile": travel_profile,
        "inspiration_template": inspiration_template,
        "generated_at": generated_at,
    }


@router.post("/generate", response_model=RouteGenerateResponse)
def generate_route(
    payload: RouteGenerateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    locations = db.query(Location).all()
    request_payload = payload.model_dump()
    try:
        route_json = generate_route_via_llm(request_payload, locations)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    generated_at = datetime.utcnow()
    persisted_route = _normalize_route_json(route_json, request_payload, generated_at)

    record = AIRoute(user_id=user.id, route_json=persisted_route, created_at=generated_at)
    db.add(record)
    db.commit()
    db.refresh(record)

    return RouteGenerateResponse(route=persisted_route, route_id=record.id, saved=True)


@router.get("/my", response_model=SavedRoutesResponse)
def list_my_routes(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (
        db.query(AIRoute)
        .filter(AIRoute.user_id == user.id)
        .order_by(AIRoute.created_at.desc())
        .limit(50)
        .all()
    )

    return SavedRoutesResponse(
        routes=[
            SavedRouteItem(
                id=row.id,
                created_at=row.created_at,
                route=_normalize_route_json(row.route_json, None, row.created_at),
            )
            for row in rows
        ]
    )


@router.delete("/{route_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_route(
    route_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = (
        db.query(AIRoute)
        .filter(AIRoute.id == route_id, AIRoute.user_id == user.id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="路线不存在")

    db.delete(row)
    db.commit()


@router.post("/chat", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """通用AI对话端点，支持自定义系统提示词"""
    session_key = (payload.session_key or "").strip()
    session = None
    if session_key:
        session = (
            db.query(ChatSession)
            .filter(ChatSession.session_key == session_key, ChatSession.user_id == user.id)
            .first()
        )

    if session is None:
        session = ChatSession(
            session_key=session_key or uuid4().hex,
            user_id=user.id,
            title=_build_chat_title(payload.message),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(session)
        db.flush()
    elif session.title == "新对话":
        session.title = _build_chat_title(payload.message)
        
    # 获取历史上下文（最近的 10 条消息作为上下文，避免超出 token 限制）
    history_messages = []
    if session.id:
        msgs = (
            db.query(ChatMessage)
            .filter(ChatMessage.session_id == session.id)
            .order_by(ChatMessage.created_at.desc())
            .limit(10)
            .all()
        )
        # 反转为时间正序
        for msg in reversed(msgs):
            history_messages.append({"role": msg.role, "content": msg.content})

    db.add(
        ChatMessage(
            session_id=session.id,
            role="user",
            content=payload.message,
            created_at=datetime.utcnow(),
        )
    )

    try:
        scene_context = payload.scene_context.model_dump() if payload.scene_context else None
        reply, references = chat_via_llm(payload.message, payload.system_prompt, scene_context, history_messages)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    db.add(
        ChatMessage(
            session_id=session.id,
            role="assistant",
            content=reply,
            created_at=datetime.utcnow(),
        )
    )
    session.updated_at = datetime.utcnow()
    db.commit()

    return ChatResponse(reply=reply, session_key=session.session_key, references=references)


@router.get("/chat/history", response_model=ChatHistoryResponse)
def chat_history(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == user.id)
        .order_by(ChatSession.updated_at.desc())
        .all()
    )
    if not sessions:
        return ChatHistoryResponse(sessions=[])

    session_ids = [item.id for item in sessions]
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id.in_(session_ids))
        .order_by(ChatMessage.created_at.asc())
        .all()
    )

    messages_by_session: dict[int, list[ChatMessageItem]] = {}
    for message in messages:
        messages_by_session.setdefault(message.session_id, []).append(
            ChatMessageItem(
                id=message.id,
                role=message.role,
                content=message.content,
                created_at=message.created_at,
            )
        )

    return ChatHistoryResponse(
        sessions=[
            ChatSessionItem(
                session_key=item.session_key,
                title=item.title,
                created_at=item.created_at,
                updated_at=item.updated_at,
                messages=messages_by_session.get(item.id, []),
            )
            for item in sessions
        ]
    )


@router.delete("/chat/history/{session_key}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chat_history(
    session_key: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session = (
        db.query(ChatSession)
        .filter(ChatSession.session_key == session_key, ChatSession.user_id == user.id)
        .first()
    )
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="会话不存在")

    db.query(ChatMessage).filter(ChatMessage.session_id == session.id).delete()
    db.delete(session)
    db.commit()
