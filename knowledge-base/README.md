# AI知识库 - 泸沽湖景区

## 目录结构

```
knowledge-base/
├── common/                          # 公用配置文件夹
│   ├── config.json                 # 知识库全局配置
│   ├── categories.json             # 景点类别定义
│   ├── overview.json               # 首页景区一览配置（入口与跳转）
│   ├── pages/
│   │   ├── index.json              # 专题页面索引
│   │   ├── lugu-lake.json          # 泸沽湖整体介绍（公共总览）
│   │   ├── mosuo-culture.json      # 摩梭文化介绍（公共总览）
│   │   ├── eco-guide.json          # 生态导览主索引
│   │   └── eco-guide/              # 生态导览子模块
│   └── README.md                   # 公用文档
│
├── locations/                       # 景点知识库文件夹
│   ├── index.json                  # 具体景点索引（id/slug/name）
│   ├── luyuan-cliff/               # 示例具体景点：泸源崖
│   │   ├── info.json
│   │   ├── images/
│   │   └── audio/
│   │
│   ├── [更多景点]/
│   └── README.md                   # 景点文档
│
└── README.md                        # 这个文件
```

## 文件说明

### 分层原则（重要）

- `common/`：全域总览与公共内容（如泸沽湖整体介绍、摩梭文化介绍）
- `locations/`：具体可游览景点（用于全域导览与景点详情页）

`泸沽湖`整体介绍已迁移到 `common/pages/lugu-lake.json`，不再作为 `locations` 下具体景点。

### config.json - 知识库配置
全局配置文件，包含：
- 知识库版本
- 名称和描述
- 最后更新时间
- 功能开关

### hotels/ & nearby-spots/ - 酒店与周边推荐
独立存放酒店与周边景点的推荐配置文件，避免共用造成臃肿。目录存在 `index.json` 返回数组结构。

### overview.json - 首页景区一览配置
- 配置“泸沽湖整体介绍”“摩梭文化介绍”模块标题
- 配置独立详情页跳转路径（如 `/lugu-lake`、`/mosuo-culture`）
- 通过 `dataFile` 指向 `common/pages/*.json` 的专题内容

### common/pages/*.json - 专题页面内容
- 统一维护各专题页介绍文案（description、details.introduction）
- 统一维护专题页分节标题（sections.highlightsTitle、sections.tipsTitle）
- 前端页面不再在代码中写死介绍文本
- 生态导览已采用模块化：`common/pages/eco-guide.json` 作为索引，具体内容拆分在 `common/pages/eco-guide/*.json`

### 生态导览模块文件建议

- `science.json`：基础生态科普导语
- `rare-fauna.json`：珍稀动物列表及环境/人类价值
- `rare-flora.json`：珍稀植物列表及环境/人类价值
- `ecosystem-benefits.json`：总体价值汇总
- `wellness-route.json`：康养路线分时段建议
- `observation-tips.json`：低干扰观察守则

### locations/index.json - 具体景点索引
- 统一维护具体景点的 `id/slug/name`
- 前端通过该索引加载 `locations/{slug}/info.json`

### categories.json - 类别定义
定义景点的分类体系：
- culture: 文化景点
- nature: 自然风景
- activity: 活动体验
- dining: 美食文化
- accommodation: 住宿设施

### 景点 info.json 模板

每个景点文件夹必须包含 `info.json`，结构如下：

```json
{
  "id": 1,                           // 景点唯一ID
  "name": "景点名称",
  "slug": "景点-英文-slug",          // 用于URL和文件夹名称
  "category": "nature",              // 景点类别
  "latitude": 27.6931,               // 纬度
  "longitude": 100.7883,             // 经度
  "description": "简短描述",
  "details": {
    "introduction": "详细介绍",
    "highlights": ["亮点1", "亮点2"],
    "bestSeasonToVisit": "3月-11月",
    "recommendedDuration": "2-3天",
    "accommodationTips": "住宿建议"
  },
  "sections": {
    "highlightsTitle": "景点亮点",
    "galleryTitle": "景点图片",
    "visitInfoTitle": "游览信息",
    "locationTitle": "位置信息",
    "transportationTitle": "交通方式",
    "facilitiesTitle": "设施服务",
    "ticketTitle": "票价信息"
  },
  "location": {
    "province": "云南省",
    "city": "丽江市",
    "district": "盐源县",
    "address": "详细地址"
  },
  "transportation": {
    "byAir": "航空交通",
    "byTrain": "铁路交通",
    "byBus": "汽车交通"
  },
  "facilities": {
    "parking": true,                 // 是否有停车场
    "restroom": true,                // 是否有厕所
    "foodAndDrink": true,            // 是否有餐饮
    "accommodation": true,           // 是否有住宿
    "medicalService": true           // 是否有医疗服务
  },
  "ticketInfo": {
    "price": 100,
    "currency": "CNY",
    "validDays": 1,
    "remark": "备注"
  },
  "contact": {
    "phone": "电话号码",
    "website": "网址"
  },
  "tags": ["标签1", "标签2"],        // SEO标签
  "images": {
    "count": 2,
    "basePath": "images/",
    "files": ["1.jpg", "2.jpg"]      // 图片文件列表
  },
  "audioUrl": "/audio/intro.mp3",   // 语音介绍链接
  "lastUpdated": "2026-03-26"
}
```

## 图片管理规则

- 在景点文件夹下创建 `images/` 子目录
- 图片命名：`1.jpg`, `2.jpg`, `3.jpg` 等
- 支持格式：jpg, jpeg, png, webp
- 建议尺寸：1920x1280 或更小（优化加载速度）
- 在 info.json 的 images.files 中声明所有图片

## 音频管理规则

- 在景点文件夹下创建 `audio/` 子目录（可选）
- 音频文件：MP3格式，建议时长 1-3 分钟
- 在 info.json 的 audioUrl 中指定音频链接
- 用于 AI 语音导览和多媒体展示

## 添加新景点步骤

1. 在 `locations/` 下创建新文件夹，使用 slug 名称（如 `scenic-spot-name`）
2. 在文件夹内创建 `images/` 和 `audio/` 子目录
3. 复制 `info.json` 模板并填写景点信息
4. 将景点图片放入 `images/` 目录
5. 修改 `info.json` 中的 images.files 数组列出所有图片
6. 将景点音频（如有）放入 `audio/` 目录
7. 在 `locations/index.json` 中新增该景点索引条目

## 更新公共总览内容

- 泸沽湖整体介绍：编辑 `common/pages/lugu-lake.json`
- 摩梭文化介绍：编辑 `common/pages/mosuo-culture.json`
- 生态导览主索引：编辑 `common/pages/eco-guide.json`
- 生态导览具体模块：编辑 `common/pages/eco-guide/*.json`
- 首页景区一览入口：编辑 `common/overview.json`

## AI知识库应用

该知识库设计用于：

### 1. AI对话系统
- 为LLM提供景点背景知识
- 支持更精准的景点推荐
- 增强对用户问题的回答质量

### 2. 路线生成
- 基于景点信息生成旅游路线
- 考虑距离、类别、季节因素

### 3. 搜索和过滤
- 按类别、标签搜索景点
- 按最佳游览季节推荐

### 4. 多媒体展示
- 优先展示图片
- 提供语音导览

## 维护说明

- 定期更新景点信息（门票、电话等）
- 添加新景点时确保 ID 不重复
- 保持图片质量和大小的平衡
- 定期更新 lastUpdated 字段
- 保持 slug 名称的一致性

## 使用方式

### Docker 部署中的访问路径

```javascript
// 从 Docker 容器内访问（volume 挂载）
const kbPath = '/data/knowledge-base'

// 前端静态资源访问
<img src="/knowledge-base/locations/luyuan-cliff/images/1.jpeg" />

// API 端点示例（知识库详情回退）
fetch('/api/locations/knowledge-base/luyuan-cliff')
```

### Docker Compose 配置

在 docker-compose.yml 中配置卷挂载：

```yaml
volumes:
  - ./knowledge-base:/usr/share/nginx/html/knowledge-base
  - ./knowledge-base:/app/knowledge-base
```

## 扩展计划

- [ ] 集成更多景点数据
- [ ] 添加景点评价系统
- [ ] 支持多语言描述
- [ ] 实时天气信息集成
- [ ] VR全景图支持
