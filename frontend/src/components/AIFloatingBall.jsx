import { useEffect, useMemo, useState, useRef } from "react";
import LucideIcon from "./LucideIcon";
import { useLocation, useNavigate } from "react-router-dom";
import { TextArea, Button, Toast, DotLoading, Dialog } from "antd-mobile";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getUserSessionUsername } from "../auth";
import { deleteChatSession, fetchChatHistory, sceneChat, getUserToken } from "../api";

const createConversationId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createConversation = () => {
  const now = Date.now();
  return {
    id: createConversationId(),
    title: "新对话",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
};

const getConversationTitle = (text) => {
  const normalized = typeof text === "string" ? text.trim() : "";
  if (!normalized) return "新对话";
  return normalized.length > 18 ? `${normalized.slice(0, 18)}...` : normalized;
};

const formatHistoryTime = (timestamp) =>
  new Date(timestamp).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const normalizeServerConversation = (session) => {
  const messages = Array.isArray(session?.messages)
    ? session.messages.map((item, index) => ({
        id: `${item?.id ?? `${session?.session_key || "session"}-${index}`}`,
        role: item?.role || "assistant",
        content: typeof item?.content === "string" ? item.content : String(item?.content ?? ""),
      }))
    : [];

  const createdAt = session?.created_at ? Date.parse(session.created_at) : Date.now();
  const updatedAt = session?.updated_at ? Date.parse(session.updated_at) : Date.now();

  return {
    id: session?.session_key || createConversationId(),
    title: typeof session?.title === "string" && session.title.trim() ? session.title : "新对话",
    messages,
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
  };
};

const getScenePromptPackByRoute = (pathname) => {
  const cleanedPath = typeof pathname === "string" ? pathname : "";

  if (cleanedPath.startsWith("/locations/")) {
    return {
      sceneLabel: "景点详情导览",
      capabilityHints: [
        "可引导用户使用[打卡页](/checkin)进行扫码与轨迹打卡。",
        "可引导用户在[旅行记录页](/scroll)沉淀图文与心得。",
      ],
      domainHints: [
        "优先讲清当前景点看点、建议停留时长和下一站衔接。",
        "建议融合泸沽湖自然景观与摩梭文化体验。",
      ],
      answerStyle: "先一句结论，再给 3 条可执行步骤，最后给 1 条跳转建议。",
      recommendedLinks: [
        "[打卡页](/checkin)",
        "[旅行记录页](/scroll)",
        "[首页-全域导览](/home?openPanel=global)",
      ],
    };
  }

  if (cleanedPath === "/checkin") {
    return {
      sceneLabel: "地图打卡助手",
      capabilityHints: [
        "可围绕扫码打卡、实时轨迹、定位补采给出操作步骤。",
        "可引导用户回到[首页-全域导览](/home?openPanel=global)补充景点选择。",
      ],
      domainHints: [
        "优先推荐可连续打卡的路线顺序与时段安排。",
        "提醒湖区天气变化与安全边界。",
      ],
      answerStyle: "给出打卡顺序、耗时预估和风险提醒。",
      recommendedLinks: [
        "[首页-全域导览](/home?openPanel=global)",
        "[泸沽湖专题页](/lugu-lake)",
      ],
    };
  }

  if (cleanedPath === "/scroll") {
    return {
      sceneLabel: "旅行记录助手",
      capabilityHints: [
        "可输出可直接使用的游记文案结构与标题建议。",
        "可引导回[景区一览](/home?openPanel=overview)补充背景信息。",
      ],
      domainHints: [
        "文案可突出高原湖景、日出日落、摩梭文化体验。",
        "鼓励按时间线组织“地点-体验-感受”。",
      ],
      answerStyle: "先给文案模板，再给可替换句式。",
      recommendedLinks: [
        "[景区一览](/home?openPanel=overview)",
        "[摩梭文化页](/mosuo-culture)",
      ],
    };
  }

  if (cleanedPath === "/me") {
    return {
      sceneLabel: "个人中心建议",
      capabilityHints: [
        "可帮助用户总结游玩偏好并给出下一次路线建议。",
        "可结合历史打卡和记录内容给出复盘建议。",
      ],
      domainHints: [
        "优先输出个性化而非通用模板。",
        "强调泸沽湖玩法可按文化深度与景观偏好分层。",
      ],
      answerStyle: "简明总结 + 个性化下一步建议。",
      recommendedLinks: [
        "[首页](/home)",
        "[文化导览](/home?openPanel=culture)",
      ],
    };
  }

  if (cleanedPath === "/guide") {
    return {
      sceneLabel: "智能导览规划",
      capabilityHints: [
        "可输出分时段路线（时间-地点-时长-理由）。",
        "可结合人群偏好给出 A/B 方案。",
      ],
      domainHints: [
        "覆盖泸沽湖景观主线与摩梭文化主线。",
        "优先给出半天/一天可执行行程。",
      ],
      answerStyle: "结构化行程表 + 一句总提醒。",
      recommendedLinks: [
        "[泸沽湖专题页](/lugu-lake)",
        "[摩梭文化页](/mosuo-culture)",
        "[打卡页](/checkin)",
      ],
    };
  }

  if (cleanedPath === "/lugu-lake") {
    return {
      sceneLabel: "泸沽湖专题导览",
      capabilityHints: [
        "可从景观、节奏、停留天数给出专题解读。",
        "可引导用户进入景点详情页继续深挖。",
      ],
      domainHints: [
        "强调高原湖泊景观与环湖慢游体验。",
        "结合季节与时段给出体验优先级。",
      ],
      answerStyle: "专题解读 + 线路建议。",
      recommendedLinks: [
        "[景区一览](/home?openPanel=overview)",
        "[首页-全域导览](/home?openPanel=global)",
      ],
    };
  }

  if (cleanedPath === "/mosuo-culture") {
    return {
      sceneLabel: "摩梭文化专题",
      capabilityHints: [
        "可解释母系文化、礼仪边界与参访方式。",
        "可引导用户组合文化体验与景观游览。",
      ],
      domainHints: [
        "强调尊重在地生活方式与参访礼仪。",
        "优先推荐具讲解价值的体验路径。",
      ],
      answerStyle: "文化解释 + 实践建议。",
      recommendedLinks: [
        "[文化导览](/home?openPanel=culture)",
        "[旅行记录页](/scroll)",
      ],
    };
  }

  return {
    sceneLabel: "首页全局导览",
    capabilityHints: [
      "可从首页四个模块（景区一览/文化导览/全域导览/生态导览）组织回答。",
      "可引导用户按目标快速跳转到对应模块。",
    ],
    domainHints: [
      "优先给泸沽湖入门路线，再给文化深度路线。",
      "建议兼顾拍照、人文、打卡三类诉求。",
    ],
    answerStyle: "先总览后分支，给主方案与备选方案。",
    recommendedLinks: [
      "[景区一览](/home?openPanel=overview)",
      "[文化导览](/home?openPanel=culture)",
      "[全域导览](/home?openPanel=global)",
      "[生态导览](/home?openPanel=eco)",
    ],
  };
};

// 根据路由返回对应的系统提示词
const getSystemPromptByRoute = (pathname) => {
  const pack = getScenePromptPackByRoute(pathname);
  const baseRules = [
    "你是泸沽湖智慧文旅平台内嵌 AI 助手，回答必须贴合当前页面场景。",
    "先给结论，再给 2-4 条可执行建议；建议优先映射到本软件页面。",
    "知识库信息不足时要明确说明，再给出通用方案，不要编造数据。",
    "涉及价格、时效、开放时间等可能变化的信息，补充“以现场和官方信息为准”。",
    "页面跳转建议请使用 Markdown 链接格式：[页面名](真实路径)。",
    `当前界面定位：${pack.sceneLabel}`,
    `回答风格：${pack.answerStyle}`,
    "软件能力提示：",
    ...pack.capabilityHints.map((item) => `- ${item}`),
    "泸沽湖知识重点：",
    ...pack.domainHints.map((item) => `- ${item}`),
    "优先推荐链接：",
    ...pack.recommendedLinks.map((item) => `- ${item}`),
  ].join("\n");

  return baseRules;
};

const getSceneMetaByRoute = (pathname) => {
  if (pathname.startsWith("/locations/")) {
    return {
      title: "景点讲解模式",
      tips: ["这个景点怎么玩更省时间？", "讲讲这里的人文故事", "帮我规划下一站"],
    };
  }
  if (pathname === "/scroll") {
    return {
      title: "旅行记录模式",
      tips: ["帮我整理今天的旅行文案", "推荐朋友圈文案风格", "回顾一下我的足迹亮点"],
    };
  }
  if (pathname === "/checkin") {
    return {
      title: "打卡助手模式",
      tips: ["附近适合打卡的点有哪些？", "现在打卡顺序怎么走更顺？", "帮我写一句打卡心情"],
    };
  }
  if (pathname === "/me") {
    return {
      title: "个人中心模式",
      tips: ["我适合什么旅行风格？", "帮我总结旅行偏好", "给我下次出行建议"],
    };
  }
  return {
    title: "智慧导览模式",
    tips: ["泸沽湖一日游怎么安排？", "哪些景点最值得先去？", "现在适合玩什么项目？"],
  };
};

const getSceneContextByRoute = (pathname) => {
  const cleanedPath = typeof pathname === "string" ? pathname : "";
  const pack = getScenePromptPackByRoute(cleanedPath);
  const scene = {
    pathname: cleanedPath,
    scene_type: "general",
    page_slug: null,
    location_ref: null,
    scene_label: pack.sceneLabel,
    capability_hints: pack.capabilityHints,
    domain_hints: pack.domainHints,
    recommended_links: pack.recommendedLinks,
    answer_style: pack.answerStyle,
  };

  if (cleanedPath.startsWith("/locations/")) {
    const locationRef = cleanedPath.split("/")[2] || "";
    return {
      ...scene,
      scene_type: "location-detail",
      location_ref: locationRef,
    };
  }

  if (cleanedPath === "/lugu-lake" || cleanedPath === "/mosuo-culture") {
    return {
      ...scene,
      scene_type: "page",
      page_slug: cleanedPath.slice(1),
    };
  }

  if (cleanedPath === "/checkin") {
    return { ...scene, scene_type: "checkin" };
  }

  if (cleanedPath === "/scroll") {
    return { ...scene, scene_type: "scroll" };
  }

  if (cleanedPath === "/home") {
    return { ...scene, scene_type: "home" };
  }

  if (cleanedPath === "/guide") {
    return { ...scene, scene_type: "guide" };
  }

  if (cleanedPath === "/me") {
    return { ...scene, scene_type: "profile" };
  }

  return scene;
};

const normalizeReferences = (references) => {
  if (!Array.isArray(references)) return [];
  const seen = new Set();

  return references
    .map((item) => {
      const title = typeof item?.title === "string" ? item.title.trim() : "";
      const path = typeof item?.path === "string" ? item.path.trim() : "";
      const sourceKey = typeof item?.source_key === "string" ? item.source_key.trim() : "";
      if (!path.startsWith("/")) return null;

      const dedupeKey = `${sourceKey || title}-${path}`;
      if (seen.has(dedupeKey)) return null;
      seen.add(dedupeKey);

      return {
        title: title || "参考页面",
        path,
      };
    })
    .filter(Boolean);
};

const appendReferencesToReply = (reply, references) => {
  const base = typeof reply === "string" && reply.trim() ? reply.trim() : "抱歉，未获得回复，请稍后重试。";
  if (!Array.isArray(references) || references.length === 0) return base;
  if (base.includes("参考链接：")) return base;

  const lines = references.map((item) => `- [${item.title}](${item.path})`);
  if (lines.length === 0) return base;
  return `${base}\n\n参考链接：\n${lines.join("\n")}`;
};

export default function AIFloatingBall() {
  const location = useLocation();
  const navigate = useNavigate();
  const sessionUsername = getUserSessionUsername();
  const [visible, setVisible] = useState(false);
  const [ballPosition, setBallPosition] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const initialConversationRef = useRef(null);
  if (!initialConversationRef.current) {
    initialConversationRef.current = createConversation();
  }
  const [conversations, setConversations] = useState(() => [initialConversationRef.current]);
  const [activeConversationId, setActiveConversationId] = useState(() => initialConversationRef.current.id);
  const [historyCollapsed, setHistoryCollapsed] = useState(true);
  const [input, setInput] = useState("");
  const [loadingConversationId, setLoadingConversationId] = useState(null);
  const messagesEndRef = useRef(null);
  const messagesListRef = useRef(null);
  const floatingContainerRef = useRef(null);
  const inertialFrameRef = useRef(null);
  const suppressClickRef = useRef(false);
  const positionRef = useRef(null);
  const velocityRef = useRef({ x: 0, y: 0 });
  const dragStateRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
  });
  const sceneMeta = getSceneMetaByRoute(location.pathname);
  const loading = loadingConversationId !== null;

  const FLOAT_PADDING = 8;
  const FLOAT_INITIAL_RIGHT = 16;
  const FLOAT_INITIAL_BOTTOM = 100;
  const FLOAT_BOUNCE = 0.72;
  const FLOAT_FRICTION = 0.93;
  const FLOAT_STOP_SPEED = 0.02;

  const syncBallPosition = (nextPosition) => {
    positionRef.current = nextPosition;
    setBallPosition(nextPosition);
  };

  const getFloatingRect = () => {
    const rect = floatingContainerRef.current?.getBoundingClientRect();
    return {
      width: rect?.width || 64,
      height: rect?.height || 64,
    };
  };

  const getMovementBounds = () => {
    const { width, height } = getFloatingRect();
    return {
      minX: FLOAT_PADDING,
      maxX: Math.max(FLOAT_PADDING, window.innerWidth - width - FLOAT_PADDING),
      minY: FLOAT_PADDING,
      maxY: Math.max(FLOAT_PADDING, window.innerHeight - height - FLOAT_PADDING),
    };
  };

  const clampToBounds = (x, y) => {
    const bounds = getMovementBounds();
    return {
      x: Math.min(bounds.maxX, Math.max(bounds.minX, x)),
      y: Math.min(bounds.maxY, Math.max(bounds.minY, y)),
    };
  };

  const cancelInertia = () => {
    if (inertialFrameRef.current !== null) {
      cancelAnimationFrame(inertialFrameRef.current);
      inertialFrameRef.current = null;
    }
  };

  const startInertia = () => {
    cancelInertia();
    let previousTimestamp = performance.now();

    const animate = (timestamp) => {
      if (dragStateRef.current.active) {
        inertialFrameRef.current = null;
        return;
      }

      const dt = Math.min(32, Math.max(1, timestamp - previousTimestamp));
      previousTimestamp = timestamp;

      const current = positionRef.current;
      if (!current) {
        inertialFrameRef.current = null;
        return;
      }

      let nextX = current.x + velocityRef.current.x * dt;
      let nextY = current.y + velocityRef.current.y * dt;

      velocityRef.current = {
        x: velocityRef.current.x * Math.pow(FLOAT_FRICTION, dt / 16),
        y: velocityRef.current.y * Math.pow(FLOAT_FRICTION, dt / 16),
      };

      const bounds = getMovementBounds();
      if (nextX <= bounds.minX) {
        nextX = bounds.minX;
        velocityRef.current.x = Math.abs(velocityRef.current.x) * FLOAT_BOUNCE;
      } else if (nextX >= bounds.maxX) {
        nextX = bounds.maxX;
        velocityRef.current.x = -Math.abs(velocityRef.current.x) * FLOAT_BOUNCE;
      }

      if (nextY <= bounds.minY) {
        nextY = bounds.minY;
        velocityRef.current.y = Math.abs(velocityRef.current.y) * FLOAT_BOUNCE;
      } else if (nextY >= bounds.maxY) {
        nextY = bounds.maxY;
        velocityRef.current.y = -Math.abs(velocityRef.current.y) * FLOAT_BOUNCE;
      }

      syncBallPosition({ x: nextX, y: nextY });

      const speed = Math.hypot(velocityRef.current.x, velocityRef.current.y);
      if (speed < FLOAT_STOP_SPEED) {
        inertialFrameRef.current = null;
        return;
      }

      inertialFrameRef.current = requestAnimationFrame(animate);
    };

    inertialFrameRef.current = requestAnimationFrame(animate);
  };

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId) || conversations[0] || null,
    [conversations, activeConversationId]
  );

  const messages = activeConversation?.messages || [];

  const historyItems = useMemo(() => {
    return conversations
      .filter((item) => item.messages.length > 0)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((item) => {
        const latestMessage = [...item.messages].reverse().find((msg) => msg.role === "assistant" || msg.role === "user");
        return {
          id: item.id,
          title: item.title,
          preview: latestMessage?.content || "暂无内容",
          messageCount: item.messages.length,
          updatedAtLabel: formatHistoryTime(item.updatedAt),
        };
      });
  }, [conversations]);

  const scrollToBottom = () => {
    if (messagesListRef.current) {
      messagesListRef.current.scrollTop = messagesListRef.current.scrollHeight;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeConversationId]);

  useEffect(() => {
    if (!conversations.some((item) => item.id === activeConversationId)) {
      setActiveConversationId(conversations[0]?.id || null);
    }
  }, [conversations, activeConversationId]);

  useEffect(() => {
    if (!visible) return undefined;

    const handleEsc = (event) => {
      if (event.key === "Escape") {
        setVisible(false);
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [visible]);

  useEffect(() => {
    const initBallPosition = () => {
      const { width, height } = getFloatingRect();
      const initialX = window.innerWidth - width - FLOAT_INITIAL_RIGHT;
      const initialY = window.innerHeight - height - FLOAT_INITIAL_BOTTOM;
      syncBallPosition(clampToBounds(initialX, initialY));
    };

    const frame = requestAnimationFrame(initBallPosition);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (!positionRef.current) return;
      syncBallPosition(clampToBounds(positionRef.current.x, positionRef.current.y));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    return () => cancelInertia();
  }, []);

  useEffect(() => {
    const nextConversation = createConversation();
    setConversations([nextConversation]);
    setActiveConversationId(nextConversation.id);
    setInput("");
    setLoadingConversationId(null);
  }, [sessionUsername]);

  useEffect(() => {
    if (!visible) return;

    const token = getUserToken();
    if (!token) {
      setConversations((prev) => {
        if (prev.length > 0) return prev;
        const nextConversation = createConversation();
        setActiveConversationId(nextConversation.id);
        return [nextConversation];
      });
      return;
    }

    let cancelled = false;
    const loadChatHistory = async () => {
      try {
        const result = await fetchChatHistory(token);
        const sessions = Array.isArray(result?.sessions) ? result.sessions : [];
        if (cancelled) return;
        if (sessions.length === 0) {
          const nextConversation = createConversation();
          setConversations([nextConversation]);
          setActiveConversationId(nextConversation.id);
          return;
        }

        const normalized = sessions.map(normalizeServerConversation);
        setConversations(normalized);

        const stillExists = normalized.some((item) => item.id === activeConversationId);
        setActiveConversationId(stillExists ? activeConversationId : normalized[0].id);
      } catch (error) {
        if (error?.response?.status !== 401) {
          console.warn("load chat history failed", error);
        }
      }
    };

    loadChatHistory();

    return () => {
      cancelled = true;
    };
  }, [visible]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;

    let targetConversationId = activeConversation?.id;
    if (!targetConversationId) {
      const nextConversation = createConversation();
      targetConversationId = nextConversation.id;
      setConversations((prev) => [nextConversation, ...prev]);
      setActiveConversationId(nextConversation.id);
    }

    const token = getUserToken();
    if (!token) {
      Toast.show({ content: "请先在“我的”页面登录游客账号" });
      return;
    }

    // 添加用户消息到对话记录
    const userMessageId = `${Date.now()}-user`;
    setConversations((prev) =>
      prev.map((conversation) => {
        if (conversation.id !== targetConversationId) return conversation;
        return {
          ...conversation,
          title: conversation.title === "新对话" ? getConversationTitle(text) : conversation.title,
          messages: [...conversation.messages, { id: userMessageId, role: "user", content: text }],
          updatedAt: Date.now(),
        };
      })
    );
    setInput("");
    setLoadingConversationId(targetConversationId);

    try {
      const systemPrompt = getSystemPromptByRoute(location.pathname);
      const sceneContext = getSceneContextByRoute(location.pathname);
      const result = await sceneChat(text, systemPrompt, token, sceneContext, targetConversationId);
      const normalizedReferences = normalizeReferences(result?.references);
      const normalizedReply = appendReferencesToReply(result?.reply, normalizedReferences);
      const resolvedSessionId = typeof result?.session_key === "string" && result.session_key.trim()
        ? result.session_key.trim()
        : targetConversationId;
      
      // 添加 AI 回复到对话记录
      const assistantMessageId = `${Date.now()}-assistant`;
      setConversations((prev) =>
        prev.map((conversation) => {
          if (conversation.id !== targetConversationId) return conversation;
          return {
            ...conversation,
            id: resolvedSessionId,
            messages: [
              ...conversation.messages,
              { id: assistantMessageId, role: "assistant", content: normalizedReply },
            ],
            updatedAt: Date.now(),
          };
        })
      );
      setActiveConversationId(resolvedSessionId);
    } catch (error) {
      const status = error?.response?.status;
      const detail = error?.response?.data?.detail;
      const isTimeout = error?.code === "ECONNABORTED";

      let content = "对话失败，请稍后再试";
      if (status === 401) {
        content = "登录已过期，请重新登录";
      } else if (isTimeout) {
        content = "AI 响应较慢，请稍后重试";
      } else if (typeof detail === "string" && detail.trim()) {
        content = detail;
      }

      Toast.show({ content });
      const fallbackMessageId = `${Date.now()}-assistant-error`;
      setConversations((prev) =>
        prev.map((conversation) => {
          if (conversation.id !== targetConversationId) return conversation;
          return {
            ...conversation,
            messages: [...conversation.messages, { id: fallbackMessageId, role: "assistant", content }],
            updatedAt: Date.now(),
          };
        })
      );
    } finally {
      setLoadingConversationId((prev) => (prev === targetConversationId ? null : prev));
    }
  };

  const handleCreateConversation = () => {
    const nextConversation = createConversation();
    setConversations((prev) => [nextConversation, ...prev]);
    setActiveConversationId(nextConversation.id);
    setInput("");
  };

  const handleClearHistory = () => {
    if (!activeConversation || activeConversation.messages.length === 0) {
      Toast.show({ content: "当前会话暂无历史可清除" });
      return;
    }

    Dialog.confirm({
      className: "ai-delete-confirm-dialog",
      content: "确定要删除当前选中的会话记录吗？",
      onConfirm: async () => {
        const token = getUserToken();
        if (!token) {
          Toast.show({ content: "请先在“我的”页面登录游客账号" });
          return;
        }
        try {
          await deleteChatSession(activeConversation.id, token);
        } catch (error) {
          Toast.show({ content: error?.response?.data?.detail || "删除失败，请稍后重试" });
          return;
        }

        const remainingConversations = conversations.filter((item) => item.id !== activeConversation.id);
        const nextConversations = remainingConversations.length > 0 ? remainingConversations : [createConversation()];
        setConversations(nextConversations);
        setActiveConversationId(nextConversations[0].id);
        Toast.show({ content: "已删除当前会话" });
      },
    });
  };

  const handleQuickAsk = (text) => {
    setInput(text);
  };

  const handleInputKeyDown = (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleBallPointerDown = (event) => {
    cancelInertia();

    dragStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      lastTime: performance.now(),
    };

    velocityRef.current = { x: 0, y: 0 };
    suppressClickRef.current = false;
    setIsDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleBallPointerMove = (event) => {
    const dragState = dragStateRef.current;
    if (!dragState.active || dragState.pointerId !== event.pointerId) return;

    const now = performance.now();
    const dt = Math.max(1, now - dragState.lastTime);
    const dx = event.clientX - dragState.lastX;
    const dy = event.clientY - dragState.lastY;

    const movedDistance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);
    if (movedDistance > 4) {
      suppressClickRef.current = true;
    }

    const current = positionRef.current || { x: FLOAT_PADDING, y: FLOAT_PADDING };
    syncBallPosition(clampToBounds(current.x + dx, current.y + dy));

    velocityRef.current = {
      x: dx / dt,
      y: dy / dt,
    };

    dragStateRef.current = {
      ...dragState,
      lastX: event.clientX,
      lastY: event.clientY,
      lastTime: now,
    };
  };

  const handleBallPointerUp = (event) => {
    const dragState = dragStateRef.current;
    if (!dragState.active || dragState.pointerId !== event.pointerId) return;

    dragStateRef.current = {
      ...dragState,
      active: false,
      pointerId: null,
    };

    setIsDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    if (suppressClickRef.current) {
      startInertia();
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
  };

  const handleBallClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setVisible(true);
  };

  const renderMarkdownLink = ({ href, children, ...props }) => {
    const normalizedHref = typeof href === "string" ? href.trim() : "";
    if (!normalizedHref) {
      return <span {...props}>{children}</span>;
    }

    const isInternalPath = normalizedHref.startsWith("/") && !normalizedHref.startsWith("//");
    if (isInternalPath) {
      return (
        <a
          {...props}
          href={normalizedHref}
          onClick={(event) => {
            event.preventDefault();
            navigate(normalizedHref);
            setVisible(false);
          }}
        >
          {children}
        </a>
      );
    }

    return (
      <a {...props} href={normalizedHref} target="_blank" rel="noreferrer noopener">
        {children}
      </a>
    );
  };

  const floatingContainerStyle = ballPosition
    ? {
        left: `${ballPosition.x}px`,
        top: `${ballPosition.y}px`,
        right: "auto",
        bottom: "auto",
        zIndex: 2147483647,
      }
    : {
        zIndex: 2147483647,
      };

  return (
    <>
      {!visible && (
        <div
          ref={floatingContainerRef}
          className="fixed ai-floating-container w-16 h-16 touch-none"
          style={floatingContainerStyle}
        >
          {/* 提示气泡 (默认隐藏，鼠标悬停时显示) */}
          <div className="absolute bottom-full right-0 bg-lake-50/95 text-lake-800 text-sm font-medium py-2 px-4 rounded-2xl shadow-lg mb-3 opacity-0 transition-opacity duration-300 transform translate-y-2 pointer-events-none border border-lake-200/60 whitespace-nowrap">
            需要帮忙吗？和我聊聊！
          </div>

          {/* 按钮主体 */}
          <button 
            onClick={handleBallClick}
            onPointerDown={handleBallPointerDown}
            onPointerMove={handleBallPointerMove}
            onPointerUp={handleBallPointerUp}
            onPointerCancel={handleBallPointerUp}
            className={`group relative flex items-center justify-center w-16 h-16 bg-gradient-to-br from-lake-500 to-lake-700 text-white rounded-full shadow-lg opacity-90 hover:opacity-100 ${isDragging ? "" : "hover:scale-105 active:scale-95 ai-animate-float"} transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-lake-300 cursor-grab active:cursor-grabbing`}
            aria-label="AI助手"
            title="AI助手"
            onMouseEnter={(e) => {
              if (isDragging) return;
              const tooltip = e.currentTarget.previousElementSibling;
              if (tooltip) {
                tooltip.style.opacity = '1';
                tooltip.style.transform = 'translateY(0)';
              }
            }}
            onMouseLeave={(e) => {
              if (isDragging) return;
              const tooltip = e.currentTarget.previousElementSibling;
              if (tooltip) {
                tooltip.style.opacity = '0';
                tooltip.style.transform = 'translateY(8px)';
              }
            }}
            style={{
              background: "rgba(186, 168, 117, 0.9)",
              boxShadow: "0 8px 22px rgba(186, 168, 117, 0.45)",
            }}
          >
              {/* 背景光晕效果 (心跳/呼吸灯效果) */}
              <div className="absolute inset-0 rounded-full border-2 border-white/20 animate-ping opacity-20 group-hover:opacity-40"></div>
              
              {/* 机器人 SVG 图标 */}
              <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="1.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className="w-8 h-8 relative z-10"
              >
                  {/* 头部天线 */}
                  <line x1="12" y1="3" x2="12" y2="6" strokeWidth="2"/>
                  <circle cx="12" cy="2" r="1" fill="currentColor" stroke="none"/>
                  
                  {/* 机器人外壳/面部 */}
                  <rect x="4" y="7" width="16" height="13" rx="4" ry="4" strokeWidth="2" className="fill-lake-300/20"/>
                  
                  {/* 机器人的耳朵 */}
                  <line x1="2" y1="12" x2="4" y2="12" strokeWidth="2"/>
                  <line x1="20" y1="12" x2="22" y2="12" strokeWidth="2"/>
                  
                  {/* 眼睛 (带有眨眼动画) */}
                  <circle cx="9" cy="12" r="1.5" fill="currentColor" stroke="none" className="ai-eye-blink"/>
                  <circle cx="15" cy="12" r="1.5" fill="currentColor" stroke="none" className="ai-eye-blink"/>
                  
                  {/* 嘴巴/语音指示器 */}
                  <path d="M10 16 C11 17, 13 17, 14 16" strokeWidth="2" strokeLinecap="round"/>
              </svg>

              {/* 消息红点提示 (右上角) */}
              <span className="absolute top-0 right-0 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-white"></span>
              </span>
          </button>
        </div>
      )}

      {visible && (
        <div className="ai-chat-overlay" onClick={() => setVisible(false)}>
          <div className="ai-chat-panel" onClick={(event) => event.stopPropagation()}>
            <div className="ai-chat-panel-header">
              <div className="ai-chat-panel-title">AI导游助手</div>
              <div className="ai-chat-panel-actions">
                <button type="button" className="ai-panel-btn ai-panel-btn-light" onClick={handleCreateConversation} disabled={loading}>
                  新建对话
                </button>
                <button type="button" className="ai-panel-btn ai-panel-btn-light" onClick={() => setHistoryCollapsed((prev) => !prev)}>
                  {historyCollapsed ? "展开历史" : "收起历史"}
                </button>
              </div>
              <button
                type="button"
                className="ai-panel-corner-close"
                onClick={() => setVisible(false)}
                aria-label="关闭AI对话"
              >
                <LucideIcon name="X" size={16} color="currentColor" className="ai-panel-corner-close-icon" />
              </button>
            </div>

            <div className={`ai-chat-container ${historyCollapsed ? "ai-chat-container-collapsed" : ""}`}>
              {!historyCollapsed && (
                <aside className="ai-history-panel">
                  <div className="ai-history-title flex justify-between items-center">
                    <span>会话历史</span>
                    {activeConversation?.messages?.length > 0 && (
                      <button 
                        onClick={handleClearHistory}
                        className="text-lake-500 hover:text-red-500 transition-colors bg-transparent border-none cursor-pointer flex items-center justify-center p-1"
                        title="删除当前会话"
                      >
                        <LucideIcon name="Trash2" size={16} />
                      </button>
                    )}
                  </div>
                  {historyItems.length === 0 ? (
                    <div className="ai-history-empty">暂无完整会话记录，发送消息后自动保存</div>
                  ) : (
                    <div className="ai-history-list">
                      {historyItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`ai-history-item ${item.id === activeConversation?.id ? "ai-history-item-active" : ""}`}
                          onClick={() => setActiveConversationId(item.id)}
                        >
                          <span className="ai-history-question">{item.title}</span>
                          <span className="ai-history-answer">{item.preview}</span>
                          <span className="ai-history-meta">{item.updatedAtLabel} · {item.messageCount} 条消息</span>
                        </button>
                      ))}
                    </div>
                  )}
                </aside>
              )}

              <div className="ai-chat-main">
                <div className="ai-chat-scene-header">
                  <div className="ai-chat-scene-title">{sceneMeta.title}</div>
                  <div className="ai-chat-scene-subtitle">当前会话：{activeConversation?.title || "新对话"}</div>
                  <div className="ai-chat-scene-subtitle">当前路径：{location.pathname}</div>
                </div>

                <div className="ai-messages-list" ref={messagesListRef}>
                  {messages.length === 0 && (
                    <div className="ai-empty-state">
                      <div className="ai-empty-icon"><LucideIcon name="MessageCircle" size={24} /></div>
                      <p>有什么我可以帮助你的吗？</p>
                      <p className="ai-empty-hint">
                        根据当前页面，我会提供更贴切的建议。
                      </p>
                      <div className="ai-quick-ask-list">
                        {sceneMeta.tips.map((tip) => (
                          <button
                            key={tip}
                            type="button"
                            className="ai-quick-ask-item"
                            onClick={() => handleQuickAsk(tip)}
                          >
                            {tip}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {messages.map((msg, idx) => (
                    <div
                      key={msg.id || idx}
                      className={`ai-message ai-message-${msg.role}`}
                    >
                      <div className="ai-message-bubble">
                        {msg.role === "assistant" ? (
                          <div className="ai-markdown-content">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: renderMarkdownLink }}>
                              {typeof msg.content === "string" ? msg.content : String(msg.content ?? "")}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          msg.content
                        )}
                      </div>
                    </div>
                  ))}
                  {loadingConversationId === activeConversation?.id && (
                    <div className="ai-message ai-message-assistant">
                      <div className="ai-message-bubble ai-message-loading">
                        <DotLoading color="primary" />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                

                <div className="ai-input-area">
                  <div className="ai-input-wrapper">
                    <TextArea
                      style={{ border: 'none'  }}
                      className="ai-textarea"
                      placeholder="输入你的问题"
                      value={input}
                      onChange={setInput}
                      onKeyDown={handleInputKeyDown}
                      disabled={loading}
                      autoSize={{ minRows: 1, maxRows: 3 }}
                    />
                  </div>
                  <Button
                    className="ai-send-btn"
                    size="small"
                    color="primary"
                    onClick={handleSend}
                    loading={loading}
                    disabled={!input.trim() || loading}
                  >
                    发送
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

