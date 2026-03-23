# 📚 API 完整指南

## 基础信息

**基础 URL**: `http://localhost:8000`  
**API 文档**: `http://localhost:8000/docs` (Swagger UI)  
**认证方式**: JWT Token (Bearer)  

## 国际化 (i18n)

所有 API 响应都遵循以下统一格式：

```json
{
  "code": 200,
  "message": "success",
  "data": {}
}
```

---

## 🔐 认证模块 (`/auth`)

### 用户注册

**端点**: `POST /auth/register`

```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newuser",
    "password": "MyPassword123!"
  }'
```

**请求体**
| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| username | string | ✅ | 用户名 (3-50 字符) |
| password | string | ✅ | 密码 (8+ 字符) |

**响应** (201)
```json
{
  "code": 201,
  "message": "User created successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "newuser",
    "role": "user",
    "created_at": "2026-03-23T10:00:00Z"
  }
}
```

**错误** (409)
```json
{
  "code": 409,
  "message": "Username already exists",
  "detail": "该用户名已被注册"
}
```

### 用户登录

**端点**: `POST /auth/login`

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newuser",
    "password": "MyPassword123!"
  }'
```

**请求体**
| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| username | string | ✅ | 用户名 |
| password | string | ✅ | 密码 |

**响应** (200)
```json
{
  "code": 200,
  "message": "Login successful",
  "data": {
    "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
    "token_type": "bearer",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "newuser",
      "role": "user"
    }
  }
}
```

**错误** (401)
```json
{
  "code": 401,
  "message": "Invalid credentials",
  "detail": "用户名或密码错误"
}
```

---

## 🏞️ 景点模块 (`/locations`)

### 获取景点列表

**端点**: `GET /locations`

```bash
curl http://localhost:8000/locations

# 带分页
curl "http://localhost:8000/locations?skip=0&limit=10"

# 带分类过滤
curl "http://localhost:8000/locations?category=古镇"
```

**查询参数**
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| skip | int | 0 | 跳过数量 |
| limit | int | 10 | 返回数量 |
| category | string | - | 分类过滤 |

**响应** (200)
```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "id": "uuid",
      "name": "大落水村",
      "description": "泸沽湖畔最著名的摩梭村寨...",
      "image_url": "https://...",
      "latitude": 27.5,
      "longitude": 100.1,
      "category": "古镇",
      "created_at": "2026-03-23T00:00:00Z"
    }
  ]
}
```

### 获取景点详情

**端点**: `GET /locations/{location_id}`

```bash
curl http://localhost:8000/locations/550e8400-e29b-41d4-a716-446655440000
```

**路径参数**
| 参数 | 类型 | 说明 |
|------|------|------|
| location_id | UUID | 景点 ID |

**响应** (200)
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "uuid",
    "name": "大落水村",
    "description": "泸沽湖畔最著名的摩梭村寨，以其独特的摩梭文化著称...",
    "image_url": "https://images.example.com/location.jpg",
    "latitude": 27.5,
    "longitude": 100.1,
    "category": "古镇",
    "guide_text": "欢迎来到大落水村...",  # AI 导览文本
    "created_at": "2026-03-23T00:00:00Z"
  }
}
```

### 获取 AI 导览

**端点**: `GET /locations/{location_id}/guide`

```bash
curl http://localhost:8000/locations/uuid/guide
```

**响应** (200)
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "location_id": "uuid",
    "location_name": "大落水村",
    "guide_text": "大落水村是泸沽湖最大的摩梭村落...",
    "voice_url": "https://voice.example.com/guide.mp3",
    "duration": 180  # 秒
  }
}
```

---

## ✓ 打卡模块 (`/checkins`)

### 创建打卡记录

**端点**: `POST /checkins`

```bash
curl -X POST http://localhost:8000/checkins \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "location_id": "uuid",
    "notes": "景色优美，日落绝美"
  }'
```

**请求体**
| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| location_id | UUID | ✅ | 景点 ID |
| notes | string | ❌ | 打卡备注 (最多 500 字) |

**响应** (201)
```json
{
  "code": 201,
  "message": "Checkin created successfully",
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "location_id": "uuid",
    "location_name": "大落水村",
    "notes": "景色优美，日落绝美",
    "checked_at": "2026-03-23T14:30:00Z",
    "created_at": "2026-03-23T14:30:00Z"
  }
}
```

**错误** (401)
```json
{
  "code": 401,
  "message": "Not authenticated",
  "detail": "需要登录后才能打卡"
}
```

### 获取用户打卡列表

**端点**: `GET /checkins/user`

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/checkins/user

# 带分页
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/checkins/user?skip=0&limit=20"
```

**查询参数**
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| skip | int | 0 | 跳过数量 |
| limit | int | 10 | 返回数量 |

**响应** (200)
```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "id": "uuid",
      "location_id": "uuid",
      "location_name": "大落水村",
      "notes": "景色优美",
      "checked_at": "2026-03-23T14:30:00Z",
      "created_at": "2026-03-23T14:30:00Z"
    }
  ]
}
```

### 删除打卡记录

**端点**: `DELETE /checkins/{checkin_id}`

```bash
curl -X DELETE http://localhost:8000/checkins/uuid \
  -H "Authorization: Bearer $TOKEN"
```

**响应** (200)
```json
{
  "code": 200,
  "message": "Checkin deleted successfully"
}
```

---

## 📄 旅行绘卷模块 (`/scrolls`)

### 创建旅行绘卷

**端点**: `POST /scrolls`

```bash
curl -X POST http://localhost:8000/scrolls \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "2026 年春游泸沽湖",
    "description": "美好的旅行记忆",
    "checkin_ids": ["uuid1", "uuid2", "uuid3"]
  }'
```

**请求体**
| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| title | string | ✅ | 绘卷标题 (1-100 字) |
| description | string | ❌ | 绘卷描述 (最多 500 字) |
| checkin_ids | UUID[] | ✅ | 打卡 ID 列表 |

**响应** (201)
```json
{
  "code": 201,
  "message": "Scroll created successfully",
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "title": "2026 年春游泸沽湖",
    "description": "美好的旅行记忆",
    "checkins_count": 3,
    "created_at": "2026-03-23T15:00:00Z"
  }
}
```

### 获取用户的绘卷列表

**端点**: `GET /scrolls/user`

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/scrolls/user
```

**响应** (200)
```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "id": "uuid",
      "title": "2026 年春游泸沽湖",
      "description": "美好的旅行记忆",
      "checkins": [
        {
          "location_name": "大落水村",
          "checked_at": "2026-03-23T14:30:00Z",
          "notes": "景色优美"
        }
      ],
      "created_at": "2026-03-23T15:00:00Z",
      "exported_at": null
    }
  ]
}
```

### 导出绘卷为图片

**端点**: `GET /scrolls/{scroll_id}/export/image`

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/scrolls/uuid/export/image \
  -o scroll.png
```

**响应** (200)
- Content-Type: `image/png`
- 返回二进制图片数据

### 导出绘卷为 PDF

**端点**: `GET /scrolls/{scroll_id}/export/pdf`

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/scrolls/uuid/export/pdf \
  -o scroll.pdf
```

**响应** (200)
- Content-Type: `application/pdf`
- 返回二进制 PDF 数据

---

## 👤 用户模块 (`/users`)

### 获取当前用户信息

**端点**: `GET /users/me`

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/users/me
```

**响应** (200)
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "uuid",
    "username": "newuser",
    "role": "user",
    "created_at": "2026-03-23T10:00:00Z",
    "updated_at": "2026-03-23T10:00:00Z"
  }
}
```

### 获取用户统计数据

**端点**: `GET /users/statistics`

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/users/statistics
```

**响应** (200)
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "total_checkins": 5,
    "unique_locations": 4,
    "total_scrolls": 1,
    "last_checkin": "2026-03-23T14:30:00Z",
    "account_age_days": 10
  }
}
```

---

## 错误处理

### 常见错误对照表

| HTTP 状态码 | 错误码 | 含义 | 处理建议 |
|-----------|--------|------|--------|
| 400 | INVALID_REQUEST | 请求参数错误 | 检查参数是否正确 |
| 401 | UNAUTHORIZED | 需要认证 | 提交登录请求 |
| 403 | FORBIDDEN | 无权限操作 | 检查用户角色 |
| 404 | NOT_FOUND | 资源不存在 | 检查资源 ID |
| 409 | CONFLICT | 资源冲突 | 用户已存在等情况 |
| 500 | INTERNAL_ERROR | 服务器错误 | 联系技术支持 |

### 标准错误响应格式

```json
{
  "code": 400,
  "message": "Validation error",
  "detail": "字段 'username' 长度必须 ≥ 3",
  "errors": [
    {
      "field": "username",
      "message": "Must be at least 3 characters"
    }
  ]
}
```

---

## 🔑 认证令牌使用

### 在请求头中添加 Token

```bash
# 方式 1: Bearer Token
curl -H "Authorization: Bearer eyJ0eXAi..." \
  http://localhost:8000/protected-endpoint

# 方式 2: 创建环境变量
TOKEN="eyJ0eXAi..."
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/protected-endpoint
```

### Token 过期处理

```javascript
// 前端示例（React）
const response = await fetch('/api/endpoint', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

if (response.status === 401) {
  // Token 过期，需要重新登录
  navigateTo('/login');
}
```

---

## 📖 完整 API 文档

访问 **Swagger UI**: `http://localhost:8000/docs`

在 Swagger 页面中，你可以：
- ✅ 查看所有 API 端点
- ✅ 查看请求/响应示例
- ✅ 直接在浏览器中测试 API
- ✅ 获取自动生成的代码片段

---

**提示**: 所有 API 都遵循 RESTful 标准，支持 JSON 请求/响应格式

