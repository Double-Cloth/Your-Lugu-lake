from pydantic import BaseModel


class RouteGenerateRequest(BaseModel):
    duration: str
    preference: str
    group_type: str


class RouteGenerateResponse(BaseModel):
    route: dict
