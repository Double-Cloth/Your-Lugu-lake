import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { DotLoading } from "antd-mobile";

import { fetchLocationById } from "../api";

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
const IMAGE_SLOTS = [1, 2, 3, 4];

function checkImageExists(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(src);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export default function LocationDetailPage() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [galleryImages, setGalleryImages] = useState([]);

  const imageCandidates = useMemo(() => {
    if (!id) return [];
    return IMAGE_SLOTS.flatMap((idx) =>
      IMAGE_EXTENSIONS.map((ext) => `/images/locations/${id}-${idx}.${ext}`)
    );
  }, [id]);

  useEffect(() => {
    fetchLocationById(id).then(setItem);
  }, [id]);

  useEffect(() => {
    let canceled = false;

    async function resolveGalleryImages() {
      const checks = await Promise.all(imageCandidates.map((src) => checkImageExists(src)));
      if (!canceled) {
        setGalleryImages(checks.filter(Boolean));
      }
    }

    if (imageCandidates.length === 0) {
      setGalleryImages([]);
      return () => {
        canceled = true;
      };
    }

    void resolveGalleryImages();

    return () => {
      canceled = true;
    };
  }, [imageCandidates]);

  if (!item) {
    return (
      <div className="card card-glass text-center">
        <DotLoading color="primary" />
      </div>
    );
  }

  return (
    <div className="page-fade-in">
      <div className="hero-shell detail-hero mb-3">
        <div className="hero-kicker detail-hero-kicker">Location Detail</div>
        <h1 className="page-title detail-hero-title m-0">{item.name}</h1>
      </div>

      <div className="card card-glass">
        <div className="detail-meta-row">
          <span className="detail-category-chip">{item.category || "景点"}</span>
          <span className="detail-coordinate">坐标 {item.latitude}, {item.longitude}</span>
        </div>
        <p className="detail-description">{item.description}</p>
      </div>

      <div className="card card-glass">
        <div className="detail-section-title">景点图片</div>
        {galleryImages.length > 0 ? (
          <div className="detail-gallery-grid">
            {galleryImages.map((src) => (
              <img key={src} src={src} alt={`${item.name} 图片`} className="detail-gallery-image" />
            ))}
          </div>
        ) : (
          <p className="detail-gallery-empty">
            当前景点图片待补充。请将图片放入 /public/images/locations 目录，并按 {`{id}-1.jpg`} 这类命名。
          </p>
        )}
        <p className="detail-gallery-tip">支持 jpg、jpeg、png、webp 格式。</p>
      </div>

      <div className="card card-glass">
        <p className="text-xs text-slate-500">
          <span className="chip-soft">景点ID {item.id}</span>
        </p>
      </div>
    </div>
  );
}
