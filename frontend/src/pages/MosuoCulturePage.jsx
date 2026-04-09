import { useEffect, useState } from "react";
import LucideIcon from "../components/LucideIcon";
import { DotLoading } from "antd-mobile";
import { useNavigate } from "react-router-dom";
import { fetchKnowledgeBaseCommonPage } from "../api";
import { ImmersivePage, CardComponent } from "../components/SharedUI";

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
          <p className="text-white/80">摩梭文化介绍加载失败</p>
        </CardComponent>
      </ImmersivePage>
    );
  }

  const details = data.details || {};
  const sections = data.sections || {};
  const highlights = Array.isArray(details.highlights) ? details.highlights : [];
  const tips = Array.isArray(details.experienceTips) ? details.experienceTips : [];

  return (
    <ImmersivePage bgImage="/images/lugu-hero.png" className="page-fade-in pb-[env(safe-area-inset-bottom)]">
      <div className="mb-4 pt-2 -mx-2">
        <button
          type="button"
          className="px-2 py-1 inline-flex items-center text-amber-100/80 hover:text-white transition-colors"
          onClick={() => navigate("/home", { state: { openPanel: "overview" } })}
        >
          <LucideIcon name="ChevronLeft" size={20} className="mr-1" /> 返回
        </button>
      </div>

      <div className="mb-6">
        <div className="text-amber-200 text-sm font-bold tracking-wider uppercase mb-1 drop-shadow-md text-shadow-sm">Mosuo Culture</div>
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
            <LucideIcon name="Sparkles" size={18} className="mr-2 text-amber-200" />
            {sections.highlightsTitle || "文化亮点"}
          </h2>
          <div className="flex flex-wrap gap-2">
            {highlights.map((item, idx) => (
              <span key={`c-hl-${idx}`} className="px-3 py-1.5 bg-white/10 backdrop-blur border border-white/20 text-white rounded-full text-sm shadow-sm transition hover:bg-white/20">
                {item}
              </span>
            ))}
          </div>
        </CardComponent>
      )}

      {tips.length > 0 && (
        <CardComponent variant="glass" className="mb-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center">
            <LucideIcon name="Info" size={18} className="mr-2 text-cyan-200" />
            {sections.tipsTitle || sections.experienceTipsTitle || "参访建议"}
          </h2>
          <ul className="text-sm text-white/80 mt-0 mb-0 pl-5 space-y-2 list-disc marker:text-cyan-200">
            {tips.map((item, idx) => (
              <li key={`tip-${idx}`} className="pl-1">{item}</li>
            ))}
          </ul>
        </CardComponent>
      )}
    </ImmersivePage>
  );
}
