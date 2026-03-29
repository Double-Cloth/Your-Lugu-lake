from datetime import datetime

from sqlalchemy import DateTime, Float, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class KnowledgeVectorStoreMeta(Base):
    __tablename__ = "knowledge_vector_store_meta"

    id: Mapped[int] = mapped_column(primary_key=True)
    signature_json: Mapped[list] = mapped_column(JSON)
    idf_json: Mapped[dict] = mapped_column(JSON)
    default_idf: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class KnowledgeVectorChunk(Base):
    __tablename__ = "knowledge_vector_chunks"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    source_name: Mapped[str] = mapped_column(String(128), index=True)
    text: Mapped[str] = mapped_column(Text)
    vector_json: Mapped[dict] = mapped_column(JSON)
    norm: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
