# API 指南（当前实现）

## 基础信息

- Base URL: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`
- 鉴权方式: `Authorization: Bearer <token>`

说明：当前接口返回为业务对象本身（并非统一 `{code,message,data}` 包装）。

## 健康检查

### `GET /health`

```json
{"status":"ok"}
```

## 认证 ` /api/auth `

### `POST /api/auth/register`
请求体：
```json
{"username":"demo_user","password":"123456"}
```
响应示例：
```json
{"access_token":"...","token_type":"bearer","role":"user"}
```

### `POST /api/auth/login`
请求体同上，响应同 `register`。

### `GET /api/auth/me`
需登录，返回用户信息：
```json
{"id":1,"username":"demo_user","role":"user","created_at":"2026-03-26T..."}
```

### `PUT /api/auth/me`
请求体（字段可选）：
```json
{"username":"new_name","password":"new_pass_123"}
```

## 景点 ` /api/locations `

### `GET /api/locations`
返回数据库景点列表。

### `GET /api/locations/{location_id}`
返回单个数据库景点。

### `GET /api/locations/knowledge-base/{slug}`
返回知识库 `info.json` 内容。

### `GET /api/locations/knowledge-base/{slug}/images`
返回：
```json
{"slug":"lugu-lake","images":["1.jpg","2.jpg"],"basePath":"/knowledge-base/locations/lugu-lake/images/"}
```

## 管理景点 ` /api/admin/locations `（管理员）

### `POST /api/admin/locations`
创建景点（请求体字段与 `LocationCreate` 一致）：
- `name`, `description`, `audio_url`, `latitude`, `longitude`, `category`, `qr_code_url`

### `PUT /api/admin/locations/{location_id}`
按字段部分更新。

### `DELETE /api/admin/locations/{location_id}`
删除景点，返回：
```json
{"ok":true}
```

## 打卡 ` /api/footprints `

### `POST /api/footprints`（游客登录）
`multipart/form-data` 字段：
- `location_id` (int)
- `gps_lat` (float)
- `gps_lon` (float)
- `mood_text` (string, optional)
- `photo` (file, optional)

响应：
```json
{"id":123,"photo_url":"/uploads/xxx.jpg"}
```

### `GET /api/footprints/me`
返回当前用户足迹数组。

## 路线与对话 ` /api/routes `

### `POST /api/routes/generate`
请求体：
```json
{"duration":"one-day","preference":"culture","group_type":"friends"}
```
响应：
```json
{"route":{}}
```

### `POST /api/routes/chat`
请求体：
```json
{"message":"你好","system_prompt":"你是导游"}
```
响应：
```json
{"reply":"..."}
```

## 管理后台 ` /api/admin `（管理员）

### `GET /api/admin/stats`
返回统计：
```json
{"users":0,"locations":0,"footprints":0,"ai_routes":0}
```

### `POST /api/admin/qrcodes/generate/{location_id}`
为景点生成二维码并写回 `qr_code_url`。

### `GET /api/admin/qrcodes/batch-export`
导出全部二维码 zip（二进制）。

### `GET /api/admin/qrcodes/file/{file_name}`
下载单个二维码文件。

## 常见错误码

- `400`: 参数问题或业务校验失败
- `401`: 未登录/Token 无效
- `403`: 非管理员访问管理接口
- `404`: 资源不存在
- `422`: 请求体验证失败 / JSON 解析失败
- `503`: AI 服务不可用
