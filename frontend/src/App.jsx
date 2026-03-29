import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { TabBar } from "antd-mobile";
import { AppOutline, EnvironmentOutline, UserOutline } from "antd-mobile-icons";

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
    <div className="app-mobile-shell w-full h-[100dvh] max-w-md sm:max-w-xl md:max-w-3xl landscape:max-w-screen-xl mx-auto relative overflow-hidden flex flex-col font-sans shadow-2xl bg-black">
      <div className="app-main-scroll flex-1 flex flex-col overflow-y-auto overflow-x-hidden scroll-smooth scrollbar-hide pb-[calc(84px+env(safe-area-inset-bottom))]">
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
      
      <div className="app-glass-footer-wrap" style={{ bottom: "max(14px, env(safe-area-inset-bottom))" }}>
        <nav className="app-glass-footer" aria-label="主导航">
          <TabBar safeArea={false} 
            activeKey={location.pathname} 
            onChange={(key) => navigate(key)}
            className="app-glass-tabbar"
          >  
            {tabs.map((item) => (
              <TabBar.Item 
                key={item.key} 
                icon={item.icon} 
                title={item.title} 
              />    
            ))}
          </TabBar>
        </nav>
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
