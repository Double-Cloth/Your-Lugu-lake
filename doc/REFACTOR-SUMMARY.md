# 重构摘要（当前状态）

## 结论

项目文旅内容链路已调整为：
- 首页与专题介绍：knowledge-base 驱动
- 生态导览：主索引 + 子模块文件驱动
- 景点详情：knowledge-base 优先 + API/数据库回退
- 文档与目录结构：已与当前代码实现对齐

## 关键成果

1. 文案数据化
- 专题介绍文案不再写死在页面组件
- 详情页分节标题支持 `sections.*Title`

2. 数据结构优化
- `knowledge-base/common/pages/*` 统一专题页
- `knowledge-base/common/pages/eco-guide/*.json` 拆分生态导览模块
- `knowledge-base/locations/index.json` 维护映射

3. 接口能力增强
- 后端新增知识库读取接口
- 管理端支持二维码生成与批量导出
- 前端会话链路升级为 Cookie + CSRF（Bearer 保留兼容）

## 影响范围

- 前端：`api.js`、首页、专题页、景点详情页
- 后端：`api/locations.py`、`api/admin.py`
- 数据：`knowledge-base/common/*`、`knowledge-base/locations/*`
- 文档：`doc/*.md` 与 `knowledge-base/README.md`

## 访问路径备忘

- 首页：`/home`
- 景点详情：`/locations/:id`
- 泸沽湖专题：`/lugu-lake`
- 摩梭文化专题：`/mosuo-culture`
- 管理登录：`/admin/login`
