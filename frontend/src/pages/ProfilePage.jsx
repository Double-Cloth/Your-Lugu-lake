import { useEffect, useMemo, useRef, useState } from "react";
import LucideIcon from "../components/LucideIcon";
import { Dialog, Popup, Toast } from "antd-mobile";
import { UserOutline, LockOutline } from "antd-mobile-icons";
import { useNavigate, useParams } from "react-router-dom";
import { ImmersivePage, CardComponent, ButtonComponent, GlassInput, SkeletonComponent, EmptyStateComponent } from "../components/SharedUI";
import {
  buildAssetUrl,
  deleteRoute,
  fetchCurrentUser,
  fetchTrackingState,
  fetchLocations,
  fetchMyFootprints,
  fetchMyRoutes,
  getUserToken,
  loginUser,
  logoutSession,
  registerUser,
  updateCurrentUser,
} from "../api";
import {
  buildUserProfilePath,
  buildAdminDashboardPath,
  clearUserSession,
  getUserSessionUsername,
  hasUserSession,
  setUserSession,
  setAdminSession,
  withUserSessionPath,
} from "../auth";

function toRecordList(footprints, locationMap) {
  return footprints.map((item) => ({
    id: item.id,
    title: locationMap[item.location_id]?.name || `景点 #${item.location_id}`,
    time: new Date(item.check_in_time).toLocaleString(),
    checkInTime: item.check_in_time,
    mood: item.mood_text || "完成打卡",
    photoList: Array.isArray(item.photo_urls)
      ? item.photo_urls
      : (item.photo_url ? [item.photo_url] : []),
  }));
}

function formatTravelProfile(profile) {
  if (!profile || typeof profile !== "object") return "";

  const durationMap = {
    "half-day": "半天",
    "one-day": "一天",
  };
  const groupMap = {
    solo: "独行",
    friends: "朋友",
    family: "亲子",
    couple: "情侣",
  };
  const focusMap = {
    culture: "礼俗讲解",
    mixed: "景观+文化",
    light: "轻松体验",
  };
  const paceMap = {
    relaxed: "松弛",
    balanced: "平衡",
    intense: "高效",
  };

  const duration = durationMap[profile.duration] || profile.duration || "";
  const group = groupMap[profile.group_type] || profile.group_type || "";
  const focus = focusMap[profile.preference] || profile.preference || "";
  const pace = paceMap[profile.pace] || profile.pace || "";

  return [duration, group, focus, pace].filter(Boolean).join(" · ");
}

function isUnauthorizedError(error) {
  return Number(error?.response?.status) === 401;
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function normalizePosterTrackPoints(trackPoints) {
  if (!Array.isArray(trackPoints)) {
    return [];
  }

  return trackPoints
    .map((item) => {
      const lat = Number(item?.lat);
      const lon = Number(item?.lon);
      const t = Number(item?.t);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return null;
      }
      return {
        lat,
        lon,
        t: Number.isFinite(t) ? t : Date.now(),
      };
    })
    .filter(Boolean)
    .slice(-600);
}

function drawTrackPreview(ctx, points, x, y, width, height) {
  if (!points || points.length < 2) {
    return;
  }

  const panelRadius = 20;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, panelRadius);
  ctx.fillStyle = "rgba(8, 30, 44, 0.46)";
  ctx.fill();
  ctx.strokeStyle = "rgba(151, 212, 236, 0.38)";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  const padding = 18;
  const minLon = Math.min(...points.map((point) => point.lon));
  const maxLon = Math.max(...points.map((point) => point.lon));
  const minLat = Math.min(...points.map((point) => point.lat));
  const maxLat = Math.max(...points.map((point) => point.lat));
  const lonSpan = Math.max(0.00001, maxLon - minLon);
  const latSpan = Math.max(0.00001, maxLat - minLat);

  const gridColor = "rgba(181, 224, 244, 0.12)";
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let idx = 1; idx <= 3; idx += 1) {
    const gx = x + padding + ((width - padding * 2) * idx) / 4;
    const gy = y + padding + ((height - padding * 2) * idx) / 4;
    ctx.beginPath();
    ctx.moveTo(gx, y + padding);
    ctx.lineTo(gx, y + height - padding);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + padding, gy);
    ctx.lineTo(x + width - padding, gy);
    ctx.stroke();
  }

  const plotPoints = points.map((point) => {
    const px = x + padding + ((point.lon - minLon) / lonSpan) * (width - padding * 2);
    const py = y + height - padding - ((point.lat - minLat) / latSpan) * (height - padding * 2);
    return { x: px, y: py };
  });

  ctx.beginPath();
  ctx.moveTo(plotPoints[0].x, plotPoints[0].y);
  plotPoints.slice(1).forEach((point) => {
    ctx.lineTo(point.x, point.y);
  });
  ctx.strokeStyle = "rgba(113, 229, 255, 0.95)";
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.shadowColor = "rgba(54, 196, 239, 0.6)";
  ctx.shadowBlur = 8;
  ctx.stroke();

  const startPoint = plotPoints[0];
  const endPoint = plotPoints[plotPoints.length - 1];

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#bdfde6";
  ctx.beginPath();
  ctx.arc(startPoint.x, startPoint.y, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffe4aa";
  ctx.beginPath();
  ctx.arc(endPoint.x, endPoint.y, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(226, 245, 255, 0.92)";
  ctx.font = "600 18px 'PingFang SC', 'Noto Sans SC', sans-serif";
  ctx.fillText(`轨迹点 ${points.length}`, x + 16, y + height - 14);
  ctx.restore();
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { username: usernameFromPath } = useParams();
  const posterBackgroundUrl = "/images/lugu-hero.png";
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
  const [savedRoutes, setSavedRoutes] = useState([]);
  const [savedRoutesLoading, setSavedRoutesLoading] = useState(false);
  const [deletingRouteId, setDeletingRouteId] = useState(null);
  const [quickRefreshing, setQuickRefreshing] = useState(false);
  
  const [posterVisible, setPosterVisible] = useState(false);
  const [posterTrackPoints, setPosterTrackPoints] = useState([]);
  const canvasRef = useRef(null);
  const accountSectionRef = useRef(null);
  const recordsSectionRef = useRef(null);
  const routesSectionRef = useRef(null);

  const displayName = useMemo(() => {
    return profile?.username || "游客";
  }, [profile]);

  useEffect(() => {
    if (!loggedIn) return;
    void loadProfile();
    void loadRecords();
  }, [loggedIn]);

  useEffect(() => {
    void restoreSessionFromCookie();
  }, []);

  useEffect(() => {
    setEditName(displayName);
  }, [displayName]);

  useEffect(() => {
    if (!posterVisible) return;
    void drawPoster();
  }, [posterVisible, records, savedRoutes, displayName, posterTrackPoints]);

  useEffect(() => {
    if (loggedIn) {
      const sessionUser = getUserSessionUsername();
      if (!sessionUser) return;

      const normalizedPathUser = typeof usernameFromPath === "string"
        ? decodeURIComponent(usernameFromPath).trim()
        : "";
      if (normalizedPathUser === sessionUser) return;

      navigate(buildUserProfilePath(), { replace: true });
      return;
    }

    if (typeof usernameFromPath === "string") {
      const normalizedPathUser = decodeURIComponent(usernameFromPath).trim();
      if (normalizedPathUser) {
        setUsername((prev) => (prev ? prev : normalizedPathUser));
      }
    }
  }, [loggedIn, navigate, usernameFromPath]);

  async function restoreSessionFromCookie() {
    if (!hasUserSession()) {
      setLoggedIn(false);
      return;
    }

    const token = getUserToken();
    if (!token) {
      setLoggedIn(false);
      return;
    }

    try {
      let data = null;
      let lastError = null;

      // 移动端切回前台时网络可能短暂不可用，避免一次失败就清会话。
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          data = await fetchCurrentUser(token);
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          if (isUnauthorizedError(error)) {
            break;
          }
          if (attempt < 2) {
            await delay(400 * (attempt + 1));
          }
        }
      }

      if (lastError) {
        throw lastError;
      }

      if (!data) {
        clearUserSession();
        setLoggedIn(false);
        return;
      }
      setUserSession("", data?.username || "");
      setProfile(data);
      setLoggedIn(true);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        clearUserSession();
        setLoggedIn(false);
        return;
      }

      // 非 401 不强制登出，避免用户感知为“自动刷新/跳回登录”。
      setLoggedIn(true);
    }
  }

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
      setUserSession("", data?.username || username);
      setLoggedIn(true);
      setPassword("");
      setConfirmPassword("");
      navigate(buildUserProfilePath(), { replace: true });
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
      // Auto-detect role and route accordingly
      if (data.role === "admin") {
        setAdminSession("", data?.username || username);
        navigate(buildAdminDashboardPath(), { replace: true });
        Toast.show({ content: "登录成功" });
      } else if (data.role === "user") {
        setUserSession("", data?.username || username);
        setLoggedIn(true);
        setPassword("");
        navigate(buildUserProfilePath(), { replace: true });
        Toast.show({ content: "登录成功" });
      } else {
        Toast.show({ content: "账号角色不明确，登录失败" });
      }
    } catch (error) {
      const status = error?.response?.status;
      if (status === 401) {
        Toast.show({ content: "账号或密码错误" });
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
    void logoutSession().catch(() => null);
    clearUserSession();
    setLoggedIn(false);
    setProfile(null);
    setRecords([]);
    setSavedRoutes([]);
    setPosterTrackPoints([]);
    setEditName("");
    navigate("/me", { replace: true });
    Toast.show({ content: "已退出游客登录" });
  }

  async function loadProfile() {
    const token = getUserToken();
    if (!token) return;
    try {
      const data = await fetchCurrentUser(token);
      if (!data) {
        clearUserSession();
        setLoggedIn(false);
        setProfile(null);
        return;
      }
      setProfile(data);

      if (typeof data?.username === "string" && data.username.trim()) {
        setUserSession(token, data.username);
      }
    } catch (error) {
      if (isUnauthorizedError(error)) {
        clearUserSession();
        setLoggedIn(false);
        setProfile(null);
        return;
      }
      Toast.show({ content: "网络波动，资料将在恢复后自动刷新" });
    }
  }

  async function loadRecords() {
    const token = getUserToken();
    if (!token) {
      setRecords([]);
      setSavedRoutes([]);
      setPosterTrackPoints([]);
      return;
    }
    setRecordLoading(true);
    setSavedRoutesLoading(true);
    try {
      const [footprints, locations, routes, trackingState] = await Promise.all([
        fetchMyFootprints(token),
        fetchLocations(),
        fetchMyRoutes(token),
        fetchTrackingState().catch(() => null),
      ]);
      const locationMap = {};
      locations.forEach((item) => {
        locationMap[item.id] = item;
      });

      const list = Array.isArray(footprints) ? toRecordList(footprints, locationMap) : [];
      setRecords(list);
      setSavedRoutes(Array.isArray(routes) ? routes : []);
      setPosterTrackPoints(normalizePosterTrackPoints(trackingState?.track_points));
    } catch {
      setRecords([]);
      setSavedRoutes([]);
      setPosterTrackPoints([]);
      Toast.show({ content: "加载游览数据失败" });
    } finally {
      setRecordLoading(false);
      setSavedRoutesLoading(false);
    }
  }

  async function handleQuickRefresh() {
    if (quickRefreshing || recordLoading || savedRoutesLoading) {
      return;
    }

    setQuickRefreshing(true);
    try {
      await loadRecords();
      Toast.show({ content: "已刷新最新数据" });
    } finally {
      setQuickRefreshing(false);
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
      setUserSession("", data?.username || "");
      navigate(buildUserProfilePath(), { replace: true });
      setEditMode(false);
      setEditPassword("");
      Toast.show({ content: "资料已更新" });
    } catch (error) {
      const detail = error?.response?.data?.detail;
      Toast.show({ content: detail || "更新失败" });
    }
  }

  async function handleDeleteRoute(routeId) {
    const token = getUserToken();
    if (!token) {
      Toast.show({ content: "请先登录" });
      return;
    }

    if (deletingRouteId !== null) {
      return;
    }

    Dialog.confirm({
      className: "route-delete-confirm-dialog",
      title: "删除路线",
      content: "确认删除这条路线吗？删除后不可恢复。",
      confirmText: "确认删除",
      cancelText: "取消",
      onConfirm: async () => {
        setDeletingRouteId(routeId);
        try {
          await deleteRoute(routeId, token);
          setSavedRoutes((prev) => prev.filter((item) => item.id !== routeId));
          Toast.show({ content: "路线已删除" });
        } catch (error) {
          const detail = error?.response?.data?.detail;
          Toast.show({ content: detail || "删除失败，请稍后重试" });
        } finally {
          setDeletingRouteId(null);
        }
      },
    });
  }

  async function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("图片加载失败"));
      image.src = url;
    });
  }

  function drawCoverImage(ctx, image, canvasWidth, canvasHeight) {
    const scale = Math.max(canvasWidth / image.width, canvasHeight / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const offsetX = (canvasWidth - drawWidth) / 2;
    const offsetY = (canvasHeight - drawHeight) / 2;
    ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  }

  async function drawPoster() {
    let canvas = canvasRef.current;
    for (let attempt = 0; !canvas && attempt < 6; attempt += 1) {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      canvas = canvasRef.current;
    }
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 720;
    canvas.height = 1080;

    const uniqueSpots = new Set(records.map((item) => item.title)).size;
    const firstWithPhoto = records.find((item) => Array.isArray(item.photoList) && item.photoList.length > 0);
    const topMood = records.find((item) => item.mood && item.mood !== "完成打卡");
    const trackPointsForPoster = normalizePosterTrackPoints(posterTrackPoints);
    const hasTrackPreview = trackPointsForPoster.length >= 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    try {
      const background = await loadImage(posterBackgroundUrl);
      ctx.save();
      drawCoverImage(ctx, background, canvas.width, canvas.height);
      ctx.restore();
    } catch {
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, "#0b3b4f");
      gradient.addColorStop(1, "#0e3141");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const overlay = ctx.createLinearGradient(0, 0, 0, canvas.height);
    overlay.addColorStop(0, "rgba(5, 20, 30, 0.36)");
    overlay.addColorStop(0.55, "rgba(6, 24, 36, 0.48)");
    overlay.addColorStop(1, "rgba(5, 18, 28, 0.78)");
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(32, 32, canvas.width - 64, canvas.height - 64);
    ctx.strokeStyle = "rgba(196,231,246,0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(32, 32, canvas.width - 64, canvas.height - 64);

    if (firstWithPhoto?.photoList?.[0]) {
      try {
        const photo = await loadImage(buildAssetUrl(firstWithPhoto.photoList[0]));
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(56, 68, canvas.width - 112, 300, 22);
        ctx.clip();
        ctx.drawImage(photo, 56, 68, canvas.width - 112, 300);
        ctx.restore();
      } catch {
        // Ignore image rendering failures and keep text poster available.
      }
    }

    ctx.fillStyle = "#f3fbff";
    ctx.font = "700 44px 'PingFang SC', 'Noto Sans SC', sans-serif";
    ctx.fillText("泸沽湖旅行海报", 56, 430);

    ctx.font = "500 26px 'PingFang SC', 'Noto Sans SC', sans-serif";
    ctx.fillStyle = "rgba(232,246,255,0.9)";
    ctx.fillText(`旅行者：${displayName}`, 56, 472);

    ctx.font = "500 22px 'PingFang SC', 'Noto Sans SC', sans-serif";
    ctx.fillStyle = "rgba(205,234,247,0.95)";
    ctx.fillText(`打卡 ${records.length} 次  ·  探索 ${uniqueSpots} 个景点  ·  路线 ${savedRoutes.length} 条`, 56, 510);

    if (hasTrackPreview) {
      drawTrackPreview(ctx, trackPointsForPoster, 56, 538, canvas.width - 112, 188);
    }

    ctx.font = "500 21px 'PingFang SC', 'Noto Sans SC', sans-serif";
    records.slice(0, hasTrackPreview ? 3 : 5).forEach((item, idx) => {
      const y = (hasTrackPreview ? 780 : 578) + idx * 72;
      ctx.fillStyle = "#75daf3";
      ctx.beginPath();
      ctx.arc(62, y - 6, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#fff7eb";
      ctx.fillText(`${item.title} · ${item.time.split(" ")[0]}`, 80, y);
      ctx.fillStyle = "rgba(213,236,247,0.85)";
      const mood = (item.mood || "完成打卡").slice(0, 24);
      ctx.fillText(mood, 80, y + 30);
    });

    if (topMood) {
      ctx.fillStyle = "rgba(245, 227, 192, 0.95)";
      ctx.font = "500 22px 'PingFang SC', 'Noto Sans SC', sans-serif";
      ctx.fillText(`今日心情：${(topMood.mood || "湖畔风正好").slice(0, 26)}`, 56, 968);
    }

    ctx.fillStyle = "#9adff4";
    ctx.font = "italic 20px 'Times New Roman', serif";
    ctx.fillText(`Generated ${new Date().toLocaleDateString("zh-CN")}`, 56, canvas.height - 56);
  }

  async function savePoster() {
    await drawPoster();
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `lugu-poster-${Date.now()}.png`;
      link.click();
      Toast.show({ content: "海报已导出为图片" });
    } catch {
      Toast.show({ content: "海报导出失败，请稍后重试" });
    }
  }

  function openPoster() {
    if (records.length === 0) {
      Toast.show({ content: "暂无真实游览记录，无法生成海报" });
      return;
    }
    setPosterVisible(true);
  }

  function scrollToSection(sectionRef) {
    if (!sectionRef?.current) return;
    sectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
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
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-orange-500/20 rounded-full blur-3xl pointer-events-none"></div>

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
    <div className="animate-[fadeIn_0.4s_ease-out] mx-auto w-full pt-4 pb-4">
      <CardComponent variant="immersive" className="relative overflow-hidden mb-6 border-white/20 p-6 flex-shrink-0">
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-amber-400/20 blur-3xl rounded-full"></div>
        <div className="flex items-center gap-5 relative z-10">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 p-[2px] shadow-lg flex-shrink-0">
            <div className="w-full h-full bg-slate-900 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {displayName.charAt(0).toUpperCase()}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-white truncate drop-shadow-md">{displayName}</h2>
            <p className="text-white/60 text-sm mt-0.5 truncate">你的泸沽湖行程正在记录</p>
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-xs text-amber-300 font-medium tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              {profile?.role === "admin" ? "管理员" : "已登录"}
            </div>
          </div>
        </div>
      </CardComponent>

      <div className="grid grid-cols-3 gap-3 mb-6">
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
        <CardComponent variant="immersive" className="mb-0 flex flex-col items-center justify-center py-5">
          <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60 mb-1">
            {savedRoutes.length}
          </div>
          <div className="text-xs text-white/50 tracking-wider">我的路线</div>
        </CardComponent>
      </div>

      <div className="profile-function-groups mb-6">
        <div className="profile-function-section">
          <h3 className="profile-function-title">
            <span className="profile-function-dot bg-amber-300"></span>
            行程助手
          </h3>
          <div className="profile-function-grid profile-function-grid-main">
            <button
              onClick={() => navigate(withUserSessionPath("/checkin"))}
              className="profile-function-item"
            >
              <div className="profile-function-icon-wrap">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-amber-300" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              </div>
              <span className="profile-function-text">打卡签到</span>
            </button>
            <button
              onClick={() => navigate(withUserSessionPath("/scroll"))}
              className="profile-function-item"
            >
              <div className="profile-function-icon-wrap">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-orange-400" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
              </div>
              <span className="profile-function-text">旅行绘卷</span>
            </button>
          </div>
        </div>

        <div className="profile-function-section">
          <h3 className="profile-function-title">
            <span className="profile-function-dot bg-violet-300"></span>
            工具与同步
          </h3>
          <div className="profile-function-grid profile-function-grid-tool">
            <button onClick={openPoster} className="profile-function-item">
              <div className="profile-function-icon-wrap">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-violet-300" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
              </div>
              <span className="profile-function-text">生成海报</span>
            </button>
            <button
              onClick={() => void handleQuickRefresh()}
              disabled={quickRefreshing || recordLoading || savedRoutesLoading}
              className="profile-function-item disabled:opacity-60"
            >
              <div className="profile-function-icon-wrap">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" className={`text-emerald-300 ${quickRefreshing || recordLoading || savedRoutesLoading ? "animate-spin" : ""}`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
              </div>
              <span className="profile-function-text">{quickRefreshing || recordLoading || savedRoutesLoading ? "刷新中" : "刷新数据"}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="profile-category-nav mb-6">
        <button className="profile-category-item" onClick={() => scrollToSection(accountSectionRef)}>
          <span className="profile-category-name">账号与安全</span>
          <span className="profile-category-desc">修改资料与密码</span>
        </button>
        <button className="profile-category-item" onClick={() => scrollToSection(recordsSectionRef)}>
          <span className="profile-category-name">足迹记录</span>
          <span className="profile-category-desc">查看打卡时间线</span>
        </button>
        <button className="profile-category-item" onClick={() => scrollToSection(routesSectionRef)}>
          <span className="profile-category-name">路线管理</span>
          <span className="profile-category-desc">继续优化或删除路线</span>
        </button>
      </div>

      <div className="mb-6" ref={accountSectionRef}>
        <h3 className="text-sm font-bold text-white/90 mb-3 px-1 flex items-center">
          <span className="w-1 h-3.5 bg-amber-400 rounded-full mr-2"></span>
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

      <div className="mb-6" ref={recordsSectionRef}>
        <h3 className="text-sm font-bold text-white/90 mb-3 px-1 flex items-center">
          <span className="w-1 h-3.5 bg-orange-400 rounded-full mr-2"></span>
          游览记录
        </h3>
        <CardComponent variant="immersive" className="p-5 overflow-visible">
          {recordLoading ? (
            <SkeletonComponent className="h-32 mb-0" />
          ) : records.length > 0 ? (
            <div className="relative border-l-2 border-white/10 ml-3 space-y-6">
              {records.map((item) => (
                <div key={item.id} className="relative pl-5">
                  <div className="absolute w-3 h-3 bg-amber-400 rounded-full -left-[7px] top-1.5 shadow-[0_0_8px_rgba(251, 146, 60, 0.5)] border-2 border-slate-900"></div>
                  <div className="text-xs text-white/50 font-mono tracking-wider">{item.time}</div>
                  <div className="text-base font-bold text-white mt-1 mb-0.5">{item.title}</div>
                  <div className="text-sm text-white/70 leading-relaxed bg-white/5 p-2 rounded-lg mt-2 italic shadow-inner">"{item.mood}"</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyStateComponent 
              icon={<LucideIcon name="Map" size={48} className="text-white/40 mb-3 mx-auto" strokeWidth={1.5} />} 
              title="暂无足迹" 
              description="去景点打卡，记录你的专属旅程吧" 
              className="border-none shadow-none bg-transparent mb-0 p-4"
            />
          )}
        </CardComponent>
      </div>

      <div className="mb-6" ref={routesSectionRef}>
        <h3 className="text-sm font-bold text-white/90 mb-3 px-1 flex items-center">
          <span className="w-1 h-3.5 bg-amber-300 rounded-full mr-2"></span>
          我的路线
        </h3>
        <CardComponent variant="immersive" className="p-5 overflow-visible">
          {savedRoutesLoading ? (
            <SkeletonComponent className="h-28 mb-0" />
          ) : savedRoutes.length > 0 ? (
            <div className="space-y-4">
              {savedRoutes.map((item) => {
                const route = item?.route && typeof item.route === "object" ? item.route : {};
                const timeline = Array.isArray(route.timeline) ? route.timeline : [];
                const routeTitle = route.title || `文化路线 #${item.id}`;
                const routeRequirement = typeof route.requirement === "string" ? route.requirement : "";
                const templateTitle = route?.inspiration_template?.title || "";
                const profileSummary = formatTravelProfile(route.travel_profile);
                return (
                  <div key={`route-${item.id}`} className="rounded-2xl border border-white/15 bg-white/5 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{routeTitle}</div>
                        <div className="text-xs text-white/55 mt-1">保存时间：{new Date(item.created_at).toLocaleString()}</div>
                        {templateTitle ? (
                          <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-amber-300/20 border border-amber-200/30 text-amber-100">
                            {templateTitle}
                          </div>
                        ) : null}
                      </div>
                      <span className="shrink-0 px-2 py-1 rounded-full text-[11px] bg-amber-300/20 border border-amber-200/30 text-amber-100">
                        {timeline.length} 站
                      </span>
                    </div>

                    {profileSummary ? (
                      <div className="mt-2 text-xs text-white/70">画像：{profileSummary}</div>
                    ) : null}

                    {routeRequirement ? (
                      <div className="mt-2 text-xs text-white/70 bg-white/5 border border-white/10 rounded-lg px-2.5 py-2">
                        需求：{routeRequirement}
                      </div>
                    ) : null}

                    {timeline.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {timeline.map((stop, idx) => (
                          <div key={`route-${item.id}-stop-${idx}`} className="flex items-center justify-between text-xs">
                            <span className="text-amber-100/90">{stop.time || `第 ${idx + 1} 站`}</span>
                            <span className="text-white/80 max-w-[60%] truncate">{stop.location || "景点"}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 text-xs text-white/55">该路线暂未包含时间轴明细。</div>
                    )}

                    <ButtonComponent
                      variant="secondary"
                      className="w-full mt-3"
                      onClick={() => navigate(withUserSessionPath("/home"), {
                        state: {
                          openPanel: "culture",
                          cultureSeed: {
                            route_id: item.id,
                            created_at: item.created_at,
                            route,
                          },
                        },
                      })}
                    >
                      基于此路线继续优化
                    </ButtonComponent>

                    <ButtonComponent
                      variant="danger"
                      className="w-full mt-2"
                      loading={deletingRouteId === item.id}
                      disabled={deletingRouteId !== null && deletingRouteId !== item.id}
                      onClick={() => void handleDeleteRoute(item.id)}
                    >
                      删除路线
                    </ButtonComponent>
                  </div>
                );
              })}

              <ButtonComponent
                variant="secondary"
                className="w-full"
                onClick={() => navigate(withUserSessionPath("/home"), { state: { openPanel: "culture" } })}
              >
                继续优化文化路线
              </ButtonComponent>
            </div>
          ) : (
            <EmptyStateComponent
              icon={<LucideIcon name="Compass" size={48} className="text-white/40 mb-3 mx-auto" strokeWidth={1.5} />}
              title="暂无路线"
              description="去首页-文化导览生成并自动保存你的专属路线"
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
          
          <div className="poster-preview-wrap flex justify-center mb-6">
            <canvas ref={canvasRef} width={720} height={1080} className="profile-poster-canvas rounded-2xl border border-white/20 shadow-2xl max-w-full" />
          </div>
          
          <div className="flex gap-3">
            <ButtonComponent variant="secondary" className="flex-1" onClick={() => void drawPoster()}>重新生成</ButtonComponent>
            <ButtonComponent variant="primary" className="flex-1 shadow-lg shadow-amber-500/30" onClick={() => void savePoster()}>一键保存</ButtonComponent>
          </div>
        </div>
      </Popup>
    </div>
  );

  return (
    <ImmersivePage bgImage="/images/lugu-hero.png">
      {loggedIn ? renderAuth() : renderUnauth()}
    </ImmersivePage>
  );
}

