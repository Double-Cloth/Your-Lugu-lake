import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DotLoading } from "antd-mobile";

import { fetchLocations } from "../api";

export default function HomePage() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLocations()
      .then(setLocations)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-fade-in">
      <div className="hero-shell mb-3">
        <div className="hero-kicker">Lake Explorer</div>
        <h1 className="page-title m-0">泸沽湖智能导览</h1>
        <p className="hero-copy">发现人文与自然交织的路线，收藏你的泸沽湖记忆。</p>
      </div>

      <div className="card card-glass">
        <h3 className="section-title">景点推荐</h3>
        <p className="mt-2 text-sm text-slate-600">移动端优先展示，点击可进入景点详情页。</p>
      </div>

      {loading ? (
        <div className="card card-glass text-center">
          <DotLoading color="primary" />
        </div>
      ) : (
        locations.map((item) => (
          <Link to={`/locations/${item.id}`} key={item.id} className="block card card-glass list-card no-underline text-current">
            <div className="flex items-center justify-between">
              <h3 className="m-0 text-lg">{item.name}</h3>
              <span className="chip-soft">{item.category}</span>
            </div>
            <p className="text-sm text-slate-600 mt-2 mb-0 line-clamp-2">{item.description}</p>
          </Link>
        ))
      )}
    </div>
  );
}
