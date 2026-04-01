# 泸沽湖智能导览系统

<div align="center">

![License](https://img.shields.io/badge/license-MIT-green)
![Python](https://img.shields.io/badge/python-3.9%2B-blue)
![Node.js](https://img.shields.io/badge/node.js-16%2B-green)
![React](https://img.shields.io/badge/react-18-61dafb)
![FastAPI](https://img.shields.io/badge/fastapi-0.115-009485)

面向泸沽湖文旅场景的全栈导览系统，提供游客端导览、AI 交互、足迹沉淀和管理端运维能力。

</div>

## 1. 项目定位

本项目聚焦于“景区内容数字化 + 游客导览体验 + 运营管理”三个层面，目标是提供一套可持续维护的景区数字导览基础设施。

在业务侧，系统围绕游客行前了解、行中导览、行后沉淀形成闭环。
在工程侧，系统采用前后端分离、知识库与数据库并行的数据架构，兼顾内容更新效率与运行稳定性。

## 2. 核心能力全景

### 2.1 游客端

- 首页分层导览：景区一览、文化导览、全域导览
- 景点详情页：知识库优先加载，数据库信息兜底
- 打卡功能：支持地理位置、文字心情、图片上传
- 旅行绘卷：基于打卡记录聚合展示个人行程轨迹

### 2.2 AI 能力

- AI 路线生成：根据用户输入生成可保存的路线建议
- 场景对话：支持带上下文的多轮问答与会话历史管理
- 知识增强：按页面场景和景点上下文动态检索知识库片段
- 容错降级：未配置或暂不可用时，回退本地知识内容回复

### 2.3 管理端

- 景点 CRUD 管理
- 运营看板统计（用户、景点、打卡、AI 路线）
- 景点二维码单个生成与批量导出

### 2.4 安全机制

- Cookie 会话（用户与管理员分离）
- CSRF 防护（写请求校验 Header）
- 登录失败限流与短时锁定
- 密码传输加密（RSA-OAEP）与明文回退开关

## 3. 业务闭环流程

1. 游客注册或登录后获取会话。
2. 在首页或专题页浏览知识库内容并进入景点详情。
3. 在景点现场完成打卡，系统沉淀足迹数据。
4. 通过 AI 进行路线生成或场景问答，增强导览体验。
5. 在个人页查看聚合记录，形成可回看、可分享的旅行绘卷。

## 4. 技术架构

	React (Vite)
	   |
	   | HTTP / JSON + Cookie + CSRF
	   v
	FastAPI (/api/*)
	   |
	   | SQLAlchemy
	   v
	PostgreSQL

	Static Knowledge Base (JSON/Images)
	   |- Frontend: /knowledge-base/* (Vite middleware)
	   |- Backend:  /api/locations/knowledge-base/{slug}

架构特征说明：

- 前端负责页面编排、交互控制与知识库静态读取。
- 后端提供认证、业务 API、文件上传、AI 与管理能力。
- 数据层区分为关系数据（用户、打卡、路线等）与内容数据（知识库 JSON/图片）。

## 5. 技术栈

- 前端：React 18、Vite 6、Ant Design Mobile 5、Tailwind CSS、Axios
- 后端：FastAPI、SQLAlchemy 2、Pydantic Settings、PostgreSQL 14
- AI 与检索：DashScope qwen-plus、本地知识向量缓存与检索
- 安全：HttpOnly Cookie、CSRF、密码哈希、密码传输加密
- 部署：Docker Compose

## 6. 仓库结构

	.
	├─ frontend/                  # React + Vite 前端
	│  ├─ src/pages/              # 游客端与管理端页面
	│  ├─ src/components/         # 通用组件
	│  ├─ src/api.js              # API 访问与知识库读取入口
	│  └─ vite.config.js          # 代理与知识库静态映射
	├─ backend/                   # FastAPI 后端
	│  ├─ app/api/                # auth, locations, routes, footprints, admin
	│  ├─ app/models/             # ORM 模型定义
	│  ├─ app/services/           # LLM 与知识检索服务
	│  ├─ app/core/               # 配置与安全能力
	│  └─ scripts/seed.py         # 初始化数据脚本
	├─ knowledge-base/            # 景区知识库（JSON + 图片）
	├─ doc/                       # 详细架构与开发文档
	└─ docker-compose.yml

## 7. 快速启动

### 7.1 环境要求

- Docker Desktop（含 Compose）
- 可选：Node.js 16+、Python 3.9+（用于本地拆分开发）

### 7.2 环境变量准备

在仓库根目录创建 .env：

Linux 或 macOS：

	cp .env.example .env

Windows PowerShell：

	Copy-Item .env.example .env

建议至少修改以下配置：

- SECRET_KEY
- POSTGRES_PASSWORD
- DASHSCOPE_API_KEY（可留空，留空时系统启用降级回复）

### 7.3 Docker 启动

	docker compose up --build

访问地址：

- 前端：http://localhost:5173
- 后端 API 文档：http://localhost:18000/docs
- 健康检查：http://localhost:18000/health

## 8. 本地开发模式

### 8.1 前端

	cd frontend
	npm install
	npm run dev

### 8.2 后端

	cd backend
	python -m venv .venv
	# Windows: .venv\Scripts\activate
	# macOS/Linux: source .venv/bin/activate
	pip install -r requirements.txt
	uvicorn app.main:app --reload

说明：前端通过 VITE_PROXY_TARGET 将 /api 和 /uploads 代理到后端。

## 9. 关键配置说明

配置文件来源：根目录 .env.example。

### 9.1 基础运行配置

- APP_ENV：环境标识（development 或 production）
- ALLOWED_HOSTS：允许访问的 Host 白名单
- CORS_ORIGINS：允许跨域来源列表
- BACKEND_PORT、FRONTEND_PORT：服务端口
- BACKEND_BIND_HOST、FRONTEND_BIND_HOST：服务绑定地址（生产建议后端绑定 127.0.0.1）

### 9.2 数据库配置

- POSTGRES_DB、POSTGRES_USER、POSTGRES_PASSWORD
- DB_HOST、DB_PORT（Compose 场景建议 DB_HOST=db、DB_PORT=5432）

### 9.3 安全配置

- SESSION_COOKIE_SECURE：生产环境需设为 true
- SESSION_COOKIE_SAMESITE、SESSION_COOKIE_DOMAIN
- CSRF_COOKIE_NAME、CSRF_HEADER_NAME、ENFORCE_CSRF
- PASSWORD_TRANSPORT_ENCRYPTION_ENABLED
- PASSWORD_TRANSPORT_PRIVATE_KEY_PEM
- PASSWORD_TRANSPORT_ALLOW_PLAINTEXT_FALLBACK（生产建议 false）

### 9.4 AI 配置

- DASHSCOPE_API_KEY
- DASHSCOPE_MODEL（默认 qwen-plus）

## 10. 鉴权与权限模型

- 会话载体：HttpOnly Cookie
- CSRF：对写请求强制校验 Header
- 角色模型：user、admin
- 权限边界：
  - 普通用户可访问导览、打卡、AI 能力
  - 管理员可访问统计、景点管理、二维码管理

兼容说明：后端保留 Bearer Header 兼容能力，推荐优先使用 Cookie 会话。

## 11. API 能力概览

### 11.1 健康检查

- GET /health

### 11.2 认证与用户

- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me
- PUT /api/auth/me
- GET /api/auth/password-public-key

### 11.3 景点与知识库

- GET /api/locations
- GET /api/locations/{location_id}
- GET /api/locations/knowledge-base/{slug}
- GET /api/locations/knowledge-base/{slug}/images

### 11.4 打卡

- POST /api/footprints
- GET /api/footprints/me

### 11.5 AI 与路线

- POST /api/routes/generate
- GET /api/routes/my
- POST /api/routes/chat
- GET /api/routes/chat/history
- DELETE /api/routes/chat/history/{session_key}

### 11.6 管理端

- GET /api/admin/stats
- POST /api/admin/locations
- PUT /api/admin/locations/{location_id}
- DELETE /api/admin/locations/{location_id}
- POST /api/admin/qrcodes/generate/{location_id}
- GET /api/admin/qrcodes/batch-export
- GET /api/admin/qrcodes/file/{file_name}

完整参数与响应示例见文档中心中的 API 指南。

## 12. 数据初始化与内容维护

### 12.1 启动初始化

容器启动命令会自动执行 seed 脚本，初始化管理员账号与基础景点数据。

- 默认管理员用户名：由 `SEED_ADMIN_USERNAME` 控制（默认 `admin`）
- 默认管理员密码：由 `SEED_ADMIN_PASSWORD` 控制（默认 `admin123`）

生产环境应在首次部署前设置强口令（建议在 `.env` 中配置 `SEED_ADMIN_PASSWORD`）。

### 12.2 知识库维护规范

知识库目录：knowledge-base。

核心路径：

- knowledge-base/common
- knowledge-base/common/pages
- knowledge-base/locations/{slug}/info.json
- knowledge-base/locations/{slug}/images
- knowledge-base/hotels/index.json
- knowledge-base/nearby-spots/index.json

建议维护策略：

- 内容变更优先修改知识库文件，不直接改前端硬编码文本。
- 新增景点时同步维护 locations/index.json 与对应 slug 目录。
- 发布前对 JSON 做格式校验，避免运行期解析错误。

## 13. 运维与发布建议

### 13.1 生产部署最低要求

- APP_ENV=production
- SESSION_COOKIE_SECURE=true
- CORS_ORIGINS 使用明确域名列表
- ALLOWED_HOSTS 使用明确域名列表
- 使用强 SECRET_KEY 与强数据库密码
- 关闭密码明文回退：PASSWORD_TRANSPORT_ALLOW_PLAINTEXT_FALLBACK=false

### 13.2 启动后验证清单

	curl http://localhost:18000/health
	curl http://localhost:18000/docs

同时检查：

- 前端首页可访问
- 登录后浏览器存在会话 Cookie 与 CSRF Cookie
- 管理端统计接口可正常返回

## 14. 常见问题与排障

- 新增接口后仍返回 404：确认容器已重启并加载新代码。
- 写接口返回 403：核对 X-CSRF-Token Header 与 CSRF Cookie 是否一致。
- Docker 中 AI 回复泛化或空内容：确认知识库挂载到 /knowledge-base。
- AI 接口超时：可为 AI 请求配置更长单独超时，避免受全局超时限制。
- 登录异常：优先检查数据库是否就绪及 seed 是否成功执行。

## 15. 文档索引

- [文档总览](doc/README.md)
- [架构设计](doc/01-ARCHITECTURE.md)
- [快速开始](doc/02-QUICKSTART.md)
- [API 指南](doc/03-API-GUIDE.md)
- [前端开发指南](doc/04-FRONTEND-DEV.md)
- [后端开发指南](doc/05-BACKEND-DEV.md)
- [部署与运维](doc/06-DEPLOYMENT.md)
- [知识库接入规范](doc/07-KNOWLEDGE-BASE-INTEGRATION.md)

## 16. 版本信息

- 当前版本：0.3.1
- 最近更新：2026-03-31

## 17. 许可证

本项目采用 MIT 许可证，详见 [LICENSE](LICENSE)。
