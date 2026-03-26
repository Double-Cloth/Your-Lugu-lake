# 部署与运维指南

## Docker Compose（当前项目）

核心服务：
- `db`：PostgreSQL 14
- `backend`：FastAPI
- `frontend`：Vite dev server

启动命令：

```bash
docker compose up --build
```

后台启动：

```bash
docker compose up -d
```

停止：

```bash
docker compose down
```

重置数据卷：

```bash
docker compose down -v
```

## 关键挂载

- `./backend:/app`
- `backend_uploads:/app/uploads`
- `./frontend:/app`
- `./knowledge-base:/knowledge-base`
- `postgres_data:/var/lib/postgresql/data`

说明：前端开发态通过 Vite 插件将 `/knowledge-base/*` 映射到容器内 `/knowledge-base`。

## 环境变量

来源：`.env.example`

关键项：
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `BACKEND_PORT`, `FRONTEND_PORT`
- `SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES`
- `DASHSCOPE_API_KEY`, `DASHSCOPE_MODEL`
- `UPLOAD_DIR`
- `CORS_ORIGINS`
- `VITE_API_BASE_URL`

## 启动后检查

```bash
curl http://localhost:8000/health
curl http://localhost:8000/docs
```

浏览器访问：
- http://localhost:5173

## 日志与排障

查看所有服务日志：

```bash
docker compose logs -f
```

只看后端：

```bash
docker compose logs -f backend
```

只看数据库：

```bash
docker compose logs -f db
```

### 常见问题

1. 后端启动后接口 404：
- 确认容器已使用最新代码（重启 compose）

2. 登录失败 / 500：
- 查看 backend 日志，确认 `scripts.seed` 是否执行成功
- 检查数据库是否就绪（依赖 healthcheck）

3. AI 无回复：
- 检查 `DASHSCOPE_API_KEY`
- 检查 API URL/模型参数是否被空字符串覆盖

4. 知识库图片或 JSON 读取失败：
- 检查 `./knowledge-base:/knowledge-base` 挂载
- 检查 JSON 文件格式是否合法

## 生产建议

1. 前后端镜像分离并固定版本 tag
2. 关闭 `--reload`
3. 替换强密码与 `SECRET_KEY`
4. 使用反向代理与 HTTPS
5. 记录并轮转日志
