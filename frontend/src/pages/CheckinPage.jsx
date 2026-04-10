import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Toast, Modal, ImageUploader } from "antd-mobile";
import { ImmersivePage, CardComponent, ButtonComponent, GlassInput } from "../components/SharedUI";
import { Html5Qrcode } from "html5-qrcode";
import { getUserSessionUsername, withUserSessionPath } from "../auth";
import { buildAssetUrl, createFootprint, fetchLocationById, fetchTrackingState, getUserToken, saveTrackingState } from "../api";
import {
  getTrackingState,
  recordTrackingPoint,
  resetTrackingState,
  setTrackingActive,
  setTrackingLocation,
  setTrackingState,
  toTrackingApiPayload,
  subscribeTrackingState,
} from "../store/trackingStore";
import LucideIcon from "../components/LucideIcon";

function parseLocationIdFromText(text) {
  const rawText = String(text || "").trim();
  if (!rawText) return null;

  let normalizedText = rawText;
  if (normalizedText.startsWith("{") || normalizedText.startsWith("[")) {
    try {
      const parsed = JSON.parse(normalizedText);
      normalizedText = String(parsed?.scan_content || parsed?.scanContent || parsed?.location_id || parsed?.locationId || normalizedText).trim();
    } catch {
      // ignore JSON parse failures and fall back to text matching
    }
  }

  const pathMatch = normalizedText.match(/\/locations\/(\d+)/);
  if (pathMatch?.[1]) return Number(pathMatch[1]);

  const urlMatch = normalizedText.match(/[?&](?:location_id|locationId)=(\d+)/i);
  if (urlMatch?.[1]) return Number(urlMatch[1]);

  const plainNumber = Number(normalizedText);
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

  if (navigator.permissions?.query) {
    try {
      const status = await navigator.permissions.query({ name: "geolocation" });
      if (status?.state === "denied") {
        Toast.show({ content: "浏览器已禁止定位权限，请在站点设置中改为允许" });
        return false;
      }
    } catch {
      // ignore unsupported Permission API implementations
    }
  }

  try {
    await getCurrentPositionWithFallback();
    return true;
  } catch (error) {
    Toast.show({ content: getGeolocationErrorMessage(error, "定位权限请求失败") });
    return false;
  }
}

function getGeolocationErrorMessage(error, prefix = "定位失败") {
  if (!error) return `${prefix}，请稍后重试`;
  if (error.code === 1) return "请在浏览器站点设置中允许定位权限";
  if (error.code === 2) return "无法获取位置（可能是信号较弱或系统定位服务未开启）";
  if (error.code === 3) return "定位超时，请移动到开阔区域后重试";
  return `${prefix}，请稍后重试`;
}

function getCurrentPosition(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

async function getCurrentPositionWithFallback() {
  const attempts = [
    { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    { enableHighAccuracy: false, maximumAge: 30000, timeout: 18000 },
  ];

  let lastError = null;
  for (const options of attempts) {
    try {
      return await getCurrentPosition(options);
    } catch (error) {
      lastError = error;
      if (error?.code === 1) {
        throw error;
      }
    }
  }
  throw lastError || new Error("定位失败");
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


const CHECKIN_DRAFT_STORAGE_PREFIX = "lugu_checkin_draft_v1_";

function writeCheckinDraft(username, data) {
  if (!username) return;
  try { sessionStorage.setItem(CHECKIN_DRAFT_STORAGE_PREFIX + username, JSON.stringify(data)); } catch (e) {}
}

function readCheckinDraft(username) {
  if (!username) return null;
  try {
    const raw = sessionStorage.getItem(CHECKIN_DRAFT_STORAGE_PREFIX + username);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function clearCheckinDraft(username) {
  if (!username) return;
  try { sessionStorage.removeItem(CHECKIN_DRAFT_STORAGE_PREFIX + username); } catch (e) {}
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function dataUrlToFile(dataUrl, fileName, mimeType) {
  try {
    const arr = dataUrl.split(",");
    const match = arr[0].match(/:(.*?);/);
    const mime = match ? match[1] : mimeType;
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) { u8arr[n] = bstr.charCodeAt(n); }
    return new File([u8arr], fileName, { type: mime });
  } catch (e) {
    return null;
  }
}

export default function CheckinPage() {
  const navigate = useNavigate();
  const sessionUsername = getUserSessionUsername();
  const persistedTrackingState = getTrackingState(sessionUsername);

  const mapRef = useRef(null);
  const amapRef = useRef(null);
  const amapAuthFailedRef = useRef(false);
  const [mapRequested, setMapRequested] = useState(true);
  const polylineRef = useRef(null);
  const markerRef = useRef(null);
  const watchIdRef = useRef(null);
  const watchFallbackRef = useRef(false);
  const disposedRef = useRef(false);

  const scannerRef = useRef(null);
  const qrReaderRef = useRef(null);

  const [tracking, setTracking] = useState(persistedTrackingState.tracking);
  const [trackPoints, setTrackPoints] = useState(persistedTrackingState.trackPoints);
  const [scanLoading, setScanLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isStartingTrack, setIsStartingTrack] = useState(false);
  const [scanEnabled, setScanEnabled] = useState(false);
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [scannedQrText, setScannedQrText] = useState("");

  const [locationId, setLocationId] = useState("");
  const [activeSpot, setActiveSpot] = useState(null);
  const [gps, setGps] = useState(persistedTrackingState.gps);
  const [moodText, setMoodText] = useState("");
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState("");
  const [cameraSupported, setCameraSupported] = useState(true);
  const [trackingUpdatedAt, setTrackingUpdatedAt] = useState(persistedTrackingState.updatedAt || "");
  const draftHydratedRef = useRef(false);
  const draftSaveTimerRef = useRef(null);
  const trackingSyncReadyRef = useRef(false);
  const trackingSyncTimerRef = useRef(null);

  function handleBack() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(withUserSessionPath("/home"), { replace: true });
  }

  useEffect(() => {
    const unsubscribe = subscribeTrackingState(sessionUsername, (state) => {
      setTracking(Boolean(state?.tracking));
      setTrackPoints(Array.isArray(state?.trackPoints) ? state.trackPoints : []);
      setGps(state?.gps || { lat: "", lon: "" });
      setTrackingUpdatedAt(state?.updatedAt || "");
    });

    return unsubscribe;
  }, [sessionUsername]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateRemoteTrackingState() {
      try {
        const remoteState = await fetchTrackingState();
        if (cancelled || !remoteState) {
          return;
        }

        const normalizedRemoteState = {
          tracking: Boolean(remoteState.tracking),
          gps: remoteState.gps || { lat: "", lon: "" },
          trackPoints: Array.isArray(remoteState.track_points) ? remoteState.track_points : [],
          updatedAt: remoteState.updated_at || "",
        };

        const localState = getTrackingState(sessionUsername);
        const remoteUpdatedAt = Date.parse(normalizedRemoteState.updatedAt || "") || 0;
        const localUpdatedAt = Date.parse(localState.updatedAt || "") || 0;

        if (remoteUpdatedAt >= localUpdatedAt || localState.trackPoints.length === 0) {
          setTrackingState(sessionUsername, normalizedRemoteState);
        }
        setTrackingUpdatedAt(normalizedRemoteState.updatedAt || localState.updatedAt || "");
      } catch {
        // keep using local cached state when the server is unavailable
      } finally {
        if (!cancelled) {
          trackingSyncReadyRef.current = true;
          void saveTrackingState(toTrackingApiPayload(getTrackingState(sessionUsername))).catch(() => null);
        }
      }
    }

    void hydrateRemoteTrackingState();

    return () => {
      cancelled = true;
    };
  }, [sessionUsername]);

  useEffect(() => {
    if (!trackingSyncReadyRef.current) return undefined;

    if (trackingSyncTimerRef.current) {
      window.clearTimeout(trackingSyncTimerRef.current);
    }

    trackingSyncTimerRef.current = window.setTimeout(() => {
      void saveTrackingState(toTrackingApiPayload({ tracking, gps, trackPoints })).catch(() => null);
    }, 500);

    return () => {
      if (trackingSyncTimerRef.current) {
        window.clearTimeout(trackingSyncTimerRef.current);
        trackingSyncTimerRef.current = null;
      }
    };
  }, [tracking, gps, trackPoints]);

  useEffect(() => {
    let cancelled = false;
    draftHydratedRef.current = false;

    const restoreDraft = async () => {
      const draft = readCheckinDraft(sessionUsername);
      if (!draft) {
        setScanLoading(false);
        setScanEnabled(false);
        setScanModalVisible(false);
        setScannedQrText("");
        setLocationId("");
        setActiveSpot(null);
        setMoodText("");
        setFiles([]);
        setSubmitting(false);
        setMapRequested(true);
        draftHydratedRef.current = true;
        return;
      }

      const restoredFiles = Array.isArray(draft.files)
        ? await Promise.all(
            draft.files.map(async (item, index) => {
              if (!item?.dataUrl) return null;
              const file = dataUrlToFile(item.dataUrl, item.fileName || `checkin-photo-${index + 1}`, item.mimeType || "image/jpeg");
              if (!file) return null;
              return { url: item.dataUrl, file };
            })
          )
        : [];

      if (cancelled) return;

      setLocationId(typeof draft.locationId === "string" ? draft.locationId : "");
      setActiveSpot(draft.activeSpot || null);
      setMoodText(typeof draft.moodText === "string" ? draft.moodText : "");
      setFiles(restoredFiles.filter(Boolean));
      setScannedQrText(typeof draft.scannedQrText === "string" ? draft.scannedQrText : "");
      setScanModalVisible(!!draft.scanModalVisible);
      setMapRequested(draft.mapRequested !== undefined ? !!draft.mapRequested : true);

      draftHydratedRef.current = true;
    };

    void restoreDraft();

    return () => {
      cancelled = true;
    };
  }, [sessionUsername]);

  useEffect(() => {
    if (!draftHydratedRef.current) return undefined;

    if (draftSaveTimerRef.current) {
      window.clearTimeout(draftSaveTimerRef.current);
    }

    draftSaveTimerRef.current = window.setTimeout(async () => {
      try {
        const storedFiles = await Promise.all(
          files.map(async (item, index) => {
            if (!item?.file) return null;
            const dataUrl = await fileToDataUrl(item.file);
            return {
              fileName: item.file?.name || `checkin-photo-${index}`,
              mimeType: item.file?.type || "image/jpeg",
              dataUrl,
            };
          })
        );

        const payload = {
          locationId,
          activeSpot,
          moodText,
          files: storedFiles.filter(Boolean),
          scannedQrText,
          scanModalVisible,
          mapRequested,
        };
        writeCheckinDraft(sessionUsername, payload);
      } catch {
        // ignore persistence errors
      }
    }, 250);

    return () => {
      if (draftSaveTimerRef.current) {
        window.clearTimeout(draftSaveTimerRef.current);
        draftSaveTimerRef.current = null;
      }
    };
  }, [sessionUsername, locationId, activeSpot, moodText, files, scannedQrText, scanModalVisible, mapRequested]);

  const ipHttpAccess = useMemo(() => isHttpIpAccess(), []);


  const loadAmapScript = async (aMapKey) => {
    if (window.AMap) {
      return window.AMap;
    }

    if (!window.__amapScriptPromise) {
      window.__amapScriptPromise = new Promise((resolve, reject) => {
        const existingScript = document.querySelector('script[data-amap-sdk="true"]');
        if (existingScript) {
          existingScript.addEventListener("load", () => resolve(window.AMap));
          existingScript.addEventListener("error", reject);
          return;
        }

        const script = document.createElement("script");
        const scriptUrl = new URL("https://webapi.amap.com/maps");
        scriptUrl.searchParams.set("v", "1.4.15");
        scriptUrl.searchParams.set("key", aMapKey);
        script.dataset.amapSdk = "true";
        script.src = scriptUrl.toString();
        script.async = true;
        script.onload = () => resolve(window.AMap);
        script.onerror = () => {
          window.__amapScriptPromise = null;
          reject(new Error("高德地图脚本加载失败"));
        };
        document.head.appendChild(script);
      });
    }

    try {
      return await window.__amapScriptPromise;
    } catch (error) {
      window.__amapScriptPromise = null;
      throw error;
    }
  };

  // 计算是否可以提交
  const canSubmit = useMemo(() => {
    const hasLocationInfo = Boolean(String(locationId || "").trim());
    const hasMoodInfo = Boolean(String(moodText || "").trim());
    return hasLocationInfo || hasMoodInfo;
  }, [locationId, moodText]);

  // 初始化地图
  useEffect(() => {
    let isMounted = true;
    disposedRef.current = false;
    const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";
    const aMapKey = import.meta.env.VITE_AMAP_KEY;
    const aMapSecurityJsCode = import.meta.env.VITE_AMAP_SECURITY_JS_CODE;
    amapAuthFailedRef.current = false;
    if (ipHttpAccess) {
      setMapError("当前是服务器IP的HTTP访问，地图需要把当前 IP 加入高德 Web JS API 白名单；摄像头和定位仍建议使用 HTTPS 或 localhost。");
    }
    
    // 如果没有配置Key，则跳过地图加载
    if (!aMapKey) {
      setMapLoaded(false);
      setMapError("未配置高德地图 Key");
      return;
    }

    const handleGlobalError = (event) => {
      const message = String(event?.error?.message || event?.message || "");
      if (!message.includes("INVALID_USER_DOMAIN") && !message.includes("Unimplemented type: 3")) return;
      event?.preventDefault?.();
      event?.stopImmediatePropagation?.();
      if (!isMounted) return;
      amapAuthFailedRef.current = true;
      const details = currentOrigin ? `当前访问来源: ${currentOrigin}` : "";
      const reason = message.includes("INVALID_USER_DOMAIN")
        ? "高德鉴权失败（INVALID_USER_DOMAIN）。请把当前访问域名或IP加入高德 Web JS API 白名单，并确认 Key 与安全密钥属于同一个高德应用。"
        : "高德地图运行时异常。当前环境可能不满足高德 Web JS API 的白名单或资源加载要求。";
      setMapError(`${reason}${details}`);
      Toast.show({ content: "地图暂不可用，请先使用扫码或手动输入景点ID" });
    };

    if (typeof window !== "undefined") {
      window.addEventListener("error", handleGlobalError);
    }

    if (typeof window !== "undefined" && aMapSecurityJsCode) {
      window._AMapSecurityConfig = {
        ...(window._AMapSecurityConfig || {}),
        securityJsCode: aMapSecurityJsCode,
      };
    }
    
    const loadAMap = async () => {
      if (!mapRequested) return;
      if (amapAuthFailedRef.current) return;
      try {
        await loadAmapScript(aMapKey);
        if (amapAuthFailedRef.current) return;
        if (isMounted) initMap();
      } catch (error) {
        console.error("高德地图加载失败，请检查API Key是否有效", error);
        if (isMounted) {
          const originHint = currentOrigin ? `当前访问来源: ${currentOrigin}` : "";
          setMapError(`地图脚本加载失败，请检查 VITE_AMAP_KEY、VITE_AMAP_SECURITY_JS_CODE、Web JS API 权限、域名/IP 白名单和网络是否可访问 webapi.amap.com。${originHint}`);
          Toast.show({ 
            content: "地图加载失败，请检查高德 Key、安全密钥、Web JS API 权限和白名单配置",
            duration: 5
          });
        }
      }
    };

    const initMap = () => {
      try {
        if (!mapRef.current || !isMounted || amapAuthFailedRef.current) return;
        
        const map = new window.AMap.Map(mapRef.current, {
          viewMode: "2D",
          zoom: 14,
          center: [100.7537, 27.6452],
          resizeEnable: true,
        });

        if (isMounted) {
          amapAuthFailedRef.current = false;
          amapRef.current = map;
          setMapLoaded(true);
          setMapError("");
        }
      } catch (error) {
        console.error("地图初始化失败:", error);
        if (isMounted) {
          const originHint = currentOrigin ? `当前访问来源: ${currentOrigin}` : "";
          setMapError(`地图初始化失败，可能是高德 Key/安全密钥无效，或未开通 Web JS API。${originHint}`);
          Toast.show({ content: "地图初始化失败，请检查高德 Key、安全密钥和白名单后重试" });
        }
      }
    };

    loadAMap();

    return () => {
      isMounted = false;
      if (typeof window !== "undefined") {
        window.removeEventListener("error", handleGlobalError);
      }
      polylineRef.current = null;
      markerRef.current = null;
      amapRef.current = null;
    };
  }, [mapRequested, ipHttpAccess]);

  useEffect(() => {
    return () => {
      disposedRef.current = true;
      if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (trackingSyncTimerRef.current) {
        window.clearTimeout(trackingSyncTimerRef.current);
      }
      setTrackingActive(sessionUsername, false);
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        void scanner.stop().catch(() => null);
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRequested) {
      setMapLoaded(false);
      if (!mapError) {
        setMapError("地图默认按需加载。点击下方按钮后再初始化高德地图，可避免因域名白名单问题影响页面切换。");
      }
    }
  }, [mapRequested]);

  function focusMapOnPosition(lat, lon, zoom = 16) {
    if (!amapRef.current || amapAuthFailedRef.current) {
      return;
    }

    const map = amapRef.current;

    if (markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }

    const marker = new window.AMap.Marker({
      position: [lon, lat],
      title: "当前位置",
      icon: new window.AMap.Icon({
        size: [19, 31],
        image: "https://webapi.amap.com/theme/v1.3/markers/n/mark_bs.png",
        imageSize: [19, 31],
      }),
      offset: new window.AMap.Pixel(-9, -31),
    });

    marker.setMap(map);
    markerRef.current = marker;
    map.setCenter([lon, lat]);
    map.setZoom(zoom);
  }

  // 更新地图标记和轨迹线
  useEffect(() => {
    if (!mapLoaded || !amapRef.current || amapAuthFailedRef.current) return;

    const map = amapRef.current;

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    const hasTrackPoints = Array.isArray(trackPoints) && trackPoints.length > 0;
    const hasGps = Boolean(gps?.lat && gps?.lon);

    if (hasTrackPoints) {
      const path = trackPoints.map((point) => [point.lon, point.lat]);

      if (path.length > 1) {
        const polyline = new window.AMap.Polyline({
          path,
          strokeColor: "#00D9FF",
          strokeWeight: 4,
          strokeOpacity: 0.8,
          lineJoin: "round",
        });

        polyline.setMap(map);
        polylineRef.current = polyline;
      }

      const lastPoint = trackPoints[trackPoints.length - 1];
      focusMapOnPosition(lastPoint.lat, lastPoint.lon, 16);
      return;
    }

    if (hasGps) {
      focusMapOnPosition(Number(gps.lat), Number(gps.lon), 16);
    }
  }, [mapLoaded, gps.lat, gps.lon, trackPoints]);

  // 开始实时定位和轨迹记录
  async function startTracking() {
    setIsStartingTrack(true);
    setMapRequested(true);
    const permissionGranted = await requestLocationPermission();
    if (!permissionGranted) {
      setIsStartingTrack(false);
      return;
    }
    if (watchIdRef.current !== null) {
      setIsStartingTrack(false);
      return;
    }

    watchFallbackRef.current = false;
    setTrackingActive(sessionUsername, true);

    const startWatch = (options) => {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          setIsStartingTrack(false);
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          recordTrackingPoint(sessionUsername, lat, lon);
        },
        (error) => {
          const canFallback = !watchFallbackRef.current && (error?.code === 2 || error?.code === 3);
          if (canFallback) {
            watchFallbackRef.current = true;
            if (watchIdRef.current !== null) {
              navigator.geolocation.clearWatch(watchIdRef.current);
              watchIdRef.current = null;
            }
            Toast.show({ content: "高精度定位不稳定，已自动切换到普通精度" });
            startWatch({ enableHighAccuracy: false, maximumAge: 30000, timeout: 20000 });
            return;
          }

          setIsStartingTrack(false);
          if (error?.code === 1) {
            if (watchIdRef.current !== null) {
              navigator.geolocation.clearWatch(watchIdRef.current);
              watchIdRef.current = null;
            }
            setTrackingActive(sessionUsername, false);
          }
          Toast.show({ content: getGeolocationErrorMessage(error, "实时定位失败") });
        },
        options
      );
    };

    startWatch({ enableHighAccuracy: true, maximumAge: 0, timeout: 12000 });
  }

  // 停止定位
  function stopTracking() {
    if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    watchFallbackRef.current = false;
    setIsStartingTrack(false);
    setTrackingActive(sessionUsername, false);
  }

  // 重置轨迹
  function resetTrack() {
    stopTracking();
    resetTrackingState(sessionUsername);
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
    setIsLocating(true);
    setMapRequested(true);
    try {
      const permissionGranted = await requestLocationPermission();
      if (!permissionGranted) {
        setIsLocating(false);
        return;
      }
      const pos = await getCurrentPositionWithFallback();
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      setTrackingLocation(sessionUsername, lat, lon);
      focusMapOnPosition(lat, lon, 16);
    } catch (error) {
      Toast.show({ content: getGeolocationErrorMessage(error, "定位失败") });
    } finally {
      setIsLocating(false);
    }
  }

  async function submitCheckin(qrContent = "") {
    if (!canSubmit) {
      Toast.show({ content: "请至少填写景点ID或心情" });
      return false;
    }

    const formData = new FormData();
    if (locationId) {
      formData.append("location_id", locationId);
    }
    if (gps.lat && gps.lon) {
      formData.append("gps_lat", gps.lat);
      formData.append("gps_lon", gps.lon);
    }
    formData.append("mood_text", moodText);
    if (qrContent) {
      formData.append("qr_content", qrContent);
    }
    for (const item of files) {
      if (item?.file) {
        formData.append("photos", item.file);
      }
    }

    setSubmitting(true);
    try {
      const result = await createFootprint(formData, getUserToken() || "cookie-session");
      if (!locationId && result?.location_name) {
        Toast.show({ content: `打卡成功，已自动匹配景点：${result.location_name}` });
      } else {
        Toast.show({ content: "打卡成功" });
      }
      setMoodText("");
      setFiles([]);
      setLocationId("");
      setScannedQrText("");
      setScanModalVisible(false);
      resetTrack();
      return true;
    } catch (error) {
      if (error?.response?.status === 401) {
        Toast.show({ content: "请先在“我的”页面登录游客账号" });
        return false;
      }
      Toast.show({ content: error?.response?.data?.detail || "打卡失败，请稍后再试" });
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function stopScan() {
    const scanner = scannerRef.current;
    if (!scanner) {
      setScanEnabled(false);
      return;
    }

    try {
      await scanner.stop();
    } catch {
      // ignore
    }
    try {
      await scanner.clear();
    } catch {
      // ignore
    }
    scannerRef.current = null;
    if (qrReaderRef.current) {
      qrReaderRef.current.innerHTML = "";
    }
    setScanEnabled(false);
  }

  async function waitForQrReaderReady() {
    await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
    await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));

    const container = qrReaderRef.current;
    if (!container) {
      throw new Error("二维码容器未挂载");
    }

    if (container.clientWidth === 0 || container.clientHeight === 0) {
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    }

    if (container.clientWidth === 0 || container.clientHeight === 0) {
      throw new Error("二维码容器尺寸无效");
    }
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

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraSupported(false);
      Toast.show({ content: "当前设备不支持摄像头，请改用手动输入景点ID" });
      return;
    }

    const permissionGranted = await requestCameraPermission(() => setCameraSupported(false));
    if (!permissionGranted) {
      return;
    }

    setScanLoading(true);
    try {
      setScanEnabled(true);
      await waitForQrReaderReady();

      if (disposedRef.current) {
        return;
      }

      const instance = new Html5Qrcode("qr-reader");
      scannerRef.current = instance;

      const onScanSuccess = async (decodedText) => {
        if (disposedRef.current) {
          return;
        }
        const parsedId = parseLocationIdFromText(decodedText);
        if (!parsedId) {
          Toast.show({ content: "二维码内容无效" });
          return;
        }

        setLocationId(String(parsedId));
        setScannedQrText(decodedText);
        try {
          const location = await fetchLocationById(parsedId);
          setActiveSpot(location);
        } catch {
          setActiveSpot(null);
        }
        setScanModalVisible(true);
        Toast.show({ content: `扫码成功，景点ID: ${parsedId}` });
        await stopScan();
      };

      const scanConfig = { fps: 10, qrbox: { width: 220, height: 220 } };
      const cameraCandidates = [{ facingMode: "environment" }, { facingMode: "user" }];

      try {
        const cameras = await Html5Qrcode.getCameras();
        if (Array.isArray(cameras) && cameras.length > 0) {
          const backCamera = cameras.find((camera) => /back|rear|environment|后置|背面/i.test(camera?.label || ""));
          cameraCandidates.unshift({ deviceId: { exact: (backCamera || cameras[0]).id } });
        }
      } catch {
        // ignore camera enumeration failures and fall back to facingMode
      }

      let started = false;
      let lastError = null;
      for (const cameraOption of cameraCandidates) {
        try {
          await instance.start(cameraOption, scanConfig, onScanSuccess);
          started = true;
          break;
        } catch (error) {
          lastError = error;
        }
      }

      if (!started) {
        throw lastError || new Error("未找到可用摄像头");
      }
    } catch (error) {
      console.error("启动扫码失败:", error);
      if (error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError") {
        Toast.show({ content: "请在浏览器弹窗中允许摄像头权限" });
      } else {
        Toast.show({ content: "启动扫码失败，请检查浏览器权限、HTTPS 证书和二维码容器是否已渲染" });
      }
      setScanEnabled(false);
      await stopScan();
    } finally {
      setScanLoading(false);
    }
  }

  return (
    <ImmersivePage bgImage="/images/lugu-scenery.jpg" className="checkin-theme page-fade-in pb-[env(safe-area-inset-bottom)]">
      <div className="mb-3">
        <button type="button" className="app-glass-back-btn" onClick={handleBack} aria-label="返回上一页">
          <LucideIcon name="ChevronLeft" size={18} color="currentColor" />
        </button>
      </div>

      <div className="hero-shell checkin-hero mb-3">
        <div className="hero-kicker">Check-in Trail</div>
        <h1 className="page-title m-0">地图打卡</h1>
        <p className="hero-copy">使用高德地图实时定位绘制移动轨迹，通过二维码完成景点打卡。</p>
      </div>

      {/* 地图卡片 */}
      <CardComponent variant="glass" className="checkin-card p-0 overflow-hidden mb-4 h-64">
        <div 
          ref={mapRef} 
          style={{ width: "100%", height: "100%", borderRadius: "1rem" }}
          className="checkin-map-stage relative"
        >
          {!mapLoaded && (
            <div className="checkin-map-overlay absolute inset-0 flex items-center justify-center rounded-xl px-4">
              <div className="checkin-map-overlay-inner w-full max-w-[18rem] text-center text-sm leading-6 space-y-3">
                <div>{mapError || (mapRequested ? "地图加载中..." : "地图未启用")}</div>
                {!mapRequested && (
                  <ButtonComponent
                    variant="primary"
                      onClick={() => setMapRequested(true)}
                    className="checkin-map-enable-btn text-sm font-bold"
                  >
                    启用地图
                  </ButtonComponent>
                )}
              </div>
            </div>
          )}
        </div>
      </CardComponent>

      {ipHttpAccess && (
        <div className="checkin-alert mb-4 rounded-2xl px-4 py-3 text-xs leading-5">
          当前是通过服务器 IP 的 HTTP 方式访问。地图需要高德控制台把这个 IP 加入白名单，摄像头和定位则需要 HTTPS 或 localhost。
        </div>
      )}

      {/* 定位控制卡片 */}
      <CardComponent variant="glass" className="checkin-card mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="checkin-section-title font-bold flex items-center gap-2">
            <LucideIcon name="Navigation" size={18} className="checkin-icon-cyan" />
            实时轨迹
          </h3>
          <span className={`checkin-status text-xs px-2 py-1 rounded-full ${tracking ? 'is-live' : 'is-idle'}`}>
            {tracking ? "定位中" : "未定位"}
          </span>
        </div>

        <div className="space-y-2">
          <ButtonComponent
            variant={tracking ? "danger" : "primary"}
            loading={isStartingTrack}
            onClick={tracking ? stopTracking : startTracking}
           className="text-sm font-bold w-full">
            {tracking ? "停止实时轨迹" : "开始实时轨迹"}
          </ButtonComponent>
          <div className="grid grid-cols-2 gap-2">
            <ButtonComponent
              onClick={locateMe}
              loading={isLocating}
             className="w-full checkin-ghost-btn text-sm font-bold">
              定位我的位置
            </ButtonComponent>
            <ButtonComponent
              onClick={resetTrack}
              variant="danger"
             className="w-full checkin-ghost-btn text-sm font-bold">
              重置轨迹
            </ButtonComponent>
          </div>
        </div>

        {trackPoints.length > 0 && (
          <div className="checkin-soft-panel mt-3 p-2 rounded-lg">
            <p className="checkin-subtle-text text-xs">
              已记录轨迹点：{trackPoints.length} 个
            </p>
            {trackingUpdatedAt ? (
              <p className="checkin-subtle-text mt-1 text-[11px] opacity-75">
                最近同步：{new Date(trackingUpdatedAt).toLocaleString()}
              </p>
            ) : null}
          </div>
        )}
      </CardComponent>

      {/* 二维码扫描卡片 */}
      <CardComponent variant="glass" className="checkin-card mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="checkin-section-title font-bold flex items-center gap-2">
            <LucideIcon name="QrCode" size={18} className="checkin-icon-amber" />
            扫码打卡
          </h3>
          <span className="checkin-status is-idle text-xs px-2 py-1 rounded-full">摄像头</span>
        </div>

        <ButtonComponent
          variant="primary"
          loading={scanLoading}
          onClick={startScan}
         className="text-sm font-bold w-full">
          {scanEnabled ? "关闭扫码" : "扫描管理员二维码"}
        </ButtonComponent>

        <div
          id="qr-reader"
          ref={qrReaderRef}
          className="checkin-qr-reader mt-3 min-h-[260px] rounded-lg overflow-hidden"
          style={{ display: scanEnabled || scanLoading ? "block" : "none" }}
        />

        {!cameraSupported && (
          <div className="checkin-alert mt-3 p-3 rounded-lg text-xs leading-5">
            当前浏览器无法直接启用摄像头。请使用 HTTPS 访问页面；如果是服务器 IP 访问，也需要配置 HTTPS 才能使用摄像头。
          </div>
        )}
      </CardComponent>

      {/* 景点选择卡片 */}
      <CardComponent variant="glass" className="checkin-card mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="checkin-section-title font-bold flex items-center gap-2">
            <LucideIcon name="MapPin" size={18} className="checkin-icon-coral" />
            景点信息
          </h3>
        </div>

        <GlassInput
          placeholder="景点ID（选填，扫码后自动填充）"
          value={locationId}
          onChange={setLocationId}
          wrapperClassName="mb-2"
        />

        {activeSpot && (
          <div className="checkin-soft-panel p-2 rounded-lg text-xs">
            <p className="checkin-section-title font-bold mb-1">{activeSpot.name}</p>
            {activeSpot.description && (
              <p className="checkin-subtle-text">{activeSpot.description.substring(0, 100)}...</p>
            )}
          </div>
        )}
      </CardComponent>

      {/* 定位信息卡片 */}
      {gps.lat && gps.lon && (
        <CardComponent variant="glass" className="checkin-card mb-4">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="checkin-soft-panel p-2 rounded border">
              <p className="checkin-subtle-text">纬度</p>
              <p className="checkin-section-title font-bold text-sm">{parseFloat(gps.lat).toFixed(4)}</p>
            </div>
            <div className="checkin-soft-panel p-2 rounded border">
              <p className="checkin-subtle-text">经度</p>
              <p className="checkin-section-title font-bold text-sm">{parseFloat(gps.lon).toFixed(4)}</p>
            </div>
          </div>
        </CardComponent>
      )}

      {/* 打卡表单卡片 */}
      <CardComponent variant="glass" className="checkin-card mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="checkin-section-title font-bold flex items-center gap-2">
            <LucideIcon name="Heart" size={18} className="checkin-icon-rose" />
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
          <label className="checkin-subtle-text text-xs block mb-2">上传照片</label>
          <ImageUploader
            value={files}
            onChange={setFiles}
            maxCount={9}
            upload={async (file) => ({
              url: URL.createObjectURL(file),
              file,
            })}
          />
        </div>

        <ButtonComponent
          variant="primary"
          loading={submitting}
          disabled={!canSubmit}
          onClick={submitCheckin}
         className="w-full font-bold text-base py-2">
          {canSubmit ? "确认打卡" : "请填写景点ID或心情"}
        </ButtonComponent>
      </CardComponent>

      <Modal
        className="checkin-modal"
        visible={scanModalVisible}
        content={
          <div className="checkin-modal-content">
            <div className="checkin-modal-title text-base font-semibold">{activeSpot?.name || "当前景点"}</div>
            {activeSpot?.qr_code_url ? <img src={buildAssetUrl(activeSpot.qr_code_url)} alt="景点二维码" className="w-full rounded-xl mt-2" /> : null}
            <div className="checkin-modal-desc text-sm mt-2">{activeSpot?.description || "已完成扫码，欢迎继续探索。"}</div>
            <div className="checkin-modal-meta text-xs mt-3">分类：{activeSpot?.category || "景点"}</div>
          </div>
        }
        closeOnMaskClick
        onClose={() => setScanModalVisible(false)}
        actions={[
          { key: "later", text: "稍后处理", onClick: () => setScanModalVisible(false) },
          { key: "checkin", text: "记录打卡", primary: true, onClick: () => submitCheckin(scannedQrText) },
        ]}
      />
    </ImmersivePage>
  );
}
