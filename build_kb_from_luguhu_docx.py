import json
import shutil
from datetime import datetime
from pathlib import Path

ROOT = Path(r"d:\DC\program-projects\Your-Lugu-lake")
KB_LOC = ROOT / "knowledge-base" / "locations"
MEDIA_DIR = ROOT / "泸沽湖" / "word" / "media"
INDEX_PATH = KB_LOC / "index.json"

SPOTS = [
    {"name": "走婚桥", "slug": "zouhun-bridge", "category": "culture", "lat": 27.7921, "lon": 100.8325, "province": "四川省", "city": "凉山彝族自治州", "district": "盐源县", "address": "泸沽湖草海片区"},
    {"name": "草海", "slug": "caohai-wetland", "category": "nature", "lat": 27.7870, "lon": 100.8290, "province": "四川省", "city": "凉山彝族自治州", "district": "盐源县", "address": "泸沽湖草海湿地区"},
    {"name": "女神湾", "slug": "nvshen-bay", "category": "nature", "lat": 27.7530, "lon": 100.7000, "province": "四川省", "city": "凉山彝族自治州", "district": "盐源县", "address": "泸沽湖赵家湾"},
    {"name": "王妃岛", "slug": "wangfei-island", "category": "culture", "lat": 27.7060, "lon": 100.7890, "province": "四川省", "city": "凉山彝族自治州", "district": "盐源县", "address": "泸沽湖博凹岛"},
    {"name": "摩梭博物馆", "slug": "mosuo-museum", "category": "culture", "lat": 27.7050, "lon": 100.7920, "province": "四川省", "city": "凉山彝族自治州", "district": "盐源县", "address": "泸沽湖镇"},
    {"name": "洛洼半岛", "slug": "luowa-peninsula", "category": "nature", "lat": 27.7200, "lon": 100.8050, "province": "四川省", "city": "凉山彝族自治州", "district": "盐源县", "address": "泸沽湖洛洼片区"},
    {"name": "情人滩", "slug": "lovers-beach", "category": "nature", "lat": 27.7300, "lon": 100.8450, "province": "云南省", "city": "丽江市", "district": "宁蒗县", "address": "泸沽湖洼垮湖湾"},
    {"name": "泸源崖", "slug": "luyuan-cliff", "category": "nature", "lat": 27.7600, "lon": 100.8200, "province": "四川省", "city": "凉山彝族自治州", "district": "盐源县", "address": "泸沽湖东岸"},
    {"name": "祭神台", "slug": "jishen-platform", "category": "culture", "lat": 27.7460, "lon": 100.8120, "province": "四川省", "city": "凉山彝族自治州", "district": "盐源县", "address": "泸沽湖湖岸高处"},
    {"name": "后龙山", "slug": "houlong-mountain", "category": "nature", "lat": 27.7600, "lon": 100.8350, "province": "四川省", "city": "凉山彝族自治州", "district": "盐源县", "address": "泸沽湖东岸"},
    {"name": "里务比岛", "slug": "liwubi-island", "category": "culture", "lat": 27.6960, "lon": 100.7820, "province": "云南省", "city": "丽江市", "district": "宁蒗县", "address": "泸沽湖湖心岛"},
    {"name": "黑瓦俄岛", "slug": "heiwae-island", "category": "nature", "lat": 27.6940, "lon": 100.7810, "province": "云南省", "city": "丽江市", "district": "宁蒗县", "address": "泸沽湖湖心小岛"},
    {"name": "阿夏幽谷", "slug": "axia-valley", "category": "nature", "lat": 27.6840, "lon": 100.7750, "province": "云南省", "city": "丽江市", "district": "宁蒗县", "address": "泸沽湖西南角"},
    {"name": "小落水村", "slug": "xiaoluoshui-village", "category": "culture", "lat": 27.7440, "lon": 100.8550, "province": "云南省", "city": "丽江市", "district": "宁蒗县", "address": "泸沽湖北岸"},
    {"name": "大落水村", "slug": "daluoshui-village", "category": "culture", "lat": 27.7040, "lon": 100.7930, "province": "云南省", "city": "丽江市", "district": "宁蒗县", "address": "永宁镇落水行政村"},
    {"name": "里格半岛", "slug": "lige-peninsula", "category": "nature", "lat": 27.7271, "lon": 100.7517, "province": "云南省", "city": "丽江市", "district": "宁蒗县", "address": "泸沽湖西北岸"},
    {"name": "格姆女神山", "slug": "gemu-goddess-mountain", "category": "nature", "lat": 27.7400, "lon": 100.7600, "province": "云南省", "city": "丽江市", "district": "宁蒗县", "address": "泸沽湖西北岸"},
]


with INDEX_PATH.open("r", encoding="utf-8") as f:
    index_data = json.load(f)

existing = {item.get("slug") for item in index_data.get("locations", []) if isinstance(item, dict)}
max_id = 0
for item in index_data.get("locations", []):
    if isinstance(item, dict):
        try:
            max_id = max(max_id, int(item.get("id") or 0))
        except Exception:
            pass

media_files = sorted([p for p in MEDIA_DIR.iterdir() if p.is_file() and p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}])
if not media_files:
    raise RuntimeError("No media files found in source folder")

cursor = 0
added = []
for spot in SPOTS:
    slug = spot["slug"]
    if slug in existing:
        continue

    max_id += 1
    spot_id = max_id

    loc_dir = KB_LOC / slug
    img_dir = loc_dir / "images"
    img_dir.mkdir(parents=True, exist_ok=True)

    pick = [media_files[cursor % len(media_files)]]
    if len(media_files) > 1:
        pick.append(media_files[(cursor + 1) % len(media_files)])
    cursor += 2

    copied_names = []
    for i, src in enumerate(pick, start=1):
        dst_name = f"{i}{src.suffix.lower()}"
        shutil.copy2(src, img_dir / dst_name)
        copied_names.append(dst_name)

    description = f"{spot['name']}景点信息基于根目录“泸沽湖”文档整理，建议后续按实地资料继续完善。"

    info = {
        "id": spot_id,
        "name": spot["name"],
        "slug": slug,
        "category": spot["category"],
        "latitude": spot["lat"],
        "longitude": spot["lon"],
        "description": description,
        "details": {
            "introduction": description,
            "highlights": ["文档资料导入", "泸沽湖片区", "可继续扩展"],
            "bestSeasonToVisit": "全年",
            "recommendedDuration": "1-2小时",
            "accommodationTips": "建议结合大落水或里格片区住宿安排"
        },
        "sections": {
            "highlightsTitle": "景点亮点",
            "galleryTitle": "景点图片",
            "visitInfoTitle": "游览信息",
            "locationTitle": "位置信息",
            "transportationTitle": "交通方式",
            "facilitiesTitle": "设施服务",
            "ticketTitle": "票价信息"
        },
        "location": {
            "province": spot["province"],
            "city": spot["city"],
            "district": spot["district"],
            "address": spot["address"]
        },
        "transportation": {
            "byAir": "可从丽江三义机场转车前往泸沽湖",
            "byTrain": "可从丽江站转乘客运前往",
            "byBus": "泸沽湖景区有环湖线路可接驳"
        },
        "facilities": {
            "parking": True,
            "restroom": True,
            "foodAndDrink": True,
            "accommodation": True,
            "medicalService": False
        },
        "ticketInfo": {
            "price": 0,
            "currency": "CNY",
            "validDays": 1,
            "remark": "具体票价以景区公示为准"
        },
        "contact": {
            "phone": "",
            "website": ""
        },
        "tags": ["泸沽湖", "文档导入", spot["category"]],
        "images": {
            "count": len(copied_names),
            "basePath": "images/",
            "files": copied_names
        },
        "audioUrl": "",
        "lastUpdated": datetime.now().strftime("%Y-%m-%d")
    }

    with (loc_dir / "info.json").open("w", encoding="utf-8") as f:
        json.dump(info, f, ensure_ascii=False, indent=2)

    index_data.setdefault("locations", []).append({
        "slug": slug,
        "id": spot_id,
        "name": spot["name"],
    })
    added.append(spot)

index_data["lastUpdated"] = datetime.now().strftime("%Y-%m-%d")
with INDEX_PATH.open("w", encoding="utf-8") as f:
    json.dump(index_data, f, ensure_ascii=False, indent=2)

print(f"Added {len(added)} locations")
for item in added:
    print(f"- {item['name']} ({item['slug']})")
