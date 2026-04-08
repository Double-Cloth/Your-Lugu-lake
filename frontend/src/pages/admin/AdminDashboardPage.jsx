import { useEffect, useState, useRef } from "react";
import { Button, Card, DotLoading, Input, Popup, Selector, Toast, Tabs, List } from "antd-mobile";
import { useNavigate } from "react-router-dom";

import {
  buildAssetUrl,
  createAdminLocation,
  deleteAdminLocation,
  deleteAdminUser,
  downloadQrcodeZip,
  fetchAdminStats,
  fetchAdminUserDetail,
  fetchLocations,
  fetchKnowledgeBaseLocationsIndex,
  getAdminToken,
  generateLocationQr,
  generateQrcodesFromKnowledgeBase,
  logoutSession,
  updateAdminLocation,
  updateAdminUser,
  resetAdminUserPassword,
  fetchAdminUsers,
  fetchAdminFootprints,
  fetchFootprintStats,
  fetchAdminQrcodes,
  importLocationsFromFile,
} from "../../api";
import { clearAdminSession } from "../../auth";

const categoryOptions = [
  { label: "人文文化", value: "culture" },
  { label: "自然风光", value: "nature" },
];

function isValidCoordinatePair(lat, lon) {
  if (!lat || !lon || lat === "" || lon === "") {
    return false;
  }
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return false;
  }
  if (latitude === 0 && longitude === 0) {
    return false;
  }
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

function getMapLinks(lat, lon) {
  if (!isValidCoordinatePair(lat, lon)) {
    return { staticMapUrl: "", webMapUrl: "", tileUrl: "" };
  }

  const latitude = Number(lat);
  const longitude = Number(lon);
  
  // 使用 tile.openstreetmap.fr 提供的静态地图（国内相对稳定）
  // 参数：center=lon,lat&zoom=13&size=600x260
  const staticUrl = `https://tile.openstreetmap.fr/hot/13/4393/2681.png`;
  
  // 使用 tile 构造一个查询地图链接（纯粹的查询，不依赖图像）
  const mapTileUrl = `https://tile.openstreetmap.org/13/${getOsmTileX(longitude, 13)}/${getOsmTileY(latitude, 13)}.png`;
  
  // OpenStreetMap网页链接（最可靠）
  const webMapUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=13/${latitude}/${longitude}`;
  
  return {
    staticMapUrl: staticUrl,
    webMapUrl: webMapUrl,
    tileUrl: mapTileUrl,
  };
}

// 计算OSM Web Mercator瓦片坐标
function getOsmTileX(lon, zoom) {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

function getOsmTileY(lat, zoom) {
  const latRad = (lat * Math.PI) / 180;
  return Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, zoom));
}

const LOCATION_FILTER_STORAGE_KEY = "admin_location_filters_v1";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [locations, setLocations] = useState([]);
  const [knowledgeBaseLocations, setKnowledgeBaseLocations] = useState([]);
  const [editVisible, setEditVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  const [locationCategoryFilter, setLocationCategoryFilter] = useState("");
  const [locationStatusFilter, setLocationStatusFilter] = useState("all");
  const [locationQrFilter, setLocationQrFilter] = useState("all");
  const [locationSortBy, setLocationSortBy] = useState("name-asc");
  const [userDetailVisible, setUserDetailVisible] = useState(false);
  const [selectedUserDetail, setSelectedUserDetail] = useState(null);
  const [selectedUserForOps, setSelectedUserForOps] = useState(null);
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [footprints, setFootprints] = useState([]);
  const [qrcodes, setQrcodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [footprintStats, setFootprintStats] = useState(null);
  const [selectedCreateKbSlug, setSelectedCreateKbSlug] = useState("");
  const [importingFile, setImportingFile] = useState(false);
  const [importResults, setImportResults] = useState(null);
    const fileInputRef = useRef(null);
  
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    audio_url: "",
    latitude: "",
    longitude: "",
    category: "culture",
    qr_code_url: "",
  });
  const [form, setForm] = useState({
    name: "",
    description: "",
    audio_url: "",
    latitude: "",
    longitude: "",
    category: "culture",
    qr_code_url: "",
  });
  const navigate = useNavigate();

  const createMap = getMapLinks(form.latitude, form.longitude);
  const editMap = getMapLinks(editForm.latitude, editForm.longitude);
  const selectedCreateKbLocation = (knowledgeBaseLocations || []).find((item) => item.slug === selectedCreateKbSlug) || null;
  const createKbMap = getMapLinks(selectedCreateKbLocation?.latitude, selectedCreateKbLocation?.longitude);

  function validateLocationPayload(payload) {
    if (!payload.name?.trim()) {
      return "景点名称不能为空";
    }
    if (!payload.description?.trim()) {
      return "景点介绍不能为空";
    }
    if (!payload.category?.trim()) {
      return "景点类别不能为空";
    }

    const latitude = Number(payload.latitude);
    const longitude = Number(payload.longitude);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return "经纬度必须是数字";
    }
    if (latitude < -90 || latitude > 90) {
      return "纬度必须在 -90 到 90 之间";
    }
    if (longitude < -180 || longitude > 180) {
      return "经度必须在 -180 到 180 之间";
    }

    if (payload.audio_url && !/^https?:\/\//.test(payload.audio_url)) {
      return "音频链接需以 http:// 或 https:// 开头";
    }

    return "";
  }

  async function loadDashboard(token) {
    try {
      setLoading(true);
      const results = await Promise.allSettled([
        fetchAdminStats(token),
        fetchLocations(),
        fetchKnowledgeBaseLocationsIndex(),
        fetchAdminUsers(token, 1, 50, userSearch, userRoleFilter),
        fetchAdminFootprints(token),
        fetchFootprintStats(token),
        fetchAdminQrcodes(token),
      ]);

      const [statsRes, locsRes, kbLocsRes, usersRes, footprintsRes, statsFootprintRes, qrcodesRes] = results;

      if (statsRes.status === "fulfilled") setStats(statsRes.value);
      if (locsRes.status === "fulfilled") setLocations(Array.isArray(locsRes.value) ? locsRes.value : []);
      if (kbLocsRes.status === "fulfilled") {
        const kbList = Array.isArray(kbLocsRes.value) ? kbLocsRes.value : [];
        setKnowledgeBaseLocations(kbList);
        if (!selectedCreateKbSlug && kbList.length > 0) {
          setSelectedCreateKbSlug(kbList[0].slug || "");
        }
      }
      if (usersRes.status === "fulfilled") setUsers(usersRes.value?.data || []);
      if (footprintsRes.status === "fulfilled") setFootprints(footprintsRes.value?.data || []);
      if (statsFootprintRes.status === "fulfilled") setFootprintStats(statsFootprintRes.value);
      if (qrcodesRes.status === "fulfilled") setQrcodes(qrcodesRes.value?.data || []);
    } finally {
      setLoading(false);
    }
  }

  async function reloadUsers(token) {
    const userRes = await fetchAdminUsers(token, 1, 50, userSearch, userRoleFilter);
    setUsers(userRes?.data || []);
  }

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      navigate("/admin/login", { replace: true });
      return;
    }

    loadDashboard(token);
  }, [navigate]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(LOCATION_FILTER_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (typeof saved?.locationSearch === "string") setLocationSearch(saved.locationSearch);
      if (typeof saved?.locationCategoryFilter === "string") setLocationCategoryFilter(saved.locationCategoryFilter);
      if (typeof saved?.locationStatusFilter === "string") setLocationStatusFilter(saved.locationStatusFilter);
      if (typeof saved?.locationQrFilter === "string") setLocationQrFilter(saved.locationQrFilter);
      if (typeof saved?.locationSortBy === "string") setLocationSortBy(saved.locationSortBy);
    } catch {
      // ignore invalid local cache
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = {
      locationSearch,
      locationCategoryFilter,
      locationStatusFilter,
      locationQrFilter,
      locationSortBy,
    };
    window.localStorage.setItem(LOCATION_FILTER_STORAGE_KEY, JSON.stringify(payload));
  }, [locationSearch, locationCategoryFilter, locationStatusFilter, locationQrFilter, locationSortBy]);

  useEffect(() => {
    const token = getAdminToken();
    if (!token) return;
    void reloadUsers(token);
  }, [userRoleFilter]);

  function logout() {
    void logoutSession().catch(() => null);
    clearAdminSession();
    navigate("/me", { replace: true });
  }

  function resetLocationFilters() {
    setLocationSearch("");
    setLocationCategoryFilter("");
    setLocationStatusFilter("all");
    setLocationQrFilter("all");
    setLocationSortBy("name-asc");
  }

  async function handleSearchUsers() {
    const token = getAdminToken();
    if (!token) return;
    try {
      await reloadUsers(token);
      Toast.show({ content: "已刷新游客列表" });
    } catch {
      Toast.show({ content: "加载游客失败" });
    }
  }

  async function handleViewUserDetail(user) {
    const token = getAdminToken();
    if (!token) return;
    try {
      const detail = await fetchAdminUserDetail(user.id, token);
      setSelectedUserDetail(detail);
      setSelectedUserForOps(user);
      setGeneratedPassword("");
      setNewPasswordInput("");
      setUserDetailVisible(true);
    } catch {
      Toast.show({ content: "加载游客详情失败" });
    }
  }

  async function handleToggleUserRole(user) {
    const token = getAdminToken();
    if (!token) return;
    const nextRole = user.role === "admin" ? "user" : "admin";
    try {
      await updateAdminUser(user.id, { role: nextRole }, token);
      Toast.show({ content: `角色已更新为 ${nextRole}` });
      await reloadUsers(token);
      if (selectedUserDetail && selectedUserDetail.id === user.id) {
        const detail = await fetchAdminUserDetail(user.id, token);
        setSelectedUserDetail(detail);
      }
    } catch (error) {
      Toast.show({ content: error?.response?.data?.detail || "更新角色失败" });
    }
  }

  async function handleResetUserPassword(user) {
    const token = getAdminToken();
    if (!token) return;
    const confirmText = newPasswordInput.trim()
      ? `确认将用户 ${user.username} 的密码重置为你输入的新密码？`
      : `确认重置用户 ${user.username} 的密码并自动生成临时密码？`;
    if (!window.confirm(confirmText)) {
      return;
    }
    try {
      const payload = newPasswordInput.trim() ? { new_password: newPasswordInput.trim() } : {};
      const result = await resetAdminUserPassword(user.id, payload, token);
      setGeneratedPassword(result.temporary_password || "");
      setNewPasswordInput("");
      const temporaryPassword = result?.temporary_password || "";
      Toast.show({
        content: temporaryPassword ? `密码已重置，临时密码：${temporaryPassword}` : "密码已重置",
        duration: 3000,
      });
    } catch (error) {
      Toast.show({ content: error?.response?.data?.detail || "重置密码失败" });
    }
  }

  async function handleDeleteUser(user) {
    const token = getAdminToken();
    if (!token) return;
    if (!window.confirm(`确认删除用户 ${user.username} 吗？该操作会同时删除其全部打卡记录。`)) {
      return;
    }
    try {
      await deleteAdminUser(user.id, token);
      Toast.show({ content: "游客账号已删除" });
      await reloadUsers(token);
      if (selectedUserDetail && selectedUserDetail.id === user.id) {
        setUserDetailVisible(false);
        setSelectedUserDetail(null);
      }
    } catch (error) {
      Toast.show({ content: error?.response?.data?.detail || "删除游客失败" });
    }
  }

  async function handleCreateLocation() {
    const token = getAdminToken();
    if (!token) return;

    if (!selectedCreateKbLocation) {
      Toast.show({ content: "请先选择 knowledge-base 景点" });
      return;
    }

    try {
      await createAdminLocation(
        {
          name: selectedCreateKbLocation.name || "",
          description: selectedCreateKbLocation.description || selectedCreateKbLocation.name || "",
          audio_url: selectedCreateKbLocation.audioUrl || selectedCreateKbLocation.audio_url || "",
          latitude: Number(selectedCreateKbLocation.latitude),
          longitude: Number(selectedCreateKbLocation.longitude),
          category: selectedCreateKbLocation.category || "culture",
          qr_code_url: "",
        },
        token
      );
      Toast.show({ content: "已按 knowledge-base 规范创建/同步景点" });
      const token2 = getAdminToken();
      if (token2) await loadDashboard(token2);
    } catch {
      Toast.show({ content: "创建失败：仅允许 knowledge-base 规范景点" });
    }
  }

  async function handleDeleteLocation(locationId, kbSlug = "") {
    const token = getAdminToken();
    if (!token) return;
    const target = (displayLocations || []).find((loc) => Number(loc.id) === Number(locationId));
    const displayName = target?.name || `#${locationId}`;
    if (!window.confirm(`确认删除景点 ${displayName} 吗？该操作会同时删除二维码和打卡关联数据。`)) {
      return;
    }
    try {
      await deleteAdminLocation(locationId, token, kbSlug);
      Toast.show({ content: `已删除景点：${displayName}` });
      await loadDashboard(token);
    } catch {
      Toast.show({ content: "删除失败" });
    }
  }

  function startEditLocation(location) {
    setEditingId(location.id);
    setEditForm({
      name: location.name || "",
      description: location.description || "",
      audio_url: location.audio_url || "",
      latitude: String(location.latitude ?? ""),
      longitude: String(location.longitude ?? ""),
      category: location.category || "culture",
      qr_code_url: location.qr_code_url || "",
    });
    setEditVisible(true);
  }

  function cancelEditLocation() {
    setEditingId(null);
    setEditVisible(false);
  }

  async function saveEditLocation(locationId) {
    const token = getAdminToken();
    if (!token) return;

    const validationError = validateLocationPayload(editForm);
    if (validationError) {
      Toast.show({ content: validationError });
      return;
    }

    try {
      await updateAdminLocation(
        locationId,
        {
          ...editForm,
          latitude: Number(editForm.latitude),
          longitude: Number(editForm.longitude),
        },
        token
      );
      Toast.show({ content: "景点更新成功" });
      setEditingId(null);
      setEditVisible(false);
      await loadDashboard(token);
    } catch {
      Toast.show({ content: "更新失败，请检查字段" });
    }
  }

  async function handleQuickUpdateCategory(location) {
    const token = getAdminToken();
    if (!token) return;
    const nextCategory = location.category === "nature" ? "culture" : "nature";
    try {
      await updateAdminLocation(location.id, { category: nextCategory }, token);
      Toast.show({ content: `已切换为 ${nextCategory}` });
      await loadDashboard(token);
    } catch {
      Toast.show({ content: "更新失败" });
    }
  }

  async function handleGenerateQrcode(locationId) {
    const token = getAdminToken();
    if (!token) return;
    try {
      await generateLocationQr(locationId, token);
      Toast.show({ content: "二维码生成成功" });
      await loadDashboard(token);
    } catch {
      Toast.show({ content: "二维码生成失败" });
    }
  }

  function handleDownloadSingleQr(location) {
    if (!location.qr_code_url) {
      Toast.show({ content: "请先生成二维码" });
      return;
    }
    window.open(buildAssetUrl(location.qr_code_url), "_blank");
  }

  async function handleDownloadZip() {
    const token = getAdminToken();
    if (!token) return;

    try {
      const blob = await downloadQrcodeZip(token);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "location-qrcodes.zip";
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      Toast.show({ content: "下载失败" });
    }
  }

  async function handleAutoGenerateQrcodes() {
    const token = getAdminToken();
    if (!token) return;

    try {
      const result = await generateQrcodesFromKnowledgeBase(token);
      Toast.show({
        content: `已生成${result.generated_qrcodes || 0}个二维码（新增景点${result.created_locations || 0}）`,
      });
      await loadDashboard(token);
    } catch {
      Toast.show({ content: "自动生成失败，请检查知识库数据" });
    }
  }

  async function handleImportFromFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const token = getAdminToken();
    if (!token) return;

    setImportingFile(true);
    setImportResults(null);

    try {
      const result = await importLocationsFromFile(file, token);
      if (result.ok) {
        setImportResults(result);
        Toast.show({
          content: `已导入 ${result.total} 个景点`,
        });
        const token2 = getAdminToken();
        if (token2) await loadDashboard(token2);
      }
    } catch (error) {
      Toast.show({
        content: error.response?.data?.detail || "导入失败，请检查文件格式",
      });
      setImportResults(null);
    } finally {
      setImportingFile(false);
      e.target.value = "";
    }
  }

  function handleClickFileInput() {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }

  const dbLocationById = new Map(
    (Array.isArray(locations) ? locations : []).map((item) => [Number(item.id), item])
  );
  const dbLocationByName = new Map(
    (Array.isArray(locations) ? locations : []).map((item) => [String(item.name || "").trim().toLowerCase(), item])
  );

  const displayLocations = Array.isArray(knowledgeBaseLocations) && knowledgeBaseLocations.length > 0
    ? knowledgeBaseLocations.map((kb) => {
      const mappedById = dbLocationById.get(Number(kb.id));
      const mappedByName = dbLocationByName.get(String(kb.name || "").trim().toLowerCase());
      const dbLoc = mappedById || mappedByName || null;
      return {
        id: dbLoc?.id ?? null,
        kb_id: kb.id ?? null,
        slug: kb.slug || "",
        name: kb.name || dbLoc?.name || "",
        description: kb.description || dbLoc?.description || "",
        audio_url: kb.audioUrl || kb.audio_url || dbLoc?.audio_url || "",
        latitude: kb.latitude ?? dbLoc?.latitude ?? "",
        longitude: kb.longitude ?? dbLoc?.longitude ?? "",
        category: kb.category || dbLoc?.category || "culture",
        qr_code_url: dbLoc?.qr_code_url || "",
      };
    })
    : locations;

  const normalizedLocationKeyword = locationSearch.trim().toLowerCase();
  const filteredLocations = (Array.isArray(displayLocations) ? displayLocations : []).filter((loc) => {
    if (locationCategoryFilter && String(loc.category || "") !== locationCategoryFilter) {
      return false;
    }

    if (locationStatusFilter === "db-only" && !loc.id) {
      return false;
    }
    if (locationStatusFilter === "kb-only" && loc.id) {
      return false;
    }

    if (locationQrFilter === "with-qr" && !loc.qr_code_url) {
      return false;
    }
    if (locationQrFilter === "without-qr" && !!loc.qr_code_url) {
      return false;
    }

    if (!normalizedLocationKeyword) {
      return true;
    }

    const haystacks = [
      String(loc.name || "").toLowerCase(),
      String(loc.slug || "").toLowerCase(),
      String(loc.description || "").toLowerCase(),
    ];
    return haystacks.some((text) => text.includes(normalizedLocationKeyword));
  });

  const sortedFilteredLocations = [...filteredLocations].sort((a, b) => {
    if (locationSortBy === "name-desc") {
      return String(b.name || "").localeCompare(String(a.name || ""), "zh-CN");
    }
    if (locationSortBy === "id-asc") {
      const aId = Number(a.id ?? a.kb_id ?? Number.MAX_SAFE_INTEGER);
      const bId = Number(b.id ?? b.kb_id ?? Number.MAX_SAFE_INTEGER);
      return aId - bId;
    }
    if (locationSortBy === "id-desc") {
      const aId = Number(a.id ?? a.kb_id ?? -1);
      const bId = Number(b.id ?? b.kb_id ?? -1);
      return bId - aId;
    }
    return String(a.name || "").localeCompare(String(b.name || ""), "zh-CN");
  });

  const locationStats = {
    total: (Array.isArray(displayLocations) ? displayLocations : []).length,
    inDb: (Array.isArray(displayLocations) ? displayLocations : []).filter((item) => !!item.id).length,
    kbOnly: (Array.isArray(displayLocations) ? displayLocations : []).filter((item) => !item.id).length,
    withQr: (Array.isArray(displayLocations) ? displayLocations : []).filter((item) => !!item.qr_code_url).length,
  };

  return (
    <div className="app-mobile-shell mobile-shell admin-dashboard">
      <div className="mobile-content page-fade-in">
        <div className="px-4 pt-4 pb-20">
      <div className="hero-shell mb-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="hero-kicker">Dashboard</div>
            <h1 className="page-title m-0">管理中心</h1>
          </div>
        </div>
        <p className="hero-copy">景点管理、游客统计、打卡数据、二维码生成</p>
        <Button size="small" onClick={logout}>退出</Button>
      </div>

      {!stats ? (
        <div className="card card-glass text-center"><DotLoading color="primary" /></div>
      ) : (
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <Tabs.Tab title="概览" key="overview">
            <div className="admin-stat-grid">
              <div className="admin-stat-tile">
                <div className="admin-stat-label">游客数量</div>
                <div className="admin-stat-value">{stats.users}</div>
              </div>
              <div className="admin-stat-tile">
                <div className="admin-stat-label">景点数量</div>
                <div className="admin-stat-value">{stats.locations}</div>
              </div>
              <div className="admin-stat-tile">
                <div className="admin-stat-label">打卡数量</div>
                <div className="admin-stat-value">{stats.footprints}</div>
              </div>
              <div className="admin-stat-tile">
                <div className="admin-stat-label">今日打卡</div>
                <div className="admin-stat-value">{stats.today_footprints}</div>
              </div>
            </div>

            {footprintStats && (
              <Card className="card card-glass mt-3">
                <h3>打卡统计</h3>
                <div className="text-sm space-y-1">
                  <div>周打卡: {footprintStats.this_week}</div>
                  <div>月打卡: {footprintStats.this_month}</div>
                </div>
              </Card>
            )}
          </Tabs.Tab>

          <Tabs.Tab title="游客管理" key="users">
            <Card className="card card-glass mb-3">
              <div className="flex gap-2 mb-3">
                <Input
                  value={userSearch}
                  onChange={setUserSearch}
                  placeholder="按用户名搜索游客"
                  clearable
                />
                <Button size="small" onClick={handleSearchUsers}>搜索</Button>
              </div>
              <div className="mb-3">
                <Selector
                  options={[
                    { label: "全部角色", value: "" },
                    { label: "游客", value: "user" },
                    { label: "管理员", value: "admin" },
                  ]}
                  value={[userRoleFilter]}
                  onChange={(arr) => setUserRoleFilter((arr && arr[0]) || "")}
                />
              </div>
              <h3>游客列表 ({users.length})</h3>
              {users.length === 0 ? (
                <div className="text-center text-sm text-white/50 py-4">暂无游客</div>
              ) : (
                <List>
                  {users.map((user) => (
                    <List.Item
                      key={user.id}
                      title={
                        <div className="font-medium">{user.username}</div>
                      }
                      description={
                        <div className="text-xs text-white/60">
                          <div>打卡: {user.total_footprints} | 景点: {user.total_locations_visited}</div>
                          <div>近7天打卡: {user.checkins_last_7_days || 0} | 角色: {user.role}</div>
                          <div>注册: {new Date(user.created_at).toLocaleDateString()}</div>
                        </div>
                      }
                      extra={
                        <div className="flex gap-1">
                          <Button size="mini" onClick={() => handleViewUserDetail(user)}>详情</Button>
                          <Button size="mini" onClick={() => handleResetUserPassword(user)}>重置密码</Button>
                          <Button size="mini" onClick={() => handleToggleUserRole(user)}>改角色</Button>
                          <Button size="mini" color="danger" onClick={() => handleDeleteUser(user)}>删除</Button>
                        </div>
                      }
                    />
                  ))}
                </List>
              )}
            </Card>
          </Tabs.Tab>

          <Tabs.Tab title="景点管理" key="locations">
            <Card className="card card-glass mb-3">
              <h3 className="m-0 mb-3">💾 上传文件导入景点</h3>
              <div className="space-y-2">
                <div className="bg-blue-500/20 border border-blue-400 rounded-xl p-3 text-sm text-white mb-3">
                  <div className="font-semibold mb-1">📋 支持的文件格式：</div>
                  <div className="text-xs opacity-80">文本文件（.txt, .md）、PDF 文档（.pdf）、Word 文档（.docx）</div>
                  <div className="text-xs opacity-80 mt-1">AI 将自动分析文件内容，严格按 knowledge-base 规范生成景点信息</div>
                </div>

                <div className="relative">
                  <input
                    type="file"
                                        ref={fileInputRef}
                    accept=".txt,.md,.pdf,.docx"
                    onChange={handleImportFromFile}
                    disabled={importingFile}
                    className="hidden"
                    id="file-input"
                  />
                  <Button
                      color="primary"
                      block
                                          onClick={handleClickFileInput}
                      disabled={importingFile}
                    >
                      {importingFile ? "正在处理中..." : "📁 选择文件并上传"}
                  </Button>
                </div>

                {importResults && (
                  <div className="bg-green-500/10 border border-green-400 rounded-xl p-3 text-sm">
                    <div className="font-semibold text-green-300 mb-2">✅ 导入成功</div>
                    <div className="space-y-1 text-xs">
                      {importResults.results?.map((res, idx) => (
                        <div key={idx} className={res.success ? "text-green-200" : "text-red-200"}>
                          {res.success ? "✓" : "✗"} {res.name} - {res.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>

            <Card className="card card-glass mb-3">
              <h3 className="m-0 mb-3">新增景点（选择 knowledge-base 中已有的）</h3>
              <div className="space-y-2">
                <div>
                  <div className="text-xs text-white/50 mb-1">从知识库选择景点</div>
                  <Selector
                    options={(knowledgeBaseLocations || []).map((item) => ({ label: item.name, value: item.slug }))}
                    value={selectedCreateKbSlug ? [selectedCreateKbSlug] : []}
                    onChange={(arr) => setSelectedCreateKbSlug(arr[0] || "")}
                  />
                </div>
                <div className="rounded-xl bg-white/10 border border-white/20 p-3 text-sm">
                  <div className="font-semibold text-white">{selectedCreateKbLocation?.name || "未选择景点"}</div>
                  <div className="text-white/75 mt-1">类别：{selectedCreateKbLocation?.category || "-"}</div>
                  <div className="text-white/75">坐标：{selectedCreateKbLocation ? `${selectedCreateKbLocation.latitude}, ${selectedCreateKbLocation.longitude}` : "-"}</div>
                  <div className="text-white/75 line-clamp-3 mt-1">{selectedCreateKbLocation?.description || "请选择 knowledge-base 景点后可查看摘要"}</div>
                </div>

                <div className="rounded-xl bg-slate-50 p-2">
                  <div className="text-xs text-slate-600 mb-2">📍 坐标信息 & 地图链接</div>
                  {createKbMap.webMapUrl ? (
                    <div className="space-y-2">
                      <div className="text-xs text-slate-700">
                        <div className="font-semibold">纬度/经度：</div>
                        <div className="font-mono text-slate-600">
                          {selectedCreateKbLocation?.latitude}, {selectedCreateKbLocation?.longitude}
                        </div>
                      </div>
                      <Button 
                        size="small" 
                        fill="outline"
                        block
                        onClick={() => window.open(createKbMap.webMapUrl, "_blank")}
                      >
                        🗺️ 在 OpenStreetMap 中打开（完整地图）
                      </Button>
                      <div className="text-xs text-slate-500">
                        💡 点击按钮打开完整交互地图，可查看周边&设施
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400">请选择 knowledge-base 景点后可预览</div>
                  )}
                </div>

                <Button color="primary" block onClick={handleCreateLocation}>按 knowledge-base 规范创建景点</Button>
              </div>
            </Card>

            <Card className="card card-glass">
              <div className="flex items-center justify-between mb-3">
                <h3 className="m-0">景点列表</h3>
                <div className="flex items-center gap-2">
                  <Button size="small" onClick={handleAutoGenerateQrcodes}>自动生成全部二维码</Button>
                  <Button size="small" onClick={handleDownloadZip}>批量下载二维码</Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                <div className="rounded-xl border border-white/20 bg-white/5 p-2">总景点：{locationStats.total}</div>
                <div className="rounded-xl border border-white/20 bg-white/5 p-2">已入库：{locationStats.inDb}</div>
                <div className="rounded-xl border border-white/20 bg-white/5 p-2">仅知识库：{locationStats.kbOnly}</div>
                <div className="rounded-xl border border-white/20 bg-white/5 p-2">已生成二维码：{locationStats.withQr}</div>
              </div>

              <div className="space-y-2 mb-3">
                <Input
                  value={locationSearch}
                  onChange={setLocationSearch}
                  placeholder="搜索景点名称/slug/描述"
                  clearable
                />
                <div>
                  <div className="text-xs text-white/60 mb-1">类别筛选</div>
                  <Selector
                    options={[
                      { label: "全部", value: "" },
                      { label: "人文", value: "culture" },
                      { label: "自然", value: "nature" },
                    ]}
                    value={[locationCategoryFilter]}
                    onChange={(arr) => setLocationCategoryFilter((arr && arr[0]) || "")}
                  />
                </div>
                <div>
                  <div className="text-xs text-white/60 mb-1">状态筛选</div>
                  <Selector
                    options={[
                      { label: "全部", value: "all" },
                      { label: "已入库", value: "db-only" },
                      { label: "仅知识库", value: "kb-only" },
                    ]}
                    value={[locationStatusFilter]}
                    onChange={(arr) => setLocationStatusFilter((arr && arr[0]) || "all")}
                  />
                </div>
                <div>
                  <div className="text-xs text-white/60 mb-1">二维码筛选</div>
                  <Selector
                    options={[
                      { label: "全部", value: "all" },
                      { label: "有二维码", value: "with-qr" },
                      { label: "无二维码", value: "without-qr" },
                    ]}
                    value={[locationQrFilter]}
                    onChange={(arr) => setLocationQrFilter((arr && arr[0]) || "all")}
                  />
                </div>
                <div>
                  <div className="text-xs text-white/60 mb-1">排序方式</div>
                  <Selector
                    options={[
                      { label: "名称 A-Z", value: "name-asc" },
                      { label: "名称 Z-A", value: "name-desc" },
                      { label: "编号升序", value: "id-asc" },
                      { label: "编号降序", value: "id-desc" },
                    ]}
                    value={[locationSortBy]}
                    onChange={(arr) => setLocationSortBy((arr && arr[0]) || "name-asc")}
                  />
                </div>
                <div className="flex justify-end">
                  <Button size="small" fill="outline" onClick={resetLocationFilters}>清空筛选</Button>
                </div>
              </div>

              <div className="text-xs text-white/60 mb-2">当前结果：{sortedFilteredLocations.length} 条</div>
              <div className="space-y-2">
                {sortedFilteredLocations.length === 0 ? (
                  <div className="text-center text-sm text-white/50 py-6 border border-dashed border-white/20 rounded-xl">
                    当前筛选条件下暂无景点
                  </div>
                ) : sortedFilteredLocations.map((loc) => (
                  <div key={`${loc.id ?? "kb"}-${loc.slug || loc.kb_id || loc.name || "unknown"}`} className="border rounded-xl p-3">
                    <div className="font-medium">{loc.name}</div>
                    <div className="text-xs text-white/50">{loc.category} | {loc.latitude}, {loc.longitude}</div>
                    {!loc.id && (
                      <div className="text-xs text-amber-200 mt-1">仅存在于 knowledge-base，点击“自动生成全部二维码”后将自动入库。</div>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button size="mini" disabled={!loc.id} onClick={() => startEditLocation(loc)}>编辑</Button>
                      <Button size="mini" disabled={!loc.id} onClick={() => handleQuickUpdateCategory(loc)}>切换类别</Button>
                      <Button size="mini" disabled={!loc.id} onClick={() => handleGenerateQrcode(loc.id)}>生成二维码</Button>
                      <Button size="mini" onClick={() => handleDownloadSingleQr(loc)}>下载二维码</Button>
                      <Button size="mini" color="danger" disabled={!loc.id} onClick={() => handleDeleteLocation(loc.id, loc.slug || "")}>删除</Button>
                    </div>
                    {loc.qr_code_url && <div className="text-xs text-white/95 mt-2">{loc.qr_code_url}</div>}
                  </div>
                ))}
              </div>
            </Card>
          </Tabs.Tab>

          <Tabs.Tab title="打卡记录" key="footprints">
            <Card className="card card-glass">
              <h3>打卡记录 ({footprints.length})</h3>
              {footprints.length === 0 ? (
                <div className="text-center text-sm text-white/50 py-4">暂无打卡记录</div>
              ) : (
                <List>
                  {footprints.map((fp) => (
                    <List.Item
                      key={fp.id}
                      title={
                        <div className="font-medium">游客 #{fp.user_id} → 景点 #{fp.location_id}</div>
                      }
                      description={
                        <div className="text-xs text-white/60">
                          <div>{new Date(fp.check_in_time).toLocaleString()}</div>
                          <div>位置: ({fp.gps_lat.toFixed(4)}, {fp.gps_lon.toFixed(4)})</div>
                          {fp.mood_text && <div>心情: {fp.mood_text}</div>}
                          {fp.photo_url && <div>📸 有照片</div>}
                        </div>
                      }
                    />
                  ))}
                </List>
              )}
            </Card>
          </Tabs.Tab>

          <Tabs.Tab title="二维码管理" key="qrcodes">
            <Card className="card card-glass">
              <h3>二维码 ({qrcodes.length})</h3>
              {qrcodes.length === 0 ? (
                <div className="text-center text-sm text-white/50 py-4">暂无二维码</div>
              ) : (
                <List>
                  {qrcodes.map((qr) => (
                    <List.Item
                      key={qr.id}
                      title={
                        <div className="font-medium">景点 #{qr.location_id}</div>
                      }
                      description={
                        <div className="text-xs text-white/60">
                          <div>生成: {new Date(qr.generated_at).toLocaleString()}</div>
                          <div>状态: {qr.is_active ? "✓ 激活" : "✗ 禁用"}</div>
                        </div>
                      }
                    />
                  ))}
                </List>
              )}
            </Card>
          </Tabs.Tab>
        </Tabs>
      )}

      <Popup
        visible={editVisible}
        onMaskClick={cancelEditLocation}
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 }}
      >
        <h3 className="m-0 mb-3">编辑景点</h3>
        <div className="space-y-2">
          <Input value={editForm.name} onChange={(val) => setEditForm((prev) => ({ ...prev, name: val }))} placeholder="景点名称" clearable />
          <Input value={editForm.description} onChange={(val) => setEditForm((prev) => ({ ...prev, description: val }))} placeholder="景点介绍" clearable />
          <Input value={editForm.audio_url} onChange={(val) => setEditForm((prev) => ({ ...prev, audio_url: val }))} placeholder="音频链接（http/https）" clearable />
          <div>
            <div className="text-xs text-slate-600 mb-1">景点类别</div>
            <Selector
              options={categoryOptions}
              value={[editForm.category]}
              onChange={(arr) => setEditForm((prev) => ({ ...prev, category: arr[0] || "culture" }))}
            />
          </div>
          <Input
            value={editForm.latitude}
            onChange={(val) => setEditForm((prev) => ({ ...prev, latitude: val }))}
            placeholder="纬度（示例：27.7248）"
            type="number"
            inputMode="decimal"
            clearable
          />
          <Input
            value={editForm.longitude}
            onChange={(val) => setEditForm((prev) => ({ ...prev, longitude: val }))}
            placeholder="经度（示例：100.7752）"
            type="number"
            inputMode="decimal"
            clearable
          />

          <div className="rounded-xl bg-slate-50 p-2">
            <div className="text-xs text-slate-600 mb-2">📍 坐标信息 & 地图链接</div>
            {editMap.webMapUrl ? (
              <div className="space-y-2">
                <div className="text-xs text-slate-700">
                  <div className="font-semibold">纬度/经度：</div>
                  <div className="font-mono text-slate-600">
                    {editForm.latitude}, {editForm.longitude}
                  </div>
                </div>
                <Button 
                  size="small" 
                  fill="outline"
                  block
                  onClick={() => window.open(editMap.webMapUrl, "_blank")}
                >
                  🗺️ 在 OpenStreetMap 中打开（完整地图）
                </Button>
                <div className="text-xs text-slate-500">
                  💡 点击按钮打开完整交互地图，可查看周边&设施
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400">请输入合法经纬度后可预览</div>
            )}
          </div>

          <Input value={editForm.qr_code_url} onChange={(val) => setEditForm((prev) => ({ ...prev, qr_code_url: val }))} placeholder="二维码路径" clearable />
          <div className="flex gap-2 pt-2">
            <Button block color="primary" disabled={!editingId} onClick={() => saveEditLocation(editingId)}>
              保存修改
            </Button>
            <Button block onClick={cancelEditLocation}>取消</Button>
          </div>
        </div>
      </Popup>

      <Popup
        visible={userDetailVisible}
        onMaskClick={() => setUserDetailVisible(false)}
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: "78vh", overflowY: "auto" }}
      >
        <h3 className="m-0 mb-3">游客账号详情</h3>
        {selectedUserDetail ? (
          <div className="space-y-2 text-sm">
            <div>用户名: {selectedUserDetail.username}</div>
            <div>角色: {selectedUserDetail.role}</div>
            <div>注册时间: {new Date(selectedUserDetail.created_at).toLocaleString()}</div>
            <div>总打卡: {selectedUserDetail.total_footprints}</div>
            <div>近7天打卡: {selectedUserDetail.checkins_last_7_days || 0}</div>
            <div>近30天打卡: {selectedUserDetail.checkins_last_30_days || 0}</div>
            <div>覆盖景点: {selectedUserDetail.total_locations_visited}</div>

            <div className="pt-2 border-t border-white/20">
              <div className="text-xs text-white/70 mb-1">重置密码（可选填新密码，不填则自动生成）</div>
              <div className="flex gap-2">
                <Input
                  value={newPasswordInput}
                  onChange={setNewPasswordInput}
                  placeholder="输入新密码（可留空自动生成）"
                  clearable
                />
                <Button
                  size="small"
                  onClick={() => selectedUserForOps && handleResetUserPassword(selectedUserForOps)}
                >
                  重置密码
                </Button>
              </div>
              {generatedPassword ? (
                <div className="mt-2 text-xs text-amber-300">临时密码: {generatedPassword}</div>
              ) : null}
            </div>

            <div className="pt-2 border-t border-white/20">
              <div className="font-medium mb-1">最近打卡记录</div>
              {Array.isArray(selectedUserDetail.footprints) && selectedUserDetail.footprints.length > 0 ? (
                <div className="space-y-1 text-xs text-white/75">
                  {selectedUserDetail.footprints.slice(0, 10).map((fp) => (
                    <div key={fp.id} className="rounded-lg border border-white/15 p-2">
                      <div>#{fp.id} 景点: {fp.location_name || `#${fp.location_id}`}</div>
                      <div>时间: {new Date(fp.check_in_time).toLocaleString()}</div>
                      <div>坐标: {Number(fp.gps_lat).toFixed(4)}, {Number(fp.gps_lon).toFixed(4)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-white/50">暂无打卡记录</div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-sm text-white/60">正在加载...</div>
        )}
      </Popup>
        </div>
      </div>
    </div>
  );
}
