from pydantic import BaseModel, Field
from datetime import datetime


class RouteGenerateRequest(BaseModel):
    duration: str
    preference: str
    group_type: str
    custom_need: str | None = None
    pace: str | None = None
    template_id: str | None = None
    template_title: str | None = None
    requirement_text: str | None = None


class RouteGenerateResponse(BaseModel):
    route: dict
    route_id: int | None = None
    saved: bool = False


class SavedRouteItem(BaseModel):
    id: int
    created_at: datetime
    route: dict


class SavedRoutesResponse(BaseModel):
    routes: list[SavedRouteItem]


class SceneContext(BaseModel):
    pathname: str | None = None
    scene_type: str | None = None
    page_slug: str | None = None
    location_ref: str | None = None
    scene_label: str | None = None
    capability_hints: list[str] | None = None
    domain_hints: list[str] | None = None
    recommended_links: list[str] | None = None
    answer_style: str | None = None


class ChatRequest(BaseModel):
    message: str
    system_prompt: str | None = None
    scene_context: SceneContext | None = None
    session_key: str | None = None


class ChatReference(BaseModel):
    source_key: str
    title: str
    path: str
    kb_file: str | None = None


class ChatResponse(BaseModel):
    reply: str
    session_key: str
    references: list[ChatReference] = Field(default_factory=list)


class ChatMessageItem(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime


class ChatSessionItem(BaseModel):
    session_key: str
    title: str
    created_at: datetime
    updated_at: datetime
    messages: list[ChatMessageItem]


class ChatHistoryResponse(BaseModel):
    sessions: list[ChatSessionItem]
