from pydantic import BaseModel


class RouteGenerateRequest(BaseModel):
    duration: str
    preference: str
    group_type: str


class RouteGenerateResponse(BaseModel):
    route: dict


class SceneContext(BaseModel):
    pathname: str | None = None
    scene_type: str | None = None
    page_slug: str | None = None
    location_ref: str | None = None


class ChatRequest(BaseModel):
    message: str
    system_prompt: str | None = None
    scene_context: SceneContext | None = None


class ChatResponse(BaseModel):
    reply: str
