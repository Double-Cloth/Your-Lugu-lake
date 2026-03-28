import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { TabBar } from "antd-mobile";
import { AppOutline, EnvironmentOutline, UserOutline } from "antd-mobile-icons";

import PageHeader from "./components/PageHeader";
import AIFloatingBall from "./components/AIFloatingBall";
import HomePage from "./pages/HomePage";
import CheckinPage from "./pages/CheckinPage";
import ProfilePage from "./pages/ProfilePage";
import LocationDetailPage from "./pages/LocationDetailPage";
import LuguLakeOverviewPage from "./pages/LuguLakeOverviewPage";
import MosuoCulturePage from "./pages/MosuoCulturePage";
import ScrollPage from "./pages/ScrollPage";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";

const tabs = [
  { key: "/home", title: "首页", icon: <AppOutline /> },
  { key: "/checkin", title: "打卡", icon: <EnvironmentOutline /> },
  { key: "/me", title: "我的", icon: <UserOutline /> },
];

function MobileShell() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="w-full h-[100dvh] max-w-md mx-auto bg-slate-900 relative overflow-hidden flex flex-col font-sans shadow-2xl">
      <PageHeader />
      <div className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth scrollbar-hide">
        <Routes>
          <Route path="/home" element={<HomePage />} />
          <Route path="/guide" element={<Navigate to="/home" replace />} />
          <Route path="/checkin" element={<CheckinPage />} />
          <Route path="/me" element={<ProfilePage />} />
          <Route path="/scroll" element={<ScrollPage />} />
          <Route path="/lugu-lake" element={<LuguLakeOverviewPage />} />
          <Route path="/mosuo-culture" element={<MosuoCulturePage />} />
          <Route path="/locations/:id" element={<LocationDetailPage />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </div>
      <AIFloatingBall />
      
      {/* 沉浸式浮动 Dock 导航 */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-[380px] z-50 pointer-events-none">
        <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-[32px] shadow-2xl pb-safe pointer-events-auto">
          <TabBar 
            activeKey={location.pathname} 
            onChange={(key) => navigate(key)}
            className="!bg-transparent text-white/50"
          >  
            {tabs.map((item) => (
              <TabBar.Item 
                key={item.key} 
                icon={item.icon} 
                title={item.title} 
              />    
            ))}
          </TabBar>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<AdminDashboardPage />} />
      <Route path="/*" element={<MobileShell />} />
    </Routes>
  );
}
