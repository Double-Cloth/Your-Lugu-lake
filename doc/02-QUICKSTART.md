# 🚀 快速开始指南

## 一、环境准备

### 1. 系统要求
- **OS**: Windows / macOS / Linux
- **Docker**: ≥ 20.10
- **Node.js**: ≥ 16 (仅用于前端开发调试)
- **Python**: ≥ 3.9 (仅用于后端开发调试)

### 2. 安装 Docker & Docker Compose

#### Windows
```powershell
# 使用 WSL 2 后端
# 从 Docker 官网下载 Docker Desktop: https://www.docker.com/products/docker-desktop
# 安装后在 Settings → General → WSL 2 中启用
```

#### macOS / Linux
```bash
# 使用包管理器
brew install docker docker-compose  # macOS
sudo apt-get install docker.io docker-compose  # Ubuntu/Debian
```

## 二、项目启动（5分钟快速上手）

### 方法 1: Docker Compose (推荐)

```bash
# 1. 克隆项目
git clone <repo-url>
cd Your-Lugu-lake

# 2. 复制环境变量文件
cp .env.example .env
# 或 Windows PowerShell:
Copy-Item .env.example .env

# 3. 一键启动所有服务
docker compose up --build

# 4. 等待服务启动完毕（约 30-60 秒）
```

**访问地址:**
- 🌐 **前端**: http://localhost:5173
- 📚 **后端 Swagger**: http://localhost:8000/docs
- 🗄️ **数据库**: localhost:5432 (pgAdmin: http://localhost:5050)

### 方法 2: 本地开发环境 (仅限开发者)

#### 前端开发

```bash
cd frontend

# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev

# 3. 访问 http://localhost:5173
```

#### 后端开发

```bash
cd backend

# 1. 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 2. 安装依赖
pip install -r requirements.txt

# 3. 启动数据库 (需要本地 PostgreSQL)
# 配置 .env 中的 DATABASE_URL

# 4. 运行迁移
alembic upgrade head

# 5. 启动开发服务器
uvicorn app.main:app --reload
```

## 三、项目核心功能

### 用户系统

```
登录流程:
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│ 输入账号密码 │────→│ 验证凭证     │────→│ 返回 JWT     │
└─────────────┘     └─────────────┘     └──────────────┘
                           ↓
                    ☑ 长度校验
                    ☑ 密码验证
                    ☑ 用户状态检查
```

**快速体验**
- 默认管理员: `admin` / `admin`
- 默认游客账号: 任意账号注册 (使用普通注册表单)

### 景点浏览

```
首页 → 景点列表 → 选择景点 → 查看详情
 ↓      ↓           ↓         ↓
展示    分类         地图      • 名称
泸沽湖  • 古镇       • 坐标    • 描述
美景    • 自然       • 距离    • 图片
        • 人文                 • AI导览
```

### 打卡系统

```
功能: 用户在景点扫码或手动打卡记录旅行足迹

流程:
1️⃣ 进入景点详情
2️⃣ 点击"打卡"按钮
3️⃣ （可选）添加打卡备注
4️⃣ 确认打卡 → 记录到"我的打卡"
5️⃣ 积累打卡数据用于生成旅行绘卷
```

### 旅行绘卷

```
功能: 根据打卡记录生成个人旅行时间轴和分享图

生成流程:
1️⃣ 进入"旅行绘卷"页面
2️⃣ 系统整理用户的所有打卡记录
3️⃣ 按时间线排序展示
4️⃣ 支持导出为:
   • 分享图 (PNG)
   • PDF 文档
5️⃣ 通过二维码分享给朋友
```

### 个人主页

```
功能: 统一的用户信息管理中心

包含:
┌────────────────────────────────┐
│ 👤 用户头像 + 个性签名          │ ← Hero 头部
├────────────────────────────────┤
│ 📊 统计面板: 打卡数/景点数/绘卷数 │ ← 数据展示
├────────────────────────────────┤
│ 🎯 快捷导航: 打卡/绘卷/收藏/勋章 │ ← 功能快速入口
├────────────────────────────────┤
│ ⚙️ 账户管理: 修改签名/退出登录   │ ← 设置
└────────────────────────────────┘
```

## 四、API 快速参考

### 认证相关

```bash
# 用户注册
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "my_account",
    "password": "secure_password"
  }'

# 用户登录
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "my_account",
    "password": "secure_password"
  }'

# 响应示例
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "username": "my_account",
    "role": "user"
  }
}
```

### 景点相关

```bash
# 获取景点列表
curl http://localhost:8000/locations

# 过滤景点 (分类)
curl "http://localhost:8000/locations?category=古镇"

# 获取景点详情
curl http://localhost:8000/locations/{location_id}

# 获取 AI 导览文本
curl http://localhost:8000/locations/{location_id}/guide
```

### 打卡相关

```bash
# 创建打卡记录
curl -X POST http://localhost:8000/checkins \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "location_id": "uuid",
    "notes": "美景如画"
  }'

# 获取用户的打卡列表
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/checkins/user
```

## 五、文件结构说明

```
Your-Lugu-lake/
├── 📂 frontend/                # React 前端项目
│   ├── src/
│   │   ├── pages/             # 页面组件
│   │   ├── components/        # 通用组件
│   │   ├── api/               # API 接口
│   │   ├── auth/              # 认证模块
│   │   ├── App.jsx
│   │   └── styles.css         # 全局样式
│   ├── package.json
│   └── vite.config.js
│
├── 📂 backend/                 # FastAPI 后端项目
│   ├── app/
│   │   ├── main.py            # 应用入口
│   │   ├── models.py          # 数据模型
│   │   ├── routers/           # API 路由
│   │   ├── services/          # 业务逻辑
│   │   └── utils/             # 工具函数
│   ├── seed.py                # 初始数据
│   ├── requirements.txt
│   └── Dockerfile
│
├── 📂 doc/                     # 文档（完整指南）
│   ├── 01-ARCHITECTURE.md
│   ├── 02-QUICKSTART.md
│   ├── 03-API-GUIDE.md
│   ├── 04-FRONTEND-DEV.md
│   ├── 05-BACKEND-DEV.md
│   └── ...
│
├── docker-compose.yml         # Docker 配置
├── .env.example               # 环境变量示例
├── .gitignore
├── LICENSE
└── README.md
```

## 六、常见问题 (FAQ)

### Q1: Docker 容器启动失败？
**A**: 检查端口占用
```bash
# 查看占用的端口
netstat -ano | findstr :5173  # Windows
lsof -i :5173                 # macOS/Linux

# 修改 docker-compose.yml 中的端口配置
```

### Q2: 前端和后端无法通信？
**A**: 检查网络环境
```bash
# 查看 docker 网络状态
docker network ls
docker network inspect your-lugu-lake_default

# 检查 frontend 中的 API_URL 配置
# 通常应该指向 http://backend:8000 或 http://localhost:8000
```

### Q3: 数据库连接错误？
**A**: 检查 `.env` 配置
```bash
# .env 示例
DATABASE_URL=postgresql://user:password@db:5432/lugu_lake
DATABASE_URL_TEST=postgresql://user:password@db:5432/lugu_lake_test
```

### Q4: 如何重置数据库？
```bash
# 方法 1: 使用 seed 脚本
docker compose exec backend python seed.py

# 方法 2: 删除并重建容器
docker compose down -v
docker compose up --build
```

## 七、下一步

✅ 完成本快速开始  
👉 阅读后端开发指南 → `doc/05-BACKEND-DEV.md`  
👉 阅读前端开发指南 → `doc/04-FRONTEND-DEV.md`  
👉 查看 API 完整文档 → `doc/03-API-GUIDE.md`  
👉 深入架构设计 → `doc/01-ARCHITECTURE.md`  

---

**需要帮助?** 查看项目根目录的 `README.md` 或提交 Issue

