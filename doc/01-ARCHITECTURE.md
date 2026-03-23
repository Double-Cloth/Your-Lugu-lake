# 🏗️ 系统架构设计

## 整体架构

```
┌─────────────────────────────────────────────────────┐
│                   Client (Browser)                   │
│              React 18 + Vite + Ant Design           │
└──────────────────┬──────────────────────────────────┘
                   │ HTTP/REST
                   ↓
┌─────────────────────────────────────────────────────┐
│                  API Gateway (FastAPI)               │
│    JWT Authentication | Request Validation           │
└──────────────────┬──────────────────────────────────┘
                   │ SQL
                   ↓
┌─────────────────────────────────────────────────────┐
│          Database (PostgreSQL 14)                    │
│         Users | Locations | Checkins | Scrolls      │
└─────────────────────────────────────────────────────┘
```

## 核心模块

### 1. 前端架构

```
frontend/
├── src/
│   ├── pages/              # 页面组件
│   │   ├── HomePage.jsx
│   │   ├── GuidePage.jsx
│   │   ├── CheckinPage.jsx
│   │   ├── ProfilePage.jsx
│   │   ├── ScrollPage.jsx
│   │   └── LocationDetailsPage.jsx
│   ├── components/         # 通用组件
│   │   ├── PageHeader.jsx
│   │   └── TabBar.jsx
│   ├── api/                # API 调用
│   │   └── index.js
│   ├── auth/               # 认证管理
│   │   └── index.js
│   ├── App.jsx             # 主应用
│   └── styles.css          # 全局样式
└── package.json
```

### 2. 后端架构

```
backend/
├── app/
│   ├── main.py             # 应用入口
│   ├── database.py         # 数据库配置
│   ├── models.py           # SQLAlchemy 数据模型
│   ├── schemas.py          # Pydantic 数据验证
│   ├── routers/            # API 路由
│   │   ├── auth.py        # 认证相关
│   │   ├── locations.py   # 景点相关
│   │   ├── checkins.py    # 打卡相关
│   │   └── scrolls.py     # 绘卷相关
│   ├── services/           # 业务逻辑
│   └── utils/              # 工具函数
├── alembic/                # 数据库迁移
├── seed.py                 # 初始化数据
└── requirements.txt
```

### 3. 数据库模型

```sql
users {
  id: UUID PRIMARY KEY
  username: VARCHAR UNIQUE
  password: VARCHAR (pbkdf2_sha256)
  role: ENUM (user, admin)
  created_at: TIMESTAMP
  updated_at: TIMESTAMP
}

locations {
  id: UUID PRIMARY KEY
  name: VARCHAR
  description: TEXT
  image_url: VARCHAR
  latitude: FLOAT
  longitude: FLOAT
  category: VARCHAR
  created_at: TIMESTAMP
}

checkins {
  id: UUID PRIMARY KEY
  user_id: UUID FK → users
  location_id: UUID FK → locations
  notes: TEXT
  photo_url: VARCHAR
  checked_at: TIMESTAMP
  created_at: TIMESTAMP
}

scrolls {
  id: UUID PRIMARY KEY
  user_id: UUID FK → users
  title: VARCHAR
  description: TEXT
  checkin_ids: JSON[]
  exported_at: TIMESTAMP
  created_at: TIMESTAMP
}
```

## 通信流程

### 认证流程

```
用户 ─→ 输入账号密码 ─→ 前端
                     ↓
                 API 调用
                     ↓
             后端验证凭证
                     ↓
             生成 JWT Token
                     ↓
        前端存储 Token (localStorage)
                     ↓
        后续请求附带 Authorization Header
```

### 景点详情加载

```
用户点击景点 ─→ 前端获取 location_id
                   ↓
          调用 GET /locations/{id}
                   ↓
        后端查询数据库
                   ↓
    返回景点详情 + AI 引导内容
                   ↓
          前端展示详情页面
```

### 打卡流程

```
用户扫码 ─→ 获取 location_id
               ↓
        调用 POST /checkins
        body: { location_id, notes }
               ↓
        后端创建打卡记录
               ↓
       返回打卡 ID + 确认信息
               ↓
    前端更新统计数据并显示成功提示
```

## 认证机制

### JWT Token 结构

```
Header: {
  "alg": "HS256",
  "type": "JWT"
}

Payload: {
  "sub": "user_id",
  "username": "游客",
  "role": "user",
  "exp": 1234567890
}

Signature: HMACSHA256(base64(header) + "." + base64(payload), secret)
```

### Token 存储位置

- **前端**: LocalStorage (`auth_token`)
- **请求头**: `Authorization: Bearer <token>`
- **后端**: 内存校验，无状态设计

## 错误处理

### HTTP 状态码约定

| 状态码 | 含义 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 409 | 冲突（如用户已存在） |
| 500 | 服务器内部错误 |

### 错误响应格式

```json
{
  "detail": "错误详情描述",
  "error_code": "INVALID_CREDENTIALS",
  "timestamp": "2026-03-23T10:00:00Z"
}
```

## 扩展性设计

### 关键扩展点

1. **AI 导览集成**
   - `/locations/{id}/guide` - 获取 AI 导览文本
   - `/locations/{id}/voice` - 获取语音导览 URL

2. **社交功能**
   - `/scrolls/{id}/share` - 分享绘卷
   - `/scrolls/{id}/comments` - 评论组件

3. **用户统计**
   - `/users/statistics` - 获取用户统计数据
   - `/users/achievements` - 获取勋章系统

4. **高级搜索**
   - `/locations/search` - 景点搜索
   - `/locations/filter` - 基于类别/距离的筛选

## 性能优化策略

### 前端
- 代码分割 (Code Splitting)
- 图片懒加载 (Lazy Loading)
- 缓存 API 响应

### 后端
- 查询优化 (N+1 问题)
- 数据库索引
- API 响应缓存

### 网络
- 启用 GZIP 压缩
- CDN 分发静态资源
- 优化包体积

## 部署拓扑

```
┌─────────────────┐
│  Docker Compose │
├─────────────────┤
│ frontend:5173   │ (Vite Dev Server)
│ backend:8000    │ (FastAPI + Uvicorn)
│ db:5432         │ (PostgreSQL)
└─────────────────┘
     ↓
┌─────────────────────────────────┐
│  Docker Hub / Private Registry   │
└─────────────────────────────────┘
     ↓
┌─────────────────────────────────┐
│  Cloud Platform (AWS/Aliyun)    │
│  - Frontend: S3 + CloudFront    │
│  - Backend: ECS/Kubernetes      │
│  - Database: RDS PostgreSQL     │
└─────────────────────────────────┘
```

---

**关键技术栈总结**
- 前端: React 18 + Vite + Ant Design Mobile + Custom CSS
- 后端: FastAPI + SQLAlchemy 2 + PostgreSQL 14
- 认证: JWT (HS256)
- 部署: Docker + Docker Compose
- CI/CD: (可选) GitHub Actions

