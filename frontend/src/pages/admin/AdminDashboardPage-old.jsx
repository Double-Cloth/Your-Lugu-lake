import { useEffect, useState } from "react";
import { Button, Card, DotLoading, Input, Popup, Selector, Toast, Tabs, List, Datetime, Modal, Checkbox } from "antd-mobile";
import { useNavigate } from "react-router-dom";

import {
  buildAssetUrl,
  createAdminLocation,
  deleteAdminLocation,
  downloadQrcodeZip,
  fetchAdminStats,
  fetchLocations,
  getAdminToken,
  generateLocationQr,
  logoutSession,
  updateAdminLocation,
  fetchAdminUsers,
  fetchAdminFootprints,
  fetchFootprintStats,
  fetchAdminQrcodes,
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
    return { staticMapUrl: "", webMapUrl: "" };
  }

  const latitude = Number(lat);
  const longitude = Number(lon);
  return {
    staticMapUrl: `https://staticmap.openstreetmap.de/staticmap.php?center=${latitude},${longitude}&zoom=14&size=600x260&markers=${latitude},${longitude},red-pushpin`,
    webMapUrl: `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=14/${latitude}/${longitude}`,
  };
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [locations, setLocations] = useState([]);
  const [editVisible, setEditVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [createMapError, setCreateMapError] = useState(false);
  const [editMapError, setEditMapError] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [users, setUsers] = useState([]);
  const [footprints, setFootprints] = useState([]);
  const [qrcodes, setQrcodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [footprintStats, setFootprintStats] = useState(null);
  
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
      const [statsData, locationsData, usersData, footprintsData, statsFootprintData, qrcodesData] = await Promise.all([
        fetchAdminStats(token),
        fetchLocations(),
        fetchAdminUsers(token),
        fetchAdminFootprints(token),
        fetchFootprintStats(token),
        fetchAdminQrcodes(token),
      ]).catch(() => [null, null, null, null, null, null]);

      if (statsData) setStats(statsData);
      if (locationsData) setLocations(Array.isArray(locationsData) ? locationsData : []);
      if (usersData) setUsers(usersData.data || []);
      if (footprintsData) setFootprints(footprintsData.data || []);
      if (statsFootprintData) setFootprintStats(statsFootprintData);
      if (qrcodesData) setQrcodes(qrcodesData.data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      navigate("/admin/login", { replace: true });
      return;
    }

    loadDashboard(token);
  }, [navigate]);

  function logout() {
    void logoutSession().catch(() => null);
    clearAdminSession();
    navigate("/me", { replace: true });
  }

  async function handleCreateLocation() {
    setCreateMapError(false);
    const token = getAdminToken();
    if (!token) return;

    const validationError = validateLocationPayload(form);
    if (validationError) {
      Toast.show({ content: validationError });
      return;
    }

    try {
      await createAdminLocation(
        {
          ...form,
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
        },
        token
      );
      Toast.show({ content: "景点创建成功" });
      setForm({
        name: "",
        description: "",
        audio_url: "",
        latitude: "",
        longitude: "",
        category: "culture",
        qr_code_url: "",
      });
      const token2 = getAdminToken();
      if (token2) await loadDashboard(token2);
    } catch {
      Toast.show({ content: "创建失败，请检查字段" });
    }
  }

  async function handleDeleteLocation(locationId) {
    const token = getAdminToken();
    if (!token) return;
    try {
      await deleteAdminLocation(locationId, token);
      Toast.show({ content: "已删除" });
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
    setEditMapError(false);
    setEditVisible(true);
  }

  function cancelEditLocation() {
    setEditingId(null);
    setEditVisible(false);
    setEditMapError(false);
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

  return (
    <div className="mobile-shell p-4 page-fade-in">
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
                          <div>注册: {new Date(user.created_at).toLocaleDateString()}</div>
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
              <h3 className="m-0 mb-3">新增景点</h3>
              <div className="space-y-2">
                <Input value={form.name} onChange={(val) => setForm((prev) => ({ ...prev, name: val }))} placeholder="景点名称" clearable />
                <Input value={form.description} onChange={(val) => setForm((prev) => ({ ...prev, description: val }))} placeholder="景点介绍" clearable />
                <div>
                  <div className="text-xs text-white/50 mb-1">景点类别</div>
                  <Selector
                    options={categoryOptions}
                    value={[form.category]}
                    onChange={(arr) => setForm((prev) => ({ ...prev, category: arr[0] || "culture" }))}
                  />
                </div>
                <Input
                  value={form.latitude}
                  onChange={(val) => setForm((prev) => ({ ...prev, latitude: val }))}
                  placeholder="纬度（示例：27.7248）"
                  type="number"
                  inputMode="decimal"
                  clearable
                />
                <Input
                  value={form.longitude}
                  onChange={(val) => setForm((prev) => ({ ...prev, longitude: val }))}
                  placeholder="经度（示例：100.7752）"
                  type="number"
                  inputMode="decimal"
                  clearable
                />

                <div className="rounded-xl bg-slate-50 p-2">
                  <div className="text-xs text-white/50 mb-2">坐标地图预览</div>
                  {createMap.staticMapUrl ? (
                    createMapError ? (
                      <div className="w-full rounded-lg border bg-slate-200 p-3 text-center text-xs text-slate-600">
                        <div>地图预览加载失败</div>
                        <Button size="small" className="mt-2" onClick={() => window.open(createMap.webMapUrl, "_blank")}>
                          在OpenStreetMap中打开
                        </Button>
                      </div>
                    ) : (
                      <>
                        <img
                          src={createMap.staticMapUrl}
                          alt="地图预览"
                          className="w-full rounded-lg border"
                          onError={() => setCreateMapError(true)}
                        />
                        <Button size="small" className="mt-2" onClick={() => window.open(createMap.webMapUrl, "_blank")}>
                          在地图中打开
                        </Button>
                      </>
                    )
                  ) : (
                    <div className="text-xs text-slate-400">请输入合法经纬度后可预览</div>
                  )}
                </div>

                <Button color="primary" block onClick={handleCreateLocation}>创建景点</Button>
              </div>
            </Card>

            <Card className="card card-glass">
              <div className="flex items-center justify-between mb-3">
                <h3 className="m-0">景点列表</h3>
                <Button size="small" onClick={handleDownloadZip}>批量下载二维码</Button>
              </div>
              <div className="space-y-2">
                {locations.map((loc) => (
                  <div key={loc.id} className="border rounded-xl p-3">
                    <div className="font-medium">{loc.name}</div>
                    <div className="text-xs text-white/50">{loc.category} | {loc.latitude}, {loc.longitude}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button size="mini" onClick={() => startEditLocation(loc)}>编辑</Button>
                      <Button size="mini" onClick={() => handleQuickUpdateCategory(loc)}>切换类别</Button>
                      <Button size="mini" onClick={() => handleGenerateQrcode(loc.id)}>生成二维码</Button>
                      <Button size="mini" onClick={() => handleDownloadSingleQr(loc)}>下载二维码</Button>
                      <Button size="mini" color="danger" onClick={() => handleDeleteLocation(loc.id)}>删除</Button>
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
            <div className="text-xs text-white/50 mb-1">景点类别</div>
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
            <div className="text-xs text-white/50 mb-2">坐标地图预览</div>
            {editMap.staticMapUrl ? (
              editMapError ? (
                <div className="w-full rounded-lg border bg-slate-200 p-3 text-center text-xs text-slate-600">
                  <div>地图预览加载失败</div>
                  <Button size="small" className="mt-2" onClick={() => window.open(editMap.webMapUrl, "_blank")}>
                    在OpenStreetMap中打开
                  </Button>
                </div>
              ) : (
                <>
                  <img
                    src={editMap.staticMapUrl}
                    alt="地图预览"
                    className="w-full rounded-lg border"
                    onError={() => setEditMapError(true)}
                  />
                  <Button size="small" className="mt-2" onClick={() => window.open(editMap.webMapUrl, "_blank")}>
                    在地图中打开
                  </Button>
                </>
              )
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
    </div>
  );
}


  const createMap = getMapLinks(form.latitude, form.longitude);
  const editMap = getMapLinks(editForm.latitude, editForm.longitude);

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
    const [statsData, locationsData] = await Promise.all([
      fetchAdminStats(token),
      fetchLocations(),
    ]);
    setStats(statsData);
    setLocations(Array.isArray(locationsData) ? locationsData : []);
  }

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      navigate("/admin/login", { replace: true });
      return;
    }

    loadDashboard(token)
      .catch(() => {
        clearAdminSession();
        navigate("/admin/login", { replace: true });
      });
  }, [navigate]);

  function logout() {
    void logoutSession().catch(() => null);
    clearAdminSession();
    navigate("/me", { replace: true });
  }

  async function handleCreateLocation() {
    setCreateMapError(false);
    const token = getAdminToken();
    if (!token) return;

    const validationError = validateLocationPayload(form);
    if (validationError) {
      Toast.show({ content: validationError });
      return;
    }

    try {
      await createAdminLocation(
        {
          ...form,
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
        },
        token
      );
      Toast.show({ content: "景点创建成功" });
      setForm({
        name: "",
        description: "",
        audio_url: "",
        latitude: "",
        longitude: "",
        category: "culture",
        qr_code_url: "",
      });
      await loadDashboard(token);
    } catch {
      Toast.show({ content: "创建失败，请检查字段" });
    }
  }

  async function handleDeleteLocation(locationId) {
    const token = getAdminToken();
    if (!token) return;
    try {
      await deleteAdminLocation(locationId, token);
      Toast.show({ content: "已删除" });
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
    setEditMapError(false);
    setEditVisible(true);
  }

  function cancelEditLocation() {
    setEditingId(null);
    setEditVisible(false);
    setEditMapError(false);
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

  return (
    <div className="mobile-shell p-4 page-fade-in">
      <div className="hero-shell mb-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="hero-kicker">Dashboard</div>
            <h1 className="page-title m-0">管理看板</h1>
          </div>
        </div>
        <p className="hero-copy">统一管理景点信息、二维码与游客行为数据。</p>
        <Button size="small" onClick={logout}>退出</Button>
      </div>
      {!stats ? (
        <div className="card card-glass text-center"><DotLoading color="primary" /></div>
      ) : (
        <>
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
              <div className="admin-stat-label">路线生成次数</div>
              <div className="admin-stat-value">{stats.ai_routes}</div>
            </div>
          </div>

          <Card className="card card-glass">
            <h3 className="m-0 mb-3">新增景点</h3>
            <div className="space-y-2">
              <Input value={form.name} onChange={(val) => setForm((prev) => ({ ...prev, name: val }))} placeholder="景点名称" clearable />
              <Input value={form.description} onChange={(val) => setForm((prev) => ({ ...prev, description: val }))} placeholder="景点介绍" clearable />
              <div>
                <div className="text-xs text-white/50 mb-1">景点类别</div>
                <Selector
                  options={categoryOptions}
                  value={[form.category]}
                  onChange={(arr) => setForm((prev) => ({ ...prev, category: arr[0] || "culture" }))}
                />
              </div>
              <Input
                value={form.latitude}
                onChange={(val) => setForm((prev) => ({ ...prev, latitude: val }))}
                placeholder="纬度（示例：27.7248）"
                type="number"
                inputMode="decimal"
                clearable
              />
              <Input
                value={form.longitude}
                onChange={(val) => setForm((prev) => ({ ...prev, longitude: val }))}
                placeholder="经度（示例：100.7752）"
                type="number"
                inputMode="decimal"
                clearable
              />

              <div className="rounded-xl bg-slate-50 p-2">
                <div className="text-xs text-white/50 mb-2">坐标地图预览</div>
                {createMap.staticMapUrl ? (
                  createMapError ? (
                    <div className="w-full rounded-lg border bg-slate-200 p-3 text-center text-xs text-slate-600">
                      <div>地图预览加载失败</div>
                      <Button size="small" className="mt-2" onClick={() => window.open(createMap.webMapUrl, "_blank")}>
                        在OpenStreetMap中打开
                      </Button>
                    </div>
                  ) : (
                    <>
                      <img
                        src={createMap.staticMapUrl}
                        alt="地图预览"
                        className="w-full rounded-lg border"
                        onError={() => setCreateMapError(true)}
                      />
                      <Button size="small" className="mt-2" onClick={() => window.open(createMap.webMapUrl, "_blank")}>
                        在地图中打开
                      </Button>
                    </>
                  )
                ) : (
                  <div className="text-xs text-slate-400">请输入合法经纬度后可预览</div>
                )}
              </div>

              <Button color="primary" block onClick={handleCreateLocation}>创建景点</Button>
            </div>
          </Card>

          <Card className="card card-glass">
            <div className="flex items-center justify-between mb-3">
              <h3 className="m-0">景点管理</h3>
              <Button size="small" onClick={handleDownloadZip}>批量下载二维码</Button>
            </div>
            <div className="space-y-2">
              {locations.map((loc) => (
                <div key={loc.id} className="border rounded-xl p-3">
                  <div className="font-medium">{loc.name}</div>
                  <div className="text-xs text-white/50">{loc.category} | {loc.latitude}, {loc.longitude}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="mini" onClick={() => startEditLocation(loc)}>编辑</Button>
                    <Button size="mini" onClick={() => handleQuickUpdateCategory(loc)}>切换类别</Button>
                    <Button size="mini" onClick={() => handleGenerateQrcode(loc.id)}>生成二维码</Button>
                    <Button size="mini" onClick={() => handleDownloadSingleQr(loc)}>下载二维码</Button>
                    <Button size="mini" color="danger" onClick={() => handleDeleteLocation(loc.id)}>删除</Button>
                  </div>
                  {loc.qr_code_url && <div className="text-xs text-white/95 mt-2">{loc.qr_code_url}</div>}
                </div>
              ))}
            </div>
          </Card>

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
                <div className="text-xs text-white/50 mb-1">景点类别</div>
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
                <div className="text-xs text-white/50 mb-2">坐标地图预览</div>
                {editMap.staticMapUrl ? (
                  editMapError ? (
                    <div className="w-full rounded-lg border bg-slate-200 p-3 text-center text-xs text-slate-600">
                      <div>地图预览加载失败</div>
                      <Button size="small" className="mt-2" onClick={() => window.open(editMap.webMapUrl, "_blank")}>
                        在OpenStreetMap中打开
                      </Button>
                    </div>
                  ) : (
                    <>
                      <img
                        src={editMap.staticMapUrl}
                        alt="地图预览"
                        className="w-full rounded-lg border"
                        onError={() => setEditMapError(true)}
                      />
                      <Button size="small" className="mt-2" onClick={() => window.open(editMap.webMapUrl, "_blank")}>
                        在地图中打开
                      </Button>
                    </>
                  )
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
        </>
      )}
    </div>
  );
}
