import { useEffect, useState } from "react";
import { DotLoading } from "antd-mobile";
import { useNavigate } from "react-router-dom";
import { fetchKnowledgeBaseCommonPage } from "../api";

export default function MosuoCulturePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const json = await fetchKnowledgeBaseCommonPage("mosuo-culture");
        setData(json || null);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, []);

  if (loading) {
    return (
      <div className="card card-glass text-center">
        <DotLoading color="primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card card-glass text-center">
        <p>摩梭文化介绍加载失败</p>
      </div>
    );
  }

  const details = data.details || {};
  const sections = data.sections || {};
  const highlights = Array.isArray(details.highlights) ? details.highlights : [];
  const tips = Array.isArray(details.experienceTips) ? details.experienceTips : [];

  return (
    <div className="page-fade-in">
      <div className="card card-glass mb-3">
        <button
          type="button"
          className="home-popup-back"
          onClick={() => navigate("/home", { state: { openPanel: "overview" } })}
        >
          ← 返回
        </button>
      </div>

      <div className="hero-shell detail-hero mb-3">
        <div className="hero-kicker detail-hero-kicker">Mosuo Culture</div>
        <h1 className="page-title detail-hero-title m-0">{data.title || data.name}</h1>
      </div>

      <div className="card card-glass">
        <p className="detail-description">{data.description || ""}</p>
        {details.introduction ? (
          <div className="mt-3 text-sm text-white/60 leading-relaxed">{details.introduction}</div>
        ) : null}
      </div>

      {highlights.length > 0 ? (
        <div className="card card-glass">
          <div className="detail-section-title">{sections.highlightsTitle || "文化亮点"}</div>
          <div className="flex flex-wrap gap-2">
            {highlights.map((item, idx) => (
              <span key={`c-hl-${idx}`} className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm">
                ✨ {item}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {tips.length > 0 ? (
        <div className="card card-glass">
          <div className="detail-section-title">{sections.tipsTitle || sections.experienceTipsTitle || "参访建议"}</div>
          <ul className="text-sm text-white/80 mt-0 mb-0 pl-5">
            {tips.map((item, idx) => (
              <li key={`tip-${idx}`} className="mb-1">{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
