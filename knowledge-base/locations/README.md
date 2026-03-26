# 景点知识库 - 核心数据

此目录包含所有景点的详细信息数据。

## 结构说明

每个景点包含以下内容：

```
{景点-slug}/
├── info.json           # 景点详细信息（必须）
├── images/             # 景点图片目录（必须）
│   ├── 1.jpg
│   ├── 2.jpg
│   └── ...
└── audio/              # 景点音频导览（可选）
    ├── intro.mp3
    └── ...
```

## info.json 字段详解

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| id | number | 唯一景点ID | 1 |
| name | string | 景点官方名称 | 泸沽湖 |
| slug | string | URL友好标识 | lugu-lake |
| category | string | 景点类别 | nature |
| latitude | number | 纬度 | 27.6931 |
| longitude | number | 经度 | 100.7883 |
| description | string | 短描述（AI摘要用） | 高原明珠... |
| details.introduction | string | 详细介绍文本 | 详细描述... |
| details.highlights | array | 景点特色（数组） | ["高原", "摩梭文化"] |
| details.bestSeasonToVisit | string | 最佳游览季节 | 3月-11月 |
| sections.*Title | string | 详情页分节标题配置 | 景点亮点 |
| tags | array | SEO标签 | ["景点", "自然"] |

## 如何添加新景点

### 第1步：创建文件夹结构
```bash
mkdir -p locations/my-spot/images
mkdir -p locations/my-spot/audio
```

### 第2步：编写 info.json
参考 `lugu-lake/info.json` 或 `dapeng-island/info.json` 模板

关键要素：
- 确保 ID 在数据库中不重复
- slug 使用英文小写和连字符
- 图片分辨率建议 1920x1280 以上
- description 字段用于AI摘要，建议 50-150 字

### 第3步：添加图片和音频
- 图片：放在 `images/` 目录，命名为 `1.jpg`, `2.jpg` 等
- 音频：放在 `audio/` 目录，命名规范 `intro.mp3`
- 在 info.json 中更新 images.files 数组

### 第4步：验证数据
检查 JSON 格式是否正确（使用JSON验证工具）

## 数据源

景点信息来自：
- [ ] 数据库migrations
- [ ] 种子数据脚本 (backend/scripts/seed.py)
- [ ] 线上业务数据

## AI知识库应用场景

1. **聊天机器人回答** - 提供背景知识和准确信息
2. **路线推荐** - 基于景点属性和距离生成行程
3. **搜索功能** - 按名称、标签、类别过滤
4. **多媒体展示** - 展示图片和语音导览

## 最佳实践

✅ DO:
- 保持 JSON 格式有效
- 使用清晰的景点名称
- 提供至少 2 张高质量图片
- 定期更新门票价格和开放时间
- 使用一致的分类标签

❌ DON'T:
- 使用重复的景点 ID
- 上传超大图片（>5MB）
- 留空关键字段如 description
- 使用特殊字符作为 slug
