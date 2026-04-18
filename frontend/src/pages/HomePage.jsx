import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Card, DotLoading, Popup, Toast } from "antd-mobile";
import { ImmersivePage, CardComponent, ButtonComponent, ReadingGlassCard, GlassInput } from "../components/SharedUI";

import {
  buildAssetUrl,
  fetchKnowledgeBaseCommonModule,
  fetchKnowledgeBaseCommonPage,
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
const LUGU_LAKE_WEATHER_POINT = {
  latitude: 27.6931,
  longitude: 100.7883,
  name: "泸沽湖",
};

const WEATHER_CODE_LABELS = {
  0: "晴朗",
  1: "大部晴朗",
  2: "局部多云",
  3: "多云",
  45: "有雾",
  48: "冻雾",
  51: "小毛毛雨",
  53: "中毛毛雨",
  55: "大毛毛雨",
  61: "小雨",
  63: "中雨",
  65: "大雨",
  71: "小雪",
  73: "中雪",
  75: "大雪",
  80: "阵雨",
  81: "较强阵雨",
  82: "强阵雨",
  95: "雷暴",
};

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

function resolveWeatherLabel(code) {
  const numericCode = Number(code);
  return WEATHER_CODE_LABELS[numericCode] || "天气更新中";
}

function formatTemperature(value) {
  return Number.isFinite(value) ? `${Math.round(value)}℃` : "--";
}

function openExternalLink(url, fallbackMessage) {
  const targetUrl = typeof url === "string" ? url.trim() : "";
  if (!targetUrl) {
    Toast.show({ content: fallbackMessage });
    return;
  }

  window.open(targetUrl, "_blank", "noopener,noreferrer");
}

export default function HomePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePanel, setActivePanel] = useState("");
  const [travelNeed, setTravelNeed] = useState("");
  const [routeLoading, setRouteLoading] = useState(false);
  const [myFootprints, setMyFootprints] = useState([]);
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
  const [kbLocations, setKbLocations] = useState([]);
  const [nearbyGuides, setNearbyGuides] = useState({ spots: [], hotels: [] });
  const [kbOverview, setKbOverview] = useState(null);
  const [kbEcoGuide, setKbEcoGuide] = useState(null);
  const [weatherInfo, setWeatherInfo] = useState({
    loading: true,
    temperature: null,
    condition: "",
    windSpeed: null,
    high: null,
    low: null,
    updatedAt: "",
    note: "",
  });

  useEffect(() => {
    const panelFromState = location.state?.openPanel;
    const cultureSeedFromState = location.state?.cultureSeed;
    const panelFromQuery = new URLSearchParams(location.search).get("openPanel");
    const validPanels = new Set(["overview", "global", "culture", "eco"]);

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

        const ecoGuide = await fetchKnowledgeBaseCommonPage("eco-guide");
        if (ecoGuide?.moduleFiles && typeof ecoGuide.moduleFiles === "object") {
          const {
            science,
            rareFauna,
            rareFlora,
            ecosystemBenefits,
            wellnessRoute,
            observationTips,
          } = ecoGuide.moduleFiles;

          const [scienceData, faunaData, floraData, benefitsData, routeData, tipsData] = await Promise.all([
            fetchKnowledgeBaseCommonModule(science),
            fetchKnowledgeBaseCommonModule(rareFauna),
            fetchKnowledgeBaseCommonModule(rareFlora),
            fetchKnowledgeBaseCommonModule(ecosystemBenefits),
            fetchKnowledgeBaseCommonModule(wellnessRoute),
            fetchKnowledgeBaseCommonModule(observationTips),
          ]);

          setKbEcoGuide({
            ...ecoGuide,
            details: {
              introduction: scienceData?.introduction || "",
              rareFauna: Array.isArray(faunaData?.items) ? faunaData.items : [],
              rareFlora: Array.isArray(floraData?.items) ? floraData.items : [],
              ecosystemBenefits: {
                environment: Array.isArray(benefitsData?.environment) ? benefitsData.environment : [],
                human: Array.isArray(benefitsData?.human) ? benefitsData.human : [],
              },
              wellnessRoute: Array.isArray(routeData?.items) ? routeData.items : [],
              routeNote: typeof routeData?.routeNote === "string" ? routeData.routeNote : "",
              observationTips: Array.isArray(tipsData?.items) ? tipsData.items : [],
            },
          });
        } else {
          setKbEcoGuide(ecoGuide || null);
        }

        const spotsList = await fetchKnowledgeBaseNearbySpots();
        const hotelsList = await fetchKnowledgeBaseHotels();
        const spots = Array.isArray(spotsList) ? spotsList : [];
        const hotels = Array.isArray(hotelsList) ? hotelsList : [];
        setNearbyGuides({ spots, hotels });

        try {
          const userToken = getUserToken();
          if (!userToken) {
            setMyFootprints([]);
          } else {
            const footprints = await fetchMyFootprints(userToken);
            setMyFootprints(Array.isArray(footprints) ? footprints : []);
          }
        } catch (error) {
          if (error?.response?.status === 401) {
            clearUserSession();
          }
          setMyFootprints([]);
        }
      } catch {
        setLocations([]);
        setKbLocations([]);
        setNearbyGuides({ spots: [], hotels: [] });
        setKbOverview(null);
        setKbEcoGuide(null);
        setMyFootprints([]);
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadWeather() {
      setWeatherInfo((prev) => ({ ...prev, loading: true }));

      try {
        const params = new URLSearchParams({
          latitude: String(LUGU_LAKE_WEATHER_POINT.latitude),
          longitude: String(LUGU_LAKE_WEATHER_POINT.longitude),
          current: "temperature_2m,weather_code,wind_speed_10m",
          daily: "temperature_2m_max,temperature_2m_min",
          timezone: "Asia/Shanghai",
          forecast_days: "1",
        });

        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("weather request failed");
        }

        const data = await response.json();
        const current = data?.current || {};
        const daily = data?.daily || {};
        const maxTemperature = Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max[0] : null;
        const minTemperature = Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min[0] : null;

        setWeatherInfo({
          loading: false,
          temperature: Number.isFinite(current.temperature_2m) ? current.temperature_2m : null,
          condition: resolveWeatherLabel(current.weather_code),
          windSpeed: Number.isFinite(current.wind_speed_10m) ? current.wind_speed_10m : null,
          high: Number.isFinite(maxTemperature) ? maxTemperature : null,
          low: Number.isFinite(minTemperature) ? minTemperature : null,
          updatedAt: current.time || "",
          note: "湖区昼夜温差通常较明显，建议随身带一件薄外套。",
        });
      } catch (error) {
        if (error?.name === "AbortError") {
          return;
        }

        setWeatherInfo({
          loading: false,
          temperature: null,
          condition: "天气暂不可用",
          windSpeed: null,
          high: null,
          low: null,
          updatedAt: "",
          note: "建议以手机天气 App 的实时数据为准。",
        });
      }
    }

    void loadWeather();

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    return undefined;
  }, []);

  const primaryLake = useMemo(() => {
    return kbOverview?.lake || null;
  }, [kbOverview]);
  const cultureHighlights = useMemo(() => {
    const list = kbOverview?.culture?.highlights;
    return Array.isArray(list) ? list : [];
  }, [kbOverview]);
  const ecoIntro = useMemo(() => {
    return kbEcoGuide?.details?.introduction || kbEcoGuide?.description || "暂无生态导览内容，请在 knowledge-base/common/pages/eco-guide.json 中配置。";
  }, [kbEcoGuide]);
  const ecoFauna = useMemo(() => {
    const list = kbEcoGuide?.details?.rareFauna;
    return Array.isArray(list) ? list : [];
  }, [kbEcoGuide]);
  const ecoFlora = useMemo(() => {
    const list = kbEcoGuide?.details?.rareFlora;
    return Array.isArray(list) ? list : [];
  }, [kbEcoGuide]);
  const ecoBenefitsEnv = useMemo(() => {
    const list = kbEcoGuide?.details?.ecosystemBenefits?.environment;
    return Array.isArray(list) ? list : [];
  }, [kbEcoGuide]);
  const ecoBenefitsHuman = useMemo(() => {
    const list = kbEcoGuide?.details?.ecosystemBenefits?.human;
    return Array.isArray(list) ? list : [];
  }, [kbEcoGuide]);
  const ecoRoute = useMemo(() => {
    const list = kbEcoGuide?.details?.wellnessRoute;
    return Array.isArray(list) ? list : [];
  }, [kbEcoGuide]);
  const ecoTips = useMemo(() => {
    const list = kbEcoGuide?.details?.observationTips;
    return Array.isArray(list) ? list : [];
  }, [kbEcoGuide]);
  const ecoLocations = useMemo(() => {
    return kbLocations.filter((item) => {
      const text = `${item.name || ""} ${item.category || ""} ${item.description || ""}`;
      return /自然|生态|湿地|湖|山|观鸟|森林|nature|wetland/i.test(text);
    });
  }, [kbLocations]);
  const footprintSummary = useMemo(() => {
    const total = myFootprints.length;
    const withPhoto = myFootprints.filter((item) => item.photo_url).length;
    const locationCount = new Set(myFootprints.map((item) => item.location_id).filter(Boolean)).size;
    return { total, withPhoto, locationCount };
  }, [myFootprints]);
  const locationsWithAudio = useMemo(
    () => locations.filter((item) => item.audio_url),
    [locations]
  );
  const officialServiceLinks = useMemo(() => {
    return {
      ticket: kbOverview?.ticketing || {},
      shop: kbOverview?.shop || {},
      weather: { url: "https://m.baidu.com/s?word=泸沽湖风景区天气预报" } // 适配移动端和PC端的普适版
    };
  }, [kbOverview]);

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
    <ImmersivePage bgImage={LUGU_LAKE_BG_URL} className="page-fade-in pt-0 pb-0 flex-1 flex flex-col relative w-full">
      {/* 顶部紧凑栏：天气与外部服务 */}
      <div className="w-full pt-4 sm:pt-6 z-20 flex justify-center shrink-0">
        <div className="w-full max-w-xl flex flex-wrap justify-between items-center gap-y-3">
          <div className="group flex items-center gap-2.5 px-1.5 py-1.5 pr-4 rounded-full bg-black/20 backdrop-blur-md border border-white/20 shadow-[0_4px_24px_rgba(0,0,0,0.15)] hover:bg-black/30 transition-all cursor-pointer"
               onClick={() => openExternalLink(officialServiceLinks.weather?.url, "查看完整天气预报")}>
            {weatherInfo.loading ? (
              <span className="text-[11px] text-white/90 px-3 py-1 flex items-center gap-1">
                <DotLoading color="white" />
              </span>
            ) : (
              <>
                <div className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-400/80 to-sky-500/80 shadow-inner group-hover:scale-105 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white drop-shadow-sm">
                    <circle cx="12" cy="12" r="4"/>
                    <path d="M12 2v2"/>
                    <path d="M12 20v2"/>
                    <path d="m4.93 4.93 1.41 1.41"/>
                    <path d="m17.66 17.66 1.41 1.41"/>
                    <path d="M2 12h2"/>
                    <path d="M20 12h2"/>
                    <path d="m6.34 17.66-1.41 1.41"/>
                    <path d="m19.07 4.93-1.41 1.41"/>
                  </svg>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-sm font-extrabold text-white tracking-wide drop-shadow-sm">
                      {formatTemperature(weatherInfo.temperature)}
                    </span>
                  </div>
                  <span className="text-[10px] text-white/90 leading-none tracking-wide drop-shadow-sm">
                    {weatherInfo.condition} 泸沽湖
                  </span>
                </div>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              type="button" 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/20 backdrop-blur-md border border-white/20 shadow-[0_4px_24px_rgba(0,0,0,0.15)] hover:bg-black/30 transition-all active:scale-95 group"
              onClick={() => {
                openExternalLink(
                  officialServiceLinks.ticket?.url,
                  officialServiceLinks.ticket?.hint || "开发中"
                );
              }}
            >
              <div className="w-6 h-6 flex items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-red-500 shadow-inner group-hover:scale-105 transition-transform text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-sm">
                  <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"></path>
                  <path d="M13 5v2"></path>
                  <path d="M13 17v2"></path>
                  <path d="M13 11v2"></path>
                </svg>
              </div>
              <span className="text-xs font-bold text-white tracking-wider pr-1 drop-shadow-sm">购票</span>
            </button>
            <button 
              type="button" 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/20 backdrop-blur-md border border-white/20 shadow-[0_4px_24px_rgba(0,0,0,0.15)] hover:bg-black/30 transition-all active:scale-95 group"
              onClick={() => {
                openExternalLink(
                  officialServiceLinks.shop?.url,
                  officialServiceLinks.shop?.hint || "开发中"
                );
              }}
            >
              <div className="w-6 h-6 flex items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 shadow-inner group-hover:scale-105 transition-transform text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-sm">
                  <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path>
                  <path d="M3 6h18"></path>
                  <path d="M16 10a4 4 0 0 1-8 0"></path>
                </svg>
              </div>
              <span className="text-xs font-bold text-white tracking-wider pr-1 drop-shadow-sm">商城</span>
            </button>
          </div>
        </div>
      </div>

      {/* 主体自适应滑动/居中区域 */}
      <div className="flex-1 flex flex-col justify-center items-center w-full pt-1 pb-8 sm:pb-10 mt-safe">
        <div className="w-full max-w-xl text-center mb-8 sm:mb-12 z-10 relative text-shadow-md shrink-0">
          <h1 className="text-[34px] md:text-[40px] font-bold text-white mb-4 tracking-[0.15em] font-serif drop-shadow-lg">
            泸沽湖智慧文旅
          </h1>
          <p className="text-white/85 text-[15px] tracking-[0.3em] font-light drop-shadow-md pl-1">
            看风景 · 懂文化 · 走路线
          </p>
        </div>

        <div className="w-full max-w-xl space-y-4 pb-4 z-10 relative">
          <button type="button" className="home-func-btn home-func-btn-1" onClick={() => openPanel("overview")}>
            <img src="/images/buttons/func_1_icon.png" alt="" className="home-func-icon" aria-hidden="true" />
            <div className="home-func-text">
              <h3 className="home-func-title">景区一览</h3>
              <p className="home-func-desc">发现最美风景，探索摩梭文化</p>
            </div>
          </button>

          <button type="button" className="home-func-btn home-func-btn-2" onClick={() => openPanel("culture")}>
            <img src="/images/buttons/func_2_icon.png" alt="" className="home-func-icon" aria-hidden="true" />
            <div className="home-func-text">
              <h3 className="home-func-title">文化导览</h3>
              <p className="home-func-desc">AI智能规划个性路线与解说</p>
            </div>
          </button>

          <button type="button" className="home-func-btn home-func-btn-3" onClick={() => openPanel("global")}>
            <img src="/images/buttons/func_3_icon.png" alt="" className="home-func-icon" aria-hidden="true" />
            <div className="home-func-text">
              <h3 className="home-func-title">全域导览</h3>
              <p className="home-func-desc">景点/交通/餐饮/住宿规划</p>
            </div>
          </button>

          <button type="button" className="home-func-btn home-func-btn-4" onClick={() => openPanel("eco")}>
            <img src="/images/buttons/func_4_icon.png" alt="" className="home-func-icon" aria-hidden="true" />
            <div className="home-func-text">
              <h3 className="home-func-title">生态导览</h3>
              <p className="home-func-desc">生态科普 / 康养路线 / 生态足迹</p>
            </div>
          </button>
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
              <Card className="bg-white/10 border border-[rgba(252,182,118,0.32)] rounded-3xl p-5 mb-4 shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-md overview-module-card">
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
                        className="block mt-4 text-center text-amber-300 font-medium"
                      >
                        查看泸沽湖整体详情 →
                      </Link>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-white/80 mt-2 mb-0">暂未读取到知识库湖区介绍数据。</p>
                )}
              </Card>

              <Card className="bg-white/10 border border-[rgba(252,182,118,0.32)] rounded-3xl p-5 mb-4 shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-md overview-module-card">
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
                    className="block mt-4 text-center text-amber-300 font-medium"
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
            <button className="text-[rgba(252,182,118,0.85)] active:text-white px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm backdrop-blur-sm transition-all shadow-sm" onClick={closePanel}>← 返回</button>
          </div>
          <Card className="bg-white/10 border border-[rgba(252,182,118,0.32)] rounded-3xl p-5 mb-4 shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-md">
            <div className="text-sm text-white/90 leading-relaxed">
              这版文化导览会先建立你的出行画像，再生成可执行的摩梭文化路线。生成后会直接保存到“我的路线”。
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="px-2.5 py-1 text-xs rounded-full bg-amber-400/20 border border-amber-300/30 text-amber-100">画像驱动生成</span>
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
                  className={`text-left rounded-xl border px-3 py-2 transition ${selectedTemplateId === template.id ? "bg-amber-300/25 border-amber-200/40" : "bg-white/5 border-white/20 hover:bg-white/15"}`}
                  onClick={() => applyCultureTemplate(template)}
                >
                  <div className="text-sm font-semibold text-white">{template.title}</div>
                  <div className="text-xs text-white/65 mt-0.5">{template.hint}</div>
                </button>
              ))}
            </div>
            {selectedTemplateId ? (
              <div className="text-xs text-amber-100/80 mt-3">
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
                    className={`px-3 py-1.5 text-xs rounded-lg border transition ${cultureDraft.duration === item.value ? "bg-amber-300/25 border-amber-200/40 text-white" : "bg-white/5 border-white/20 text-white/85 hover:bg-white/15"}`}
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
                    className={`px-3 py-1.5 text-xs rounded-lg border transition ${cultureDraft.groupType === item.value ? "bg-amber-300/25 border-amber-200/40 text-white" : "bg-white/5 border-white/20 text-white/85 hover:bg-white/15"}`}
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
                    className={`px-3 py-1.5 text-xs rounded-lg border transition ${cultureDraft.preference === item.value ? "bg-amber-300/25 border-amber-200/40 text-white" : "bg-white/5 border-white/20 text-white/85 hover:bg-white/15"}`}
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
                    className={`px-3 py-1.5 text-xs rounded-lg border transition ${cultureDraft.pace === item.value ? "bg-amber-300/25 border-amber-200/40 text-white" : "bg-white/5 border-white/20 text-white/85 hover:bg-white/15"}`}
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
            <button className="text-[rgba(252,182,118,0.85)] active:text-white px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm backdrop-blur-sm transition-all shadow-sm" onClick={closePanel}>← 返回</button>
          </div>
          <Card className="bg-white/10 border border-[rgba(252,182,118,0.32)] rounded-3xl p-5 mb-4 shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-md global-section-card">
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

      <Popup visible={activePanel === "eco"} onMaskClick={closePanel} bodyStyle={{ minHeight: "75vh", width: "100%", maxWidth: "100%", overflowY: "auto", background: "transparent" }}>
        <div className="app-glass-popup p-5 min-h-[75vh] home-popup-scrollable">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-white tracking-wide">生态导览</h3>
            <button className="text-[rgba(189,232,250,0.8)] active:text-white px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm backdrop-blur-sm transition-all shadow-sm" onClick={closePanel}>← 返回</button>
          </div>

          <Card className="bg-white/10 border border-[rgba(189,232,250,0.2)] rounded-3xl p-5 mb-4 shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-md">
            <div className="text-xl font-bold text-white border-b border-white/20 pb-2 mb-3">{kbEcoGuide?.sections?.scienceTitle || "生态科普"}</div>
            <div className="text-sm text-white/85 leading-relaxed">
              {ecoIntro}
            </div>

            {ecoFauna.length > 0 ? (
              <div className="mt-4">
                <div className="text-sm font-semibold text-white/90 mb-2">{kbEcoGuide?.sections?.rareFaunaTitle || "珍稀动物"}</div>
                <div className="space-y-2">
                  {ecoFauna.map((item, idx) => (
                    <div key={`eco-fauna-${item.name || idx}`} className="bg-white/5 border border-white/10 rounded-2xl p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-white">{item.name || `动物 ${idx + 1}`}</div>
                        {item.protectionLevel ? <span className="px-2 py-0.5 text-[11px] rounded-full bg-white/15 text-white/85">{item.protectionLevel}</span> : null}
                      </div>
                      {item.scientificName ? <div className="text-xs text-white/55 mt-1 italic">{item.scientificName}</div> : null}
                      {item.introduction ? <div className="text-xs text-white/75 mt-2 leading-relaxed">{item.introduction}</div> : null}
                      {Array.isArray(item?.benefits?.environment) && item.benefits.environment.length > 0 ? (
                        <div className="text-xs text-emerald-100/90 mt-2">生态益处：{item.benefits.environment.join("；")}</div>
                      ) : null}
                      {Array.isArray(item?.benefits?.human) && item.benefits.human.length > 0 ? (
                        <div className="text-xs text-amber-100/90 mt-1">人类益处：{item.benefits.human.join("；")}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {ecoFlora.length > 0 ? (
              <div className="mt-4">
                <div className="text-sm font-semibold text-white/90 mb-2">{kbEcoGuide?.sections?.rareFloraTitle || "珍稀植物"}</div>
                <div className="space-y-2">
                  {ecoFlora.map((item, idx) => (
                    <div key={`eco-flora-${item.name || idx}`} className="bg-white/5 border border-white/10 rounded-2xl p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-white">{item.name || `植物 ${idx + 1}`}</div>
                        {item.protectionLevel ? <span className="px-2 py-0.5 text-[11px] rounded-full bg-white/15 text-white/85">{item.protectionLevel}</span> : null}
                      </div>
                      {item.scientificName ? <div className="text-xs text-white/55 mt-1 italic">{item.scientificName}</div> : null}
                      {item.introduction ? <div className="text-xs text-white/75 mt-2 leading-relaxed">{item.introduction}</div> : null}
                      {Array.isArray(item?.benefits?.environment) && item.benefits.environment.length > 0 ? (
                        <div className="text-xs text-emerald-100/90 mt-2">生态益处：{item.benefits.environment.join("；")}</div>
                      ) : null}
                      {Array.isArray(item?.benefits?.human) && item.benefits.human.length > 0 ? (
                        <div className="text-xs text-amber-100/90 mt-1">人类益处：{item.benefits.human.join("；")}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {ecoBenefitsEnv.length > 0 || ecoBenefitsHuman.length > 0 ? (
              <div className="mt-4">
                <div className="text-sm font-semibold text-white/90 mb-2">{kbEcoGuide?.sections?.benefitsTitle || "动植物生态价值"}</div>
                <div className="grid grid-cols-1 gap-2">
                  {ecoBenefitsEnv.length > 0 ? (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                      <div className="text-xs font-semibold text-emerald-100/90 mb-1">对生态环境的价值</div>
                      <div className="text-xs text-white/75 leading-relaxed">{ecoBenefitsEnv.join("；")}</div>
                    </div>
                  ) : null}
                  {ecoBenefitsHuman.length > 0 ? (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                      <div className="text-xs font-semibold text-amber-100/90 mb-1">对人类社会的价值</div>
                      <div className="text-xs text-white/75 leading-relaxed">{ecoBenefitsHuman.join("；")}</div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {ecoTips.length > 0 ? (
              <div className="mt-4">
                <div className="text-sm font-semibold text-white/90 mb-2">{kbEcoGuide?.sections?.tipsTitle || "观察守则"}</div>
                <div className="grid grid-cols-1 gap-2">
                  {ecoTips.map((tip, idx) => (
                    <div key={`eco-tip-${idx}`} className="bg-white/5 border border-white/10 rounded-2xl p-3 text-sm text-white/80">{tip}</div>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>

          <Card className="bg-white/10 border border-[rgba(189,232,250,0.2)] rounded-3xl p-5 mb-4 shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-md">
            <div className="text-xl font-bold text-white border-b border-white/20 pb-2 mb-3">{kbEcoGuide?.sections?.wellnessRouteTitle || "康养路线"}</div>
            <div className="space-y-2 text-sm text-white/85">
              {ecoRoute.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3">暂无路线配置，请在 knowledge-base/common/pages/eco-guide.json 中补充。</div>
              ) : ecoRoute.map((item, idx) => (
                <div key={`eco-route-${item.period || idx}`} className="bg-white/5 border border-white/10 rounded-2xl p-3">
                  <div className="font-semibold text-white">{item.period || `阶段 ${idx + 1}`} {item.time || ""}</div>
                  {item.activity ? <div className="mt-1">{item.activity}</div> : null}
                  {item.benefit ? <div className="text-xs text-white/65 mt-1">收益：{item.benefit}</div> : null}
                </div>
              ))}
            </div>
            <div className="text-xs text-white/55 mt-3">{kbEcoGuide?.details?.routeNote || "如果你想要更具体的路线，可以先去“全域导览”挑选景点，再回来组合成生态线。"}</div>
          </Card>

          <Card className="bg-white/10 border border-[rgba(189,232,250,0.2)] rounded-3xl p-5 mb-4 shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-md">
            <div className="text-xl font-bold text-white border-b border-white/20 pb-2 mb-3">生态足迹</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                <div className="text-lg font-bold text-white">{footprintSummary.total}</div>
                <div className="text-xs text-white/65 mt-1">已记录足迹</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                <div className="text-lg font-bold text-white">{footprintSummary.locationCount}</div>
                <div className="text-xs text-white/65 mt-1">涉及景点</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                <div className="text-lg font-bold text-white">{footprintSummary.withPhoto}</div>
                <div className="text-xs text-white/65 mt-1">带照片记录</div>
              </div>
            </div>
            <div className="text-sm text-white/80 mt-3 leading-relaxed">
              记录足迹时可以优先选择少打扰的拍摄方式、减少一次性用品、优先步行或拼车，把旅程留在风景里，而不是留在消耗里。
            </div>
            {myFootprints.length > 0 ? (
              <div className="mt-3 space-y-2">
                {myFootprints.slice(0, 3).map((item, idx) => (
                  <div key={`eco-footprint-${item.id || idx}`} className="bg-white/5 border border-white/10 rounded-2xl p-3">
                    <div className="text-sm font-semibold text-white">{item.location_name || item.title || `足迹 ${idx + 1}`}</div>
                    <div className="text-xs text-white/60 mt-1">{item.created_at ? new Date(item.created_at).toLocaleString() : "记录时间未知"}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-white/55 mt-3">登录后可在这里看到你的生态足迹摘要与最近记录。</div>
            )}
          </Card>

          {ecoLocations.length > 0 ? (
            <Card className="bg-white/10 border border-white/20 rounded-3xl p-5 mb-4 shadow-lg backdrop-blur-md mb-0">
              <div className="font-semibold text-white/95">推荐自然点位</div>
              <div className="space-y-2 mt-3">
                {ecoLocations.slice(0, 4).map((item) => (
                  <Link
                    to={item.id ? `/locations/${item.id}` : "/home"}
                    state={{ fromPanel: "eco" }}
                    key={`eco-${item.slug || item.id}`}
                    className="block bg-white/10 border border-white/20 rounded-2xl p-4 no-underline text-current"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-white/95">{item.name}</div>
                      <span className="px-2 py-1 text-xs rounded-full bg-white/20 text-white/90">{item.category || "自然"}</span>
                    </div>
                    <div className="text-sm text-white/75 mt-1">{item.description || "适合纳入生态线路的自然点位。"}</div>
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
