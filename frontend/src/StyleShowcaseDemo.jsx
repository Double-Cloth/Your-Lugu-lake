import { useState } from "react";
import { Button, Card, Input, Toast } from "antd-mobile";

/**
 * 高级样式展示组件
 * 演示项目中可用的所有现代化样式和交互效果
 */
export default function StyleShowcaseDemo() {
  const [loading, setLoading] = useState(false);

  const handleButtonClick = () => {
    setLoading(true);
    Toast.show({ content: "✨ 样式已应用！" });
    setTimeout(() => setLoading(false), 800);
  };

  return (
    <div className="mobile-shell p-4 page-fade-in">
      {/* ===== Hero Section ===== */}
      <div className="hero-shell mb-3">
        <div className="hero-kicker">Design System</div>
        <h1 className="page-title m-0">高级样式系统</h1>
        <p className="hero-copy">现代化 UI 组件库，包含渐变、毛玻璃、交互动画等高级效果。</p>
      </div>

      {/* ===== Button Styles ===== */}
      <Card className="card card-glass">
        <h3 className="section-title">按钮样式库</h3>

        <div className="space-y-2">
          <Button color="primary" block loading={loading} onClick={handleButtonClick}>
            主按钮 (Primary) - 蓝色渐变
          </Button>
          <Button block>默认按钮 - 毛玻璃效果</Button>
          <Button block color="success">
            成功按钮 - 绿色渐变
          </Button>
          <Button block color="warning">
            警告按钮 - 橙色渐变
          </Button>
          <Button block color="danger">
            危险按钮 - 红色渐变
          </Button>
        </div>

        <div className="divider-soft mt-3"></div>

        <div className="text-subtle mt-3 mb-2">按钮特性：</div>
        <ul className="text-sm text-slate-600 space-y-1">
          <li>✓ 135° 线性渐变背景</li>
          <li>✓ 按下时水纹涟漪效果</li>
          <li>✓ 悬停时光泽闪烁动画</li>
          <li>✓ 柔和的多层阴影</li>
          <li>✓ 平滑的过渡动画 (280ms)</li>
        </ul>
      </Card>

      {/* ===== Card Variations ===== */}
      <Card className="card card-glass mt-3">
        <h3 className="section-title">卡片样式</h3>

        <div className="card card-elevated interactive-element">
          <span className="badge-primary">提升卡片</span>
          <p className="text-sm text-slate-600 mt-2 mb-0">
            悬停时上浮 (-4px) 并增加阴影深度。完美用于可点击的内容。
          </p>
        </div>

        <div className="card card-neon mt-2">
          <span className="badge-success">霓虹卡片</span>
          <p className="text-sm text-slate-600 mt-2 mb-0">
            顶部有连续光泽闪烁动画。适合突出重点内容。
          </p>
        </div>

        <div className="list-item-interactive mt-2">
          <span className="badge-warning">交互列表项</span>
          <p className="text-sm text-slate-600 mt-2 mb-0">
            点击时有涟漪效果，悬停时浮起效果。
          </p>
        </div>
      </Card>

      {/* ===== Form Elements ===== */}
      <Card className="card card-glass mt-3">
        <h3 className="section-title">表单元素</h3>

        <div className="form-group">
          <label className="form-label">文本输入框</label>
          <Input placeholder="点击输入，体验焦点动画" clearable />
          <div className="input-helper-text">已应用毛玻璃、焦点上浮等效果</div>
        </div>

        <div className="form-group">
          <label className="form-label">搜索框</label>
          <Input placeholder="搜索内容..." type="search" clearable />
        </div>

        <div className="form-field-group">
          <label className="form-label">多选选项</label>
          <div className="flex gap-2 flex-wrap">
            <span className="tag tag-blue">选项1</span>
            <span className="tag tag-green">选项2</span>
            <span className="tag tag-orange">选项3</span>
            <span className="tag tag-red">选项4</span>
          </div>
        </div>
      </Card>

      {/* ===== Statistics Display ===== */}
      <Card className="card card-glass mt-3">
        <h3 className="section-title">数据展示</h3>

        <div className="admin-stat-grid">
          <div className="stat-card">
            <div className="stat-label">总用户数</div>
            <div className="stat-value">2,847</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">景点数</div>
            <div className="stat-value">24</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">打卡次数</div>
            <div className="stat-value">12.5K</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">路线生成</div>
            <div className="stat-value">8.9K</div>
          </div>
        </div>
      </Card>

      {/* ===== Badges & Tags ===== */}
      <Card className="card card-glass mt-3">
        <h3 className="section-title">徽章与标签</h3>

        <div className="space-y-2">
          <div>
            <span className="badge-primary mr-2">New</span>
            <span className="badge-success mr-2">✓</span>
            <span className="badge-warning mr-2">!</span>
            <span className="badge-danger">✕</span>
          </div>

          <div className="mt-2 flex gap-2 flex-wrap">
            <span className="tag tag-blue">蓝色标签</span>
            <span className="tag tag-green">绿色标签</span>
            <span className="tag tag-orange">橙色标签</span>
            <span className="tag tag-red">红色标签</span>
          </div>
        </div>
      </Card>

      {/* ===== Shadow Utilities ===== */}
      <Card className="card card-glass mt-3">
        <h3 className="section-title">阴影系统</h3>

        <div className="space-y-2">
          <div className="shadow-sm p-3 bg-blue-50 rounded">
            <div className="text-sm font-medium">shadow-sm</div>
            <div className="text-xs text-slate-500">浅阴影效果</div>
          </div>
          <div className="shadow-md p-3 bg-blue-50 rounded">
            <div className="text-sm font-medium">shadow-md</div>
            <div className="text-xs text-slate-500">中等阴影效果</div>
          </div>
          <div className="shadow-lg p-3 bg-blue-50 rounded">
            <div className="text-sm font-medium">shadow-lg</div>
            <div className="text-xs text-slate-500">深阴影效果</div>
          </div>
          <div className="shadow-xl p-3 bg-blue-50 rounded">
            <div className="text-sm font-medium">shadow-xl</div>
            <div className="text-xs text-slate-500">特深阴影效果</div>
          </div>
        </div>
      </Card>

      {/* ===== Gradient & Text Effects ===== */}
      <Card className="card card-glass mt-3">
        <h3 className="section-title">渐变与文字效果</h3>

        <div className="space-y-2">
          <div className="p-3 gradient-primary rounded text-white font-medium text-center">
            gradient-primary - 蓝色渐变
          </div>
          <div className="p-3 gradient-warm rounded text-white font-medium text-center">
            gradient-warm - 暖色渐变
          </div>
          <div className="p-3 gradient-success rounded text-white font-medium text-center">
            gradient-success - 绿色渐变
          </div>

          <div className="mt-2">
            <div className="text-gradient font-bold text-lg">text-gradient 文字渐变效果</div>
            <div className="text-gradient-warm font-bold text-lg">text-gradient-warm 暖色渐变文字</div>
            <div className="text-highlight mt-2">text-highlight 高亮文字</div>
            <div className="text-subtle mt-2">text-subtle 柔和文字</div>
          </div>
        </div>
      </Card>

      {/* ===== Animation Showcase ===== */}
      <Card className="card card-glass mt-3">
        <h3 className="section-title">动画效果</h3>

        <div className="space-y-2">
          <div className="p-3 bg-blue-50 rounded float-up">
            <div className="text-sm">float-up - 页面加载上浮动画</div>
          </div>

          <div className="p-3 bg-center bg-blue-50 rounded btn-loading">
            <div className="text-sm">btn-loading - 脉冲发光（悬停卡片）</div>
          </div>

          <div className="mt-2 text-subtle">
            所有页面都自动应用 <span className="font-mono text-highlight">page-fade-in</span> 动画。
          </div>
        </div>
      </Card>

      {/* ===== Usage Guide ===== */}
      <Card className="card card-glass mt-3 mb-3">
        <h3 className="section-title">快速使用指南</h3>

        <div className="space-y-2 text-sm">
          <div>
            <div className="font-semibold text-slate-700">1. 在 JSX 中使用类名</div>
            <div className="text-slate-600 mt-1">
              {"<div className=\"card card-glass\">内容</div>"}
            </div>
          </div>

          <div className="divider-soft"></div>

          <div>
            <div className="font-semibold text-slate-700">2. 组合工具类</div>
            <div className="text-slate-600 mt-1">
              {"<div className=\"shadow-lg hover-lift rounded-lg p-4\">"}
            </div>
          </div>

          <div className="divider-soft"></div>

          <div>
            <div className="font-semibold text-slate-700">3. 查看完整指南</div>
            <div className="text-slate-600 mt-1">
              详见项目根目录的 <span className="font-mono">STYLING_GUIDE.md</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
