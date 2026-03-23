import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, ImageUploader, Input, Toast } from "antd-mobile";
import { Html5Qrcode } from "html5-qrcode";
import { useNavigate } from "react-router-dom";

import { createFootprint, getUserToken } from "../api";

function parseLocationIdFromText(text) {
  if (!text) return null;
  const match = text.match(/\/locations\/(\d+)/);
  return match ? Number(match[1]) : null;
}

async function stopAndClearScanner(instance) {
  if (!instance) {
    return;
  }

  try {
    const stopResult = instance.stop();
    if (stopResult && typeof stopResult.then === "function") {
      await stopResult;
    }
  } catch {
    // Ignore scanner state errors such as "not running or paused".
  }

  try {
    const clearResult = instance.clear();
    if (clearResult && typeof clearResult.then === "function") {
      await clearResult;
    }
  } catch {
    // Ignore clear failures if scanner is already disposed.
  }
}

export default function CheckinPage() {
  const navigate = useNavigate();
  const [scanEnabled, setScanEnabled] = useState(false);
  const scannerRef = useRef(null);
  const [locationId, setLocationId] = useState("");
  const [moodText, setMoodText] = useState("");
  const [gps, setGps] = useState({ lat: "", lon: "" });
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(() => {
    return Boolean(locationId && gps.lat && gps.lon);
  }, [locationId, gps.lat, gps.lon]);

  useEffect(() => {
    let disposed = false;

    if (scanEnabled) {
      const instance = new Html5Qrcode("qr-reader");
      scannerRef.current = instance;

      instance
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            const id = parseLocationIdFromText(decodedText);
            if (id) {
              setLocationId(String(id));
              Toast.show({ content: `识别到景点ID: ${id}` });
              navigate(`/locations/${id}`);
            } else {
              Toast.show({ content: "二维码内容不符合景点格式" });
            }
          }
        )
        .catch(() => {
          if (!disposed) {
            Toast.show({ content: "无法启动摄像头，请检查权限" });
            setScanEnabled(false);
          }
        });
    }

    return () => {
      disposed = true;
      const current = scannerRef.current;
      scannerRef.current = null;
      void stopAndClearScanner(current);
    };
  }, [scanEnabled, navigate, setScanEnabled]);

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

  async function toggleScan() {
    if (scanEnabled) {
      const current = scannerRef.current;
      scannerRef.current = null;
      await stopAndClearScanner(current);
      setScanEnabled(false);
      return;
    }
    setScanEnabled(true);
  }

  return (
    <div className="page-fade-in">
      <div className="hero-shell mb-3">
        <div className="hero-kicker">Scan & Checkin</div>
        <h1 className="page-title m-0">扫码打卡</h1>
        <p className="hero-copy">扫码识别景点并记录此刻位置、心情和照片。</p>
      </div>

      <Card className="card card-glass">
        <div className="flex items-center justify-between mb-2">
          <h3 className="section-title m-0">扫码入口</h3>
          <span className="chip-soft">{scanEnabled ? "扫描中" : "已停止"}</span>
        </div>
        <Button block onClick={toggleScan}>{scanEnabled ? "关闭扫码" : "开启扫码"}</Button>
        {scanEnabled && <div id="qr-reader" className="mt-3" />}

        <Input
          className="mt-3"
          placeholder="景点ID（扫码后自动填充）"
          value={locationId}
          onChange={setLocationId}
          clearable
        />

        <Button className="mt-3" block onClick={locateMe}>获取当前位置</Button>
        <div className="mt-2 text-xs text-slate-500">
          纬度: {gps.lat || "未获取"}，经度: {gps.lon || "未获取"}
        </div>

        <Input
          className="mt-3"
          placeholder="记录此刻心情"
          value={moodText}
          onChange={setMoodText}
          clearable
        />

        <div className="mt-3">
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
    </div>
  );
}
