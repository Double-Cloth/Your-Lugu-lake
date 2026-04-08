from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class QrCodeCreate(BaseModel):
    location_id: int
    description: Optional[str] = ""


class QrCodeUpdate(BaseModel):
    description: Optional[str] = None
    is_active: Optional[bool] = None


class QrCodeOut(BaseModel):
    id: int
    location_id: int
    qr_code_url: str
    generated_at: datetime
    generated_by: Optional[int] = None
    description: str
    is_active: bool

    class Config:
        from_attributes = True


class UserOut(BaseModel):
    id: int
    username: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


class FootprintOut(BaseModel):
    id: int
    user_id: int
    location_id: int
    check_in_time: datetime
    gps_lat: float
    gps_lon: float
    mood_text: str
    photo_url: str

    class Config:
        from_attributes = True


class FootprintDetailOut(FootprintOut):
    user: UserOut
    
    class Config:
        from_attributes = True


class AdminDashboardStats(BaseModel):
    """管理后台统计信息"""
    users: int
    locations: int
    footprints: int
    ai_routes: int
    today_footprints: int  # 今天的打卡数
    today_checkins: int  # 今天的新游客


class UserDetailOut(BaseModel):
    """用户详细信息"""
    id: int
    username: str
    role: str
    created_at: datetime
    total_footprints: int
    total_locations_visited: int
    last_checkin: Optional[str] = None  # ISO格式时间

    class Config:
        from_attributes = True


class AdminUserUpdateIn(BaseModel):
    role: Optional[str] = None


class AdminUserResetPasswordIn(BaseModel):
    new_password: Optional[str] = None
