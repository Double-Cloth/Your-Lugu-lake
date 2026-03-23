from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Footprint(Base):
    __tablename__ = "footprints"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"), index=True)
    check_in_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    gps_lat: Mapped[float] = mapped_column(Float)
    gps_lon: Mapped[float] = mapped_column(Float)
    mood_text: Mapped[str] = mapped_column(Text, default="")
    photo_url: Mapped[str] = mapped_column(String(255), default="")
