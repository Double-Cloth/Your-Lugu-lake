from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class QrCode(Base):
    """打卡二维码模型"""
    __tablename__ = "qrcodes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"), unique=True, index=True)
    qr_code_url: Mapped[str] = mapped_column(String(255), nullable=False)  # 二维码文件路径
    qr_code_data: Mapped[str] = mapped_column(Text, nullable=False)  # 二维码包含的数据（JSON格式）
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    generated_by: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))  # 管理员ID
    description: Mapped[str] = mapped_column(Text, default="")  # 二维码描述
    is_active: Mapped[bool] = mapped_column(default=True)  # 是否激活
