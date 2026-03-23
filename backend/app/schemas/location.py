from pydantic import BaseModel


class LocationBase(BaseModel):
    name: str
    description: str
    audio_url: str
    latitude: float
    longitude: float
    category: str
    qr_code_url: str


class LocationOut(LocationBase):
    id: int

    model_config = {"from_attributes": True}


class LocationCreate(LocationBase):
    pass


class LocationUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    audio_url: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    category: str | None = None
    qr_code_url: str | None = None
