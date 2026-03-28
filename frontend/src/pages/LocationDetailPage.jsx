import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { DotLoading } from "antd-mobile";

import { fetchLocationDetail, fetchKnowledgeBaseLocationImages } from "../api";

export default function LocationDetailPage() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [galleryImages, setGalleryImages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLocation() {
      setLoading(true);
      try {
        const locationData = await fetchLocationDetail(id);
        setItem(locationData);
        
        // 从知识库加载图片
        if (locationData) {
          // 仅使用slug读取知识库图片，避免将数字ID误当slug请求
          let images = [];
          if (locationData.slug) {
            images = await fetchKnowledgeBaseLocationImages(locationData.slug);
          }
          setGalleryImages(images);
        }
      } catch (error) {
        console.error("Failed to load location detail:", error);
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      loadLocation();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="card card-glass text-center">
        <DotLoading color="primary" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="card card-glass text-center">
        <p>景点信息加载失败</p>
      </div>
    );
  }

  const { details = {}, location = {}, facilities = {}, ticketInfo = {}, transportation = {}, sections = {} } = item;

  return (
    <div className="page-fade-in">
      <div className="hero-shell detail-hero mb-3">
        <div className="hero-kicker detail-hero-kicker">Location Detail</div>
        <h1 className="page-title detail-hero-title m-0">{item.name}</h1>
      </div>

      {/* 基本信息卡片 */}
      <div className="card card-glass">
        <div className="detail-meta-row">
          <span className="detail-category-chip">{item.category || "景点"}</span>
          <span className="detail-coordinate">
            坐标 {item.latitude?.toFixed(4)}, {item.longitude?.toFixed(4)}
          </span>
        </div>
        <p className="detail-description">{item.description}</p>
        {details.introduction && (
          <div className="mt-3 text-sm text-white/60 leading-relaxed">
            {details.introduction}
          </div>
        )}
      </div>

      {/* 景点亮点 */}
      {details.highlights && details.highlights.length > 0 && (
        <div className="card card-glass">
          <div className="detail-section-title">{sections.highlightsTitle || "景点亮点"}</div>
          <div className="flex flex-wrap gap-2">
            {details.highlights.map((highlight, idx) => (
              <span key={idx} className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm">
                ✨ {highlight}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 景点图片 */}
      <div className="card card-glass">
        <div className="detail-section-title">{sections.galleryTitle || "景点图片"}</div>
        {galleryImages.length > 0 ? (
          <div className="detail-gallery-grid">
            {galleryImages.map((src) => (
              <img
                key={src}
                src={src}
                alt={`${item.name} 图片`}
                className="detail-gallery-image"
              />
            ))}
          </div>
        ) : (
          <p className="detail-gallery-empty">
            当前景点图片待补充。请将图片放入
            <br />
            <code>/knowledge-base/locations/{item.slug || item.id}/images/</code>
          </p>
        )}
        <p className="detail-gallery-tip">支持 jpg、jpeg、png、webp 格式。</p>
      </div>

      {/* 游览信息 */}
      {(details.bestSeasonToVisit || details.recommendedDuration) && (
        <div className="card card-glass">
          <div className="detail-section-title">{sections.visitInfoTitle || "游览信息"}</div>
          <div className="space-y-2 text-sm">
            {details.bestSeasonToVisit && (
              <div>
                <span className="font-semibold">最佳季节：</span>
                {details.bestSeasonToVisit}
              </div>
            )}
            {details.recommendedDuration && (
              <div>
                <span className="font-semibold">推荐时长：</span>
                {details.recommendedDuration}
              </div>
            )}
            {details.accommodationTips && (
              <div>
                <span className="font-semibold">住宿建议：</span>
                {details.accommodationTips}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 位置信息 */}
      {(location.province || location.city || location.address) && (
        <div className="card card-glass">
          <div className="detail-section-title">{sections.locationTitle || "位置信息"}</div>
          <div className="space-y-1 text-sm">
            {location.province && <div>📍 {location.province}</div>}
            {location.city && <div className="ml-2">{location.city}</div>}
            {location.district && <div className="ml-2">{location.district}</div>}
            {location.address && <div className="font-semibold mt-2">{location.address}</div>}
          </div>
        </div>
      )}

      {/* 交通方式 */}
      {Object.keys(transportation).length > 0 && (
        <div className="card card-glass">
          <div className="detail-section-title">{sections.transportationTitle || "交通方式"}</div>
          <div className="space-y-2 text-sm">
            {transportation.byAir && <div>✈️ {transportation.byAir}</div>}
            {transportation.byTrain && <div>🚂 {transportation.byTrain}</div>}
            {transportation.byBus && <div>🚌 {transportation.byBus}</div>}
            {transportation.byBoat && <div>🚤 {transportation.byBoat}</div>}
          </div>
        </div>
      )}

      {/* 设施信息 */}
      {Object.keys(facilities).length > 0 && (
        <div className="card card-glass">
          <div className="detail-section-title">{sections.facilitiesTitle || "设施服务"}</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {facilities.parking !== undefined && (
              <div>🅿️ 停车场 {facilities.parking ? "✅" : "❌"}</div>
            )}
            {facilities.restroom !== undefined && (
              <div>🚻 卫生间 {facilities.restroom ? "✅" : "❌"}</div>
            )}
            {facilities.foodAndDrink !== undefined && (
              <div>🍽️ 餐饮 {facilities.foodAndDrink ? "✅" : "❌"}</div>
            )}
            {facilities.accommodation !== undefined && (
              <div>🏨 住宿 {facilities.accommodation ? "✅" : "❌"}</div>
            )}
            {facilities.medicalService !== undefined && (
              <div>🏥 医疗 {facilities.medicalService ? "✅" : "❌"}</div>
            )}
          </div>
        </div>
      )}

      {/* 票价信息 */}
      {ticketInfo.price && (
        <div className="card card-glass">
          <div className="detail-section-title">{sections.ticketTitle || "票价信息"}</div>
          <div className="text-lg font-bold">
            ¥{ticketInfo.price} {ticketInfo.currency}
          </div>
          {ticketInfo.validDays && <div className="text-sm text-white/60">有效期：{ticketInfo.validDays}天</div>}
          {ticketInfo.remark && <div className="text-xs text-white/50 mt-2">{ticketInfo.remark}</div>}
        </div>
      )}

      {/* 基础信息 */}
      <div className="card card-glass">
        <p className="text-xs text-white/50">
          <span className="chip-soft">景点ID {item.id}</span>
          {item.slug && <span className="chip-soft ml-2">标识 {item.slug}</span>}
          {item._source && <span className="chip-soft ml-2">数据源 {item._source}</span>}
        </p>
      </div>
    </div>
  );
}
