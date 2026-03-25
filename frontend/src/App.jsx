import { useMemo } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { TabBar } from "antd-mobile";
import { AppOutline, EnvironmentOutline, UserOutline } from "antd-mobile-icons";

import PageHeader from "./components/PageHeader";
import AIFloatingBall from "./components/AIFloatingBall";
import HomePage from "./pages/HomePage";
import CheckinPage from "./pages/CheckinPage";
import ProfilePage from "./pages/ProfilePage";
import LocationDetailPage from "./pages/LocationDetailPage";
import ScrollPage from "./pages/ScrollPage";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";

const tabs = [
  { key: "/home", title: "首页", icon: <AppOutline /> },
  { key: "/checkin", title: "打卡", icon: <EnvironmentOutline /> },
  { key: "/me", title: "我的", icon: <UserOutline /> },
];

function createMovingBlobs(count = 8) {
  const palette = [
    "hsla(198 86% 64% / 0.34)",
    "hsla(176 68% 66% / 0.3)",
    "hsla(36 94% 69% / 0.24)",
    "hsla(210 82% 68% / 0.3)",
    "hsla(165 62% 69% / 0.3)",
    "hsla(22 92% 71% / 0.24)",
  ];

  const pick = (min, max) => Math.round(min + Math.random() * (max - min));

  return Array.from({ length: count }, (_, index) => ({
    id: `app-blob-${index}`,
    color: palette[index % palette.length],
    top: `${pick(-12, 88)}%`,
    left: `${pick(-18, 88)}%`,
    size: `${pick(130, 260)}px`,
    duration: `${pick(14, 26)}s`,
    delay: `${pick(-12, 0)}s`,
    x1: `${pick(-28, 28)}px`,
    y1: `${pick(-26, 24)}px`,
    x2: `${pick(-36, 36)}px`,
    y2: `${pick(-30, 30)}px`,
    scale2: (0.82 + Math.random() * 0.36).toFixed(2),
  }));
}

function MobileShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const movingBlobs = useMemo(() => createMovingBlobs(8), []);

  return (
    <div className="mobile-shell">
      <div className="app-dynamic-bg" aria-hidden="true">
        {movingBlobs.map((blob) => (
          <span
            key={blob.id}
            className="app-bg-blob"
            style={{
              top: blob.top,
              left: blob.left,
              width: blob.size,
              height: blob.size,
              background: blob.color,
              animationDuration: blob.duration,
              animationDelay: blob.delay,
              "--x1": blob.x1,
              "--y1": blob.y1,
              "--x2": blob.x2,
              "--y2": blob.y2,
              "--scale2": blob.scale2,
            }}
          />
        ))}
      </div>
      <PageHeader />
      <div className="mobile-content">
        <Routes>
          <Route path="/home" element={<HomePage />} />
          <Route path="/guide" element={<Navigate to="/home" replace />} />
          <Route path="/checkin" element={<CheckinPage />} />
          <Route path="/me" element={<ProfilePage />} />
          <Route path="/scroll" element={<ScrollPage />} />
          <Route path="/locations/:id" element={<LocationDetailPage />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </div>
      <AIFloatingBall />
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
