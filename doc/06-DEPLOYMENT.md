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
- `DB_HOST`, `DB_PORT`, `POSTGRES_HOST_PORT`
- `BACKEND_PORT`, `FRONTEND_PORT`
- `SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES`
- `DASHSCOPE_API_KEY`, `DASHSCOPE_MODEL`
- `UPLOAD_DIR`
- `CORS_ORIGINS`
- `VITE_API_BASE_URL`

服务器部署建议：
- `DB_HOST=db`，`DB_PORT=5432`
- `POSTGRES_HOST_PORT` 仅用于宿主机映射（冲突时可改成 15432 等）
- `VITE_API_BASE_URL` 建议留空，走同源 `/api` 与 `/uploads`（由反向代理或 Vite 代理转发）
- `CORS_ORIGINS` 填写你的真实前端域名（例如 `https://your-domain.com`），不要写 `localhost`

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

3. 服务器部署后读不到数据库内容：
- 确认 `.env` 中 `DB_HOST=db`、`DB_PORT=5432`，且 `POSTGRES_DB/POSTGRES_USER/POSTGRES_PASSWORD` 与 `docker-compose.yml` 一致
- 如果服务器 5432 端口冲突，请改 `POSTGRES_HOST_PORT`（宿主机映射端口），不要改 `DB_PORT`
- 查看 `docker compose logs -f backend`，确认出现 `Seed completed`
- 执行 `docker compose exec backend python -m scripts.seed` 进行一次补种验证
- 如果曾修改过 `POSTGRES_*` 但复用了旧卷，执行 `docker compose down -v` 后再 `docker compose up -d --build`

4. AI 无回复：
- 检查 `DASHSCOPE_API_KEY`
- 检查 API URL/模型参数是否被空字符串覆盖

5. 知识库图片或 JSON 读取失败：
- 检查 `./knowledge-base:/knowledge-base` 挂载
- 检查 JSON 文件格式是否合法

## 生产建议

1. 前后端镜像分离并固定版本 tag
2. 关闭 `--reload`
3. 替换强密码与 `SECRET_KEY`
4. 使用反向代理与 HTTPS
5. 记录并轮转日志
