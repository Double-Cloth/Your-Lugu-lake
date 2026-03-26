# 前端开发指南

## 目录结构（当前）

```text
frontend/src/
├─ api.js
├─ auth.js
├─ App.jsx
├─ main.jsx
├─ styles.css
├─ components/
│  ├─ PageHeader.jsx
│  └─ AIFloatingBall.jsx
└─ pages/
   ├─ HomePage.jsx
   ├─ LuguLakeOverviewPage.jsx
   ├─ MosuoCulturePage.jsx
   ├─ LocationDetailPage.jsx
   ├─ CheckinPage.jsx
   ├─ ScrollPage.jsx
   ├─ ProfilePage.jsx
   └─ admin/
      ├─ AdminLoginPage.jsx
      └─ AdminDashboardPage.jsx
```

## 路由

由 `App.jsx` 定义：
- `/home`
- `/checkin`
- `/me`
- `/scroll`
- `/lugu-lake`
- `/mosuo-culture`
- `/locations/:id`
- `/admin/login`
- `/admin`

兼容路由：`/guide` 会重定向到 `/home`。

## 状态与鉴权

### Token 存储

- 游客 token: `localStorage.user_token`
- 管理员 token: `localStorage.admin_token`

### auth 工具

`src/auth.js`：
- `setUserSession(token)`
- `clearUserSession()`
- `hasUserSession()`

## API 调用层

统一在 `src/api.js`：
- 基础客户端：axios，`VITE_API_BASE_URL`
- 鉴权头：`Authorization: Bearer ...`

重点方法：
- 用户：`registerUser`, `loginUser`, `fetchCurrentUser`, `updateCurrentUser`
- 景点：`fetchLocations`, `fetchLocationById`, `fetchLocationDetail`
- 知识库：`fetchKnowledgeBaseCommonPage`, `fetchKnowledgeBaseOverview`, `fetchKnowledgeBaseLocationsIndex`
- 打卡：`createFootprint`, `fetchMyFootprints`
- AI：`generateRoute`, `sceneChat`
- 管理：`fetchAdminStats`, `createAdminLocation`, `updateAdminLocation`, `deleteAdminLocation`, `generateLocationQr`, `downloadQrcodeZip`

## 页面说明

### HomePage
- 三模块入口：景区一览 / 文化导览 / 全域导览
- 内容由 knowledge-base 提供（overview、locations、hotels、nearby-spots）

### LuguLakeOverviewPage / MosuoCulturePage
- 专题页内容来自：`knowledge-base/common/pages/*.json`
- 分节标题读取 `sections.highlightsTitle` 与 `sections.tipsTitle`

### LocationDetailPage
- 通过 `fetchLocationDetail` 实现知识库优先、数据库回退
- 图片来自 `knowledge-base/locations/{slug}/images/*`
- 分节标题由 `info.json` 的 `sections.*Title` 控制

### CheckinPage
- 支持扫码解析 `/locations/{id}`
- 提交足迹时使用 `multipart/form-data`

### ProfilePage
- 游客注册/登录
- 资料更新
- 打卡记录聚合展示
- 海报生成功能

### AdminDashboardPage
- 管理员登录后管理景点 CRUD
- 生成单个二维码与批量导出二维码 zip

## 样式与交互

- 全局样式在 `styles.css`
- 组件库：`antd-mobile`
- 主要移动端布局：顶部 `PageHeader` + 底部 `TabBar`

## 本地开发

```bash
cd frontend
npm install
npm run dev
```

环境变量：
- `VITE_API_BASE_URL`（默认 `http://localhost:8000`）

## 调试建议

- 网络问题优先看浏览器 Network
- 认证问题先检查本地 `user_token/admin_token`
- 景点详情异常先检查 knowledge-base JSON 格式与 slug/id 映射
