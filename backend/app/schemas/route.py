from pydantic import BaseModel


class RouteGenerateRequest(BaseModel):
    duration: str
    preference: str
    group_type: str


class RouteGenerateResponse(BaseModel):
    route: dict


class ChatRequest(BaseModel):
    message: str
    system_prompt: str | None = None


class ChatResponse(BaseModel):
    reply: str
