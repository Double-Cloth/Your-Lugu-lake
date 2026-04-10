from datetime import datetime

from pydantic import BaseModel, Field


class TrackingGpsState(BaseModel):
    lat: str = ""
    lon: str = ""


class TrackingPoint(BaseModel):
    lat: float
    lon: float
    t: int | None = None


class TrackingStateBase(BaseModel):
    tracking: bool = False
    gps: TrackingGpsState = Field(default_factory=TrackingGpsState)
    track_points: list[TrackingPoint] = Field(default_factory=list)
    replace_track_points: bool = False


class TrackingStateUpdateRequest(TrackingStateBase):
    pass


class TrackingStateResponse(TrackingStateBase):
    updated_at: datetime | None = None