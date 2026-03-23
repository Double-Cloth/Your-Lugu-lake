import { useLocation, useNavigate } from "react-router-dom";

export default function PageHeader() {
  const location = useLocation();
  const navigate = useNavigate();

  // 页面标题映射
  const pageConfig = {
    "/home": { title: "首页", showBack: false },
    "/guide": { title: "AI 导览", showBack: false },
    "/checkin": { title: "打卡点位", showBack: false },
    "/me": { title: "我的", showBack: false },
    "/scroll": { title: "我的旅行绘卷", showBack: true },
    "/locations": { title: "景点详情", showBack: true },
  };

  // 根据路径获取配置
  let config = null;
  if (location.pathname.startsWith("/locations/")) {
    config = pageConfig["/locations"];
  } else {
    config = pageConfig[location.pathname];
  }

  // 如果不在配置内，不显示
  if (!config) return null;

  const handleBack = () => {
    if (config.showBack) {
      navigate(-1);
    }
  };

  return (
    <div className="page-header">
      <div className="page-header-container">
        {config.showBack ? (
          <button className="page-header-back" onClick={handleBack} aria-label="返回">
            <span>‹</span>
          </button>
        ) : (
          <div className="page-header-spacer"></div>
        )}
        <h1 className="page-header-title">{config.title}</h1>
        <div className="page-header-spacer"></div>
      </div>
    </div>
  );
}
