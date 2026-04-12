# CheckinPage 重构说明

## 概述

按照项目其余页面风格重构打卡页面，集成**高德地图API**替代canvas轨迹绘制，提升用户体验和地理精准性。

**重构时间**: 2026-04-08  
**开发者**: AI Assistant  
**状态**: 已完成并通过构建验证

---

## 核心改进

### 1. 地图引擎升级
| 原方案 | 新方案 |
|--------|--------|
| Canvas 绘制 | 高德地图可视化 |
| 静态图形 | 交互式地图 |
| 自定义投影 | 真实GIS坐标系 |
| 无上下文 | 真实地理背景 |

**高德地图特性**:
- 实时地图显示与交互
- 精确定位和轨迹绘制
- 自动视图调整
- 路线规划补充

### 2. UI/UX 改进

#### 页面布局
```
hero-shell (头部说明)
├── 地图卡片 (CardComponent, h-64)
├── 实时轨迹卡片
│   ├── 开始/停止轨迹
│   ├── 定位位置 + 重置轨迹
│   └── 轨迹点统计
├── 二维码扫描卡片
├── 景点信息卡片
├── GPS坐标显示卡片
└── 打卡表单卡片
    ├── 心情输入
    ├── 照片上传
    └── 提交按钮
```

#### 一致性设计
- 所有卡片使用 `CardComponent variant="glass"`
- 图标集成 `LucideIcon`（Navigation, QrCode, MapPin, Heart 等）
- 状态指示器（定位中/未定位、绿色/灰色）
- 禁用状态管理（未获取定位时禁用提交）

### 3. 功能实现

#### 🌍 地图实时轨迹
```javascript
// 使用高德地图 API
// 1. 动态加载脚本
const script = document.createElement("script");
script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}`;

// 2. 绘制轨迹 Polyline
const polyline = new AMap.Polyline({
  path: trackPoints,  // [[lon, lat], ...]
  strokeColor: "#00D9FF",
  strokeWeight: 4,
});

// 3. 标记当前位置 Marker
const marker = new AMap.Marker({
  position: [lon, lat],
  title: "当前位置",
});

// 4. 自动调整视图
map.setFitView([marker]);
```

#### 📍 GPS 定位
- 精度: 高精度定位 (`enableHighAccuracy: true`)
- 方式: 
  - 实时追踪: `watchPosition()` (主动更新)
  - 单次定位: `getCurrentPosition()` (获取位置按钮)
- 精度显示: 保留4位小数

#### 📱 二维码扫描
继承自原版本，无备改动:
- 使用 `html5-qrcode` 库
- 支持前置摄像头
- 自动识别景点ID
- 扫码成功后弹窗显示景点详情

#### 打卡提交
- 表单数据: location_id, gps_lat, gps_lon, mood_text, photo
- 验证: 必需 location_id + gis坐标
- 成功后: 清空表单 + 重置轨迹
- 反馈: Toast 提示

---

## 配置说明

### 高德地图 API Key 获取

1. **注册账号**
   - 访问 https://lbs.amap.com
   - 点击"开发者中心" → "我的账户"

2. **创建应用**
   - 进入 https://lbs.amap.com/dev/key/app
   - 创建新应用
   - 选择 "Web 应用(JS API)"

3. **配置 Key**
   - 在 `.env` 文件中设置:
   ```env
   VITE_AMAP_KEY=your_key_here
   ```
   - 示例 Key 已提供用于演示测试

### 环境变量
```env
# 高德地图 Key
VITE_AMAP_KEY=ce77f0a265a7f52fd4de3d5cd76b9261

# 后端 API
VITE_API_BASE_URL=http://localhost:8000

# CSRF 配置
VITE_CSRF_COOKIE_NAME=lugu_csrf_token
VITE_CSRF_HEADER_NAME=X-CSRF-Token
```

参考文件: `.env.example`

---

## 技术栈

### 新增
- **高德地图 JS API 2.0** (CDN 加载)
  - 版本: v2.0
  - Polyline: 轨迹线绘制
  - Marker: 位置标记
  - 地图样式: darkblue

### 保留
- React 18 Hooks
- antd-mobile 组件库
- html5-qrcode 二维码
- Tailwind CSS 样式

### 依赖
总体无新增 npm 依赖，使用 CDN 加载高德地图。

```json
{
  "dependencies": {
    "antd-mobile": "^5.38.1",
    "html5-qrcode": "^2.3.8",
    "lucide-react": "^0.377.0",
    "react": "^18.3.1",
    "react-router-dom": "^6.27.0"
  }
}
```

---

## 使用流程

### 用户操作步骤

1. **开始实时轨迹**
   - 点击"开始实时轨迹"按钮
   - 允许地理位置权限
   - 移动设备，轨迹线在地图上实时显示
   - 当前位置用橙色标记

2. **定位我的位置**
   - 点击"定位我的位置"
   - 地图自动缩放到当前位置 (缩放级别16)
   - GPS 坐标显示在下方

3. **扫描景点二维码**
   - 点击"启动二维码扫描"
   - 对准景点二维码
   - 自动识别并填充景点ID
   - 显示景点详情

4. **或者手动输入景点ID**
   - 在"景点ID"输入框直接输入
   - 回显景点基本信息

5. **填写打卡信息**
   - "分享你的感受":  输入打卡备注
   - "上传照片": 选择本地照片 (最多1张)
   - "确认打卡": 提交打卡

6. **成功反馈**
   - Toast 提示"打卡成功"
   - 表单清空
   - 轨迹重置
   - 继续下一个打卡

---

## 开发指南

### 本地开发启动

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
# 访问 http://localhost:5174
```

### 构建生产版本

```bash
npm run build
# 输出到 dist/
```

### 关键文件

```
frontend/src/pages/CheckinPage.jsx       # 主组件
frontend/.env/.env.example               # 配置文件
frontend/src/components/SharedUI.jsx     # UI 组件库
frontend/index.html                      # 全局 HTML
```

---

## API 调用

### 后端接口依赖

| 接口 | 用途 | 认证 |
|------|------|------|
| `POST /api/footprints/create` | 提交打卡 | 需要 |
| `GET /api/locations/{id}` | 获取景点信息 | 不需要 |
| 用户登录 | 打卡前登录 | Cookie/Token |

### 数据格式

**打卡提交**:
```javascript
FormData {
  location_id: string,      // 例: "1"
  gps_lat: string,          // 例: "27.6452"
  gps_lon: string,          // 例: "100.7537"
  mood_text: string,        // 选填
  photo: File               // 选填
}
```

**响应示例**:
```json
{
  "id": 123,
  "user_id": 456,
  "location_id": 1,
  "check_in_time": "2026-04-08T15:56:00Z",
  "gps_lat": 27.6452,
  "gps_lon": 100.7537,
  "mood_text": "景色很棒",
  "photo_url": "/uploads/footprints/..."
}
```

---

## 故障排查

### 问题1: 地图不显示
**原因**: 
- 高德 API Key 无效或过期
- CDN 加载超时
- 浏览器 CORS 限制
- 当前访问域名或 IP 未加入高德 Web JS API 白名单
- Key 与 `securityJsCode` 不属于同一个高德应用

**解决**:
- 检查 `.env` 中的 `VITE_AMAP_KEY`
- 在浏览器 DevTools Network 检查 amap.com 请求
- 在高德控制台把当前访问来源加入 Web JS API 白名单
- 确认 `VITE_AMAP_SECURITY_JS_CODE` 和 `VITE_AMAP_KEY` 来自同一个应用
- 尝试使用 localhost 或已备案的正式域名访问

### 问题2: GPS 定位失败
**原因**:
- 未授予地理位置权限
- HTTPS 非安全环境
- 设备不支持地理定位

**解决**:
- 检查浏览器权限设置
- 本地开发必须使用 localhost
- 某些浏览器需要 HTTPS

### 问题3: 轨迹线不显示
**原因**:
- trackPoints 为空
- 地图未初始化完成
- Polyline 创建失败

**解决**:
- 确保已点击"开始实时轨迹"并允许定位
- 检查浏览器控制台错误
- 验证 geoLocation 权限

### 问题4: 打卡提交失败
**原因**:
- 未登录 (401 错误)
- 缺少必需字段
- 后端服务不可用

**解决**:
- 先在"我的"页面登录
- 确保景点ID和GPS坐标已填充
- 检查后端服务状态

---

## 性能优化建议

1. **地图加载**
   - 考虑 CDN 缓存策略
   - 非首次加载时使用缓存

2. **轨迹更新**
   - 当前使用每次 trackPoints 变化重新绘制
   - 考虑节流 (throttle) 高频定位更新

3. **图片上传**
   - 压缩图片大小
   - 实现客户端预览

---

## 未来增强方向

- [ ] 轨迹统计 (距离、时间、速度)
- [ ] 与路线规划集成
- [ ] 打卡历史回放
- [ ] 热力图展示
- [ ] 离线地图支持
- [ ] 多图片上传

---

## 参考资源

- 高德地图文档: https://lbs.amap.com/api/javascript-api/guide/abc
- React Hooks: https://react.dev/reference/react
- Tailwind CSS: https://tailwindcss.com
- antd-mobile: https://mobile.ant.design

---

**最后更新**: 2026-04-08  
**作者**: AI Engineering Assistant
