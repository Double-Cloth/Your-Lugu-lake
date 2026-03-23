# 🏞️ 泸沽湖智能导览系统

<div align="center">

![License](https://img.shields.io/badge/license-MIT-green)
![Python](https://img.shields.io/badge/python-3.9%2B-blue)
![Node.js](https://img.shields.io/badge/node.js-16%2B-green)
![React](https://img.shields.io/badge/react-18-61dafb)
![FastAPI](https://img.shields.io/badge/fastapi-0.104-009485)

**一个全栈移动导览系统，集景点展示、AI 导览、打卡记录、旅行绘卷于一体**

[快速开始](#-快速开始) • [功能特性](#-功能特性) • [API 文档](#-api-完整文档) • [开发指南](#-开发文档)

</div>

---

## ⚡ 5 分钟快速开始

```bash
# 1. 克隆项目
git clone https://github.com/your-username/Your-Lugu-lake.git
cd Your-Lugu-lake

# 2. 复制配置文件
cp .env.example .env

# 3. 一键启动所有服务
docker compose up --build

# 打开浏览器访问：
# 🌐 前端：http://localhost:5173
# 📚 API：http://localhost:8000/docs
```

---

## ✨ 核心功能

### 🏠 首页 - 景点浏览
展示泸沽湖 8 个核心景点，支持分类筛选 (古镇 / 自然 / 人文)，一键进入景点详情和 AI 导览。

### 🧭 AI 导览 - 智能内容
接入阿里通义千问大模型，为每个景点生成个性化导览文本，包含历史背景、特色介绍、最佳线路等。

### ✓ 打卡系统 - 足迹记录
在景点进行打卡，添加备注和照片，查看打卡时间线，支持删除记录。

### 📄 旅行绘卷 - 数据可视化
根据打卡记录生成时间线，导出为分享图 (PNG) 或 PDF 文档，支持二维码分享。

### 👤 个人主页 - 用户中心
专业的用户卡片、统计数据面板、4 个彩色功能导航、个人信息编辑、账户管理。

### 📱 移动优化 - 完全响应式
完全响应式设计 (360px - 480px+)，底部固定导航栏，顶部固定页眉，支持安全区域 (刘海屏/挖孔屏)。

---

## 🛠️ 技术栈

**前端**: React 18 + Vite + Ant Design Mobile + 150+ CSS 样式  
**后端**: FastAPI + SQLAlchemy 2 + PostgreSQL 14  
**认证**: JWT Token (24h 有效期)  
**部署**: Docker Compose  

---

## 📚 完整文档

所有文档已整理到 `doc/` 文件夹：

| 文档 | 描述 |
|------|------|
| [快速开始](doc/02-QUICKSTART.md) | 环境配置、启动步骤、API 参考 |
| [架构设计](doc/01-ARCHITECTURE.md) | 系统架构、数据模型、通信流程 |
| [前端开发](doc/04-FRONTEND-DEV.md) | 项目结构、页面说明、开发规范 |
| [后端开发](doc/05-BACKEND-DEV.md) | API 设计、数据模型、业务逻辑 |
| [API 指南](doc/03-API-GUIDE.md) | 所有端点、请求响应示例 |
| [部署指南](doc/06-DEPLOYMENT.md) | Docker 部署、监控、优化 |

---

## 🚀 主要特性

- ✅ 完整的全栈应用框架
- ✅ 丰富的移动端组件库
- ✅ 专业的响应式设计
- ✅ 高级样式和动画效果
- ✅ RESTful API 设计
- ✅ JWT 用户认证
- ✅ Docker 一键部署
- ✅ 详细的开发文档
- ✅ 生产级代码质量
- ✅ 可扩展的架构设计

---

## 📊 项目用量

| 指标 | 数值 |
|------|------|
| CSS 大小 | 53.84 kB (11.29 kB gzip) |
| JS 大小 | 150.38 kB (51.46 kB gzip) |
| 前端页面 | 6 + 2 通用组件 |
| 后端 API | 20+ 端点 |
| 样式类 | 150+ |
| 文档页数 | 6 份详细指南 |

---

## 📖 快速导航

- 📘 [完整快速开始](doc/02-QUICKSTART.md) - 详细的启动和配置指南
- 🎨 [前端开发完整指南](doc/04-FRONTEND-DEV.md) - 页面结构、组件库、样式系统
- 🔧 [后端开发完整指南](doc/05-BACKEND-DEV.md) - 数据库、API 设计、业务逻辑
- 📚 [API 完整文档](doc/03-API-GUIDE.md) - 所有端点和示例
- 🏗️ [架构设计文档](doc/01-ARCHITECTURE.md) - 系统架构、数据流
- 🚢 [部署指南](doc/06-DEPLOYMENT.md) - Docker、监控、性能优化

---

## 📄 许可证

本项目采用 MIT 许可证，详见 [LICENSE](LICENSE) 文件。

---

**版本**: 0.2.4 | **最后更新**: 2026-03-23

准备好了吗? [立即开始 →](doc/02-QUICKSTART.md)
