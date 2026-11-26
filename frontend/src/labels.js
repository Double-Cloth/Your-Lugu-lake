const CATEGORY_LABELS = {
  culture: "人文文化",
  cultural: "人文文化",
  nature: "自然风光",
  natural: "自然风光",
  scenic: "自然景观",
  scenery: "自然景观",
  lake: "湖泊",
  mountain: "山景",
  island: "岛屿",
  village: "村落",
  wetland: "湿地",
  museum: "博物馆",
  temple: "寺院",
  viewpoint: "观景点",
  photography: "摄影点",
  food: "餐饮美食",
  restaurant: "餐饮美食",
  hotel: "住宿",
  accommodation: "住宿",
  ticket: "票务",
  service: "服务设施",
  shopping: "购物",
};

export function formatCategoryLabel(value) {
  if (value === undefined || value === null || value === "") {
    return "景点";
  }
  const raw = String(value).trim();
  return CATEGORY_LABELS[raw.toLowerCase()] || raw;
}
