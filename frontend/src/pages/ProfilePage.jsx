import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Input, Popup, Toast } from "antd-mobile";
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

  useEffect(() => {
    setEditName(displayName);
  }, [displayName]);

  useEffect(() => {
    if (!posterVisible) return;
    drawPoster();
  }, [posterVisible, records, displayName]);

  async function handleRegister() {
    if (!username || !password) {
      Toast.show({ content: "请输入账号与密码" });
      return;
    }
    setLoading(true);
    try {
      const data = await registerUser({ username, password });
      setUserSession(data.access_token);
      setLoggedIn(true);
      setPassword("");
      Toast.show({ content: "注册并登录成功" });
    } catch {
      Toast.show({ content: "注册失败，账号可能已存在" });
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    if (!username || !password) {
      Toast.show({ content: "请输入账号与密码" });
      return;
    }
    setLoading(true);
    try {
      const data = await loginUser({ username, password });
      if (data.role !== "user") {
        Toast.show({ content: "请使用游客账号登录" });
        return;
      }
      setUserSession(data.access_token);
      setLoggedIn(true);
      setPassword("");
      Toast.show({ content: "登录成功" });
    } catch {
      Toast.show({ content: "登录失败" });
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    clearUserSession();
    setLoggedIn(false);
    setProfile(null);
    setRecords([]);
    Toast.show({ content: "已退出游客登录" });
  }

  async function loadProfile() {
    const token = getUserToken();
    if (!token) return;
    try {
      const data = await fetchCurrentUser(token);
      setProfile(data);
    } catch {
      Toast.show({ content: "获取用户信息失败" });
    }
  }

  async function loadRecords() {
    const token = getUserToken();
    if (!token) {
      setRecords([]);
      return;
    }

    setRecordLoading(true);
    try {
      const [footprints, locations] = await Promise.all([
        fetchMyFootprints(token),
        fetchLocations(),
      ]);
      const locationMap = {};
      locations.forEach((item) => {
        locationMap[item.id] = item;
      });

      const list = Array.isArray(footprints) ? toRecordList(footprints, locationMap) : [];
      setRecords(list);
    } catch {
      setRecords([]);
      Toast.show({ content: "加载游览记录失败" });
    } finally {
      setRecordLoading(false);
    }
  }

  async function saveProfile() {
    const nextName = editName.trim();
    if (!nextName) {
      Toast.show({ content: "用户名不能为空" });
      return;
    }

    if (editPassword && editPassword.length < 6) {
      Toast.show({ content: "密码长度至少 6 位" });
      return;
    }

    const token = getUserToken();
    if (!token) {
      Toast.show({ content: "请先登录" });
      return;
    }

    try {
      const payload = {
        username: nextName !== profile?.username ? nextName : undefined,
        password: editPassword || undefined,
      };
      const data = await updateCurrentUser(payload, token);
      setProfile(data);
      setEditMode(false);
      setEditPassword("");
      Toast.show({ content: "资料已更新" });
    } catch (error) {
      const detail = error?.response?.data?.detail;
      Toast.show({ content: detail || "更新失败" });
    }
  }

  function drawPoster() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#0f7eb5");
    gradient.addColorStop(1, "#f59e0b");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillRect(20, 20, canvas.width - 40, canvas.height - 40);

    ctx.fillStyle = "#11546d";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText("泸沽湖专属游览海报", 44, 72);

    ctx.font = "18px sans-serif";
    ctx.fillStyle = "#1f2937";
    ctx.fillText(`旅行者：${displayName}`, 44, 108);

    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#334155";
    records.slice(0, 4).forEach((item, idx) => {
      const y = 158 + idx * 56;
      ctx.fillStyle = "#0f7eb5";
      ctx.fillRect(44, y - 12, 8, 8);
      ctx.fillStyle = "#0f172a";
      ctx.fillText(`${item.title} · ${item.time}`, 60, y);
      ctx.fillStyle = "#64748b";
      ctx.fillText(item.mood, 60, y + 20);
    });

    ctx.fillStyle = "#0f7eb5";
    ctx.font = "italic 16px sans-serif";
    ctx.fillText("Lugu Lake Memory", 44, canvas.height - 42);
  }

  function savePoster() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "lugu-poster.png";
    link.click();
    Toast.show({ content: "海报已导出为图片" });
  }

  function openPoster() {
    if (records.length === 0) {
      Toast.show({ content: "暂无真实游览记录，无法生成海报" });
      return;
    }
    setPosterVisible(true);
  }

  return (
    <div className="page-fade-in">
      {loggedIn ? (
        <>
          <div className="profile-hero-section">
            <div className="profile-hero-bg" />
            <div className="profile-hero-content">
              <div className="profile-avatar-large">旅</div>
              <div className="profile-hero-info">
                <h1 className="profile-hero-name">{displayName}</h1>
                <p className="profile-hero-bio">你的泸沽湖行程正在持续更新</p>
                <div className="profile-hero-status"><span className="status-badge verified">✓ 已登录</span></div>
              </div>
            </div>
          </div>

          <div className="profile-stats-grid mt-3 mb-3">
            <div className="stat-card">
              <div className="stat-number">{records.length}</div>
              <div className="stat-label">打卡次</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{new Set(records.map((item) => item.title)).size}</div>
              <div className="stat-label">景点</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{profile?.role || "user"}</div>
              <div className="stat-label">账号类型</div>
            </div>
          </div>

          <div className="profile-action-grid mb-3">
            <Button className="action-btn primary" onClick={() => navigate("/checkin")}>
              <div className="action-icon">✓</div>
              <div className="action-text">我的打卡</div>
            </Button>
            <Button className="action-btn secondary" onClick={() => navigate("/scroll")}>
              <div className="action-icon">📄</div>
              <div className="action-text">旅行绘卷</div>
            </Button>
            <Button className="action-btn tertiary" onClick={openPoster}>
              <div className="action-icon">🖼</div>
              <div className="action-text">生成海报</div>
            </Button>
            <Button className="action-btn quaternary" onClick={loadRecords} loading={recordLoading}>
              <div className="action-icon">⟳</div>
              <div className="action-text">刷新记录</div>
            </Button>
          </div>

          <div className="profile-section">
            <div className="section-title">账号设置</div>
            <Card className="card card-glass">
              <div className="form-group">
                <label className="form-label">用户名</label>
                <Input value={editName} onChange={setEditName} disabled={!editMode} placeholder="用户名" />
              </div>
              <div className="divider-soft my-3"></div>
              <div className="form-group">
                <label className="form-label">登录密码</label>
                <Input
                  value={editPassword}
                  onChange={setEditPassword}
                  disabled={!editMode}
                  type="password"
                  placeholder={editMode ? "输入新密码（可选）" : "已隐藏"}
                />
              </div>
              <div className="button-group-horizontal mt-3">
                <Button block onClick={() => setEditMode((prev) => !prev)}>
                  {editMode ? "取消编辑" : "编辑资料"}
                </Button>
                <Button color="primary" block disabled={!editMode} onClick={() => void saveProfile()}>
                  保存修改
                </Button>
              </div>
            </Card>
          </div>

          <div className="profile-section">
            <div className="section-title">游览记录</div>
            <Card className="card card-glass">
              {recordLoading ? (
                <div className="text-sm text-slate-500">正在加载记录...</div>
              ) : (
                records.length > 0 ? (
                  <div className="space-y-3">
                    {records.map((item) => (
                      <div key={item.id} className="timeline-item">
                        <div className="text-xs text-lake-700">{item.time}</div>
                        <div className="font-medium text-base">{item.title}</div>
                        <div className="text-sm text-slate-600">{item.mood}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">暂无真实打卡记录，请先到“打卡”页面提交。</div>
                )
              )}
            </Card>
          </div>

          <div className="profile-section mb-2">
            <div className="section-title">账户操作</div>
            <Button block color="danger" className="logout-btn mt-2" onClick={handleLogout}>退出登录</Button>
          </div>

          <Popup visible={posterVisible} onMaskClick={() => setPosterVisible(false)} bodyStyle={{ minHeight: "60vh" }}>
            <div className="p-4 pb-6">
              <h3 className="section-title">AI 个性化海报</h3>
              <div className="text-sm text-slate-600 mb-3">根据你的游览记录自动生成专属海报，支持一键保存图片。</div>
              <canvas ref={canvasRef} width={340} height={500} className="profile-poster-canvas" />
              <div className="button-group-horizontal mt-3">
                <Button block onClick={drawPoster}>重新生成</Button>
                <Button block color="primary" onClick={savePoster}>保存为图片</Button>
              </div>
            </div>
          </Popup>
        </>
      ) : (
        <>
          <div className="hero-shell mb-3">
            <div className="hero-kicker">游客中心</div>
            <h1 className="page-title m-0">我的</h1>
            <p className="hero-copy">登录账号解锁完整功能，记录你的泸沽湖之旅。</p>
          </div>

          <Card className="card card-glass mb-3">
            <div className="form-group">
              <label className="form-label">账号</label>
              <Input value={username} onChange={setUsername} placeholder="输入账号" clearable />
              <div className="input-helper-text">如果没有账号，可以先注册一个</div>
            </div>

            <div className="form-group">
              <label className="form-label">密码</label>
              <Input value={password} onChange={setPassword} placeholder="输入密码" type="password" clearable />
            </div>

            <div className="button-group-horizontal">
              <Button loading={loading} block onClick={handleRegister}>
                注册新账号
              </Button>
              <Button color="primary" loading={loading} block onClick={handleLogin}>
                登录
              </Button>
            </div>
          </Card>

          <Card className="card card-neon mb-3">
            <div className="profile-tips">
              <div className="tips-title">快速开始</div>
              <ol className="tips-list">
                <li><strong>注册/登录：</strong>先完成账号登录</li>
                <li><strong>首页浏览：</strong>体验景区一览、文化导览、全域导览</li>
                <li><strong>地图打卡：</strong>使用真实扫码并提交你的足迹</li>
                <li><strong>生成海报：</strong>在个人页制作专属游览海报</li>
              </ol>
            </div>
          </Card>

          <div className="features-showcase mb-3">
            <div className="section-title">核心功能</div>
            <div className="features-grid">
              <Card className="feature-card mb-0">
                <div className="feature-showcase-icon">🧭</div>
                <div className="feature-showcase-title">首页功能中心</div>
              </Card>
              <Card className="feature-card mb-0">
                <div className="feature-showcase-icon">✓</div>
                <div className="feature-showcase-title">地图打卡</div>
              </Card>
              <Card className="feature-card mb-0">
                <div className="feature-showcase-icon">📄</div>
                <div className="feature-showcase-title">游览时间线</div>
              </Card>
              <Card className="feature-card mb-0">
                <div className="feature-showcase-icon">🖼</div>
                <div className="feature-showcase-title">AI 海报生成</div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
