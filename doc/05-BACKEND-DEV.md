# 后端开发指南

## 目录结构（当前）

```text
backend/
├─ app/
│  ├─ main.py
│  ├─ api/
│  │  ├─ auth.py
│  │  ├─ locations.py
│  │  ├─ routes.py
│  │  ├─ footprints.py
│  │  ├─ admin.py
│  │  └─ deps.py
│  ├─ core/
│  │  ├─ config.py
│  │  └─ security.py
│  ├─ db/
│  │  ├─ base.py
│  │  └─ session.py
│  ├─ models/
│  │  ├─ user.py
│  │  ├─ location.py
│  │  ├─ footprint.py
│  │  └─ ai_route.py
│  └─ schemas/
│     ├─ auth.py
│     ├─ location.py
│     └─ route.py
├─ scripts/seed.py
├─ requirements.txt
└─ Dockerfile
```

## 启动方式

### Docker（推荐）

由根目录 `docker compose up --build` 启动，后端命令为：

```bash
python -m scripts.seed && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 本地调试

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## 配置项

来自 `app/core/config.py`：
- `database_url`
- `secret_key`
- `algorithm`
- `access_token_expire_minutes`
- `dashscope_api_key`
- `dashscope_model`
- `upload_dir`
- `cors_origins`

## 鉴权与安全

- 密码哈希：`pbkdf2_sha256`（`passlib`）
- 会话机制：HttpOnly Cookie（用户与管理员隔离）
- CSRF：写请求校验 `X-CSRF-Token`
- 兼容能力：保留 Bearer 头部校验链路（用于历史兼容）
- 依赖注入：
- `get_current_user`
- `require_admin`

## 数据模型

### User
- `id`, `username`, `password_hash`, `role`, `created_at`

### Location
- `id`, `name`, `description`, `audio_url`, `latitude`, `longitude`, `category`, `qr_code_url`

### Footprint
- `id`, `user_id`, `location_id`, `check_in_time`, `gps_lat`, `gps_lon`, `mood_text`, `photo_url`

### AIRoute
- `id`, `user_id`, `route_json`, `created_at`

## API 路由分层

### 认证
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PUT /api/auth/me`

### 景点
- `GET /api/locations`
- `GET /api/locations/{location_id}`
- `GET /api/locations/knowledge-base/{slug}`
- `GET /api/locations/knowledge-base/{slug}/images`

### 景点管理（管理员）
- `POST /api/admin/locations`
- `PUT /api/admin/locations/{location_id}`
- `DELETE /api/admin/locations/{location_id}`

### 打卡
- `POST /api/footprints`
- `GET /api/footprints/me`

### AI 路线与对话
- `POST /api/routes/generate`
- `POST /api/routes/chat`

### 后台统计与二维码（管理员）
- `GET /api/admin/stats`
- `POST /api/admin/qrcodes/generate/{location_id}`
- `GET /api/admin/qrcodes/batch-export`
- `GET /api/admin/qrcodes/file/{file_name}`

## 开发建议

1. 新增 API 时先补 `schemas`，再写 `api/*`。
2. 需要管理员权限的路由统一挂 `Depends(require_admin)`。
3. 文件上传统一落到 `settings.upload_dir`。
4. 与 knowledge-base 相关逻辑优先保证 JSON 解析错误可读（422）。

## 调试清单

- 401：优先检查会话 Cookie 是否存在；兼容链路再检查 Bearer
- 403：确认权限角色与 CSRF Header 是否正确
- 404（知识库）：确认 `knowledge-base/locations/{slug}/info.json`
- 503（AI）：确认 `DASHSCOPE_API_KEY` 配置
