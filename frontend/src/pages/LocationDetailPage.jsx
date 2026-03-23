import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, DotLoading } from "antd-mobile";

import { fetchLocationById } from "../api";

export default function LocationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);

  useEffect(() => {
    fetchLocationById(id).then(setItem);
  }, [id]);

  if (!item) {
    return (
      <div className="card card-glass text-center">
        <DotLoading color="primary" />
      </div>
    );
  }

  return (
    <div className="page-fade-in">
      <Button size="small" onClick={() => navigate(-1)}>
        返回
      </Button>

      <div className="hero-shell mt-2 mb-3">
        <div className="hero-kicker">Location Detail</div>
        <h1 className="page-title m-0">{item.name}</h1>
      </div>

      <div className="card card-glass">
        <p className="text-sm text-slate-700 leading-6">{item.description}</p>
        <p className="text-xs text-slate-500">
          <span className="chip-soft">坐标 {item.latitude}, {item.longitude}</span>
        </p>
      </div>
    </div>
  );
}
