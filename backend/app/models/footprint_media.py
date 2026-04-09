from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class FootprintMedia(Base):
    __tablename__ = "footprint_media"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    footprint_id: Mapped[int] = mapped_column(ForeignKey("footprints.id", ondelete="CASCADE"), index=True)
    media_url: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
