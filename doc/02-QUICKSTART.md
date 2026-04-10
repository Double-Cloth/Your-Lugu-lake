# 快速开始

## 1. 环境要求

- Docker / Docker Compose
- 可选：Node.js 16+（本地前端调试）
- 可选：Python 3.9+（本地后端调试）

## 2. Docker 一键启动（推荐）

```bash
git clone <repo-url>
cd Your-Lugu-lake

# Windows 可用 Copy-Item
cp .env.example .env

# 启动
docker compose up --build
```

启动后访问：
- 前端：http://localhost:5173
- 后端文档：http://localhost:18000/docs
- 健康检查：http://localhost:18000/health

## 3. 核心功能体验

1. 打开首页：体验「景区一览 / 文化导览 / 全域导览 / 生态导览」
2. 在「我的」注册或登录游客账号
3. 在「打卡」页扫码或手填景点 ID，提交足迹
4. 在「文化导览」生成 AI 路线
5. 进入 `/locations/:id` 查看景点详情（知识库优先）

## 4. 常用 API 快速验证

### 认证

```bash
curl -X POST http://localhost:18000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"demo_user","password":"123456"}'

curl -X POST http://localhost:18000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo_user","password":"123456"}'
```

### 景点

```bash
curl http://localhost:18000/api/locations
curl http://localhost:18000/api/locations/1
curl http://localhost:18000/api/locations/knowledge-base/luyuan-cliff
```

### 打卡（需 token）

```bash
curl -X POST http://localhost:18000/api/footprints \
  -H "Authorization: Bearer <TOKEN>" \
  -F "location_id=1" \
  -F "gps_lat=27.6931" \
  -F "gps_lon=100.7883" \
  -F "mood_text=天气很好"
```

## 5. 本地分开运行（可选）

### 前端

```bash
cd frontend
npm install
npm run dev
```

### 后端

```bash
cd backend
python -m venv venv
venv\Scripts\activate   # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## 6. 常见问题

### Q1: 登录失败或 401
- 检查浏览器是否正确接收会话 Cookie
- 检查写请求是否带上 `X-CSRF-Token`

### Q2: 景点详情不显示知识库内容
- 检查 `knowledge-base/locations/index.json` 是否包含对应 `id/slug`
- 检查 `knowledge-base/locations/{slug}/info.json` 是否有效 JSON

### Q4: 生态导览某模块不显示
- 检查 `knowledge-base/common/pages/eco-guide.json` 中 `moduleFiles` 是否指向存在文件
- 检查子文件（如 `rare-fauna.json`）是否包含 `items` 数组

### Q3: 打卡上传图片失败
- 检查是否使用 `multipart/form-data`
- 检查后端 `uploads` 目录权限
