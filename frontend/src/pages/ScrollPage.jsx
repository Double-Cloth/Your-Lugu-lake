import { useMemo, useRef, useState } from "react";
import { Button, Card, Toast } from "antd-mobile";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

import { fetchLocations, fetchMyFootprints, getUserToken } from "../api";

export default function ScrollPage() {
  const [loading, setLoading] = useState(false);
  const [footprints, setFootprints] = useState([]);
  const [locationMap, setLocationMap] = useState({});
  const scrollRef = useRef(null);

  const enriched = useMemo(() => {
    return footprints.map((item) => ({
      ...item,
      locationName: locationMap[item.location_id]?.name || `景点#${item.location_id}`,
    }));
  }, [footprints, locationMap]);

  async function loadScroll() {
    const token = getUserToken();
    if (!token) {
      Toast.show({ content: "请先登录游客账号" });
      return;
    }

    setLoading(true);
    try {
      const [myFootprints, locations] = await Promise.all([
        fetchMyFootprints(token),
        fetchLocations(),
      ]);

      const map = {};
      locations.forEach((loc) => {
        map[loc.id] = loc;
      });

      setLocationMap(map);
      setFootprints(Array.isArray(myFootprints) ? myFootprints : []);
    } catch {
      Toast.show({ content: "加载绘卷失败" });
    } finally {
      setLoading(false);
    }
  }

  async function exportImage() {
    if (!scrollRef.current) return;
    const canvas = await html2canvas(scrollRef.current, { scale: 2 });
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "lugu-scroll.png";
    link.click();
  }

  async function exportPdf() {
    if (!scrollRef.current) return;
    const canvas = await html2canvas(scrollRef.current, { scale: 2 });
    const imgData = canvas.toDataURL("image/jpeg", 0.92);

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = 210;
    const pageHeight = 297;
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let yOffset = 0;
    let heightLeft = imgHeight;
    while (heightLeft > 0) {
      pdf.addImage(imgData, "JPEG", 0, yOffset, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      if (heightLeft > 0) {
        pdf.addPage();
        yOffset -= pageHeight;
      }
    }

    pdf.save("lugu-scroll.pdf");
  }

  return (
    <div className="page-fade-in">
      <div className="hero-shell mb-3">
        <div className="hero-kicker">Travel Scroll</div>
        <h1 className="page-title m-0">我的旅行绘卷</h1>
        <p className="hero-copy">把脚步、心情和照片串成一卷可分享的旅行故事。</p>
      </div>
      <Card className="card card-glass">
        <Button color="primary" loading={loading} block onClick={loadScroll}>
          汇总我的行程
        </Button>
      </Card>

      <div ref={scrollRef} className="card card-glass">
        <h3 className="m-0">泸沽湖足迹时间线</h3>
        {enriched.length === 0 ? (
          <p className="text-sm text-white/50 mt-3">暂无打卡记录，先去“打卡”页面完成行程记录。</p>
        ) : (
          <div className="mt-3 space-y-3">
            {enriched.map((item, idx) => (
              <div
                key={item.id}
                className="timeline-item"
                style={{ animationDelay: `${idx * 90}ms` }}
              >
                <div className="text-xs text-white/95">{new Date(item.check_in_time).toLocaleString()}</div>
                <div className="font-medium text-base">{item.locationName}</div>
                <div className="text-sm text-white/60">{item.mood_text || "无心情记录"}</div>
                {item.photo_url && (
                  <img
                    src={`${import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"}${item.photo_url}`}
                    alt="footprint"
                    className="mt-2 w-full rounded-lg"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {enriched.length > 0 && (
        <Card className="card card-glass">
          <Button block onClick={exportImage}>导出分享图</Button>
          <Button className="mt-3" block color="primary" onClick={exportPdf}>
            导出 PDF
          </Button>
        </Card>
      )}
    </div>
  );
}
