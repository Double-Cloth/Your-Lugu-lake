# 🔧 后端开发完整指南

## 项目结构

```
backend/
├── app/
│   ├── main.py                 # 应用入口和中间件配置
│   ├── database.py             # 数据库连接配置
│   ├── models.py               # SQLAlchemy ORM 模型
│   ├── schemas.py              # Pydantic 验证模型
│   ├── routers/
│   │   ├── auth.py            # 认证相关 API
│   │   ├── locations.py       # 景点相关 API
│   │   ├── checkins.py        # 打卡相关 API
│   │   └── scrolls.py         # 绘卷相关 API
│   ├── services/              # 业务逻辑层
│   │   ├── auth_service.py
│   │   ├── location_service.py
│   │   └── checkin_service.py
│   └── utils/                 # 工具函数
│       ├── jwt.py            # JWT 处理
│       ├── security.py       # 密码加密
│       └── errors.py         # 自定义异常
├── alembic/                  # 数据库迁移配置
├── seed.py                   # 初始化数据脚本
├── requirements.txt          # 依赖包
├── Dockerfile                # Docker 配置
└── .env                      # 环境变量
```

## 开发环境设置

### 1. 创建虚拟环境

```bash
cd backend

# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
source venv/bin/activate           # macOS/Linux
# 或
venv\Scripts\activate             # Windows
```

### 2. 安装依赖

```bash
pip install -r requirements.txt
```

### 3. 配置环境变量

```bash
# 复制环境变量文件
cp .env.example .env

# 编辑 .env，设置数据库 URL
DATABASE_URL=postgresql://user:password@localhost:5432/lugu_lake
```

### 4. 初始化数据库

```bash
# 创建数据库迁移
alembic upgrade head

# 导入初始数据
python seed.py
```

### 5. 启动开发服务器

```bash
uvicorn app.main:app --reload

# 输出:
#   INFO:     Uvicorn running on http://127.0.0.1:8000
#   INFO:     Application startup complete
```

**访问 Swagger 文档:** http://localhost:8000/docs

## 核心技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| FastAPI | 0.104.x | Web 框架 |
| SQLAlchemy | 2.0.x | ORM |
| Pydantic | 2.0.x | 数据验证 |
| Python-Jose | 3.3.x | JWT |
| Passlib | 1.7.x | 密码加密 |
| PostgreSQL | 14.x | 数据库 |

## 数据模型详解

### User 用户模型

```python
# models.py
from sqlalchemy import Column, String, Enum
from app.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID, primary_key=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)  # pbkdf2 hash
    role = Column(Enum("user", "admin"), default="user")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

**用户角色:**
- `user` - 游客 (普通用户)
- `admin` - 管理员 (内部使用)

### Location 景点模型

```python
class Location(Base):
    __tablename__ = "locations"
    
    id = Column(UUID, primary_key=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    image_url = Column(String(500))
    latitude = Column(Float)
    longitude = Column(Float)
    category = Column(String(50))  # 古镇, 自然, 人文
    created_at = Column(DateTime, default=datetime.utcnow)
```

### Checkin 打卡模型

```python
class Checkin(Base):
    __tablename__ = "checkins"
    
    id = Column(UUID, primary_key=True)
    user_id = Column(UUID, ForeignKey("users.id"))
    location_id = Column(UUID, ForeignKey("locations.id"))
    notes = Column(String(500))
    photo_url = Column(String(500), nullable=True)
    checked_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", backref="checkins")
    location = relationship("Location", backref="checkins")
```

### Scroll 绘卷模型

```python
class Scroll(Base):
    __tablename__ = "scrolls"
    
    id = Column(UUID, primary_key=True)
    user_id = Column(UUID, ForeignKey("users.id"))
    title = Column(String(100), nullable=False)
    description = Column(Text)
    checkin_ids = Column(JSON)  # UUID[] 数组
    exported_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", backref="scrolls")
```

## 验证模型 (Pydantic Schemas)

```python
# schemas.py
from pydantic import BaseModel, Field

class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)

class UserLogin(BaseModel):
    username: str
    password: str

class UserOut(BaseModel):
    id: UUID
    username: str
    role: str

class CheckinCreate(BaseModel):
    location_id: UUID
    notes: str = Field("", max_length=500)

class CheckinOut(BaseModel):
    id: UUID
    location_id: UUID
    location_name: str
    notes: str
    checked_at: datetime
    created_at: datetime
```

## 认证系统详解

### JWT Token 生成和验证

```python
# utils/jwt.py
from jose import JWTError, jwt
from datetime import datetime, timedelta

SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 小时

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_access_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
        return user_id
    except JWTError:
        return None
```

### 密码加密和验证

```python
# utils/security.py
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["pbkdf2_sha256"])

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)
```

### 依赖注入 - 获取当前用户

```python
# 在路由中使用依赖
from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthCredentials

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthCredentials = Depends(security)):
    token = credentials.credentials
    user_id = verify_access_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# 在路由中使用
@router.get("/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user
```

## API 路由详解

### 认证路由 (routers/auth.py)

```python
from fastapi import APIRouter, HTTPException, status
from app import schemas, models
from app.database import SessionLocal
from app.utils.security import hash_password, verify_password
from app.utils.jwt import create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", status_code=201)
async def register(user: schemas.UserRegister):
    db = SessionLocal()
    
    # 检查用户是否存在
    existing_user = db.query(models.User).filter(
        models.User.username == user.username
    ).first()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already exists"
        )
    
    # 创建新用户
    db_user = models.User(
        username=user.username,
        password=hash_password(user.password)
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return {
        "id": db_user.id,
        "username": db_user.username,
        "role": db_user.role
    }

@router.post("/login")
async def login(credentials: schemas.UserLogin):
    db = SessionLocal()
    
    user = db.query(models.User).filter(
        models.User.username == credentials.username
    ).first()
    
    if not user or not verify_password(credentials.password, user.password):
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials"
        )
    
    access_token = create_access_token({"sub": str(user.id)})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "role": user.role
        }
    }
```

### 景点路由 (routers/locations.py)

```python
@router.get("/locations")
async def list_locations(skip: int = 0, limit: int = 10, category: str = None):
    db = SessionLocal()
    query = db.query(models.Location)
    
    if category:
        query = query.filter(models.Location.category == category)
    
    locations = query.offset(skip).limit(limit).all()
    return locations

@router.get("/locations/{location_id}")
async def get_location(location_id: UUID):
    db = SessionLocal()
    location = db.query(models.Location).filter(
        models.Location.id == location_id
    ).first()
    
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    
    return location

@router.get("/locations/{location_id}/guide")
async def get_location_guide(location_id: UUID):
    # 调用 AI 服务获取导览文本
    guide_text = await get_ai_guide(location_id)
    
    return {
        "location_id": location_id,
        "location_name": location.name,
        "guide_text": guide_text,
        "duration": calculate_duration(guide_text)
    }
```

## 业务逻辑层 (Services)

### 示例: 打卡服务

```python
# services/checkin_service.py
from app.models import Checkin, Location
from app.database import SessionLocal
from uuid import UUID
from datetime import datetime

class CheckinService:
    @staticmethod
    def create_checkin(user_id: UUID, location_id: UUID, notes: str = ""):
        db = SessionLocal()
        
        # 验证景点存在
        location = db.query(Location).filter(
            Location.id == location_id
        ).first()
        
        if not location:
            raise ValueError("Location not found")
        
        # 创建打卡记录
        checkin = Checkin(
            user_id=user_id,
            location_id=location_id,
            notes=notes,
            checked_at=datetime.utcnow()
        )
        
        db.add(checkin)
        db.commit()
        
        return {
            "id": checkin.id,
            "location_name": location.name,
            "checked_at": checkin.checked_at
        }
    
    @staticmethod
    def get_user_checkins(user_id: UUID, skip: int = 0, limit: int = 10):
        db = SessionLocal()
        checkins = db.query(Checkin).filter(
            Checkin.user_id == user_id
        ).offset(skip).limit(limit).all()
        
        return checkins
```

## 错误处理

### 统一错误响应

```python
# utils/errors.py
from fastapi import HTTPException, status

class AppException(Exception):
    def __init__(self, status_code: int, message: str, detail: str = None):
        self.status_code = status_code
        self.message = message
        self.detail = detail or message

# 在主应用中添加异常处理器
@app.exception_handler(AppException)
async def app_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "code": exc.status_code,
            "message": exc.message,
            "detail": exc.detail
        }
    )
```

### 常见错误模式

```python
# 未授权
raise HTTPException(
    status_code=401,
    detail="Authentication required"
)

# 禁止访问
raise HTTPException(
    status_code=403,
    detail="Insufficient permissions"
)

# 资源不存在
raise HTTPException(
    status_code=404,
    detail="Resource not found"
)

# 验证错误
raise HTTPException(
    status_code=422,
    detail="Validation error"
)
```

## 数据库迁移 (Alembic)

### 创建新迁移

```bash
# 生成迁移文件
alembic revision --autogenerate -m "Add new column"

# 输出:
#   Generating /Your-Lugu-lake/backend/alembic/versions/001_add_new_column.py
```

### 应用迁移

```bash
# 应用所有待处理的迁移
alembic upgrade head

# 回滚到上一个版本
alembic downgrade -1

# 查看迁移历史
alembic current
```

## 初始化数据 (Seed)

### seed.py 结构

```python
# seed.py
from app.database import SessionLocal
from app.models import User, Location
from app.utils.security import hash_password

def seed_database():
    db = SessionLocal()
    
    # 创建默认用户
    admin = User(
        username="admin",
        password=hash_password("admin"),
        role="admin"
    )
    db.add(admin)
    
    # 创建景点数据
    locations = [
        Location(
            name="大落水村",
            description="泸沽湖主要景点",
            category="古镇",
            latitude=27.5,
            longitude=100.1
        ),
        # ... 更多景点
    ]
    db.add_all(locations)
    db.commit()

if __name__ == "__main__":
    seed_database()
```

### 运行 Seed

```bash
# 使用 Docker
docker compose exec backend python seed.py

# 本地运行
python seed.py
```

## 开发规范

### API 设计规范

1. **端点命名**: `/resource` 或 `/resource/{id}`
2. **HTTP 方法**:
   - `GET` - 读取
   - `POST` - 创建 (返回 201)
   - `PUT` - 替换
   - `PATCH` - 部分更新
   - `DELETE` - 删除

3. **响应格式**:
```json
{
  "code": 200,
  "message": "success",
  "data": {}
}
```

### 代码风格

- 使用 PEP 8 命名规范
- 类名: PascalCase
- 函数/变量: snake_case
- 常量: UPPER_SNAKE_CASE
- 缩进: 4 空格

## 测试

### 单元测试示例

```python
# tests/test_auth.py
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_register():
    response = client.post(
        "/auth/register",
        json={"username": "testuser", "password": "testpass123"}
    )
    assert response.status_code == 201
    assert response.json()["data"]["username"] == "testuser"

def test_login():
    response = client.post(
        "/auth/login",
        json={"username": "testuser", "password": "testpass123"}
    )
    assert response.status_code == 200
    assert "access_token" in response.json()["data"]
```

### 运行测试

```bash
pytest tests/

# 显示覆盖率
pytest --cov=app tests/
```

## 调试技巧

### 1. 启用日志

```python
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

logger.debug(f"Processing location: {location_id}")
logger.error(f"Error: {str(e)}")
```

### 2. 查看 SQL 查询

```python
# 在 main.py 中启用
import logging
logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO)
```

### 3. 使用 Swagger 测试 API

访问 http://localhost:8000/docs，在网页中直接测试所有 API

## 部署检查清单

- [ ] 所有环境变量已设置
- [ ] 数据库迁移已应用
- [ ] 初始数据已导入
- [ ] 所有依赖已安装
- [ ] CORS 配置正确
- [ ] 日志记录配置完成
- [ ] 密钥已更换 (非 dev)
- [ ] 所有测试通过

---

**需要帮助?** 查看前端开发指南 → `doc/04-FRONTEND-DEV.md`

