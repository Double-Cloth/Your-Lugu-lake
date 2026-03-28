import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button, Card, DotLoading, Input, Popup, Toast } from "antd-mobile";
import { ImmersivePage, CardComponent, ButtonComponent, ReadingGlassCard, GlassInput } from "../components/SharedUI";

import {
  buildAssetUrl,
  fetchKnowledgeBaseHotels,
  fetchKnowledgeBaseLocationsIndex,
  fetchKnowledgeBaseNearbySpots,
  fetchKnowledgeBaseOverview,
  fetchLocations,
  fetchMyFootprints,
  generateRoute,
  getUserToken,
} from "../api";

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
  const [kbLocations, setKbLocations] = useState([]);
  const [nearbyGuides, setNearbyGuides] = useState({ spots: [], hotels: [] });
  const [kbOverview, setKbOverview] = useState(null);

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

        const kbList = await fetchKnowledgeBaseLocationsIndex();
        setKbLocations(Array.isArray(kbList) ? kbList : []);

        const overview = await fetchKnowledgeBaseOverview();
        setKbOverview(overview?.overview || null);

        const spotsList = await fetchKnowledgeBaseNearbySpots();
        const hotelsList = await fetchKnowledgeBaseHotels();
        const spots = Array.isArray(spotsList) ? spotsList : [];
        const hotels = Array.isArray(hotelsList) ? hotelsList : [];
        setNearbyGuides({ spots, hotels });

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
        setKbLocations([]);
        setNearbyGuides({ spots: [], hotels: [] });
        setKbOverview(null);
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

  const primaryLake = useMemo(() => {
    return kbOverview?.lake || null;
  }, [kbOverview]);
  const cultureHighlights = useMemo(() => {
    const list = kbOverview?.culture?.highlights;
    return Array.isArray(list) ? list : [];
  }, [kbOverview]);
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
    <ImmersivePage bgImage={heroBgUrl || LUGU_LAKE_BG_URL} className="page-fade-in pt-0 pb-0">
      <div className="flex flex-col h-full mt-10">
        <div className="text-center mb-10 mt-6 z-10 relative px-4 text-shadow-md">
          <div className="inline-block bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full text-white/95 text-xs tracking-widest mb-4 border border-white/20 shadow-lg">
            欢迎来到泸沽湖景区
          </div>
          <h1 className="text-[32px] md:text-4xl font-bold text-white mb-3 tracking-[0.1em] font-serif drop-shadow-md">
            泸沽湖智慧文旅
          </h1>
          <p className="text-white/80 text-sm tracking-widest drop-shadow">
            看风景 · 懂文化 · 走路线
          </p>
        </div>

        <div className="space-y-4 px-4 z-10 relative flex-1">
          <CardComponent variant="immersive" onClick={() => openPanel("overview")} className="cursor-pointer active:scale-95">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white/90 shadow-inner">
                <IconSpark />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-1">景区一览</h3>
                <p className="text-xs text-white/70">发现最美风景，探索摩梭文化</p>
              </div>
              <div className="text-white/40 text-2xl">›</div>
            </div>
          </CardComponent>

          <CardComponent variant="immersive" onClick={() => openPanel("culture")} className="cursor-pointer active:scale-95">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white/90 shadow-inner">
                <IconRoute />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-1">文化导览</h3>
                <p className="text-xs text-white/70">AI智能规划个性路线与解说</p>
              </div>
              <div className="text-white/40 text-2xl">›</div>
            </div>
          </CardComponent>

          <CardComponent variant="immersive" onClick={() => openPanel("global")} className="cursor-pointer active:scale-95">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white/90 shadow-inner">
                <IconGlobe />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-1">全域导览</h3>
                <p className="text-xs text-white/70">查看所有景点周边及指引</p>
              </div>
              <div className="text-white/40 text-2xl">›</div>
            </div>
          </CardComponent>
        </div>
      </div>

      <Popup visible={activePanel === "overview"} onMaskClick={closePanel} bodyStyle={{ minHeight: "75vh", width: "100%", maxWidth: "100%", overflowY: "auto", background: "transparent" }}>
        <div className="backdrop-blur-xl bg-slate-900/80 p-5 min-h-[75vh] rounded-t-3xl border-t border-white/20 home-popup-scrollable">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-white">景区一览</h3>
            <button className="text-white/80 active:text-white" onClick={closePanel}>← 返回</button>
          </div>
          {loading ? (
            <div className="bg-white/10 border border-white/20 rounded-3xl p-5 mb-4 shadow-lg backdrop-blur-md text-center"><DotLoading color="primary" /></div>
          ) : (
            <>
              <Card className="bg-white/10 border border-white/20 rounded-3xl p-5 mb-4 shadow-lg backdrop-blur-md overview-module-card">
                <div className="text-xl font-bold text-white border-b border-white/20 pb-2 mb-3">{kbOverview?.lake?.title || "泸沽湖整体介绍"}</div>
                {primaryLake ? (
                  <>
                    <div className="flex items-center justify-between mt-2">
                      <h3 className="m-0 text-lg text-white/95">{primaryLake.title || "泸沽湖整体介绍"}</h3>
                      <span className="px-2 py-1 text-xs rounded-full bg-white/20 text-white/90">湖区总览</span>
                    </div>
                    <p className="text-sm text-white/80 mt-2 mb-0">
                      {primaryLake.description || ""}
                    </p>
                    {primaryLake.detailPath ? (
                      <Link
                        to={primaryLake.detailPath}
                        state={{ fromPanel: "overview" }}
                        className="block mt-4 text-center text-sky-300 font-medium"
                      >
                        查看泸沽湖整体详情 →
                      </Link>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-white/80 mt-2 mb-0">暂未读取到知识库湖区介绍数据。</p>
                )}
              </Card>

              <Card className="bg-white/10 border border-white/20 rounded-3xl p-5 mb-4 shadow-lg backdrop-blur-md overview-module-card">
                <div className="text-xl font-bold text-white border-b border-white/20 pb-2 mb-3">{kbOverview?.culture?.title || "摩梭文化介绍"}</div>
                <p className="text-sm text-white/80 mt-2 mb-2">
                  {kbOverview?.culture?.description || ""}
                </p>
                <ul className="text-sm text-white/90 mt-0 mb-0 pl-5">
                  {cultureHighlights.map((item, idx) => (
                    <li key={`culture-${idx}`} className="mb-1">{item}</li>
                  ))}
                </ul>
                {kbOverview?.culture?.detailPath ? (
                  <Link
                    to={kbOverview.culture.detailPath}
                    state={{ fromPanel: "overview" }}
                    className="block mt-4 text-center text-sky-300 font-medium"
                  >
                    查看摩梭文化详情 →
                  </Link>
                ) : null}
              </Card>
            </>
          )}

          <Card className="bg-white/10 border border-white/20 rounded-3xl p-5 mb-4 shadow-lg backdrop-blur-md mb-0">
            <div className="text-sm text-white/80">
              {kbOverview?.summary || ""}
            </div>
          </Card>
        </div>
      </Popup>

      <Popup visible={activePanel === "culture"} onMaskClick={closePanel} bodyStyle={{ minHeight: "75vh", width: "100%", maxWidth: "100%", overflowY: "auto", background: "transparent" }}>
        <div className="backdrop-blur-xl bg-slate-900/80 p-5 min-h-[75vh] rounded-t-3xl border-t border-white/20 home-popup-scrollable">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-white">文化导览</h3>
            <button className="text-white/80 active:text-white" onClick={closePanel}>← 返回</button>
          </div>
          <Card className="bg-white/10 border border-white/20 rounded-3xl p-5 mb-4 shadow-lg backdrop-blur-md">
            <div className="text-sm text-white/80 mb-3">示例：我带老人游玩半天，想多了解摩梭文化。</div>
            
            <div className="mb-3">
              <div className="text-xs text-white/50 mb-2">快速选项：</div>
              <div className="flex flex-wrap gap-2">
                <button 
                  type="button"
                  className="px-3 py-1.5 text-xs bg-white/10 text-white/90 rounded-lg border border-white/20 hover:bg-white/20 transition"
                  onClick={() => setTravelNeed("我带老人游玩半天，想多了解摩梭文化")}
                >
                  老人半天
                </button>
                <button 
                  type="button"
                  className="px-3 py-1.5 text-xs bg-white/10 text-white/90 rounded-lg border border-white/20 hover:bg-white/20 transition"
                  onClick={() => setTravelNeed("我和朋友游玩一天，想看遗留的摩梭文化景观")} 
                >
                  朋友一天
                </button>
                <button 
                  type="button"
                  className="px-3 py-1.5 text-xs bg-white/10 text-white/90 rounded-lg border border-white/20 hover:bg-white/20 transition"
                  onClick={() => setTravelNeed("我和家人游玩一天，想深入了解摩梭女性文化")} 
                >
                  家人一天
                </button>
                <button 
                  type="button"
                  className="px-3 py-1.5 text-xs bg-white/10 text-white/90 rounded-lg border border-white/20 hover:bg-white/20 transition"
                  onClick={() => setTravelNeed("我独自游玩半天，想体验最有特色的摩梭风情")}
                >
                  独自半天
                </button>
              </div>
            </div>
            
            <GlassInput
              wrapperClassName="mt-2"
              value={travelNeed}
              onChange={setTravelNeed}
              placeholder="输入自定义游览需求"
              clearable
            />
            <ButtonComponent variant="primary" className="mt-4 w-full shadow-lg" loading={routeLoading} onClick={createCulturePlan}>
              生成导览路线
            </ButtonComponent>
            <div className="text-xs text-white/50 mt-2">路线来自真实 AI 接口，失败会直接报错，不做虚拟回退。</div>
          </Card>

          <Card className="bg-white/10 border border-white/20 rounded-3xl p-5 mb-4 shadow-lg backdrop-blur-md">
            <div className="font-semibold text-white/95">语音导览资源</div>
            {locationsWithAudio.length === 0 ? (
              <div className="text-sm text-white/50 mt-2">当前景点暂无 audio_url 数据。</div>
            ) : (
              locationsWithAudio.map((item) => (
                <div key={`audio-${item.id}`} className="mt-2">
                  <div className="text-sm font-medium text-white/90">{item.name}</div>
                  <audio controls src={buildAssetUrl(item.audio_url)} className="w-full mt-1" />
                </div>
              ))
            )}
          </Card>

          {routePlan.timeline.length > 0 && (
            <Card className="bg-white/10 border border-white/20 rounded-3xl p-5 mb-4 shadow-lg backdrop-blur-md mb-0">
              <h3 className="m-0 text-white/95">{routePlan.title}</h3>
              <div className="mt-3 space-y-3">
                {routePlan.timeline.map((item, idx) => (
                  <div key={`${item.time}-${item.location}-${idx}`} className="timeline-item" style={{ animationDelay: `${idx * 90}ms` }}>
                    <div className="text-xs text-white/95">{item.time}</div>
                    <div className="font-medium text-base text-white">{item.location}</div>
                    <div className="text-sm text-white/80">停留约 {item.stay_minutes} 分钟</div>
                    {item.highlight && <div className="text-xs text-white/50 mt-1">{item.highlight}</div>}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </Popup>

      <Popup visible={activePanel === "global"} onMaskClick={closePanel} bodyStyle={{ minHeight: "75vh", width: "100%", maxWidth: "100%", overflowY: "auto", background: "transparent" }}>
        <div className="backdrop-blur-xl bg-slate-900/80 p-5 min-h-[75vh] rounded-t-3xl border-t border-white/20 home-popup-scrollable">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-white">全域导览</h3>
            <button className="text-white/80 active:text-white" onClick={closePanel}>← 返回</button>
          </div>
          <Card className="bg-white/10 border border-white/20 rounded-3xl p-5 mb-4 shadow-lg backdrop-blur-md global-section-card">
            <div className="text-xl font-bold text-white border-b border-white/20 pb-2 mb-3">景点总览（知识库全量）</div>
            {kbLocations.length === 0 ? (
              <div className="text-sm text-white/50 mt-2">暂未读取到知识库景点，已保留数据库数据作为回退。</div>
            ) : (
              <div className="space-y-2 mt-2">
                {kbLocations.map((item) => (
                  <Link
                    to={item.id ? `/locations/${item.id}` : "/home"}
                    state={{ fromPanel: "global" }}
                    key={`kb-${item.slug || item.id}`}
                    className="block bg-white/10 border border-white/20 rounded-3xl p-5 mb-4 shadow-lg backdrop-blur-md list-card no-underline text-current"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-white/95">{item.name}</div>
                      <span className="px-2 py-1 text-xs rounded-full bg-white/20 text-white/90">{item.category || "景点"}</span>
                    </div>
                    <div className="text-sm text-white/80 mt-1">{item.description || "暂无简介"}</div>
                    {item.latitude && item.longitude ? (
                      <div className="text-xs text-white/50 mt-1">坐标：{item.latitude}, {item.longitude}</div>
                    ) : null}
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card className="bg-white/10 border border-white/20 rounded-3xl p-5 mb-4 shadow-lg backdrop-blur-md global-section-card">
            <div className="text-xl font-bold text-white border-b border-white/20 pb-2 mb-3">周围景点 / 酒店</div>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div>
                <div className="text-sm font-semibold text-white/90 mb-2">周边景点</div>
                {nearbyGuides.spots.length === 0 ? (
                  <div className="text-sm text-white/50 mt-1">暂无配置，可在 knowledge-base/nearby-spots/index.json 中添加景点。</div>
                ) : (
                  nearbyGuides.spots.map((item, idx) => (
                    <div key={`spot-${idx}`} className="bg-white/5 border border-white/10 rounded-xl p-3 mb-2">
                      <div className="font-medium text-white/90">{item.name || `周边景点 ${idx + 1}`}</div>
                      {item.distance ? <div className="text-xs text-white/50">距离：{item.distance}</div> : null}
                      {item.description ? <div className="text-xs text-white/50 mt-1">{item.description}</div> : null}
                    </div>
                  ))
                )}
              </div>

              <div>
                <div className="text-sm font-semibold text-white/90 mb-2">周边酒店</div>
                {nearbyGuides.hotels.length === 0 ? (
                  <div className="text-sm text-white/50 mt-1">暂无配置，可在 knowledge-base/hotels/index.json 中添加酒店。</div>
                ) : (
                  nearbyGuides.hotels.map((item, idx) => (
                    <div key={`hotel-${idx}`} className="bg-white/5 border border-white/10 rounded-xl p-3 mb-2">
                      <div className="font-medium text-white/90">{item.name || `周边酒店 ${idx + 1}`}</div>
                      {item.price ? <div className="text-xs text-white/50">参考价格：{item.price}</div> : null}
                      {item.description ? <div className="text-xs text-white/50 mt-1">{item.description}</div> : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>

          {kbLocations.length === 0 && locations.length > 0 ? (
            <Card className="bg-white/10 border border-white/20 rounded-3xl p-5 mb-4 shadow-lg backdrop-blur-md mb-0">
              <div className="text-sm font-semibold text-white/90 mb-2">数据库回退景点</div>
              <div className="space-y-2 mt-2">
                {locations.map((item) => (
                  <Link
                    to={`/locations/${item.id}`}
                    state={{ fromPanel: "global" }}
                    key={`db-${item.id}`}
                    className="block bg-white/10 border border-white/20 rounded-3xl p-5 mb-4 shadow-lg backdrop-blur-md list-card no-underline text-current"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-white/95">{item.name}</div>
                      <span className="px-2 py-1 text-xs rounded-full bg-white/20 text-white/90">{item.category}</span>
                    </div>
                    <div className="text-sm text-white/80 mt-1">{item.description}</div>
                  </Link>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      </Popup>
    </ImmersivePage>
  );
}
