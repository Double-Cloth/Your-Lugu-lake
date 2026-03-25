import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button, Card, DotLoading, Input, Popup, Toast } from "antd-mobile";

import { buildAssetUrl, fetchLocations, fetchMyFootprints, generateRoute, getUserToken } from "../api";

const LUGU_LAKE_BG_URL = "/images/lugu-hero.jpg";

function IconSpark() {
  return (
    <svg viewBox="0 0 24 24" className="feature-icon-svg" aria-hidden="true">
      <path d="M12 2l2.2 5.2L19 9.4l-4.8 2.2L12 17l-2.2-5.4L5 9.4l4.8-2.2L12 2z" fill="currentColor" />
    </svg>
  );
}

function IconRoute() {
  return (
    <svg viewBox="0 0 24 24" className="feature-icon-svg" aria-hidden="true">
      <path d="M6 4a2 2 0 100 4 2 2 0 000-4zm12 12a2 2 0 100 4 2 2 0 000-4z" fill="currentColor" />
      <path d="M7.8 6h4.9c2.6 0 4.3 1.6 4.3 3.8 0 2.1-1.5 3.3-3.8 3.3H9.6c-1.2 0-1.9.5-1.9 1.3S8.4 16 9.5 16H16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg viewBox="0 0 24 24" className="feature-icon-svg" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 12h18M12 3c2.8 2.6 2.8 15.4 0 18M12 3c-2.8 2.6-2.8 15.4 0 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export default function HomePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePanel, setActivePanel] = useState("");
  const [travelNeed, setTravelNeed] = useState("");
  const [routeLoading, setRouteLoading] = useState(false);
  const [routePlan, setRoutePlan] = useState({ title: "", timeline: [] });
  const [coverPhotoUrl, setCoverPhotoUrl] = useState("");
  const [heroBgUrl, setHeroBgUrl] = useState("");

  useEffect(() => {
    const panel = location.state?.openPanel;
    if (panel === "overview" || panel === "global" || panel === "culture") {
      setActivePanel(panel);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const locs = await fetchLocations();
        setLocations(Array.isArray(locs) ? locs : []);

        const token = getUserToken();
        if (token) {
          const footprints = await fetchMyFootprints(token);
          const firstWithPhoto = Array.isArray(footprints)
            ? footprints.find((item) => item.photo_url)
            : null;
          setCoverPhotoUrl(firstWithPhoto?.photo_url ? buildAssetUrl(firstWithPhoto.photo_url) : "");
        } else {
          setCoverPhotoUrl("");
        }
      } catch {
        setLocations([]);
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, []);

  useEffect(() => {
    const candidates = [coverPhotoUrl, LUGU_LAKE_BG_URL].filter(Boolean);
    if (candidates.length === 0) {
      setHeroBgUrl("");
      return;
    }

    let canceled = false;
    let idx = 0;

    function tryNext() {
      if (idx >= candidates.length) {
        if (!canceled) {
          setHeroBgUrl("");
        }
        return;
      }

      const url = candidates[idx];
      const img = new Image();
      img.onload = () => {
        if (!canceled) {
          setHeroBgUrl(url);
        }
      };
      img.onerror = () => {
        idx += 1;
        tryNext();
      };
      img.src = url;
    }

    tryNext();
    return () => {
      canceled = true;
    };
  }, [coverPhotoUrl]);

  const topLocations = useMemo(() => locations.slice(0, 4), [locations]);
  const locationsWithAudio = useMemo(
    () => locations.filter((item) => item.audio_url),
    [locations]
  );

  function openPanel(name) {
    setActivePanel(name);
  }

  function closePanel() {
    setActivePanel("");
  }

  async function createCulturePlan() {
    const need = travelNeed.trim();
    if (!need) {
      Toast.show({ content: "请输入你的游览需求" });
      return;
    }

    setRouteLoading(true);
    const token = getUserToken();

    try {
      if (!token) {
        Toast.show({ content: "请先登录后再生成路线" });
        return;
      }

      const result = await generateRoute(
        {
          duration: need.includes("半天") ? "half-day" : "one-day",
          preference: need.includes("文化") ? "culture" : "mixed",
          group_type: need.includes("老人") ? "family" : "friends",
        },
        token
      );

      const timeline = Array.isArray(result.route?.timeline) ? result.route.timeline : [];
      setRoutePlan({
        title: result.route?.title || "AI 文化导览路线",
        timeline,
      });
      if (timeline.length === 0) {
        Toast.show({ content: "接口返回为空，请稍后重试" });
      }
    } catch (error) {
      const detail = error?.response?.data?.detail;
      Toast.show({ content: detail || "路线生成失败" });
    } finally {
      setRouteLoading(false);
    }
  }

  return (
    <div className="page-fade-in">
      <div
        className="home-hero mb-3"
        style={{
          backgroundImage: heroBgUrl
            ? `linear-gradient(120deg, rgba(8, 52, 78, 0.42), rgba(31, 119, 153, 0.18)), url(${heroBgUrl})`
            : undefined,
        }}
      >
        <div className="home-hero-mask" />
        <div className="home-hero-avatar">泸</div>
        <div className="home-hero-bubble">泸沽湖景区欢迎您</div>
        <div className="home-hero-content">
          <div className="hero-kicker text-white/90">Lugu Lake Smart Culture & Travel</div>
          <h1 className="page-title m-0 text-white">泸沽湖智慧文旅</h1>
          <p className="hero-copy text-white/90">看风景、懂文化、走路线，一屏进入高质量湖区体验。</p>
          <div className="home-hero-badges">
            <span className="hero-badge">真实景点数据</span>
            <span className="hero-badge">实时路线生成</span>
            <span className="hero-badge">移动端优化</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 home-feature-list">
        <button type="button" className="feature-entry feature-entry-cyan" onClick={() => openPanel("overview")}>
          <div className="feature-entry-icon"><IconSpark /></div>
          <div>
            <div className="feature-entry-title">景区一览</div>
            <div className="feature-entry-desc">发现泸沽湖最美景点，了解摩梭文化</div>
          </div>
          <div className="feature-entry-arrow">›</div>
        </button>

        <button type="button" className="feature-entry feature-entry-amber" onClick={() => openPanel("culture")}>
          <div className="feature-entry-icon"><IconRoute /></div>
          <div>
            <div className="feature-entry-title">文化导览</div>
            <div className="feature-entry-desc">AI智能规划个性路线</div>
          </div>
          <div className="feature-entry-arrow">›</div>
        </button>

        <button type="button" className="feature-entry feature-entry-blue" onClick={() => openPanel("global")}>
          <div className="feature-entry-icon"><IconGlobe /></div>
          <div>
            <div className="feature-entry-title">全域导览</div>
            <div className="feature-entry-desc">查看所有景点，了解周边详细信息</div>
          </div>
          <div className="feature-entry-arrow">›</div>
        </button>
      </div>

      <Popup visible={activePanel === "overview"} onMaskClick={closePanel} bodyStyle={{ minHeight: "75vh", width: "100%", maxWidth: "100%", overflowY: "auto" }}>
        <div className="home-popup-content home-popup-scrollable">
          <div className="home-popup-header">
            <h3 className="section-title">景区一览</h3>
            <button className="home-popup-back" onClick={closePanel}>← 返回</button>
          </div>
          {loading ? (
            <div className="card card-glass text-center"><DotLoading color="primary" /></div>
          ) : (
            topLocations.map((item) => (
              <Link
                to={`/locations/${item.id}`}
                state={{ fromPanel: "overview" }}
                key={item.id}
                className="block card card-glass list-card no-underline text-current"
              >
                <div className="flex items-center justify-between">
                  <h3 className="m-0 text-lg">{item.name}</h3>
                  <span className="chip-soft">{item.category}</span>
                </div>
                <p className="text-sm text-slate-600 mt-2 mb-0 line-clamp-2">{item.description}</p>
              </Link>
            ))
          )}

          <Card className="card card-glass">
            <div className="font-semibold text-lake-700">摩梭文化</div>
            <div className="text-sm text-slate-600 mt-2">
              以下内容来自真实景点描述字段：
            </div>
            <ul className="text-sm text-slate-700 mt-2 mb-0 pl-5">
              {topLocations.map((item) => (
                <li key={`culture-${item.id}`} className="mb-1">{item.name}：{item.description}</li>
              ))}
            </ul>
          </Card>

          <Card className="card card-glass mb-0">
            <div className="text-sm text-slate-600">
              当前系统未提供“景区问答”独立接口，已按要求移除模拟聊天。
            </div>
          </Card>
        </div>
      </Popup>

      <Popup visible={activePanel === "culture"} onMaskClick={closePanel} bodyStyle={{ minHeight: "75vh", width: "100%", maxWidth: "100%", overflowY: "auto" }}>
        <div className="home-popup-content home-popup-scrollable">
          <div className="home-popup-header">
            <h3 className="section-title">文化导览</h3>
            <button className="home-popup-back" onClick={closePanel}>← 返回</button>
          </div>
          <Card className="card card-glass">
            <div className="text-sm text-slate-600 mb-3">示例：我带老人游玩半天，想多了解摩梭文化。</div>
            
            <div className="mb-3">
              <div className="text-xs text-slate-500 mb-2">快速选项：</div>
              <div className="flex flex-wrap gap-2">
                <button 
                  type="button"
                  className="px-3 py-1.5 text-xs bg-sky-100 text-sky-700 rounded-lg border border-sky-200 hover:bg-sky-200 transition"
                  onClick={() => setTravelNeed("我带老人游玩半天，想多了解摩梭文化")}
                >
                  老人半天
                </button>
                <button 
                  type="button"
                  className="px-3 py-1.5 text-xs bg-amber-100 text-amber-700 rounded-lg border border-amber-200 hover:bg-amber-200 transition"
                  onClick={() => setTravelNeed("我和朋友游玩一天，想看遗留的摩梭文化景观")} 
                >
                  朋友一天
                </button>
                <button 
                  type="button"
                  className="px-3 py-1.5 text-xs bg-teal-100 text-teal-700 rounded-lg border border-teal-200 hover:bg-teal-200 transition"
                  onClick={() => setTravelNeed("我和家人游玩一天，想深入了解摩梭女性文化")} 
                >
                  家人一天
                </button>
                <button 
                  type="button"
                  className="px-3 py-1.5 text-xs bg-rose-100 text-rose-700 rounded-lg border border-rose-200 hover:bg-rose-200 transition"
                  onClick={() => setTravelNeed("我独自游玩半天，想体验最有特色的摩梭风情")}
                >
                  独自半天
                </button>
              </div>
            </div>
            
            <Input
              className="mt-2"
              value={travelNeed}
              onChange={setTravelNeed}
              placeholder="输入自定义游览需求"
              clearable
            />
            <Button className="mt-3 home-primary-btn" color="primary" block loading={routeLoading} onClick={createCulturePlan}>
              生成导览路线
            </Button>
            <div className="text-xs text-slate-500 mt-2">路线来自真实 AI 接口，失败会直接报错，不做虚拟回退。</div>
          </Card>

          <Card className="card card-glass">
            <div className="font-semibold text-lake-700">语音导览资源</div>
            {locationsWithAudio.length === 0 ? (
              <div className="text-sm text-slate-500 mt-2">当前景点暂无 audio_url 数据。</div>
            ) : (
              locationsWithAudio.map((item) => (
                <div key={`audio-${item.id}`} className="mt-2">
                  <div className="text-sm font-medium text-slate-700">{item.name}</div>
                  <audio controls src={buildAssetUrl(item.audio_url)} className="w-full mt-1" />
                </div>
              ))
            )}
          </Card>

          {routePlan.timeline.length > 0 && (
            <Card className="card card-glass mb-0">
              <h3 className="m-0 text-lake-700">{routePlan.title}</h3>
              <div className="mt-3 space-y-3">
                {routePlan.timeline.map((item, idx) => (
                  <div key={`${item.time}-${item.location}-${idx}`} className="timeline-item" style={{ animationDelay: `${idx * 90}ms` }}>
                    <div className="text-xs text-lake-700">{item.time}</div>
                    <div className="font-medium text-base">{item.location}</div>
                    <div className="text-sm text-slate-600">停留约 {item.stay_minutes} 分钟</div>
                    {item.highlight && <div className="text-xs text-wood-500 mt-1">{item.highlight}</div>}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </Popup>

      <Popup visible={activePanel === "global"} onMaskClick={closePanel} bodyStyle={{ minHeight: "75vh", width: "100%", maxWidth: "100%", overflowY: "auto" }}>
        <div className="home-popup-content home-popup-scrollable">
          <div className="home-popup-header">
            <h3 className="section-title">全域导览</h3>
            <button className="home-popup-back" onClick={closePanel}>← 返回</button>
          </div>
          {locations.map((item) => (
            <Link
              to={`/locations/${item.id}`}
              state={{ fromPanel: "global" }}
              key={item.id}
              className="block card card-glass list-card no-underline text-current"
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold text-lake-700">{item.name}</div>
                <span className="chip-soft">{item.category}</span>
              </div>
              <div className="text-sm text-slate-600 mt-2">坐标：{item.latitude}, {item.longitude}</div>
              <div className="text-sm text-slate-600 mt-1">{item.description}</div>
            </Link>
          ))}
        </div>
      </Popup>
    </div>
  );
}
