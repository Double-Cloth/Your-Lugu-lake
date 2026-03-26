# 景点详情重构说明

## 重构目标

- 消除详情页文案和图片路径硬编码
- 改为知识库驱动
- 保留后端与数据库回退能力

## 已完成改动

### 前端

1. `frontend/src/api.js`
- 新增知识库读取方法：
- `fetchKnowledgeBaseLocationBySlug`
- `fetchKnowledgeBaseLocationImages`
- `fetchKnowledgeBaseLocationFromAPI`
- `fetchLocationDetail`

2. `frontend/src/pages/LocationDetailPage.jsx`
- 改为 `fetchLocationDetail(id)`
- 图片改为读取 `knowledge-base/locations/{slug}/images`
- 分节标题支持 `sections.*Title`

### 后端

`backend/app/api/locations.py` 增加：
- `GET /api/locations/knowledge-base/{slug}`
- `GET /api/locations/knowledge-base/{slug}/images`

### 数据

- `knowledge-base/locations/index.json` 维护 `id -> slug`
- `info.json` 增加 `sections` 字段用于标题配置

## 路由说明

前端详情页路由为：
- `/locations/:id`

不是 `/location/:id`。

## 验证项

1. 访问 `/locations/1` 可展示完整详情
2. 图片来自 knowledge-base 目录
3. 删除某个 `info.json` 后可回退数据库字段
4. `sections` 缺失时使用默认标题
