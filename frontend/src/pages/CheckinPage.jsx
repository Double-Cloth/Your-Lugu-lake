import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, ImageUploader, Input, Modal, Toast } from "antd-mobile";
import { ImmersivePage, CardComponent, ButtonComponent, GlassInput } from "../components/SharedUI";
import { Html5Qrcode } from "html5-qrcode";

import { buildAssetUrl, createFootprint, fetchLocationById, getUserToken } from "../api";

function parseLocationIdFromText(text) {
  if (!text) return null;
  const pathMatch = text.match(/\/locations\/(\d+)/);
  if (pathMatch?.[1]) return Number(pathMatch[1]);

  const plainNumber = Number(text);
  if (Number.isFinite(plainNumber) && plainNumber > 0) {
    return plainNumber;
  }

  return null;
}

export default function CheckinPage() {
  const canvasRef = useRef(null);
  const scannerRef = useRef(null);
  const watchIdRef = useRef(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanEnabled, setScanEnabled] = useState(false);
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [trackPoints, setTrackPoints] = useState([]);
  const [activeSpot, setActiveSpot] = useState(null);
  const [locationId, setLocationId] = useState("");
  const [moodText, setMoodText] = useState("");
  const [gps, setGps] = useState({ lat: "", lon: "" });
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(() => {
    return Boolean(locationId && gps.lat && gps.lon);
  }, [locationId, gps.lat, gps.lon]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .catch(() => null)
          .then(() => scannerRef.current?.clear().catch(() => null));
        scannerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#eaf7ff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(15, 126, 181, 0.18)";
    ctx.lineWidth = 1;
    for (let i = 24; i < canvas.width; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    for (let j = 20; j < canvas.height; j += 28) {
      ctx.beginPath();
      ctx.moveTo(0, j);
      ctx.lineTo(canvas.width, j);
      ctx.stroke();
    }

    if (trackPoints.length === 0) {
      ctx.fillStyle = "#6b7280";
      ctx.font = "14px sans-serif";
      ctx.fillText("开启实时轨迹后会在这里绘制真实移动路线", 22, 106);
      return;
    }

    const lats = trackPoints.map((p) => p.lat);
    const lons = trackPoints.map((p) => p.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    const width = canvas.width - 40;
    const height = canvas.height - 40;
    const xRange = maxLon - minLon || 0.0001;
    const yRange = maxLat - minLat || 0.0001;

    const projected = trackPoints.map((point) => {
      const x = 20 + ((point.lon - minLon) / xRange) * width;
      const y = 20 + ((maxLat - point.lat) / yRange) * height;
      return [x, y];
    });

    ctx.strokeStyle = "#1295c9";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(projected[0][0], projected[0][1]);
    for (let i = 1; i < projected.length; i += 1) {
      ctx.lineTo(projected[i][0], projected[i][1]);
    }
    ctx.stroke();

    const latest = projected[projected.length - 1];
    ctx.fillStyle = "#ff8c00";
    ctx.beginPath();
    ctx.arc(latest[0], latest[1], 6, 0, Math.PI * 2);
    ctx.fill();
  }, [trackPoints]);

  function startTracking() {
    if (!navigator.geolocation) {
      Toast.show({ content: "当前设备不支持定位" });
      return;
    }
    if (watchIdRef.current !== null) {
      return;
    }

    setTracking(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setGps({ lat: String(lat), lon: String(lon) });
        setTrackPoints((prev) => [...prev, { lat, lon, t: Date.now() }]);
      },
      () => {
        Toast.show({ content: "实时定位失败，请检查权限" });
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  }

  function stopTracking() {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTracking(false);
  }

  function resetTrack() {
    stopTracking();
    setTrackPoints([]);
  }

  async function locateMe() {
    if (!navigator.geolocation) {
      Toast.show({ content: "当前设备不支持定位" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: String(pos.coords.latitude), lon: String(pos.coords.longitude) });
      },
      () => {
        Toast.show({ content: "定位失败，请允许定位权限" });
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  async function submitCheckin() {
    const token = getUserToken();
    if (!token) {
      Toast.show({ content: "请先在“我的”页面登录游客账号" });
      return;
    }

    if (!canSubmit) {
      Toast.show({ content: "请先填写景点ID并获取定位" });
      return;
    }

    const formData = new FormData();
    formData.append("location_id", locationId);
    formData.append("gps_lat", gps.lat);
    formData.append("gps_lon", gps.lon);
    formData.append("mood_text", moodText);
    if (files[0]?.file) {
      formData.append("photo", files[0].file);
    }

    setSubmitting(true);
    try {
      await createFootprint(formData, token);
      Toast.show({ content: "打卡成功" });
      setMoodText("");
      setFiles([]);
    } catch {
      Toast.show({ content: "打卡失败，请稍后再试" });
    } finally {
      setSubmitting(false);
    }
  }

  async function stopScan() {
    if (!scannerRef.current) {
      setScanEnabled(false);
      return;
    }

    try {
      await scannerRef.current.stop();
    } catch {
      // ignore
    }
    try {
      await scannerRef.current.clear();
    } catch {
      // ignore
    }
    scannerRef.current = null;
    setScanEnabled(false);
  }

  async function startScan() {
    if (scanEnabled) {
      await stopScan();
      return;
    }

    setScanLoading(true);
    try {
      const instance = new Html5Qrcode("qr-reader");
      scannerRef.current = instance;
      await instance.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        async (decodedText) => {
          const parsedId = parseLocationIdFromText(decodedText);
          if (!parsedId) {
            Toast.show({ content: "二维码内容无效" });
            return;
          }

          setLocationId(String(parsedId));
          try {
            const location = await fetchLocationById(parsedId);
            setActiveSpot(location);
          } catch {
            setActiveSpot(null);
          }
          setScanModalVisible(true);
          Toast.show({ content: `扫码成功，景点ID: ${parsedId}` });
          await stopScan();
        }
      );
      setScanEnabled(true);
    } catch {
      Toast.show({ content: "启动扫码失败，请检查摄像头权限" });
      await stopScan();
    } finally {
      setScanLoading(false);
    }
  }

  return (
    <ImmersivePage bgImage="/images/lugu-scenery.jpg" className="page-fade-in pt-6">
      <div className="hero-shell mb-3">
        <div className="hero-kicker">Check-in Trail</div>
        <h1 className="page-title m-0">地图打卡</h1>
        <p className="hero-copy">使用实时定位绘制真实移动轨迹，并通过真实二维码完成景点打卡。</p>
      </div>

      <Card className="card card-glass">
        <div className="flex items-center justify-between mb-2">
          <h3 className="section-title m-0">路线地图</h3>
          <span className="chip-soft">{tracking ? "定位中" : "未定位"}</span>
        </div>
        <canvas ref={canvasRef} className="checkin-map-canvas" width={320} height={210} />
        <div className="button-group-horizontal mt-3">
          <Button color="primary" block onClick={tracking ? stopTracking : startTracking}>{tracking ? "停止定位" : "开始实时轨迹"}</Button>
          <Button block onClick={resetTrack}>重置轨迹</Button>
        </div>
      </Card>

      <Card className="card card-glass">
        <div className="flex items-center justify-between mb-2">
          <h3 className="section-title m-0">扫码打卡</h3>
          <span className="chip-soft">真实摄像头</span>
        </div>
        <Button block color="primary" loading={scanLoading} onClick={startScan}>{scanEnabled ? "关闭扫码" : "扫描二维码"}</Button>
        {scanEnabled && <div id="qr-reader" className="mt-3" />}

        <GlassInput
          wrapperClassName="mt-3"
          placeholder="景点ID（扫码后自动填充）"
          value={locationId}
          onChange={setLocationId}
          clearable
        />

        <Button className="mt-3" block onClick={locateMe}>获取当前位置</Button>
        <div className="mt-2 text-xs text-white/50">
          纬度: {gps.lat || "未获取"}，经度: {gps.lon || "未获取"}
        </div>

        <GlassInput
          wrapperClassName="mt-3"
          placeholder="记录此刻心情"
          value={moodText}
          onChange={setMoodText}
          clearable
        />

        <div className="mt-3 bg-white/10 p-3 rounded-xl border border-white/20">
          <ImageUploader
            value={files}
            onChange={setFiles}
            maxCount={1}
            upload={async (file) => ({
              url: URL.createObjectURL(file),
              file,
            })}
          />
        </div>

        <Button className="mt-3" color="primary" loading={submitting} block onClick={submitCheckin}>
          提交打卡
        </Button>
      </Card>

      <Modal
        visible={scanModalVisible}
        content={
          <div>
            <div className="text-base font-semibold text-white/95">{activeSpot?.name || "当前景点"}</div>
            {activeSpot?.qr_code_url ? <img src={buildAssetUrl(activeSpot.qr_code_url)} alt="景点二维码" className="w-full rounded-xl mt-2" /> : null}
            <div className="text-sm text-white/60 mt-2">{activeSpot?.description || "已完成扫码，欢迎继续探索。"}</div>
            <div className="text-xs text-white/50 mt-3">分类：{activeSpot?.category || "景点"}</div>
          </div>
        }
        closeOnMaskClick
        onClose={() => setScanModalVisible(false)}
        actions={[{ key: "ok", text: "继续打卡", primary: true, onClick: () => setScanModalVisible(false) }]}
      />
    </ImmersivePage>
  );
}
