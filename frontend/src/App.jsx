import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { TabBar } from "antd-mobile";
import { AppOutline, CompassOutline, EnvironmentOutline, UserOutline } from "antd-mobile-icons";

import PageHeader from "./components/PageHeader";
import HomePage from "./pages/HomePage";
import GuidePage from "./pages/GuidePage";
import CheckinPage from "./pages/CheckinPage";
import ProfilePage from "./pages/ProfilePage";
import LocationDetailPage from "./pages/LocationDetailPage";
import ScrollPage from "./pages/ScrollPage";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";

const tabs = [
  { key: "/home", title: "首页", icon: <AppOutline /> },
  { key: "/guide", title: "导览", icon: <CompassOutline /> },
  { key: "/checkin", title: "打卡", icon: <EnvironmentOutline /> },
  { key: "/me", title: "我的", icon: <UserOutline /> },
];

function MobileShell() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="mobile-shell">
      <PageHeader />
      <div className="mobile-content">
        <Routes>
          <Route path="/home" element={<HomePage />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="/checkin" element={<CheckinPage />} />
          <Route path="/me" element={<ProfilePage />} />
          <Route path="/scroll" element={<ScrollPage />} />
          <Route path="/locations/:id" element={<LocationDetailPage />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </div>
      <TabBar activeKey={location.pathname} onChange={(key) => navigate(key)}>
        {tabs.map((item) => (
          <TabBar.Item key={item.key} icon={item.icon} title={item.title} />
        ))}
      </TabBar>
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
