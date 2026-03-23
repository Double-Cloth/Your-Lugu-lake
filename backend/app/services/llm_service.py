import json

import requests

from app.core.config import settings


def _fallback_route(preference: str, locations: list[dict]) -> dict:
    top = locations[:4]
    return {
        "title": "泸沽湖文化体验路线",
        "preference": preference,
        "timeline": [
            {"time": "09:00", "location": top[0]["name"], "stay_minutes": 60},
            {"time": "10:30", "location": top[1]["name"], "stay_minutes": 75},
            {"time": "12:30", "location": top[2]["name"], "stay_minutes": 90},
            {"time": "15:00", "location": top[3]["name"], "stay_minutes": 60},
        ],
    }


def generate_route_with_fallback(requirement: dict, locations: list) -> dict:
    location_dicts = [
        {
            "id": item.id,
            "name": item.name,
            "category": item.category,
            "latitude": item.latitude,
            "longitude": item.longitude,
        }
        for item in locations
    ]

    if len(location_dicts) < 4:
        return {
            "title": "景点数据不足",
            "timeline": [],
            "tips": "请先初始化景点数据",
        }

    if not settings.dashscope_api_key:
        return _fallback_route(requirement.get("preference", "综合"), location_dicts)

    prompt = {
        "role": "user",
        "content": [
            {
                "text": (
                    "请基于以下泸沽湖景点生成一天的时间轴路线，返回严格JSON："
                    "{title,preference,timeline:[{time,location,stay_minutes,highlight}]}。"
                    f"用户需求: {json.dumps(requirement, ensure_ascii=False)}。"
                    f"景点: {json.dumps(location_dicts, ensure_ascii=False)}"
                )
            }
        ],
    }

    try:
        resp = requests.post(
            "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
            headers={
                "Authorization": f"Bearer {settings.dashscope_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.dashscope_model,
                "input": {"messages": [prompt]},
                "parameters": {"result_format": "message"},
            },
            timeout=25,
        )
        resp.raise_for_status()
        data = resp.json()
        text = data.get("output", {}).get("choices", [{}])[0].get("message", {}).get("content", "{}")
        parsed = json.loads(text) if isinstance(text, str) else text
        if isinstance(parsed, dict) and parsed.get("timeline"):
            return parsed
    except Exception:
        pass

    return _fallback_route(requirement.get("preference", "综合"), location_dicts)
