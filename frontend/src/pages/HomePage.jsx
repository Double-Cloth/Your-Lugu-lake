import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Card, DotLoading, Popup, Toast } from "antd-mobile";
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
import { clearUserSession, withUserSessionPath } from "../auth";

const LUGU_LAKE_BG_URL = "/images/lugu-hero.png";

const CULTURE_DURATION_OPTIONS = [
  { label: "半天", value: "half-day" },
  { label: "一天", value: "one-day" },
];

const CULTURE_GROUP_OPTIONS = [
  { label: "独行", value: "solo" },
  { label: "朋友", value: "friends" },
  { label: "亲子", value: "family" },
  { label: "情侣", value: "couple" },
];

const CULTURE_FOCUS_OPTIONS = [
  { label: "礼俗讲解", value: "culture" },
  { label: "景观+文化", value: "mixed" },
  { label: "轻松体验", value: "light" },
];

const CULTURE_PACE_OPTIONS = [
  { label: "松弛", value: "relaxed" },
  { label: "平衡", value: "balanced" },
  { label: "高效", value: "intense" },
];

const CULTURE_TEMPLATES = [
  {
    id: "elder-halfday",
    title: "老人半天",
    hint: "舒缓节奏，重体验轻奔波",
    need: "我带老人游玩半天，想多了解摩梭文化与核心礼俗。",
    duration: "half-day",
    groupType: "family",
    preference: "culture",
    pace: "relaxed",
  },
  {
    id: "friends-oneday",
    title: "朋友一天",
    hint: "拍照与体验并重",
    need: "我和朋友游玩一天，希望看人文景观并体验当地文化活动。",
    duration: "one-day",
    groupType: "friends",
    preference: "mixed",
    pace: "balanced",
  },
  {
    id: "solo-halfday",
    title: "独行沉浸",
    hint: "深度讲解，节奏紧凑",
    need: "我独自游玩半天，想高密度了解摩梭文化脉络并打卡重点点位。",
    duration: "half-day",
    groupType: "solo",
    preference: "culture",
    pace: "intense",
  },
];

function IconSpark() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6 text-white drop-shadow-md" aria-hidden="true">
      <path d="M12 2l2.2 5.2L19 9.4l-4.8 2.2L12 17l-2.2-5.4L5 9.4l4.8-2.2L12 2z" fill="currentColor" />
    </svg>
  );
}

function IconRoute() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6 text-white drop-shadow-md" aria-hidden="true">
      <path d="M6 4a2 2 0 100 4 2 2 0 000-4zm12 12a2 2 0 100 4 2 2 0 000-4z" fill="currentColor" />
      <path d="M7.8 6h4.9c2.6 0 4.3 1.6 4.3 3.8 0 2.1-1.5 3.3-3.8 3.3H9.6c-1.2 0-1.9.5-1.9 1.3S8.4 16 9.5 16H16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6 text-white drop-shadow-md" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 12h18M12 3c2.8 2.6 2.8 15.4 0 18M12 3c-2.8 2.6-2.8 15.4 0 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function resolveOptionLabel(options, value, fallback) {
  return options.find((item) => item.value === value)?.label || fallback;
}

function pickAllowedValue(options, value, fallback) {
  return options.some((item) => item.value === value) ? value : fallback;
}

function buildNeedFromDraft(draft) {
  const durationText = resolveOptionLabel(CULTURE_DURATION_OPTIONS, draft.duration, "一天");
  const groupText = resolveOptionLabel(CULTURE_GROUP_OPTIONS, draft.groupType, "朋友");
  const focusText = resolveOptionLabel(CULTURE_FOCUS_OPTIONS, draft.preference, "礼俗讲解");
  const paceText = resolveOptionLabel(CULTURE_PACE_OPTIONS, draft.pace, "平衡");
  return `我计划${durationText}出游，同行人群是${groupText}，希望以${focusText}为主，节奏偏${paceText}。`;
}

export default function HomePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePanel, setActivePanel] = useState("");
  const [travelNeed, setTravelNeed] = useState("");
  const [routeLoading, setRouteLoading] = useState(false);
  const [routePlan, setRoutePlan] = useState({
    title: "",
    timeline: [],
    routeId: null,
    generatedAt: "",
    requirement: "",
  });
  const [cultureDraft, setCultureDraft] = useState({
    duration: "one-day",
    groupType: "friends",
    preference: "culture",
    pace: "balanced",
  });
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [coverPhotoUrl, setCoverPhotoUrl] = useState("");
  const [heroBgUrl, setHeroBgUrl] = useState("");
  const [kbLocations, setKbLocations] = useState([]);
  const [nearbyGuides, setNearbyGuides] = useState({ spots: [], hotels: [] });
  const [kbOverview, setKbOverview] = useState(null);

  useEffect(() => {
    const panelFromState = location.state?.openPanel;
    const cultureSeedFromState = location.state?.cultureSeed;
    const panelFromQuery = new URLSearchParams(location.search).get("openPanel");
    const validPanels = new Set(["overview", "global", "culture"]);

    const panel = validPanels.has(panelFromState)
      ? panelFromState
      : (validPanels.has(panelFromQuery) ? panelFromQuery : "");

    if (!panel) {
      return;
    }

    if (panel === "culture" && cultureSeedFromState && typeof cultureSeedFromState === "object") {
      const route = cultureSeedFromState.route && typeof cultureSeedFromState.route === "object"
        ? cultureSeedFromState.route
        : {};
      const profile = route.travel_profile && typeof route.travel_profile === "object"
        ? route.travel_profile
        : {};
      const templateId = typeof route?.inspiration_template?.id === "string"
        ? route.inspiration_template.id
        : "";

      setCultureDraft({
        duration: pickAllowedValue(CULTURE_DURATION_OPTIONS, profile.duration, "one-day"),
        groupType: pickAllowedValue(CULTURE_GROUP_OPTIONS, profile.group_type, "friends"),
        preference: pickAllowedValue(CULTURE_FOCUS_OPTIONS, profile.preference, "culture"),
        pace: pickAllowedValue(CULTURE_PACE_OPTIONS, profile.pace, "balanced"),
      });
      setTravelNeed(typeof route.custom_need === "string" ? route.custom_need : "");
      setSelectedTemplateId(
        CULTURE_TEMPLATES.some((item) => item.id === templateId) ? templateId : ""
      );
      setRoutePlan({
        title: route.title || "AI 文化导览路线",
        timeline: Array.isArray(route.timeline) ? route.timeline : [],
        routeId: Number.isFinite(Number(cultureSeedFromState.route_id))
          ? Number(cultureSeedFromState.route_id)
          : null,
        generatedAt: route.generated_at || (cultureSeedFromState.created_at || ""),
        requirement: typeof route.requirement === "string" ? route.requirement : "",
      });
      Toast.show({ content: "已载入历史路线画像，可继续优化" });
    }

    setActivePanel(panel);

    if (validPanels.has(panelFromState)) {
      navigate(location.pathname, { replace: true, state: null });
      return;
    }

    if (validPanels.has(panelFromQuery)) {
      navigate(location.pathname, { replace: true });
    }
  }, [location.pathname, location.search, location.state, navigate]);

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

        try {
          const userToken = getUserToken();
          if (!userToken) {
            setCoverPhotoUrl("");
          } else {
            const footprints = await fetchMyFootprints(userToken);
            const firstWithPhoto = Array.isArray(footprints)
              ? footprints.find((item) => item.photo_url)
              : null;
            setCoverPhotoUrl(firstWithPhoto?.photo_url ? buildAssetUrl(firstWithPhoto.photo_url) : "");
          }
        } catch (error) {
          if (error?.response?.status === 401) {
            clearUserSession();
          }
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

  function updateCultureDraft(field, value) {
    setCultureDraft((prev) => {
      const nextDraft = { ...prev, [field]: value };
      setTravelNeed(buildNeedFromDraft(nextDraft));
      return nextDraft;
    });
    setSelectedTemplateId("");
  }

  function applyCultureTemplate(template) {
    setSelectedTemplateId(template.id);
    setTravelNeed(template.need);
    setCultureDraft({
      duration: template.duration,
      groupType: template.groupType,
      preference: template.preference,
      pace: template.pace,
    });
  }

  function buildRequirementText() {
    const currentTemplate = CULTURE_TEMPLATES.find((item) => item.id === selectedTemplateId) || null;
    const durationText = resolveOptionLabel(CULTURE_DURATION_OPTIONS, cultureDraft.duration, "一天");
    const groupText = resolveOptionLabel(CULTURE_GROUP_OPTIONS, cultureDraft.groupType, "朋友");
    const focusText = resolveOptionLabel(CULTURE_FOCUS_OPTIONS, cultureDraft.preference, "礼俗讲解");
    const paceText = resolveOptionLabel(CULTURE_PACE_OPTIONS, cultureDraft.pace, "平衡");

    const manual = travelNeed.trim();
    const profileSummary = `出行画像：${durationText}，${groupText}同行，内容重心${focusText}，节奏${paceText}。`;
    const templateSummary = currentTemplate
      ? `灵感模板：${currentTemplate.title}（${currentTemplate.hint}）。`
      : "";
    const manualSummary = manual ? `个性诉求：${manual}` : "";

    return [templateSummary, profileSummary, manualSummary].filter(Boolean).join(" ");
  }

  function handleTravelNeedChange(value) {
    setTravelNeed(value);
  }

  function buildRoutePayload() {
    const requirementText = buildRequirementText();
    const currentTemplate = CULTURE_TEMPLATES.find((item) => item.id === selectedTemplateId) || null;
    return {
      requirementText,
      payload: {
        duration: cultureDraft.duration,
        preference: cultureDraft.preference,
        group_type: cultureDraft.groupType,
        custom_need: travelNeed.trim() || null,
        pace: cultureDraft.pace,
        template_id: currentTemplate?.id || null,
        template_title: currentTemplate?.title || null,
        requirement_text: requirementText,
      },
    };
  }

  async function createCulturePlan() {
    const { requirementText, payload } = buildRoutePayload();

    setRouteLoading(true);
    try {
      const result = await generateRoute(
        payload,
        getUserToken() || "cookie-session"
      );

      const timeline = Array.isArray(result.route?.timeline) ? result.route.timeline : [];
      setRoutePlan({
        title: result.route?.title || "AI 文化导览路线",
        timeline,
        routeId: Number.isFinite(Number(result.route_id)) ? Number(result.route_id) : null,
        generatedAt: result.route?.generated_at || new Date().toISOString(),
        requirement: result.route?.requirement || requirementText,
      });
      if (timeline.length === 0) {
        Toast.show({ content: "接口返回为空，请稍后重试" });
      } else if (result.saved) {
        Toast.show({ content: "路线已保存到“我的”界面" });
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        Toast.show({ content: "请先在“我的”页面登录游客账号" });
        return;
      }
      const detail = error?.response?.data?.detail;
      Toast.show({ content: detail || "路线生成失败" });
    } finally {
      setRouteLoading(false);
    }
  }

  return (
    <ImmersivePage bgImage={heroBgUrl || LUGU_LAKE_BG_URL} className="page-fade-in pt-0 pb-0 flex-1">
      <div className="flex-1 flex flex-col justify-center items-center h-full w-full px-4" style={{ marginTop: "-40px" }}>
        <div className="w-full max-w-xl text-center mb-6 z-10 relative text-shadow-md">
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

        <div className="w-full max-w-xl space-y-4 pb-4 z-10 relative">
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
                <p className="text-xs text-white/70">景点/交通/餐饮/住宿规划</p>
              </div>
              <div className="text-white/40 text-2xl">›</div>
            </div>
          </CardComponent>
        </div>
      </div>

      <Popup visible={activePanel === "overview"} onMaskClick={closePanel} bodyStyle={{ minHeight: "75vh", width: "100%", maxWidth: "100%", overflowY: "auto", background: "transparent" }}>
        <div className="app-glass-popup p-5 min-h-[75vh] home-popup-scrollable">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-white tracking-wide">景区一览</h3>
            <button className="text-[rgba(189,232,250,0.8)] active:text-white px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm backdrop-blur-sm transition-all shadow-sm" onClick={closePanel}>← 返回</button>
          </div>
          {loading ? (
            <div className="bg-white/10 border border-white/20 rounded-3xl p-5 mb-4 shadow-lg backdrop-blur-md text-center"><DotLoading color="primary" /></div>
          ) : (
            <>
              <Card className="bg-white/10 border border-[rgba(189,232,250,0.2)] rounded-3xl p-5 mb-4 shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-md overview-module-card">
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

              <Card className="bg-white/10 border border-[rgba(189,232,250,0.2)] rounded-3xl p-5 mb-4 shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-md overview-module-card">
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
        <div className="app-glass-popup p-5 min-h-[75vh] home-popup-scrollable">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-white tracking-wide">文化导览</h3>
            <button className="text-[rgba(189,232,250,0.8)] active:text-white px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm backdrop-blur-sm transition-all shadow-sm" onClick={closePanel}>← 返回</button>
          </div>
          <Card className="bg-white/10 border border-[rgba(189,232,250,0.2)] rounded-3xl p-5 mb-4 shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-md">
            <div className="text-sm text-white/90 leading-relaxed">
              这版文化导览会先建立你的出行画像，再生成可执行的摩梭文化路线。生成后会直接保存到“我的路线”。
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="px-2.5 py-1 text-xs rounded-full bg-cyan-400/20 border border-cyan-300/30 text-cyan-100">画像驱动生成</span>
              <span className="px-2.5 py-1 text-xs rounded-full bg-amber-300/20 border border-amber-200/30 text-amber-100">自动保存到我的</span>
            </div>
          </Card>

          <Card className="bg-white/10 border border-white/20 rounded-3xl p-5 mb-4 shadow-lg backdrop-blur-md">
            <div className="text-sm font-semibold text-white/95">灵感模板</div>
            <div className="grid grid-cols-1 gap-2 mt-3">
              {CULTURE_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className={`text-left rounded-xl border px-3 py-2 transition ${selectedTemplateId === template.id ? "bg-cyan-300/25 border-cyan-200/40" : "bg-white/5 border-white/20 hover:bg-white/15"}`}
                  onClick={() => applyCultureTemplate(template)}
                >
                  <div className="text-sm font-semibold text-white">{template.title}</div>
                  <div className="text-xs text-white/65 mt-0.5">{template.hint}</div>
                </button>
              ))}
            </div>
            {selectedTemplateId ? (
              <div className="text-xs text-cyan-100/80 mt-3">
                已将灵感模板同步到出行画像，你仍可继续微调画像选项。
              </div>
            ) : null}
          </Card>

          <Card className="bg-white/10 border border-white/20 rounded-3xl p-5 mb-4 shadow-lg backdrop-blur-md">
            <div className="text-sm font-semibold text-white/95">出行画像</div>

            <div className="mt-3">
              <div className="text-xs text-white/60 mb-2">游玩时长</div>
              <div className="flex flex-wrap gap-2">
                {CULTURE_DURATION_OPTIONS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={`px-3 py-1.5 text-xs rounded-lg border transition ${cultureDraft.duration === item.value ? "bg-cyan-300/25 border-cyan-200/40 text-white" : "bg-white/5 border-white/20 text-white/85 hover:bg-white/15"}`}
                    onClick={() => updateCultureDraft("duration", item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <div className="text-xs text-white/60 mb-2">同行人群</div>
              <div className="flex flex-wrap gap-2">
                {CULTURE_GROUP_OPTIONS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={`px-3 py-1.5 text-xs rounded-lg border transition ${cultureDraft.groupType === item.value ? "bg-cyan-300/25 border-cyan-200/40 text-white" : "bg-white/5 border-white/20 text-white/85 hover:bg-white/15"}`}
                    onClick={() => updateCultureDraft("groupType", item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <div className="text-xs text-white/60 mb-2">内容重心</div>
              <div className="flex flex-wrap gap-2">
                {CULTURE_FOCUS_OPTIONS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={`px-3 py-1.5 text-xs rounded-lg border transition ${cultureDraft.preference === item.value ? "bg-cyan-300/25 border-cyan-200/40 text-white" : "bg-white/5 border-white/20 text-white/85 hover:bg-white/15"}`}
                    onClick={() => updateCultureDraft("preference", item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <div className="text-xs text-white/60 mb-2">节奏偏好</div>
              <div className="flex flex-wrap gap-2">
                {CULTURE_PACE_OPTIONS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={`px-3 py-1.5 text-xs rounded-lg border transition ${cultureDraft.pace === item.value ? "bg-cyan-300/25 border-cyan-200/40 text-white" : "bg-white/5 border-white/20 text-white/85 hover:bg-white/15"}`}
                    onClick={() => updateCultureDraft("pace", item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <GlassInput
              wrapperClassName="mt-4"
              value={travelNeed}
              onChange={handleTravelNeedChange}
              placeholder="补充你的个性诉求（可选）"
              clearable
            />
            <div className="text-xs text-white/55 mt-2">示例：想多听母系家庭故事，避开高强度步行。</div>

            <ButtonComponent variant="primary" className="mt-4 w-full shadow-lg" loading={routeLoading} onClick={createCulturePlan}>
              生成文化路线
            </ButtonComponent>
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
              <div className="flex items-start justify-between gap-3">
                <h3 className="m-0 text-white/95">{routePlan.title}</h3>
                {routePlan.routeId ? (
                  <span className="shrink-0 px-2 py-1 rounded-full text-xs bg-emerald-300/25 border border-emerald-200/30 text-emerald-100">
                    已保存 #{routePlan.routeId}
                  </span>
                ) : null}
              </div>
              {routePlan.generatedAt ? (
                <div className="text-xs text-white/55 mt-1">生成时间：{new Date(routePlan.generatedAt).toLocaleString()}</div>
              ) : null}
              {routePlan.requirement ? (
                <div className="text-xs text-white/70 mt-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                  需求摘要：{routePlan.requirement}
                </div>
              ) : null}
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

              <div className="grid grid-cols-2 gap-3 mt-4">
                <ButtonComponent
                  variant="secondary"
                  className="w-full"
                  onClick={() => navigate(withUserSessionPath("/me"))}
                >
                  去我的查看
                </ButtonComponent>
                <ButtonComponent
                  variant="primary"
                  className="w-full"
                  onClick={createCulturePlan}
                  loading={routeLoading}
                >
                  再生成一版
                </ButtonComponent>
              </div>
            </Card>
          )}
        </div>
      </Popup>

      <Popup visible={activePanel === "global"} onMaskClick={closePanel} bodyStyle={{ minHeight: "75vh", width: "100%", maxWidth: "100%", overflowY: "auto", background: "transparent" }}>
        <div className="app-glass-popup p-5 min-h-[75vh] home-popup-scrollable">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-white tracking-wide">全域导览</h3>
            <button className="text-[rgba(189,232,250,0.8)] active:text-white px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm backdrop-blur-sm transition-all shadow-sm" onClick={closePanel}>← 返回</button>
          </div>
          <Card className="bg-white/10 border border-[rgba(189,232,250,0.2)] rounded-3xl p-5 mb-4 shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-md global-section-card">
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

          <Card className="bg-white/10 border border-[rgba(189,232,250,0.2)] rounded-3xl p-5 mb-4 shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-md global-section-card">
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
