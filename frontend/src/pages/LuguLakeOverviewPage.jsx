import { useEffect, useState } from "react";
import { DotLoading } from "antd-mobile";
import { useNavigate } from "react-router-dom";
import { fetchKnowledgeBaseCommonPage } from "../api";

export default function LuguLakeOverviewPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const json = await fetchKnowledgeBaseCommonPage("lugu-lake");
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
        <p>泸沽湖整体介绍加载失败</p>
      </div>
    );
  }

  const details = data.details || {};
  const sections = data.sections || {};
  const highlights = Array.isArray(details.highlights) ? details.highlights : [];

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
        <div className="hero-kicker detail-hero-kicker">Lugu Lake Overview</div>
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
          <div className="detail-section-title">{sections.highlightsTitle || "核心亮点"}</div>
          <div className="flex flex-wrap gap-2">
            {highlights.map((item, idx) => (
              <span key={`hl-${idx}`} className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm">
                ✨ {item}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="card card-glass">
        <div className="detail-section-title">{sections.tipsTitle || sections.visitTipsTitle || "游览建议"}</div>
        <div className="space-y-2 text-sm">
          {details.bestSeasonToVisit ? (
            <div>
              <span className="font-semibold">最佳季节：</span>
              {details.bestSeasonToVisit}
            </div>
          ) : null}
          {details.recommendedDuration ? (
            <div>
              <span className="font-semibold">推荐时长：</span>
              {details.recommendedDuration}
            </div>
          ) : null}
          {details.accommodationTips ? (
            <div>
              <span className="font-semibold">住宿建议：</span>
              {details.accommodationTips}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
