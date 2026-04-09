import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Toast, Modal, ImageUploader } from "antd-mobile";
import { ImmersivePage, CardComponent, GlassInput } from "../components/SharedUI";
import { Html5Qrcode } from "html5-qrcode";
import { createFootprint, fetchLocationById, getUserToken, buildAssetUrl } from "../api";
import LucideIcon from "../components/LucideIcon";

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

function isLocalhostLike(hostname) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname);
}

function isHttpIpAccess() {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname;
  return window.location.protocol === "http:" && !isLocalhostLike(hostname) && /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

async function requestLocationPermission() {
  if (!navigator.geolocation) {
    Toast.show({ content: "当前设备不支持定位" });
    return false;
  }

  if (typeof window !== "undefined" && !window.isSecureContext) {
    Toast.show({ content: "当前页面未被浏览器识别为安全上下文，定位无法启用。请确认使用的是受信任的 HTTPS 证书，而不只是 HTTPS 协议。" });
    return false;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve(true),
      (error) => {
        if (error?.code === 1) {
          Toast.show({ content: "请在浏览器弹窗中允许定位权限" });
        } else {
          Toast.show({ content: "定位权限请求失败，请稍后重试" });
        }
        resolve(false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
    );
  });
}

async function requestCameraPermission(onUnsupported) {
  if (!navigator.mediaDevices?.getUserMedia) {
    onUnsupported?.();
    Toast.show({ content: "当前设备不支持摄像头" });
    return false;
  }

  if (typeof window !== "undefined" && !window.isSecureContext) {
    onUnsupported?.();
    Toast.show({ content: "当前页面未被浏览器识别为安全上下文，摄像头无法启用。请确认 HTTPS 证书已被浏览器信任。" });
    return false;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch (error) {
    if (error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError") {
      Toast.show({ content: "请在浏览器弹窗中允许摄像头权限" });
    } else {
      Toast.show({ content: "摄像头权限请求失败，请稍后重试" });
    }
    return false;
  }
}

export default function CheckinPage() {
  // 地图和定位相关
  const mapRef = useRef(null);
  const amapRef = useRef(null);
  const polylineRef = useRef(null);
  const markerRef = useRef(null);
  const watchIdRef = useRef(null);

  // 二维码扫描相关
  const scannerRef = useRef(null);

  // 状态管理
  const [tracking, setTracking] = useState(false);
  const [trackPoints, setTrackPoints] = useState([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanEnabled, setScanEnabled] = useState(false);
  const [scanModalVisible, setScanModalVisible] = useState(false);

  // 表单数据
  const [locationId, setLocationId] = useState("");
  const [activeSpot, setActiveSpot] = useState(null);
  const [gps, setGps] = useState({ lat: "", lon: "" });
  const [moodText, setMoodText] = useState("");
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState("");
  const [cameraSupported, setCameraSupported] = useState(true);
  const ipHttpAccess = useMemo(() => isHttpIpAccess(), []);

  // 计算是否可以提交
  const canSubmit = useMemo(() => {
    return Boolean(locationId && gps.lat && gps.lon);
  }, [locationId, gps.lat, gps.lon]);

  // 初始化地图
  useEffect(() => {
    let isMounted = true;
    const aMapKey = import.meta.env.VITE_AMAP_KEY;
    const aMapSecurityJsCode = import.meta.env.VITE_AMAP_SECURITY_JS_CODE;
    if (ipHttpAccess) {
      setMapError("当前是服务器IP的HTTP访问，摄像头不可用，地图可能受高德白名单限制");
    }
    
    // 如果没有配置Key，则跳过地图加载
    if (!aMapKey) {
      setMapLoaded(false);
      setMapError("未配置高德地图 Key");
      return;
    }

    if (typeof window !== "undefined" && aMapSecurityJsCode) {
      window._AMapSecurityConfig = {
        ...(window._AMapSecurityConfig || {}),
        securityJsCode: aMapSecurityJsCode,
      };
    }
    
    const loadAMap = async () => {
      if (window.AMap) {
        if (isMounted) initMap();
        return;
      }

      // 动态加载高德地图脚本
      const script = document.createElement("script");
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${aMapKey}`;
      script.async = true;
      script.onload = () => {
        if (isMounted) initMap();
      };
      script.onerror = () => {
        console.error("高德地图加载失败，请检查API Key是否有效");
        if (isMounted) {
          setMapError("地图脚本加载失败，请检查 VITE_AMAP_KEY、VITE_AMAP_SECURITY_JS_CODE、Web JS API 权限、域名/IP 白名单和网络是否可访问 webapi.amap.com");
          Toast.show({ 
            content: "地图加载失败，请检查高德 Key、安全密钥、Web JS API 权限和白名单配置",
            duration: 5
          });
        }
      };
      document.head.appendChild(script);
    };

    const initMap = () => {
      try {
        if (!mapRef.current || !isMounted) return;
        
        const map = new window.AMap.Map(mapRef.current, {
          viewMode: "2D",
          zoom: 14,
          center: [100.7537, 27.6452],
          resizeEnable: true,
        });

        if (isMounted) {
          amapRef.current = map;
          setMapLoaded(true);
          setMapError("");
        }
      } catch (error) {
        console.error("地图初始化失败:", error);
        if (isMounted) {
          setMapError("地图初始化失败，可能是高德 Key/安全密钥无效，或未开通 Web JS API");
          Toast.show({ content: "地图初始化失败，请检查高德 Key、安全密钥和白名单后重试" });
        }
      }
    };

    loadAMap();

    return () => {
      isMounted = false;
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

  // 更新地图标记和轨迹线
  useEffect(() => {
    if (!amapRef.current || trackPoints.length === 0) return;

    const map = amapRef.current;

    // 如果有现有的折线，就移除它
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    // 转换轨迹点为地图坐标
    const path = trackPoints.map((p) => [p.lon, p.lat]);

    // 绘制折线
    const polyline = new window.AMap.Polyline({
      path: path,
      strokeColor: "#00D9FF",
      strokeWeight: 4,
      strokeOpacity: 0.8,
      lineJoin: "round",
    });

    polyline.setMap(map);
    polylineRef.current = polyline;

    // 最后一个点作为当前位置标记
    if (markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }

    const lastPoint = trackPoints[trackPoints.length - 1];
    const marker = new window.AMap.Marker({
      position: [lastPoint.lon, lastPoint.lat],
      title: "当前位置",
      icon: new window.AMap.Icon({
        size: [32, 32],
        image: "https://webapi.amap.com/theme/v1.3/markers/m/dens_1.png",
        imageSize: [19, 31],
      }),
    });

    marker.setMap(map);
    markerRef.current = marker;

    // 自动调整地图视图
    map.setFitView([marker]);
  }, [trackPoints]);

  // 开始实时定位和轨迹记录
  async function startTracking() {
    const permissionGranted = await requestLocationPermission();
    if (!permissionGranted) {
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

  // 停止定位
  function stopTracking() {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTracking(false);
  }

  // 重置轨迹
  function resetTrack() {
    stopTracking();
    setTrackPoints([]);
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }
    if (markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }
  }

  // 定位到当前位置
  async function locateMe() {
    const permissionGranted = await requestLocationPermission();
    if (!permissionGranted) {
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setGps({ lat: String(lat), lon: String(lon) });

        if (amapRef.current) {
          const map = amapRef.current;
          map.setCenter([lon, lat]);
          map.setZoom(16);
        }
      },
      () => {
        Toast.show({ content: "定位失败，请允许定位权限" });
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  async function submitCheckin() {
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
      await createFootprint(formData, getUserToken() || "cookie-session");
      Toast.show({ content: "打卡成功" });
      setMoodText("");
      setFiles([]);
      setLocationId("");
      resetTrack();
    } catch (error) {
      if (error?.response?.status === 401) {
        Toast.show({ content: "请先在“我的”页面登录游客账号" });
        return;
      }
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

    if (!window.isSecureContext && !isLocalhostLike(window.location.hostname)) {
      setCameraSupported(false);
      Toast.show({ content: "摄像头需要浏览器认可的安全上下文。请检查 HTTPS 证书是否受信任，或改用 localhost 测试。" });
      return;
    }

    if (!cameraSupported) {
      Toast.show({ content: "当前浏览器不支持摄像头，请改用手动输入景点ID" });
      return;
    }

    setScanLoading(true);
    try {
      const cameraPermissionGranted = await requestCameraPermission(() => setCameraSupported(false));
      if (!cameraPermissionGranted) {
        setScanEnabled(false);
        return;
      }

      setScanEnabled(true);
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));

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
    } catch {
      Toast.show({ content: "启动扫码失败，请检查浏览器权限、HTTPS 证书和二维码容器是否已渲染" });
      setScanEnabled(false);
      await stopScan();
    } finally {
      setScanLoading(false);
    }
  }

  return (
    <ImmersivePage bgImage="/images/lugu-scenery.jpg" className="page-fade-in pb-[env(safe-area-inset-bottom)]">
      <div className="hero-shell mb-3">
        <div className="hero-kicker">Check-in Trail</div>
        <h1 className="page-title m-0">地图打卡</h1>
        <p className="hero-copy">使用高德地图实时定位绘制移动轨迹，通过二维码完成景点打卡。</p>
      </div>

      {/* 地图卡片 */}
      <CardComponent variant="glass" className="p-0 overflow-hidden mb-4 h-64">
        <div 
          ref={mapRef} 
          style={{ width: "100%", height: "100%", borderRadius: "1rem" }}
          className="relative"
        >
          {!mapLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
              <div className="px-4 text-center text-white text-sm leading-6">
                {mapError || "地图加载中..."}
              </div>
            </div>
          )}
        </div>
      </CardComponent>

      {ipHttpAccess && (
        <div className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-xs leading-5 text-amber-100">
          当前是通过服务器 IP 的 HTTP 方式访问。地图需要高德控制台把这个 IP 加入白名单，摄像头和定位则需要 HTTPS 或 localhost。
        </div>
      )}

      {/* 定位控制卡片 */}
      <CardComponent variant="glass" className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold flex items-center gap-2">
            <LucideIcon name="Navigation" size={18} className="text-cyan-400" />
            实时轨迹
          </h3>
          <span className={`text-xs px-2 py-1 rounded-full ${tracking ? 'bg-green-500/30 text-green-200' : 'bg-slate-500/30 text-slate-300'}`}>
            {tracking ? "定位中" : "未定位"}
          </span>
        </div>

        <div className="space-y-2">
          <Button
            block
            color={tracking ? "danger" : "primary"}
            onClick={tracking ? stopTracking : startTracking}
            className="text-sm font-bold"
          >
            {tracking ? "停止实时轨迹" : "开始实时轨迹"}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              block
              onClick={locateMe}
              className="bg-white/10 text-white border border-white/20 text-sm font-bold"
            >
              定位我的位置
            </Button>
            <Button
              block
              onClick={resetTrack}
              className="bg-white/10 text-white border border-white/20 text-sm font-bold"
              color="danger"
            >
              重置轨迹
            </Button>
          </div>
        </div>

        {trackPoints.length > 0 && (
          <div className="mt-3 p-2 bg-white/5 rounded-lg border border-white/10">
            <p className="text-xs text-white/70">
              已记录轨迹点：{trackPoints.length} 个
            </p>
          </div>
        )}
      </CardComponent>

      {/* 二维码扫描卡片 */}
      <CardComponent variant="glass" className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold flex items-center gap-2">
            <LucideIcon name="QrCode" size={18} className="text-amber-400" />
            扫码打卡
          </h3>
          <span className="text-xs px-2 py-1 rounded-full bg-slate-500/30 text-slate-300">摄像头</span>
        </div>

        <Button
          block
          color="primary"
          loading={scanLoading}
          onClick={startScan}
          className="text-sm font-bold"
        >
          {scanEnabled ? "关闭扫码" : "启动二维码扫描"}
        </Button>

        {(scanEnabled || scanLoading) && (
          <div id="qr-reader" className="mt-3 min-h-[260px] rounded-lg overflow-hidden bg-black/20" />
        )}

        {!cameraSupported && (
          <div className="mt-3 p-3 rounded-lg border border-amber-400/30 bg-amber-400/10 text-amber-100 text-xs leading-5">
            当前浏览器无法直接启用摄像头。请使用 HTTPS 访问页面；如果是服务器 IP 访问，也需要配置 HTTPS 才能使用摄像头。
          </div>
        )}
      </CardComponent>

      {/* 景点选择卡片 */}
      <CardComponent variant="glass" className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold flex items-center gap-2">
            <LucideIcon name="MapPin" size={18} className="text-red-400" />
            景点信息
          </h3>
        </div>

        <GlassInput
          placeholder="景点ID（扫码后自动填充）"
          value={locationId}
          onChange={setLocationId}
          wrapperClassName="mb-2"
        />

        {activeSpot && (
          <div className="p-2 bg-white/5 rounded-lg border border-white/10 text-xs text-white/80">
            <p className="font-bold text-white mb-1">{activeSpot.name}</p>
            {activeSpot.description && (
              <p>{activeSpot.description.substring(0, 100)}...</p>
            )}
          </div>
        )}
      </CardComponent>

      {/* 定位信息卡片 */}
      {gps.lat && gps.lon && (
        <CardComponent variant="glass" className="mb-4">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-white/5 rounded border border-white/10">
              <p className="text-white/60">纬度</p>
              <p className="text-white font-bold text-sm">{parseFloat(gps.lat).toFixed(4)}</p>
            </div>
            <div className="p-2 bg-white/5 rounded border border-white/10">
              <p className="text-white/60">经度</p>
              <p className="text-white font-bold text-sm">{parseFloat(gps.lon).toFixed(4)}</p>
            </div>
          </div>
        </CardComponent>
      )}

      {/* 打卡表单卡片 */}
      <CardComponent variant="glass" className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold flex items-center gap-2">
            <LucideIcon name="Heart" size={18} className="text-pink-400" />
            打卡内容
          </h3>
        </div>

        <GlassInput
          placeholder="分享你的感受（选填）"
          inputType="text"
          value={moodText}
          onChange={setMoodText}
          wrapperClassName="mb-3"
        />

        <div className="mb-3">
          <label className="text-xs text-white/70 block mb-2">上传照片</label>
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

        <Button
          block
          color="primary"
          loading={submitting}
          disabled={!canSubmit}
          onClick={submitCheckin}
          className="font-bold text-base py-2"
        >
          {canSubmit ? "确认打卡" : "请先获取定位"}
        </Button>
      </CardComponent>

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
