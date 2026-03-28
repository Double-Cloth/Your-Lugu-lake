import { useLocation, useNavigate } from "react-router-dom";

export default function PageHeader() {
  const location = useLocation();
  const navigate = useNavigate();

  // 页面标题映射
  const pageConfig = {
    "/home": { title: "主页", showBack: false },
    "/checkin": { title: "打卡", showBack: false },
    "/me": { title: "我的", showBack: false },
    "/scroll": { title: "我的旅行绘卷", showBack: true },
    "/locations": { title: "景点详情", showBack: true },
    "/lugu-lake": { title: "泸沽湖概览", showBack: true },
    "/mosuo-culture": { title: "摩梭文化", showBack: true },
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
      if (location.pathname.startsWith("/locations/")) {
        const fromPanel = location.state?.fromPanel;
        if (fromPanel === "overview" || fromPanel === "global") {
          navigate("/home", { state: { openPanel: fromPanel } });
          return;
        }
      }
      navigate(-1);
    }
  };

  return (
    <div className="sticky top-0 z-50 w-full backdrop-blur-xl bg-slate-900/60 border-b border-white/10 text-white shadow-sm flex items-center justify-between px-4 h-14 pt-safe">
      <div className="w-10">
        {config.showBack && (
          <button 
            className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors" 
            onClick={handleBack} 
            aria-label="返回"
          >
            <span className="text-xl leading-none -mt-1 ml-[-2px]">‹</span>
          </button>
        )}
      </div>
      <h1 className="flex-1 text-center text-[17px] font-bold tracking-widest text-white/95">
        {config.title}
      </h1>
      <div className="w-10"></div>
    </div>
  );
}
