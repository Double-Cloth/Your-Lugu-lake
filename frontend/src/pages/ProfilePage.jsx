import { useEffect, useMemo, useRef, useState } from "react";
import { Popup, Toast } from "antd-mobile";
import { UserOutline, LockOutline } from "antd-mobile-icons";
import { useNavigate } from "react-router-dom";
import { ImmersivePage, CardComponent, ButtonComponent, GlassInput, SkeletonComponent, EmptyStateComponent } from "../components/SharedUI";
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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authMode, setAuthMode] = useState("login"); // "login" | "register"
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
    if (password !== confirmPassword) {
      Toast.show({ content: "两次输入的密码不一致" });
      return;
    }
    setLoading(true);
    try {
      const data = await registerUser({ username, password });
      setUserSession(data.access_token);
      setLoggedIn(true);
      setPassword("");
      setConfirmPassword("");
      Toast.show({ content: "注册并登录成功" });
    } catch (error) {
      console.error("Register error:", error);
      const errorMsg = typeof error?.message === "string"
        ? error.message
        : (error?.response?.data?.detail || "注册失败，请重试");
      Toast.show({ content: String(errorMsg) });
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
    } catch (error) {
      const status = error?.response?.status;
      if (status === 401) {
        Toast.show({ content: "账号或密码错误；若未注册请先点击“注册新账号”" });
      } else {
        const errorMsg =
          typeof error?.message === "string"
            ? error.message
            : error?.response?.data?.detail || "登录失败，请稍后重试";
        Toast.show({ content: String(errorMsg) });
      }
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    clearUserSession();
    setLoggedIn(false);
    setProfile(null);
    setRecords([]);
    setEditName("");
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
    gradient.addColorStop(0, "#083344"); 
    gradient.addColorStop(1, "#164e63"); 
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(20, 20, canvas.width - 40, canvas.height - 40);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 26px sans-serif";
    ctx.fillText("泸沽湖专属游览海报", 44, 72);

    ctx.font = "16px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText(`旅行者：${displayName}`, 44, 108);

    ctx.font = "14px sans-serif";
    records.slice(0, 4).forEach((item, idx) => {
      const y = 158 + idx * 60;
      ctx.fillStyle = "#22d3ee"; 
      ctx.beginPath();
      ctx.arc(48, y - 4, 4, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = "#fff";
      ctx.fillText(`${item.title} · ${item.time.split(" ")[0]}`, 64, y);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillText(item.mood, 64, y + 22);
    });

    ctx.fillStyle = "#22d3ee";
    ctx.font = "italic 14px sans-serif";
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

  const renderUnauth = () => (
    <div className="relative z-10 w-full max-w-sm mx-auto animate-[fadeIn_0.5s_ease-out] flex flex-col mt-4 md:mt-[8vh] mb-auto py-8">
      <div className="text-center mb-8 mt-4">
        <h1 className="text-4xl font-bold text-white mb-3 tracking-[0.2em] font-serif drop-shadow-lg">
          泸沽湖
        </h1>
        <p className="text-white/80 text-sm tracking-widest">
          {authMode === "login" ? "登录开启专属旅程" : "注册记录湖畔时光"}
        </p>
      </div>

      <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-[32px] p-6 shadow-2xl relative overflow-hidden shrink-0">
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex relative mb-8 bg-black/40 rounded-2xl p-1 backdrop-blur-md">
          <div
            className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white/20 rounded-xl transition-all duration-300 shadow-sm ${
              authMode === "login" ? "left-1" : "left-[calc(50%+2px)]"
            }`}
          />
          <button
            className={`flex-1 py-2 text-sm font-semibold transition-colors relative z-10 ${
              authMode === "login" ? "text-white" : "text-white/60 hover:text-white/80"
            }`}
            onClick={() => setAuthMode("login")}
          >
            登录
          </button>
          <button
            className={`flex-1 py-2 text-sm font-semibold transition-colors relative z-10 ${
              authMode === "register" ? "text-white" : "text-white/60 hover:text-white/80"
            }`}
            onClick={() => setAuthMode("register")}
          >
            注册
          </button>
        </div>

        <div className="relative z-10 flex flex-col min-h-[190px]">
          <div className="flex flex-col gap-4">
            <GlassInput
              icon={<UserOutline />}
              value={username}
              onChange={setUsername}
              placeholder="用户名"
              clearable
            />

            <GlassInput
              icon={<LockOutline />}
              value={password}
              onChange={setPassword}
              placeholder="密码"
              inputType="password"
              clearable
            />

            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${authMode === "register" ? "max-h-20 opacity-100 mt-0" : "max-h-0 opacity-0 -mt-4"}`}>
              <GlassInput
                icon={<LockOutline />}
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="确认密码"
                inputType="password"
                clearable
              />
            </div>
          </div>

          <div className="mt-6">
            <ButtonComponent
              variant="primary"
              size="lg"
              className="w-full mt-auto mb-2 rounded-xl border border-white/10"
              onClick={authMode === "login" ? handleLogin : handleRegister}
              loading={loading}
            >
              {authMode === "login" ? "登 录" : "注 册"}
            </ButtonComponent>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAuth = () => (
    <div className="animate-[fadeIn_0.4s_ease-out] max-w-md mx-auto w-full pt-4 pb-12">
      <CardComponent variant="immersive" className="relative overflow-hidden mb-6 border-white/20 p-6 flex-shrink-0">
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-cyan-400/20 blur-3xl rounded-full"></div>
        <div className="flex items-center gap-5 relative z-10">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 p-[2px] shadow-lg flex-shrink-0">
            <div className="w-full h-full bg-slate-900 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {displayName.charAt(0).toUpperCase()}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-white truncate drop-shadow-md">{displayName}</h2>
            <p className="text-white/60 text-sm mt-0.5 truncate">你的泸沽湖行程正在记录</p>
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-xs text-cyan-300 font-medium tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              {profile?.role === "admin" ? "管理员" : "已登录"}
            </div>
          </div>
        </div>
      </CardComponent>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <CardComponent variant="immersive" className="mb-0 flex flex-col items-center justify-center py-5">
          <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60 mb-1">
            {records.length}
          </div>
          <div className="text-xs text-white/50 tracking-wider">打卡次数</div>
        </CardComponent>
        <CardComponent variant="immersive" className="mb-0 flex flex-col items-center justify-center py-5">
          <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60 mb-1">
            {new Set(records.map(r => r.title)).size}
          </div>
          <div className="text-xs text-white/50 tracking-wider">探索景点</div>
        </CardComponent>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        <button onClick={() => navigate("/checkin")} className="flex flex-col items-center gap-2 group">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner group-active:bg-white/10 transition-all">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-cyan-400" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          </div>
          <span className="text-xs text-white/70">打卡</span>
        </button>
        <button onClick={() => navigate("/scroll")} className="flex flex-col items-center gap-2 group">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner group-active:bg-white/10 transition-all">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-blue-400" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
          </div>
          <span className="text-xs text-white/70">绘卷</span>
        </button>
        <button onClick={openPoster} className="flex flex-col items-center gap-2 group">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner group-active:bg-white/10 transition-all">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-purple-400" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
          </div>
          <span className="text-xs text-white/70">海报</span>
        </button>
        <button onClick={loadRecords} className="flex flex-col items-center gap-2 group">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner group-active:bg-white/10 transition-all">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-emerald-400" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
          </div>
          <span className="text-xs text-white/70">刷新</span>
        </button>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-bold text-white/90 mb-3 px-1 flex items-center">
          <span className="w-1 h-3.5 bg-cyan-400 rounded-full mr-2"></span>
          账号设置
        </h3>
        <CardComponent variant="immersive" className="p-4 space-y-4 shrink-0">
          <div>
            <label className="block text-xs text-white/50 mb-1.5 ml-1">用户名</label>
            <GlassInput 
              value={editName} 
              onChange={setEditName} 
              disabled={!editMode} 
              placeholder="用户名" 
              className={!editMode ? "opacity-70" : ""}
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1.5 ml-1">登录密码</label>
            <GlassInput
              value={editPassword}
              onChange={setEditPassword}
              disabled={!editMode}
              inputType="password"
              placeholder={editMode ? "输入新密码（可选）" : "••••••••"}
              className={!editMode ? "opacity-70" : ""}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <ButtonComponent 
              variant="secondary" 
              className="flex-1" 
              onClick={() => {
                if (editMode) {
                  setEditName(displayName);
                  setEditPassword("");
                }
                setEditMode(!editMode);
              }}
            >
              {editMode ? "取消" : "修改资料"}
            </ButtonComponent>
            {editMode && (
              <ButtonComponent 
                variant="primary" 
                className="flex-1" 
                onClick={() => void saveProfile()}
              >
                保存
              </ButtonComponent>
            )}
          </div>
        </CardComponent>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-bold text-white/90 mb-3 px-1 flex items-center">
          <span className="w-1 h-3.5 bg-blue-400 rounded-full mr-2"></span>
          游览记录
        </h3>
        <CardComponent variant="immersive" className="p-5 overflow-visible">
          {recordLoading ? (
            <SkeletonComponent className="h-32 mb-0" />
          ) : records.length > 0 ? (
            <div className="relative border-l-2 border-white/10 ml-3 space-y-6">
              {records.map((item, index) => (
                <div key={item.id} className="relative pl-5">
                  <div className="absolute w-3 h-3 bg-cyan-400 rounded-full -left-[7px] top-1.5 shadow-[0_0_8px_rgba(34,211,238,0.5)] border-2 border-slate-900"></div>
                  <div className="text-xs text-white/50 font-mono tracking-wider">{item.time}</div>
                  <div className="text-base font-bold text-white mt-1 mb-0.5">{item.title}</div>
                  <div className="text-sm text-white/70 leading-relaxed bg-white/5 p-2 rounded-lg mt-2 italic shadow-inner">"{item.mood}"</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyStateComponent 
              icon="🗺️" 
              title="暂无足迹" 
              description="去景点打卡，记录你的专属旅程吧" 
              className="border-none shadow-none bg-transparent mb-0 p-4"
            />
          )}
        </CardComponent>
      </div>

      <div className="mb-10 mt-8 shrink-0">
        <ButtonComponent 
          variant="danger" 
          size="lg" 
          className="w-full bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 backdrop-blur-md" 
          onClick={handleLogout}
        >
          退出登录
        </ButtonComponent>
      </div>

      <Popup 
        visible={posterVisible} 
        onMaskClick={() => setPosterVisible(false)} 
        bodyStyle={{ backgroundColor: "transparent" }}
      >
        <div className="p-6 bg-slate-900/95 backdrop-blur-3xl rounded-t-3xl border-t border-white/20 pb-10">
          <h3 className="text-xl font-bold text-white mb-2 tracking-wide text-center">AI 个性化海报</h3>
          <p className="text-xs text-white/50 text-center mb-6">根据游览记录自动生成，可保存至相册</p>
          
          <div className="flex justify-center mb-6">
            <canvas ref={canvasRef} width={340} height={500} className="rounded-2xl border border-white/20 shadow-2xl max-w-full" />
          </div>
          
          <div className="flex gap-3">
            <ButtonComponent variant="secondary" className="flex-1" onClick={drawPoster}>重新生成</ButtonComponent>
            <ButtonComponent variant="primary" className="flex-1 shadow-lg shadow-cyan-500/30" onClick={savePoster}>一键保存</ButtonComponent>
          </div>
        </div>
      </Popup>
    </div>
  );

  return (
    <ImmersivePage bgImage="/images/lugu-hero.jpg">
      {loggedIn ? renderAuth() : renderUnauth()}
    </ImmersivePage>
  );
}
