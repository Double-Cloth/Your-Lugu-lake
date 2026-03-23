# 🚢 部署和运维指南

## Docker 部署

### Docker Compose 快速启动

```bash
# 1. 启动所有服务
docker compose up --build

# 2. 后台运行
docker compose up -d

# 3. 查看日志
docker compose logs -f

# 4. 停止服务
docker compose down

# 5. 删除所有数据（重置）
docker compose down -v
```

### 服务配置详解

```yaml
# docker-compose.yml
version: "3.8"

services:
  # 前端服务
  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    environment:
      - VITE_API_URL=http://backend:8000
    depends_on:
      - backend

  # 后端服务
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:password@db:5432/lugu_lake
      - SECRET_KEY=your-secret-key
    depends_on:
      - db
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  # 数据库服务
  db:
    image: postgres:14
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=lugu_lake
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## 环境变量配置

### .env 文件示例

```bash
# 数据库配置
DATABASE_URL=postgresql://user:password@db:5432/lugu_lake
DATABASE_URL_TEST=postgresql://user:password@db:5432/lugu_lake_test

# 认证配置
SECRET_KEY=your-super-secret-key-change-this-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# AI 服务 (可选)
DASHSCOPE_API_KEY=your-dashscope-key
AI_ENABLED=false

# 前端配置
VITE_API_URL=http://localhost:8000

# 其他配置
DEBUG=True
LOG_LEVEL=INFO
```

## 监控和日志

### 查看服务日志

```bash
# 查看所有服务日志
docker compose logs

# 查看特定服务日志
docker compose logs backend
docker compose logs frontend
docker compose logs db

# 实时跟踪日志（-f flag）
docker compose logs -f backend

# 查看最后 100 行日志
docker compose logs --tail=100 backend
```

### 常见问题排查

#### 1. 前后端无法通信

```bash
# 检查容器网络
docker network ls
docker network inspect your-lugu-lake_default

# 验证服务间连接
docker compose exec frontend ping backend
docker compose exec backend curl http://frontend:5173
```

#### 2. 数据库连接失败

```bash
# 查看数据库日志
docker compose logs db

# 检查数据库是否就绪
docker compose exec db psql -U user -d lugu_lake -c "SELECT 1"
```

#### 3. API 返回 500 错误

```bash
# 查看后端日志中的错误堆栈
docker compose logs backend | grep ERROR

# 进入后端容器调试
docker compose exec backend /bin/bash
python -c "from app.main import app; print(app)"
```

## 性能优化

### 数据库查询优化

```python
# 使用 eager loading 避免 N+1 问题
from sqlalchemy.orm import joinedload

# 优化前：会产生多次查询
locations = db.query(Location).all()
for loc in locations:
    print(loc.checkins)  # 每次都查询一次

# 优化后：一次查询
locations = db.query(Location).options(
    joinedload(Location.checkins)
).all()
```

### 添加数据库索引

```python
# models.py
class User(Base):
    __tablename__ = "users"
    
    username = Column(String(50), unique=True, index=True)
    # index=True 会自动创建索引

class Checkin(Base):
    __tablename__ = "checkins"
    
    user_id = Column(UUID, ForeignKey("users.id"), index=True)
    location_id = Column(UUID, ForeignKey("locations.id"), index=True)
```

### 启用 GZIP 压缩

```python
# app/main.py
from fastapi.middleware.gzip import GZipMiddleware

app.add_middleware(GZipMiddleware, minimum_size=1000)
```

## 备份和恢复

### 备份数据库

```bash
# 使用 Docker 备份
docker compose exec db pg_dump -U user lugu_lake > backup.sql

# 或使用 pg_backup_api
docker compose exec db pg_dump --host=localhost --user=user --format=custom lugu_lake > backup.dump
```

### 恢复数据库

```bash
# 从 SQL 文件恢复
docker compose exec -T db psql -U user lugu_lake < backup.sql

# 从自定义格式恢复
docker compose exec -T db pg_restore -U user -d lugu_lake < backup.dump
```

## 扩展部署

### AWS EC2 部署示例

```bash
# 1. SSH 连接到实例
ssh -i your-key.pem ec2-user@your-instance-ip

# 2. 安装 Docker 和 Docker Compose
sudo yum update -y
sudo yum install docker -y
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 3. 启动 Docker
sudo systemctl start docker

# 4. 克隆项目
git clone <repo-url>
cd Your-Lugu-Lake

# 5. 启动服务
docker compose up -d

# 6. 配置 Nginx 反向代理 (可选)
# 将域名指向 EC2 public IP
```

### Kubernetes 部署 (高级)

```yaml
# kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: lugu-lake-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: lugu-lake-backend
  template:
    metadata:
      labels:
        app: lugu-lake-backend
    spec:
      containers:
      - name: backend
        image: your-registry/lugu-lake-backend:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: connection-string
```

## 监控告警

### 健康检查

```bash
# 检查前端健康状态
curl http://localhost:5173/

# 检查后端健康状态
curl http://localhost:8000/health

# 检查数据库连接
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/users/me
```

### 设置告警 (使用 Prometheus)

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'lugu-lake'
    static_configs:
      - targets: ['localhost:8000']
```

## 安全最佳实践

### 1. 环境变量管理

```bash
# ✅ DO: 使用 .env 文件和 .gitignore
echo ".env" >> .gitignore

# ❌ DON'T: 不要提交敏感信息到 Git
git rm --cached .env
```

### 2. 密钥轮换

```bash
# 定期更换 SECRET_KEY
# 在 .env 中更新并重启服务
docker compose down
# 编辑 .env
docker compose up -d
```

### 3. CORS 配置

```python
# app/main.py - 仅允许信任的源
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://yourdomain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 4. HTTPS 支持

```bash
# 使用 Let's Encrypt 获取免费证书
sudo certbot certonly --standalone -d yourdomain.com

# 配置 Nginx
server {
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ...
}
```

## 常见运维问题

### Q1: 容器不断重启？
**A:** 检查日志找出错误
```bash
docker compose logs backend | tail -50
```

### Q2: 磁盘空间不足？
**A:** 清理 Docker 垃圾
```bash
docker system prune -a
docker volume prune
```

### Q3: 内存溢出？
**A:** 增加容器限制或优化应用
```yaml
# docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 512M
```

### Q4: CPU 使用率过高？
**A:** 启用缓存和数据库索引
```python
from functools import lru_cache

@lru_cache(maxsize=128)
def get_locations():
    return db.query(Location).all()
```

## 版本管理和更新

### 更新依赖

```bash
# 前端
cd frontend
npm update

# 后端
cd backend
pip install --upgrade -r requirements.txt
```

### 蓝绿部署 (Zero-downtime update)

```bash
# 1. 启动新版本容器
docker compose build backend
docker compose up -d backend_v2

# 2. 测试新版本
curl http://localhost:8001

# 3. 切换流量
# 更新 docker-compose.yml 指向新版本

# 4. 清理旧版本
docker compose stop backend
```

## 日志分析

### 查看错误日志

```bash
# 查看过去 1 小时的错误
docker compose logs backend --since 1h | grep ERROR

# 查看特定错误
docker compose logs backend | grep "InvalidToken"
```

### 使用 ELK Stack 集中日志

```yaml
version: "3.8"
services:
  elasticsearch:
    image: elasticsearch:7.14.0
    environment:
      - discovery.type=single-node
  
  logstash:
    image: logstash:7.14.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
  
  kibana:
    image: kibana:7.14.0
    ports:
      - "5601:5601"
```

---

**相关文档:**
- 快速开始: `doc/02-QUICKSTART.md`
- 后端开发: `doc/05-BACKEND-DEV.md`

