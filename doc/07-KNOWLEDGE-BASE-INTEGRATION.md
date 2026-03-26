# 知识库集成指南

## 目标

将景区介绍与景点详情从代码中抽离到 `knowledge-base/`，前端按数据渲染，后端提供回退接口。

## 当前目录约定

```text
knowledge-base/
├─ common/
│  ├─ overview.json
│  └─ pages/
│     ├─ lugu-lake.json
│     └─ mosuo-culture.json
├─ locations/
│  ├─ index.json
│  └─ {slug}/
│     ├─ info.json
│     └─ images/
├─ hotels/index.json
└─ nearby-spots/index.json
```

## 前端读取策略

1. 首页：
- `common/overview.json`
- `hotels/index.json`
- `nearby-spots/index.json`
- `locations/index.json`

2. 专题页：
- `common/pages/lugu-lake.json`
- `common/pages/mosuo-culture.json`

3. 景点详情页：
- 先读 `locations/{slug}/info.json`
- 失败回退后端 `/api/locations/knowledge-base/{slug}`
- 再失败回退数据库 `/api/locations/{id}`

## 后端知识库接口

- `GET /api/locations/knowledge-base/{slug}`
- `GET /api/locations/knowledge-base/{slug}/images`

## 关键字段约定

### common/pages/*.json
- `title`
- `description`
- `details.introduction`
- `details.highlights`
- `sections.highlightsTitle`
- `sections.tipsTitle`

### locations/{slug}/info.json
- 基础字段：`id/name/slug/category/latitude/longitude/description`
- 详情字段：`details.*`
- 分节标题：`sections.*Title`
- 资源字段：`images.basePath`, `images.files`, `audioUrl`

## 新增景点流程

1. 新建 `knowledge-base/locations/{slug}/`
2. 填写 `info.json`
3. 放置 `images/*`
4. 在 `locations/index.json` 注册 `id/slug/name`
5. 若景点已在 DB，确保 `id` 可映射到 `slug`

## 校验建议

```bash
# PowerShell JSON 校验示例
Get-Content knowledge-base/locations/lugu-lake/info.json -Raw | ConvertFrom-Json | Out-Null
```

## 常见问题

1. 页面显示数据库回退数据：
- 大概率是 `locations/index.json` 未映射成功

2. 图片不显示：
- 检查 `images.basePath` 与 `images.files`

3. 专题页标题未生效：
- 检查 `sections.tipsTitle` / `sections.highlightsTitle`
