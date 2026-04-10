# 公用配置 - 知识库基础设置

此目录包含知识库的全局配置和公用资源。

## 📋 文件说明

### pages/ - 专题页面内容
用于维护景区专题页文案，避免在前端代码中硬编码介绍内容。

包含：
- `pages/index.json`：专题页索引（slug 与文件映射）
- `pages/lugu-lake.json`：泸沽湖整体介绍
- `pages/mosuo-culture.json`：摩梭文化介绍
- `pages/eco-guide.json`：生态导览主索引
- `pages/eco-guide/*.json`：生态导览分模块内容（科普、动植物、价值、路线、守则）

### 生态导览模块化约定

`pages/eco-guide.json` 中通过 `moduleFiles` 指向子模块文件：

- `science`: `eco-guide/science.json`
- `rareFauna`: `eco-guide/rare-fauna.json`
- `rareFlora`: `eco-guide/rare-flora.json`
- `ecosystemBenefits`: `eco-guide/ecosystem-benefits.json`
- `wellnessRoute`: `eco-guide/wellness-route.json`
- `observationTips`: `eco-guide/observation-tips.json`

推荐更新策略：

1. 新增模块时先更新 `moduleFiles` 映射。
2. 保持模块文件字段语义稳定（例如 `items`、`introduction`）。
3. 修改后执行 JSON 校验，避免前端运行期解析失败。

### config.json - 知识库全局配置
用于配置知识库的元数据和功能开关。

**用途**：
- 版本管理
- 功能特性开关
- AI知识库初始化

**示例**：
```json
{
  "version": "1.0.0",
  "name": "泸沽湖景区知识库",
  "features": {
    "enableAIChat": true,
    "enableLocationRecommendation": true
  }
}
```

### categories.json - 景点分类体系
定义所有可用的景点类别。

**类别列表**：
| 代码 | 名称 | 用途 |
|------|------|------|
| culture | 文化景点 | 民族遗迹、历史建筑 |
| nature | 自然风景 | 山水风光、生态旅游 |
| activity | 活动体验 | 户外运动、探险项目 |
| dining | 美食文化 | 特色餐饮、小吃 |
| accommodation | 住宿设施 | 酒店、客栈、民宿 |

**添加新类别的步骤**：
1. 编辑 `categories.json`
2. 添加新的 category 对象
3. 确保 id 字段唯一
4. 提供 icon 和 description

## 🔧 配置最佳实践

### version 字段管理
- 主版本.次版本.修订版本 格式
- 添加新景点时更新次版本
- 修复bug时更新修订版本
- 结构变更时更新主版本

### lastUpdated 字段
- ISO 8601 日期格式：YYYY-MM-DD
- 每次修改时更新
- 便于跟踪知识库更新状态

## 📊 扩展方案

### 可添加的公用配置

1. **tags.json** - 全局标签库
```json
{
  "tags": [
    {"id": "outdoor", "name": "户外", "color": "green"},
    {"id": "cultural", "name": "文化", "color": "blue"}
  ]
}
```

2. **seasons.json** - 季节定义
```json
{
  "seasons": [
    {"id": "spring", "name": "春季", "months": [3, 4, 5]},
    {"id": "summer", "name": "夏季", "months": [6, 7, 8]}
  ]
}
```

3. **facilities.json** - 设施标准定义
```json
{
  "facilities": [
    {"id": "parking", "name": "停车场", "icon": "🅿️"},
    {"id": "restroom", "name": "卫生间", "icon": "🚻"}
  ]
}
```

## 🤖 AI知识库初始化

该目录用于：

1. **系统启动** - 加载全局配置和分类
2. **数据验证** - 景点分类必须在此定义
3. **API转换** - 后端景点数据与知识库的映射

## 📝 维护清单

- [ ] 定期更新 config.json 的 lastUpdated
- [ ] 新增景点类别时更新 categories.json
- [ ] 生态导览内容变更后同步更新 `pages/eco-guide.json` 的 lastUpdated
- [ ] 备份重要配置文件
- [ ] 监控知识库版本变更

## 🔗 相关文件

- 景点数据：`../locations/*/info.json`
- 专题页面：`./pages/*.json`
- 知识库主文档：`../README.md`
- 后端数据模型：`/backend/app/models/location.py`

## 💡 使用示例

### 前端代码示例

```javascript
// 加载公用配置
async function loadConfig() {
  const config = await fetch('/knowledge-base/common/config.json').then(r => r.json());
  const categories = await fetch('/knowledge-base/common/categories.json').then(r => r.json());
  
  // AI系统初始化
  if (config.features.enableAIChat) {
    initAIChatWithKnowledge(categories);
  }
}
```

### 数据验证示例

```javascript
// 验证景点类别
function validateLocationCategory(location) {
  const allowedCategories = categories.map(c => c.id);
  return allowedCategories.includes(location.category);
}
```
