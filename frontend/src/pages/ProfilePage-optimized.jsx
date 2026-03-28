import { useEffect, useMemo, useRef, useState } from "react";
import LucideIcon from "../components/LucideIcon";
import { Button, Input, Popup, Toast } from "antd-mobile";
import { useNavigate } from "react-router-dom";

import {
  fetchCurrentUser,
  fetchLocations,
  fetchMyFootprints,
  getUserToken,
  loginUser,
  registerUser,
  updateCurrentUser,
} from "../api";
import { clearUserSession, hasUserSession, setUserSession } from "../auth";
import { 
  ButtonComponent, GlassInput, 
  PageHeaderComponent,
  CardComponent,
  SkeletonComponent,
  EmptyStateComponent,
} from "../components/SharedUI";
import LucideIcon, { IconNames } from "../components/LucideIcon";

function toRecordList(footprints, locationMap) {
  return footprints.map((item) => ({
    id: item.id,
    title: locationMap[item.location_id]?.name || `景点 #${item.location_id}`,
    time: new Date(item.check_in_time).toLocaleString(),
    mood: item.mood_text || "完成打卡",
  }));
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(hasUserSession());
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [records, setRecords] = useState([]);
  const [recordLoading, setRecordLoading] = useState(false);
  const [posterVisible, setPosterVisible] = useState(false);
  const canvasRef = useRef(null);

  const displayName = useMemo(() => {
    return profile?.username || "游客";
  }, [profile]);

  useEffect(() => {
    if (!loggedIn) return;
    void loadProfile();
    void loadRecords();
  }, [loggedIn]);

  async function loadProfile() {
    try {
      const token = getUserToken();
      if (!token) return;
      const data = await fetchCurrentUser(token);
      setProfile(data);
      setEditName(data.username);
      setEditPassword("");
    } catch (error) {
      console.error("[Profile] 加载失败:", error);
    }
  }

  async function loadRecords() {
    setRecordLoading(true);
    try {
      const token = getUserToken();
      if (!token) return;
      const footprints = await fetchMyFootprints(token);
      const locations = await fetchLocations();
      const locationMap = Object.fromEntries(
        (Array.isArray(locations) ? locations : []).map((l) => [l.id, l])
      );
      const list = toRecordList(Array.isArray(footprints) ? footprints : [], locationMap);
      setRecords(list);
    } catch (error) {
      console.error("[Profile] 记录加载失败:", error);
      setRecords([]);
    } finally {
      setRecordLoading(false);
    }
  }

  async function handleRegister() {
    if (username.length < 3) {
      Toast.show({ content: "用户名至少3个字符", position: "bottom" });
      return;
    }
    if (password.length < 6) {
      Toast.show({ content: "密码至少6个字符", position: "bottom" });
      return;
    }
    setLoading(true);
    try {
      const token = await registerUser(username, password);
      setUserSession(token);
      setLoggedIn(true);
      Toast.show({ content: "注册成功", position: "bottom" });
    } catch (error) {
      Toast.show({ content: error?.message || "注册失败", position: "bottom" });
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    if (!username || !password) {
      Toast.show({ content: "请输入用户名和密码", position: "bottom" });
      return;
    }
    setLoading(true);
    try {
      const token = await loginUser(username, password);
      setUserSession(token);
      setLoggedIn(true);
      Toast.show({ content: "登录成功", position: "bottom" });
    } catch (error) {
      Toast.show({ content: error?.message || "登录失败", position: "bottom" });
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateProfile() {
    if (editName.length < 3) {
      Toast.show({ content: "用户名至少3个字符", position: "bottom" });
      return;
    }
    setLoading(true);
    try {
      const token = getUserToken();
      if (!token) return;
      const updates = { username: editName };
      if (editPassword) {
        if (editPassword.length < 6) {
          Toast.show({ content: "密码至少6个字符", position: "bottom" });
          setLoading(false);
          return;
        }
        updates.password = editPassword;
      }
      await updateCurrentUser(token, updates);
      await loadProfile();
      setEditMode(false);
      Toast.show({ content: "更新成功", position: "bottom" });
    } catch (error) {
      Toast.show({ content: "更新失败", position: "bottom" });
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    clearUserSession();
    setLoggedIn(false);
    setProfile(null);
    setRecords([]);
    setUsername("");
    setPassword("");
    Toast.show({ content: "已登出", position: "bottom" });
  }

  function drawPoster() {
    if (!canvasRef.current || !profile) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = 400;
    canvas.height = 600;
    ctx.fillStyle = "linear-gradient(135deg, #e3f2fd, #b3e5fc)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#1a3a52";
    ctx.font = "bold 48px PingFang SC";
    ctx.textAlign = "center";
    ctx.fillText("泸沽湖", canvas.width / 2, 100);
    ctx.font = "24px PingFang SC";
    ctx.fillStyle = "#0d5f84";
    ctx.fillText(`用户: ${profile.username}`, canvas.width / 2, 200);
    ctx.fillText(`ID: ${profile.id}`, canvas.width / 2, 250);
    ctx.font = "20px PingFang SC";
    ctx.fillStyle = "#4a6fa5";
    ctx.fillText("打卡记录", canvas.width / 2, 320);
    ctx.fillText(`共 ${records.length} 次探索`, canvas.width / 2, 360);
    ctx.fillText(new Date().toLocaleDateString("zh-CN"), canvas.width / 2, 520);
  }

  // 未登录状态
  if (!loggedIn) {
    return (
      <div className="mobile-shell">
        <PageHeaderComponent title="我的资料" />
        <div className="mobile-content page-fade-in">
          <div className="flex flex-col items-center justify-center min-h-96 px-4">
            <div className="text-6xl mb-6 opacity-40">
              <LucideIcon name={IconNames.User} size={60} />
            </div>
            <h2 className="text-xl font-black text-white mb-4">未登录</h2>
            <p className="text-sm text-lake-600 text-center mb-8">
              登录后可查看您的打卡记录和个人信息
            </p>

            <CardComponent variant="glass" className="w-full max-w-xs">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    用户名
                  </label>
                  <GlassInput placeholder="输入用户名" value={username} onChange={setUsername} />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    密码
                  </label>
                  <GlassInput placeholder="输入密码" type="password" value={password} onChange={setPassword} />
                </div>

                <div className="flex gap-3 pt-2">
                  <ButtonComponent, GlassInput
                    variant="secondary"
                    size="md"
                    className="flex-1"
                    loading={loading}
                    onClick={handleRegister}
                  >
                    注册
                  </ButtonComponent, GlassInput>
                  <ButtonComponent, GlassInput
                    variant="primary"
                    size="md"
                    className="flex-1"
                    loading={loading}
                    onClick={handleLogin}
                  >
                    登录
                  </ButtonComponent, GlassInput>
                </div>
              </div>
            </CardComponent>
          </div>
        </div>
      </div>
    );
  }

  // 已登录状态
  return (
    <div className="mobile-shell">
      <PageHeaderComponent 
        title="我的资料"
        rightContent={
          profile ? (
            <span className="text-sm font-bold text-lake-600">
              {profile.username}
            </span>
          ) : null
        }
      />

      <div className="mobile-content page-fade-in space-y-4">
        {/* 用户信息卡片 */}
        {profile && !editMode ? (
          <CardComponent variant="neon">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-lake-300 to-lake-700 flex items-center justify-center text-white text-2xl font-black">
                {profile.username.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white">
                  {profile.username}
                </h3>
                <p className="text-xs text-lake-600">
                  ID: {profile.id}
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <ButtonComponent, GlassInput
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => setEditMode(true)}
              >
                编辑信息
              </ButtonComponent, GlassInput>
              <ButtonComponent, GlassInput
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => setPosterVisible(true)}
              >
                生成海报
              </ButtonComponent, GlassInput>
            </div>

            <div className="mt-4 pt-4 border-t border-lake-300/40">
              <ButtonComponent, GlassInput
                variant="danger"
                size="sm"
                className="w-full"
                onClick={handleLogout}
              >
                退出登录
              </ButtonComponent, GlassInput>
            </div>
          </CardComponent>
        ) : null}

        {/* 编辑模式 */}
        {editMode && (
          <CardComponent variant="glass">
            <h3 className="text-base font-bold text-white mb-4">编辑信息</h3>
            <div className="space-y-4">
              <div>
                <label className="form-label">用户名</label>
                <GlassInput placeholder="输入新用户名" value={editName} onChange={setEditName} />
              </div>
              <div>
                <label className="form-label">密码 (可选)</label>
                <GlassInput type="password" placeholder="输入新密码" value={editPassword} onChange={setEditPassword} />
              </div>
              <div className="flex gap-2 pt-2">
                <ButtonComponent, GlassInput
                  variant="secondary"
                  size="md"
                  className="flex-1"
                  onClick={() => setEditMode(false)}
                >
                  取消
                </ButtonComponent, GlassInput>
                <ButtonComponent, GlassInput
                  variant="primary"
                  size="md"
                  className="flex-1"
                  loading={loading}
                  onClick={handleUpdateProfile}
                >
                  保存
                </ButtonComponent, GlassInput>
              </div>
            </div>
          </CardComponent>
        )}

        {/* 打卡记录 */}
        <div>
          <h3 className="section-title">打卡记录</h3>
          {recordLoading ? (
            <SkeletonComponent count={3} type="card" />
          ) : records.length > 0 ? (
            <div className="space-y-2">
              {records.map((record) => (
                <CardComponent key={record.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-white">
                        {record.title}
                      </h4>
                      <p className="text-xs text-lake-600 mt-1">
                        {record.time}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-lake-600 whitespace-nowrap">
                      {record.mood}
                    </span>
                  </div>
                </CardComponent>
              ))}
            </div>
          ) : (
            <EmptyStateComponent
              icon={<LucideIcon name="Map" size={48} className="text-white/40 mb-3 mx-auto" strokeWidth={1.5} />}
              title="暂无打卡"
              description="去首页探索泸沽湖的美景吧"
            />
          )}
        </div>
      </div>

      {/* 海报弹窗 */}
      <Popup
        visible={posterVisible}
        onMaskClick={() => setPosterVisible(false)}
        onClose={() => setPosterVisible(false)}
      >
        <div className="home-popup-content">
          <div className="home-popup-header">
            <span className="section-title m-0">打卡海报</span>
            <button
              className="home-popup-close"
              onClick={() => setPosterVisible(false)}
            >
              <LucideIcon name="X" size={24} />
            </button>
          </div>
          <canvas
            ref={canvasRef}
            className="profile-poster-canvas"
            onLoad={drawPoster}
          />
          <div className="text-center text-xs text-lake-600 mt-2">
            {canvasRef.current && (
              <button
                className="text-lake-600 font-semibold hover:text-white/95"
                onClick={() => {
                  drawPoster();
                  const link = document.createElement("a");
                  link.href = canvasRef.current.toDataURL();
                  link.download = "lugu-lake-poster.png";
                  link.click();
                }}
              >
                下载海报
              </button>
            )}
          </div>
        </div>
      </Popup>
    </div>
  );
}

