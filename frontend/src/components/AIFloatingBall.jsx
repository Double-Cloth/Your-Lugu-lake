import { useEffect, useMemo, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Input, Button, Toast, DotLoading } from "antd-mobile";
import { sceneChat, getUserToken } from "../api";

// 根据路由返回对应的系统提示词
const getSystemPromptByRoute = (pathname) => {
  if (pathname.startsWith("/locations/")) {
    return "你是泸沽湖景区的智能导游助手。请根据用户的问题提供关于该景点的旅游建议、历史文化信息等。";
  }
  if (pathname === "/scroll") {
    return "你是泸沽湖旅行记录助手。帮助用户整理、回顾和分享他们的旅行足迹和旅行故事。";
  }
  if (pathname === "/checkin") {
    return "你是泸沽湖打卡助手。帮助用户规划打卡路线、记录旅行时刻、提供实时位置建议。";
  }
  if (pathname === "/me") {
    return "你是泸沽湖用户服务助手。帮助用户管理个人信息、查询旅行历史、解答常见问题。";
  }
  if (pathname === "/guide" || pathname === "/home") {
    return "你是泸沽湖智慧文旅助手。帮助用户发现景点、规划路线、了解摩梭文化。";
  }
  // 默认提示词
  return "你是泸沽湖智慧文旅平台的AI助手。友好、专业地为用户提供旅游建议和信息。";
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

export default function AIFloatingBall() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const messageRefs = useRef({});
  const sceneMeta = getSceneMetaByRoute(location.pathname);
  const currentPrompt = getSystemPromptByRoute(location.pathname);

  const historyItems = useMemo(() => {
    const items = [];
    for (let i = 0; i < messages.length; i += 1) {
      const msg = messages[i];
      if (msg.role !== "user") continue;
      const answer = messages.slice(i + 1).find((item) => item.role === "assistant");
      items.push({
        id: msg.id,
        question: msg.content,
        answer: answer?.content || "等待 AI 回答...",
      });
    }
    return items;
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;

    const token = getUserToken();
    if (!token) {
      Toast.show({ content: "请先登录游客账号" });
      return;
    }

    // 添加用户消息到对话记录
    const userMessageId = `${Date.now()}-user`;
    setMessages((prev) => [...prev, { id: userMessageId, role: "user", content: text }]);
    setInput("");
    setLoading(true);

    try {
      const systemPrompt = getSystemPromptByRoute(location.pathname);
      const result = await sceneChat(text, systemPrompt, token);
      
      // 添加 AI 回复到对话记录
      const assistantMessageId = `${Date.now()}-assistant`;
      setMessages((prev) => [
        ...prev,
        { id: assistantMessageId, role: "assistant", content: result.reply || "抱歉，未获得回复，请稍后重试。" },
      ]);
    } catch (error) {
      Toast.show({ content: "对话失败，请稍后再试" });
      // 删除最后添加的用户消息
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setInput("");
  };

  const handleQuickAsk = (text) => {
    setInput(text);
  };

  const handleJumpToMessage = (messageId) => {
    const target = messageRefs.current[messageId];
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <>
      {/* 悬浮球 */}
      <button
        onClick={() => setVisible(true)}
        className="ai-floating-ball"
        aria-label="AI助手"
        title="AI助手"
      >
        <span className="ai-floating-ping" />
        <div className="ai-ball-content">✨</div>
      </button>

      {visible && (
        <div className="ai-chat-overlay" onClick={() => setVisible(false)}>
          <div className="ai-chat-panel" onClick={(event) => event.stopPropagation()}>
            <div className="ai-chat-panel-header">
              <div className="ai-chat-panel-title">AI导游助手</div>
              <div className="ai-chat-panel-actions">
                <button type="button" className="ai-panel-btn ai-panel-btn-light" onClick={handleReset}>
                  清空
                </button>
              </div>
              <button
                type="button"
                className="ai-panel-corner-close"
                onClick={() => setVisible(false)}
                aria-label="关闭AI对话"
              >
                ×
              </button>
            </div>

            <div className="ai-chat-container">
              <aside className="ai-history-panel">
                <div className="ai-history-title">聊天历史</div>
                {historyItems.length === 0 ? (
                  <div className="ai-history-empty">发送第一条消息后会在这里出现记录</div>
                ) : (
                  <div className="ai-history-list">
                    {historyItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="ai-history-item"
                        onClick={() => handleJumpToMessage(item.id)}
                      >
                        <span className="ai-history-question">Q: {item.question}</span>
                        <span className="ai-history-answer">A: {item.answer}</span>
                      </button>
                    ))}
                  </div>
                )}
              </aside>

              <div className="ai-chat-main">
                <div className="ai-chat-scene-header">
                  <div className="ai-chat-scene-title">{sceneMeta.title}</div>
                  <div className="ai-chat-scene-subtitle">当前路径：{location.pathname}</div>
                  <p className="ai-chat-context">上下文：{currentPrompt}</p>
                </div>

                <div className="ai-messages-list">
                  {messages.length === 0 && (
                    <div className="ai-empty-state">
                      <div className="ai-empty-icon">💬</div>
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
                      ref={(node) => {
                        if (msg.id && node) {
                          messageRefs.current[msg.id] = node;
                        }
                      }}
                      className={`ai-message ai-message-${msg.role}`}
                    >
                      <div className="ai-message-bubble">{msg.content}</div>
                    </div>
                  ))}
                  {loading && (
                    <div className="ai-message ai-message-assistant">
                      <div className="ai-message-bubble ai-message-loading">
                        <DotLoading color="primary" />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="ai-input-area">
                  <Input
                    placeholder="输入你的问题"
                    value={input}
                    onChange={setInput}
                    onEnter={handleSend}
                    disabled={loading}
                    clearable
                  />
                  <Button
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
