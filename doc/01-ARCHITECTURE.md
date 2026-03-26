# 系统架构设计

## 架构总览

```text
React (Vite + antd-mobile)
        |
        | HTTP / JSON + Bearer Token
        v
FastAPI (`/api/*`)
        |
        | SQLAlchemy
        v
PostgreSQL
```

系统同时接入本地知识库目录 `knowledge-base/`：
- 前端通过 `/knowledge-base/*` 读取静态 JSON 与图片（Vite 插件映射）
- 后端通过 `/api/locations/knowledge-base/{slug}` 提供知识库回退接口

## 代码结构（当前实现）

### 前端

```text
frontend/src/
├─ api.js
├─ auth.js
├─ App.jsx
├─ pages/
│  ├─ HomePage.jsx
│  ├─ LuguLakeOverviewPage.jsx
│  ├─ MosuoCulturePage.jsx
│  ├─ LocationDetailPage.jsx
│  ├─ CheckinPage.jsx
│  ├─ ScrollPage.jsx
│  ├─ ProfilePage.jsx
│  └─ admin/
│     ├─ AdminLoginPage.jsx
│     └─ AdminDashboardPage.jsx
└─ components/
   ├─ PageHeader.jsx
   └─ AIFloatingBall.jsx
```

### 后端

```text
backend/app/
├─ main.py
├─ api/
│  ├─ auth.py
│  ├─ locations.py
│  ├─ routes.py
│  ├─ footprints.py
│  ├─ admin.py
│  └─ deps.py
├─ core/
│  ├─ config.py
│  └─ security.py
├─ db/
│  ├─ base.py
│  └─ session.py
├─ models/
│  ├─ user.py
│  ├─ location.py
│  ├─ footprint.py
│  └─ ai_route.py
└─ schemas/
   ├─ auth.py
   ├─ location.py
   └─ route.py
```

## 关键业务流

### 1. 登录与鉴权

1. 前端调用 `POST /api/auth/login`
2. 后端签发 JWT（`sub=username`, `role`）
3. 前端保存到 `localStorage.user_token`（管理员使用 `admin_token`）
4. 后续请求带 `Authorization: Bearer <token>`

### 2. 景点详情加载（前端混合策略）

1. 前端进入 `/locations/:id`
2. 调用 `fetchLocationDetail(id)`：
3. 优先读取 `knowledge-base/locations/{slug}/info.json`
4. 失败时回退 `GET /api/locations/knowledge-base/{slug}`
5. 再失败回退 `GET /api/locations/{id}`

### 3. 地图打卡

1. 前端扫码解析 `/locations/{id}`
2. 用户定位 + 上传表单（可含图片）
3. 调用 `POST /api/footprints`（multipart/form-data）
4. 后端落库 `footprints`，图片存储到 `/uploads`

### 4. AI 路线与对话

- `POST /api/routes/generate`：基于请求偏好 + 景点数据生成路线并入库 `ai_routes`
- `POST /api/routes/chat`：通用对话，支持 `system_prompt`

## 数据模型（精简）

- `users`: `id`, `username`, `password_hash`, `role`, `created_at`
- `locations`: `id`, `name`, `description`, `audio_url`, `latitude`, `longitude`, `category`, `qr_code_url`
- `footprints`: `id`, `user_id`, `location_id`, `check_in_time`, `gps_lat`, `gps_lon`, `mood_text`, `photo_url`
- `ai_routes`: `id`, `user_id`, `route_json`, `created_at`

## 对外 API 分组

- 认证：`/api/auth/*`
- 景点：`/api/locations/*`
- 管理景点：`/api/admin/locations/*`
- 管理后台：`/api/admin/*`
- 路线与对话：`/api/routes/*`
- 打卡：`/api/footprints/*`
- 健康检查：`/health`

## 部署形态

当前以 Docker Compose 为主：
- `db`：PostgreSQL
- `backend`：FastAPI + Uvicorn
- `frontend`：Vite dev server

知识库以宿主机目录挂载方式接入。
