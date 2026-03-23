# 🎨 前端开发完整指南

## 项目结构

```
frontend/
├── src/
│   ├── pages/                    # 页面组件
│   │   ├── HomePage.jsx         # 首页 - 景点列表
│   │   ├── GuidePage.jsx        # AI 导览页
│   │   ├── CheckinPage.jsx      # 打卡页面
│   │   ├── ProfilePage.jsx      # 个人主页
│   │   ├── ScrollPage.jsx       # 旅行绘卷
│   │   └── LocationDetailsPage.jsx  # 景点详情
│   ├── components/              # 通用组件
│   │   ├── PageHeader.jsx       # 固定页眉
│   │   └── TabBar.jsx           # 底部导航
│   ├── api/                     # API 接口层
│   │   └── index.js
│   ├── auth/                    # 认证管理
│   │   └── index.js
│   ├── App.jsx                  # 主应用和路由
│   └── styles.css               # 全局样式系统
├── package.json
├── vite.config.js
└── Dockerfile
```

## 开发环境设置

### 1. 安装依赖

```bash
cd frontend
npm install
```

### 2. 启动开发服务器

```bash
npm run dev

# 输出:
#   VITE v5.4.21 ready in 123 ms
#
#   ➜  Local:   http://localhost:5173/
#   ➜  Press h to show help
```

### 3. 构建生产版本

```bash
npm run build

# 输出:
#   vite v5.4.21 building for production...
#   ✓ 1384 modules transformed.
#   dist/index.html        1.60 kB
#   dist/assets/index.css  53.84 kB
#   dist/assets/index.js 150.38 kB
```

## 核心技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.x | UI 框架 |
| React Router | 7.x | 客户端路由 (future flags) |
| Vite | 5.x | 构建工具 |
| Ant Design Mobile | 5.x | 移动组件库 |
| Tailwind CSS | 3.x | 样式工具类 |

## 页面详细说明

### HomePage.jsx - 首页

**功能:**
- 展示泸沽湖 8 个核心景点
- 分类筛选（古镇/自然/人文）
- 景点卡片展示（名称/描述/图片）
- 点击进入景点详情

**关键组件:**
```jsx
export default function HomePage() {
  const [locations, setLocations] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  
  // 加载景点列表
  useEffect(() => {
    fetchLocations().then(setLocations);
  }, []);
  
  // 分类过滤
  const filtered = selectedCategory 
    ? locations.filter(l => l.category === selectedCategory)
    : locations;
}
```

**样式类:**
- `.hero-shell` - Hero 区域
- `.location-card` - 景点卡片
- `.card-elevated` - 卡片提升效果

### GuidePage.jsx - AI 导览页

**功能:**
- 获取 AI 生成的景点导览文本
- 展示导览内容
- 支持语音播放（可选）

**关键 Hook:**
```jsx
useEffect(() => {
  const guideText = await getLocationGuide(locationId);
  setGuide(guideText);
}, [locationId]);
```

### CheckinPage.jsx - 打卡页面

**功能:**
- 显示用户的所有打卡记录
- 打卡时间线展示
- 支持删除打卡

**打卡流程:**
```jsx
async function handleCheckin(locationId, notes) {
  const result = await createCheckin({
    location_id: locationId,
    notes: notes
  });
  
  if (result.success) {
    Toast.show({ content: "打卡成功" });
    // 刷新列表
  }
}
```

### ProfilePage.jsx - 个人主页 ⭐ 新设计

**已登录状态:**
1. **Hero 头部** - 大头像 + 用户名 + 个性签名 + 验证徽章
2. **统计面板** - 3 列网格显示打卡次数/景点数/绘卷数
3. **功能导航** - 2x2 网格，4 个彩色快速入口
4. **个人信息** - 账号展示 + 个性签名编辑
5. **账户管理** - 退出登录按钮

**未登录状态:**
1. **登录表单** - 账号/密码输入
2. **快速开始** - 5 步引导
3. **功能展示** - 4 个核心功能卡片

**关键样式:**
```css
.profile-hero-section      /* 蓝色渐变头部 */
.profile-stats-grid        /* 3 列统计网格 */
.profile-action-grid       /* 2x2 功能网格 */
.action-btn.primary        /* 蓝色按钮 */
.action-btn.secondary      /* 绿色按钮 */
.action-btn.tertiary       /* 橙色按钮 */
.action-btn.quaternary     /* 红色按钮 */
```

### ScrollPage.jsx - 旅行绘卷

**功能:**
- 显示用户的旅行记录时间线
- 生成分享图/PDF
- 导出功能

### LocationDetailsPage.jsx - 景点详情

**功能:**
- 显示景点详细信息
- 展示 AI 导览内容
- 打卡按钮
- 地图定位（可选）

## 组件库

### PageHeader - 固定页眉

```jsx
import PageHeader from "@/components/PageHeader";

// 自动显示页面标题和返回按钮
<PageHeader />
```

**自动配置的页面:**
- `/` → 首页 (无返回按钮)
- `/guide` → AI 导览 (无返回按钮)
- `/checkin` → 打卡 (无返回按钮)
- `/scroll` → 绘卷 (有返回按钮)
- `/locations/:id` → 景点详情 (有返回按钮)
- `/me` → 个人 (无返回按钮)

### TabBar - 底部导航

```jsx
// 自动在 App.jsx 中呈现
// 固定在底部，包含 5 个主要导航项
```

**导航项:**
1. 🏠 首页 → `/`
2. 🧭 导览 → `/guide`
3. ✓ 打卡 → `/checkin`
4. 📄 绘卷 → `/scroll`
5. 👤 我的 → `/me`

## 路由配置

```jsx
// App.jsx
const routes = [
  { path: "/", element: <HomePage /> },
  { path: "/guide", element: <GuidePage /> },
  { path: "/checkin", element: <CheckinPage /> },
  { path: "/scroll", element: <ScrollPage /> },
  { path: "/locations/:id", element: <LocationDetailsPage /> },
  { path: "/me", element: <ProfilePage /> },
];
```

## API 调用模式

### 实现位置: `src/api/index.js`

```javascript
// 基础配置
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

function getAuthToken() {
  return localStorage.getItem("auth_token");
}

// API 调用函数
export async function fetchLocations() {
  const res = await fetch(`${API_BASE}/locations`);
  return res.json();
}

export async function createCheckin(data) {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}/checkins`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  return res.json();
}

// 错误处理
export async function handleApiError(error) {
  if (error.status === 401) {
    // Token 过期，清除并重定向到登录
    clearUserSession();
    window.location.href = "/me";
  }
}
```

## 认证管理

### 实现位置: `src/auth/index.js`

```javascript
// 检查用户是否已登录
export function hasUserSession() {
  return !!localStorage.getItem("auth_token");
}

// 设置用户会话 (登录时)
export function setUserSession(token, user) {
  localStorage.setItem("auth_token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

// 清除用户会话 (退出时)
export function clearUserSession() {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("user");
}

// 获取当前用户
export function getCurrentUser() {
  const user = localStorage.getItem("user");
  return user ? JSON.parse(user) : null;
}
```

## 样式系统

### 全局样式: `styles.css`

**主要样式类别:**

```css
/* 布局 */
.mobile-shell          /* 移动容器 */
.mobile-content        /* 可滚动内容区 */
.page-header           /* 固定页眉 */

/* 卡片 */
.card                  /* 基础卡片 */
.card-elevated         /* 提升卡片 */
.card-glass            /* 毛玻璃卡片 */
.card-neon             /* 霓虹卡片 */

/* 按钮 */
.adm-button--primary   /* 主按钮 */
.adm-button--danger    /* 危险按钮 */
.adm-button--success   /* 成功按钮 */

/* 徽章 */
.badge-primary         /* 主徽章 */
.badge-success         /* 成功徽章 */
.badge-warning         /* 警告徽章 */

/* 表单 */
.form-group            /* 表单组 */
.form-label            /* 表单标签 */
.input-helper-text     /* 帮助文本 */

/* 响应式 */
@media (max-width: 480px) { }
@media (max-width: 380px) { }
```

### 常用工具类 (Tailwind)

```jsx
// 外边距
<div className="mb-3 mt-2">...</div>  // margin-bottom, margin-top

// 内边距
<div className="px-4 py-2">...</div>  // padding horizontal, vertical

// 文本
<p className="text-center text-sm">...</p>

// 弹性布局
<div className="flex gap-2 justify-between">...</div>

// 网格
<div className="grid grid-cols-2 gap-3">...</div>
```

## 常见开发任务

### 1. 添加新页面

```jsx
// 1. 创建 src/pages/NewPage.jsx
export default function NewPage() {
  return <div className="page-fade-in">Your content</div>;
}

// 2. 在 App.jsx 中添加路由
// 3. 在 TabBar.jsx 中添加导航项（如需要）
```

### 2. 调用 API

```jsx
import { fetchLocations } from "@/api";

useEffect(() => {
  fetchLocations().then(data => {
    setLocations(data.data);
  });
}, []);
```

### 3. 处理用户认证

```jsx
import { hasUserSession, setUserSession, clearUserSession } from "@/auth";

// 检查登录
if (!hasUserSession()) {
  navigate("/me");
}

// 登录
const token = loginResponse.data.access_token;
setUserSession(token, loginResponse.data.user);

// 退出
clearUserSession();
```

### 4. 显示 Toast 提示

```jsx
import { Toast } from "antd-mobile";

Toast.show({
  content: "操作成功",
  icon: "success",
  duration: 2000
});
```

## 调试技巧

### 1. 查看网络请求

在浏览器开发者工具 → Network 标签中查看所有 API 请求

### 2. 查看本地存储

在浏览器开发者工具 → Application → Local Storage 中查看 `auth_token`

### 3. React 开发者工具

安装 React DevTools 浏览器插件，查看组件树和状态

### 4. Vite 调试模式

在 `vite.config.js` 中启用源代码映射：
```javascript
export default {
  build: {
    sourcemap: true
  }
}
```

## 性能优化

### 1. 代码分割

```jsx
// 使用 lazy 加载大型页面
const HomePage = lazy(() => import("./pages/HomePage"));
const GuidePage = lazy(() => import("./pages/GuidePage"));

// 在路由中使用
<Suspense fallback={<Loading />}>
  <HomePage />
</Suspense>
```

### 2. 图片优化

```jsx
// 使用 img lazy loading
<img 
  src="..." 
  loading="lazy" 
  alt="description"
/>
```

### 3. 缓存策略

```javascript
// 缓存 API 响应
const cache = new Map();

export async function fetchLocations() {
  if (cache.has("locations")) {
    return cache.get("locations");
  }
  
  const data = await fetch(...).then(r => r.json());
  cache.set("locations", data);
  return data;
}
```

## 开发规范

### 命名规范
- 文件名: PascalCase (HomePage.jsx, TabBar.jsx)
- 变量/函数: camelCase (setLocations, handleClick)
- CSS 类名: kebab-case (.profile-hero-section)

### 代码格式
- 使用 2 空格缩进
- 推荐使用 Prettier 自动格式化

### 组件结构
```jsx
// 1. 导入
import { useState, useEffect } from "react";
import { Button, Card } from "antd-mobile";

// 2. 组件定义
export default function MyComponent() {
  // 3. State hooks
  const [state, setState] = useState();
  
  // 4. Effect hooks
  useEffect(() => {}, []);
  
  // 5. 事件处理函数
  const handleClick = () => {};
  
  // 6. JSX 返回
  return <div>...</div>;
}
```

## 常见问题

### Q: 如何修改 API 端口?
**A:** 在 `.env` 中设置 `VITE_API_URL`

### Q: 如何添加新的样式?
**A:** 在 `styles.css` 中添加新的 CSS 类

### Q: 如何测试某个页面?
**A:** 在浏览器中直接访问 `http://localhost:5173/page-name`

---

**需要帮助?** 查看后端开发指南 → `doc/05-BACKEND-DEV.md`

