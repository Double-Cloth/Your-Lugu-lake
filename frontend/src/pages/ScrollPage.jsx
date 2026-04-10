import { useEffect, useMemo, useRef, useState } from "react";
import { Toast } from "antd-mobile";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useNavigate } from "react-router-dom";

import { buildAssetUrl, fetchLocations, fetchMyFootprints, getUserToken } from "../api";
import { ImmersivePage, CardComponent, ButtonComponent, GlassInput } from "../components/SharedUI";

export default function ScrollPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [footprints, setFootprints] = useState([]);
  const [locationMap, setLocationMap] = useState({});
  const [keyword, setKeyword] = useState("");
  const [activeLocationId, setActiveLocationId] = useState("all");
  const scrollRef = useRef(null);

  const enriched = useMemo(() => {
    return footprints
      .map((item) => ({
      ...item,
      checkInTime: item.check_in_time ? new Date(item.check_in_time) : null,
      locationName: locationMap[item.location_id]?.name || `景点#${item.location_id}`,
      photoList: Array.isArray(item.photo_urls)
        ? item.photo_urls
        : (item.photo_url ? [item.photo_url] : []),
      }))
      .sort((a, b) => {
        const aTs = a.checkInTime ? a.checkInTime.getTime() : 0;
        const bTs = b.checkInTime ? b.checkInTime.getTime() : 0;
        return bTs - aTs;
      });
  }, [footprints, locationMap]);

  const filtered = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return enriched.filter((item) => {
      if (activeLocationId !== "all" && String(item.location_id) !== activeLocationId) {
        return false;
      }
      if (!normalizedKeyword) {
        return true;
      }

      const searchable = `${item.locationName} ${item.mood_text || ""}`.toLowerCase();
      return searchable.includes(normalizedKeyword);
    });
  }, [activeLocationId, enriched, keyword]);

  const locationOptions = useMemo(() => {
    const usedIds = Array.from(new Set(enriched.map((item) => item.location_id).filter(Boolean)));
    return usedIds
      .map((id) => ({ id: String(id), name: locationMap[id]?.name || `景点#${id}` }))
      .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  }, [enriched, locationMap]);

  const summary = useMemo(() => {
    const latest = enriched[0];
    const uniqueLocationCount = new Set(enriched.map((item) => item.locationName)).size;
    return {
      total: enriched.length,
      uniqueLocationCount,
      latestLabel: latest?.checkInTime ? latest.checkInTime.toLocaleString() : "暂无",
    };
  }, [enriched]);

  useEffect(() => {
    if (!getUserToken()) return;
    void loadScroll();
  }, []);

  async function loadScroll() {
    setLoading(true);
    try {
      const [myFootprints, locations] = await Promise.all([
        fetchMyFootprints(getUserToken() || "cookie-session"),
        fetchLocations(),
      ]);

      const map = {};
      (Array.isArray(locations) ? locations : []).forEach((loc) => {
        map[loc.id] = loc;
      });

      setLocationMap(map);
      setFootprints(Array.isArray(myFootprints) ? myFootprints : []);
    } catch (error) {
      if (error?.response?.status === 401) {
        Toast.show({ content: "请先登录游客账号" });
        return;
      }
      Toast.show({ content: "加载绘卷失败" });
    } finally {
      setLoading(false);
    }
  }

  async function snapshotScroll() {
    if (!scrollRef.current) {
      throw new Error("绘卷区域尚未渲染完成");
    }

    return html2canvas(scrollRef.current, {
      scale: 2,
      backgroundColor: "#0d3545",
      useCORS: true,
      logging: false,
    });
  }

  async function exportImage() {
    if (filtered.length === 0) {
      Toast.show({ content: "当前无可导出的绘卷内容" });
      return;
    }

    setExporting(true);
    try {
      const canvas = await snapshotScroll();
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
      link.download = `lugu-scroll-${Date.now()}.png`;
    link.click();
      Toast.show({ content: "绘卷图片已导出" });
    } catch (error) {
      console.error("导出绘卷图片失败", error);
      Toast.show({ content: "导出失败，请稍后重试" });
    } finally {
      setExporting(false);
    }
  }

  async function exportPdf() {
    if (filtered.length === 0) {
      Toast.show({ content: "当前无可导出的绘卷内容" });
      return;
    }

    setExporting(true);
    try {
      const canvas = await snapshotScroll();
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

      pdf.save(`lugu-scroll-${Date.now()}.pdf`);
      Toast.show({ content: "绘卷 PDF 已导出" });
    } catch (error) {
      console.error("导出绘卷 PDF 失败", error);
      Toast.show({ content: "导出失败，请稍后重试" });
    } finally {
      setExporting(false);
    }
  }

  async function copySummary() {
    if (filtered.length === 0) {
      Toast.show({ content: "当前没有可分享内容" });
      return;
    }
    const top3 = filtered.slice(0, 3).map((item) => `- ${item.locationName}｜${item.mood_text || "完成打卡"}`);
    const content = [
      "我在泸沽湖的旅行绘卷",
      `总打卡：${summary.total} 次`,
      `探索景点：${summary.uniqueLocationCount} 个`,
      "近期足迹：",
      ...top3,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(content);
      Toast.show({ content: "已复制分享文案" });
    } catch {
      Toast.show({ content: "复制失败，请手动复制" });
    }
  }

  return (
    <ImmersivePage bgImage="/images/lugu-scenery.jpg" className="scroll-theme page-fade-in pb-6">
      <div className="hero-shell scroll-hero mb-3">
        <div className="hero-kicker">Travel Scroll</div>
        <h1 className="page-title m-0">我的旅行绘卷</h1>
        <p className="hero-copy">把真实打卡记录整理成可筛选、可导出、可分享的旅程档案。</p>
        <div className="scroll-hero-stats mt-3">
          <span>打卡 {summary.total}</span>
          <span>景点 {summary.uniqueLocationCount}</span>
          <span>最近 {summary.latestLabel}</span>
        </div>
      </div>

      <CardComponent variant="glass" className="scroll-card mb-3">
        <div className="space-y-3">
          <GlassInput
            value={keyword}
            onChange={setKeyword}
            placeholder="按景点名或心情关键词筛选"
            clearable
          />

          <div className="scroll-chip-row">
            <button
              type="button"
              className={`scroll-chip ${activeLocationId === "all" ? "is-active" : ""}`}
              onClick={() => setActiveLocationId("all")}
            >
              全部景点
            </button>
            {locationOptions.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`scroll-chip ${activeLocationId === item.id ? "is-active" : ""}`}
                onClick={() => setActiveLocationId(item.id)}
              >
                {item.name}
              </button>
            ))}
          </div>

          <ButtonComponent variant="primary" loading={loading} onClick={loadScroll} className="w-full">
            刷新绘卷数据
          </ButtonComponent>
        </div>
      </CardComponent>

      <div ref={scrollRef} className="scroll-capture">
        <div className="scroll-capture-header">
          <h3 className="m-0">泸沽湖足迹时间线</h3>
          <span>{filtered.length} 条记录</span>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-white/60 mt-3">暂无符合条件的记录，可先去“打卡”页面完成行程记录。</p>
        ) : (
          <div className="mt-3 space-y-4">
            {filtered.map((item, idx) => (
              <div
                key={item.id}
                className="timeline-item scroll-timeline-item"
                style={{ animationDelay: `${idx * 90}ms` }}
              >
                <div className="text-xs text-white/90">
                  {item.checkInTime ? item.checkInTime.toLocaleString() : "时间未知"}
                </div>
                <div className="font-medium text-base text-white mt-1">{item.locationName}</div>
                <div className="text-sm text-white/70 mt-1 leading-relaxed">{item.mood_text || "无心情记录"}</div>
                {item.photoList.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {item.photoList.slice(0, 6).map((url, photoIndex) => (
                      <img
                        key={`${item.id}-${photoIndex}`}
                        src={buildAssetUrl(url)}
                        alt="footprint"
                        className="scroll-photo-thumb w-full rounded-lg"
                        loading="lazy"
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <CardComponent variant="glass" className="scroll-card mb-4">
          <ButtonComponent loading={exporting} disabled={exporting} onClick={exportImage} className="w-full">
            导出分享图
          </ButtonComponent>
          <ButtonComponent variant="primary" loading={exporting} disabled={exporting} onClick={exportPdf} className="mt-3 w-full">
            导出 PDF
          </ButtonComponent>
          <ButtonComponent onClick={copySummary} className="mt-3 w-full">
            复制分享文案
          </ButtonComponent>
        </CardComponent>
      )}

      {!getUserToken() && (
        <CardComponent variant="glass" className="scroll-card mb-2">
          <ButtonComponent variant="primary" onClick={() => navigate("/me")} className="w-full">登录后生成你的绘卷</ButtonComponent>
        </CardComponent>
      )}
    </ImmersivePage>
  );
}
