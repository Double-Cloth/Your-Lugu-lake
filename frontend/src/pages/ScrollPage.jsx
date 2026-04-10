import { useEffect, useMemo, useRef, useState } from "react";
import { Toast } from "antd-mobile";
import html2canvas from "html2canvas";
import { useNavigate } from "react-router-dom";

import { buildAssetUrl, fetchLocations, fetchMyFootprints, getUserToken } from "../api";
import { ImmersivePage, CardComponent, ButtonComponent, GlassInput } from "../components/SharedUI";

function formatDateTime(value) {
  if (!value) {
    return "暂无";
  }

  return value.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(value) {
  if (!value) {
    return "暂无";
  }

  return value.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function ScrollPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [exportingImage, setExportingImage] = useState(false);
  const [copyingSummary, setCopyingSummary] = useState(false);
  const [footprints, setFootprints] = useState([]);
  const [locationMap, setLocationMap] = useState({});
  const [keyword, setKeyword] = useState("");
  const [activeLocationId, setActiveLocationId] = useState("all");
  const scrollRef = useRef(null);

  function handleBack() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/home", { replace: true });
  }

  const enriched = useMemo(() => {
    return footprints
      .map((item) => ({
        ...item,
        checkInTime: item.check_in_time ? new Date(item.check_in_time) : null,
        locationName: locationMap[item.location_id]?.name || `景点#${item.location_id}`,
        photoList: Array.isArray(item.photo_urls)
          ? item.photo_urls
          : item.photo_url
            ? [item.photo_url]
            : [],
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
    const earliest = enriched.length > 0 ? enriched[enriched.length - 1] : null;
    const uniqueLocationCount = new Set(enriched.map((item) => item.locationName)).size;
    const photoCount = enriched.reduce((total, item) => total + item.photoList.length, 0);
    const topLocations = Array.from(new Set(enriched.map((item) => item.locationName))).slice(0, 4);
    return {
      total: enriched.length,
      uniqueLocationCount,
      photoCount,
      latestLabel: latest?.checkInTime ? formatDateTime(latest.checkInTime) : "暂无",
      latestLocation: latest?.locationName || "暂无",
      latestMood: latest?.mood_text || "记录下第一段旅程感受",
      travelSpan:
        latest?.checkInTime && earliest?.checkInTime
          ? `${formatDateOnly(earliest.checkInTime)} - ${formatDateOnly(latest.checkInTime)}`
          : "暂无",
      topLocations,
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

    await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));

    return html2canvas(scrollRef.current, {
      scale: 2.25,
      backgroundColor: "#f6ead8",
      useCORS: true,
      logging: false,
    });
  }

  async function exportImage() {
    if (filtered.length === 0) {
      Toast.show({ content: "当前无可导出的绘卷内容" });
      return;
    }

    if (exportingImage || copyingSummary) {
      return;
    }

    setExportingImage(true);
    try {
      const canvas = await snapshotScroll();
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `lugu-scroll-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      Toast.show({ content: "绘卷图片已生成" });
    } catch (error) {
      console.error("导出绘卷图片失败", error);
      Toast.show({ content: "导出失败，请稍后重试" });
    } finally {
      setExportingImage(false);
    }
  }

  async function copySummary() {
    if (filtered.length === 0) {
      Toast.show({ content: "当前没有可分享内容" });
      return;
    }
    if (exportingImage || copyingSummary) {
      return;
    }

    setCopyingSummary(true);
    const top3 = filtered.slice(0, 3).map((item) => `- ${item.locationName}｜${item.mood_text || "完成打卡"}`);
    const topLocations = summary.topLocations.length > 0 ? summary.topLocations.join("、") : "暂无";
    const content = [
      "我在泸沽湖的旅行绘卷",
      `总打卡：${summary.total} 次`,
      `探索景点：${summary.uniqueLocationCount} 个`,
      `足迹跨度：${summary.travelSpan}`,
      `重点地点：${topLocations}`,
      "近期足迹：",
      ...top3,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(content);
      Toast.show({ content: "已复制分享文案" });
    } catch {
      Toast.show({ content: "复制失败，请手动复制" });
    } finally {
      setCopyingSummary(false);
    }
  }

  return (
    <ImmersivePage bgImage="/images/lugu-scenery.jpg" className="scroll-theme page-fade-in pb-6">
      <div className="mb-3 flex justify-start">
        <button type="button" className="scroll-back-btn" onClick={handleBack} aria-label="返回上一页">
          <span className="scroll-back-btn-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </span>
          <span className="scroll-back-btn-text">返回</span>
        </button>
      </div>

      <div className="hero-shell scroll-hero mb-3">
        <div className="hero-kicker">Travel Scroll</div>
        <h1 className="page-title m-0">我的旅行绘卷</h1>
        <p className="hero-copy">把真实打卡记录整理成一张更像旅行海报的长卷，方便保存、分享和回看。</p>
        <div className="scroll-hero-stats mt-3">
          <span>打卡 {summary.total}</span>
          <span>景点 {summary.uniqueLocationCount}</span>
          <span>照片 {summary.photoCount}</span>
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

          <div className="flex items-center justify-between text-xs text-[#7a5a3e]">
            <span>当前筛选 {filtered.length} 条</span>
            <span>覆盖 {locationOptions.length} 个景点</span>
          </div>

          <ButtonComponent variant="primary" loading={loading} onClick={loadScroll} className="w-full">
            刷新绘卷数据
          </ButtonComponent>
        </div>
      </CardComponent>

      <div ref={scrollRef} className="scroll-capture">
        <div className="scroll-capture-cover">
          <div className="scroll-capture-badge">Travel Scroll</div>
          <div className="scroll-capture-cover-top">
            <div>
              <h2 className="scroll-capture-title m-0">我的旅行绘卷</h2>
              <p className="scroll-capture-lead m-0">把真实足迹整理成一张能保存、能分享、能回看的长卷。</p>
            </div>
            <div className="scroll-capture-stamp">
              <span className="text-[11px] uppercase tracking-[0.24em]">Total</span>
              <strong>{filtered.length}</strong>
            </div>
          </div>

          <div className="scroll-capture-meta">
            <span>最近更新 {summary.latestLabel}</span>
            <span>足迹跨度 {summary.travelSpan}</span>
            <span>打卡景点 {summary.uniqueLocationCount}</span>
          </div>

          <div className="scroll-capture-highlight">
            <div className="scroll-capture-highlight-label">最近一站</div>
            <div className="scroll-capture-highlight-title">{summary.latestLocation}</div>
            <div className="scroll-capture-highlight-copy">{summary.latestMood}</div>
          </div>
        </div>

        <div className="scroll-capture-section">
          <div className="scroll-section-head">
            <h3 className="m-0">旅程速览</h3>
            <span>由真实打卡自动生成</span>
          </div>

          <div className="scroll-metrics-grid">
            <div className="scroll-metric-card">
              <span className="scroll-metric-label">总打卡</span>
              <strong>{summary.total}</strong>
              <p>记录你在泸沽湖留下的全部瞬间。</p>
            </div>
            <div className="scroll-metric-card">
              <span className="scroll-metric-label">探索景点</span>
              <strong>{summary.uniqueLocationCount}</strong>
              <p>覆盖的景点越多，绘卷越丰富。</p>
            </div>
            <div className="scroll-metric-card">
              <span className="scroll-metric-label">随行影像</span>
              <strong>{summary.photoCount}</strong>
              <p>照片会让这一段旅程更有质感。</p>
            </div>
            <div className="scroll-metric-card">
              <span className="scroll-metric-label">重点地点</span>
              <strong>{summary.topLocations[0] || "暂无"}</strong>
              <p>{summary.topLocations.slice(0, 3).join(" · ") || "继续去打卡，系统会自动补全。"}</p>
            </div>
          </div>
        </div>

        <div className="scroll-capture-section">
          <div className="scroll-section-head">
            <h3 className="m-0">足迹时间线</h3>
            <span>{filtered.length} 条记录</span>
          </div>

          {filtered.length === 0 ? (
            <div className="scroll-empty-state">
              <div className="scroll-empty-state-title">暂无符合条件的记录</div>
              <div className="scroll-empty-state-copy">可以切换筛选条件，或者先去“打卡”页面补充足迹。</div>
            </div>
          ) : (
            <div className="scroll-timeline-list">
              {filtered.map((item, idx) => (
                <article
                  key={item.id}
                  className="scroll-timeline-item"
                >
                  <div className="scroll-timeline-marker">{String(idx + 1).padStart(2, "0")}</div>
                  <div className="scroll-timeline-content">
                    <div className="scroll-timeline-head">
                      <div>
                        <div className="scroll-timeline-time">
                          {item.checkInTime ? formatDateTime(item.checkInTime) : "时间未知"}
                        </div>
                        <div className="scroll-timeline-title">{item.locationName}</div>
                      </div>
                      <div className="scroll-timeline-badge">{item.photoList.length > 0 ? `${item.photoList.length} 图` : "无图"}</div>
                    </div>

                    <div className="scroll-timeline-copy">{item.mood_text || "无心情记录"}</div>

                    {item.photoList.length > 0 && (
                      <div className="scroll-photo-grid">
                        {item.photoList.slice(0, 6).map((url, photoIndex) => (
                          <img
                            key={`${item.id}-${photoIndex}`}
                            src={buildAssetUrl(url)}
                            alt={`${item.locationName} 打卡照片 ${photoIndex + 1}`}
                            className="scroll-photo-thumb"
                            loading="lazy"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="scroll-capture-footer">
          <div>
            <div className="scroll-footer-label">精选地点</div>
            <div className="scroll-footer-tags">
              {summary.topLocations.length > 0 ? (
                summary.topLocations.map((name) => (
                  <span key={name} className="scroll-footer-tag">{name}</span>
                ))
              ) : (
                <span className="scroll-footer-tag">等待下一段旅程</span>
              )}
            </div>
          </div>
          <div className="scroll-footer-note">由真实打卡自动生成，适合导出分享图。</div>
        </div>
      </div>

      {filtered.length > 0 && (
        <CardComponent variant="glass" className="scroll-card mb-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ButtonComponent
              loading={exportingImage}
              disabled={exportingImage || copyingSummary}
              onClick={exportImage}
              className="w-full"
            >
              生成绘卷图片
            </ButtonComponent>
            <ButtonComponent
              variant="primary"
              loading={copyingSummary}
              disabled={exportingImage || copyingSummary}
              onClick={copySummary}
              className="w-full"
            >
              复制分享文案
            </ButtonComponent>
          </div>
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
