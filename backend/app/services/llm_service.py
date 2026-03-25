import json

import requests

from app.core.config import settings


def generate_route(requirement: dict, locations: list) -> dict:
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
        raise ValueError("景点数据不足，无法生成路线")

    if not settings.dashscope_api_key:
        raise ValueError("未配置 DashScope API Key")

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
        raise ValueError("模型返回格式异常")
    except Exception as exc:
        raise ValueError("路线生成失败") from exc


def chat(message: str, system_prompt: str | None = None) -> str:
    """通用AI对话接口"""
    if not settings.dashscope_api_key:
        raise ValueError("未配置 DashScope API Key")

    messages = []
    
    # 如果提供了系统提示词，添加到对话上下文
    if system_prompt:
        messages.append({
            "role": "system",
            "content": [{"text": system_prompt}]
        })
    
    messages.append({
        "role": "user",
        "content": [{"text": message}]
    })

    try:
        resp = requests.post(
            "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
            headers={
                "Authorization": f"Bearer {settings.dashscope_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.dashscope_model,
                "input": {"messages": messages},
                "parameters": {"result_format": "message"},
            },
            timeout=25,
        )
        resp.raise_for_status()
        data = resp.json()
        text = data.get("output", {}).get("choices", [{}])[0].get("message", {}).get("content", "")
        return text if text else "抱歉，未获得回复，请稍后重试"
    except Exception as exc:
        raise ValueError("对话失败") from exc
