import sys

overview = """import { useEffect, useState } from "react";
import LucideIcon from "../components/LucideIcon";
import { DotLoading } from "antd-mobile";
import { useNavigate } from "react-router-dom";
import { fetchKnowledgeBaseCommonPage } from "../api";
import { ImmersivePage, CardComponent } from "../components/SharedUI";

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
      <ImmersivePage>
        <div className="flex-1 flex justify-center items-center h-48">
          <DotLoading color="white" />
        </div>
      </ImmersivePage>
    );
  }

  if (!data) {
    return (
      <ImmersivePage>
        <CardComponent variant="glass" className="text-center mt-6">
          <p className="text-white/80">泸沽湖整体介绍加载失败</p>
        </CardComponent>
      </ImmersivePage>
    );
  }

  const details = data.details || {};
  const sections = data.sections || {};
  const highlights = Array.isArray(details.highlights) ? details.highlights : [];

  return (
    <ImmersivePage bgImage="/images/lugu-hero.jpg" className="page-fade-in pb-[env(safe-area-inset-bottom)]">
      <div className="mb-4 pt-2 -mx-2">
        <button
          type="button"
          className="px-2 py-1 inline-flex items-center text-white/80 hover:text-white transition-colors"
          onClick={() => navigate("/home", { state: { openPanel: "overview" } })}
        >
          <LucideIcon name="ChevronLeft" size={20} className="mr-1" /> 返回
        </button>
      </div>

      <div className="mb-6">
        <div className="text-cyan-400 text-sm font-bold tracking-wider uppercase mb-1 drop-shadow-md text-shadow-sm">Lugu Lake Overview</div>
        <h1 className="text-3xl font-bold text-white drop-shadow-lg m-0 text-shadow">{data.title || data.name}</h1>
      </div>

      <CardComponent variant="glass" className="mb-4">
        <p className="text-white/90 text-justify mb-0 leading-relaxed">{data.description || ""}</p>
        {details.introduction && (
          <div className="mt-4 text-sm text-white/70 leading-relaxed border-t border-white/10 pt-3">
            {details.introduction}
          </div>
        )}
      </CardComponent>

      {highlights.length > 0 && (
        <CardComponent variant="glass" className="mb-4">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center">
            <LucideIcon name="Sparkles" size={18} className="mr-2 text-yellow-400" />
            {sections.highlightsTitle || "核心亮点"}
          </h2>
          <div className="flex flex-wrap gap-2">
            {highlights.map((item, idx) => (
              <span key={`hl-${idx}`} className="px-3 py-1.5 bg-white/10 backdrop-blur border border-white/20 text-white rounded-full text-sm shadow-sm transition hover:bg-white/20">
                {item}
              </span>
            ))}
          </div>
        </CardComponent>
      )}

      {(details.bestSeasonToVisit || details.recommendedDuration || details.accommodationTips) && (
        <CardComponent variant="glass" className="mb-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center">
            <LucideIcon name="Info" size={18} className="mr-2 text-cyan-400" />
            {sections.tipsTitle || sections.visitTipsTitle || "游览建议"}
          </h2>
          <div className="space-y-3 text-sm text-white/80">
            {details.bestSeasonToVisit && (
              <div className="flex items-start">
                <span className="font-semibold text-white min-w-[70px]">最佳季节：</span>
                <span className="flex-1">{details.bestSeasonToVisit}</span>
              </div>
            )}
            {details.recommendedDuration && (
              <div className="flex items-start">
                <span className="font-semibold text-white min-w-[70px]">推荐时长：</span>
                <span className="flex-1">{details.recommendedDuration}</span>
              </div>
            )}
            {details.accommodationTips && (
              <div className="flex items-start">
                <span className="font-semibold text-white min-w-[70px]">住宿建议：</span>
                <span className="flex-1">{details.accommodationTips}</span>
              </div>
            )}
          </div>
        </CardComponent>
      )}
    </ImmersivePage>
  );
}
"""

with open("frontend/src/pages/LuguLakeOverviewPage.jsx", "w", encoding="utf-8") as f:
    f.write(overview)

print("Overview page done")
