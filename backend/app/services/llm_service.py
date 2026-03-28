import json
import math
import re
from collections import Counter
from pathlib import Path

import requests

from app.core.config import settings


PROJECT_ROOT = Path(__file__).resolve().parents[3]
KNOWLEDGE_BASE_ROOT = PROJECT_ROOT / "knowledge-base"


def _read_json_file(path: Path) -> dict | list | None:
    if not path.exists() or not path.is_file():
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def _to_compact_text(value, prefix: str = "") -> str:
    lines: list[str] = []
    if isinstance(value, dict):
        for key, item in value.items():
            next_prefix = f"{prefix}.{key}" if prefix else str(key)
            text = _to_compact_text(item, next_prefix)
            if text:
                lines.append(text)
    elif isinstance(value, list):
        for idx, item in enumerate(value):
            next_prefix = f"{prefix}[{idx}]" if prefix else f"item[{idx}]"
            text = _to_compact_text(item, next_prefix)
            if text:
                lines.append(text)
    else:
        literal = str(value).strip()
        if literal:
            lines.append(f"{prefix}: {literal}" if prefix else literal)
    return "\n".join(lines)


def _chunk_text(text: str, chunk_size: int = 220, overlap: int = 40) -> list[str]:
    text = (text or "").strip()
    if not text:
        return []
    if len(text) <= chunk_size:
        return [text]

    chunks: list[str] = []
    step = max(chunk_size - overlap, 40)
    start = 0
    while start < len(text):
        end = min(len(text), start + chunk_size)
        part = text[start:end].strip()
        if part:
            chunks.append(part)
        if end >= len(text):
            break
        start += step
    return chunks


_ASCII_TOKEN_RE = re.compile(r"[a-zA-Z0-9_]+")
_CJK_RE = re.compile(r"[\u4e00-\u9fff]")


def _tokenize(text: str) -> list[str]:
    source = (text or "").lower()
    tokens = _ASCII_TOKEN_RE.findall(source)

    cjk_chars = _CJK_RE.findall(source)
    if cjk_chars:
        tokens.extend(cjk_chars)
        if len(cjk_chars) >= 2:
            tokens.extend("".join(cjk_chars[i : i + 2]) for i in range(len(cjk_chars) - 1))

    return tokens


def _cosine_similarity(a: Counter, b: Counter) -> float:
    if not a or not b:
        return 0.0

    dot = sum(a[token] * b.get(token, 0) for token in a)
    if dot <= 0:
        return 0.0

    norm_a = math.sqrt(sum(v * v for v in a.values()))
    norm_b = math.sqrt(sum(v * v for v in b.values()))
    if norm_a == 0 or norm_b == 0:
        return 0.0

    return dot / (norm_a * norm_b)


def _resolve_location_slug(location_ref: str | None) -> str | None:
    if not location_ref:
        return None

    ref = str(location_ref).strip()
    if not ref:
        return None

    if any(ch.isalpha() for ch in ref) or "-" in ref:
        return ref

    index_json = _read_json_file(KNOWLEDGE_BASE_ROOT / "locations" / "index.json")
    entries = index_json.get("locations", []) if isinstance(index_json, dict) else []
    for item in entries:
        if str(item.get("id")) == ref and isinstance(item.get("slug"), str):
            return item["slug"]
    return None


def _knowledge_targets(scene_context: dict | None) -> list[tuple[str, Path]]:
    pathname = str((scene_context or {}).get("pathname") or "").strip()
    page_slug = str((scene_context or {}).get("page_slug") or "").strip()
    scene_type = str((scene_context or {}).get("scene_type") or "").strip()
    location_ref = str((scene_context or {}).get("location_ref") or "").strip()

    targets: list[tuple[str, Path]] = []

    if pathname.startswith("/locations/") or scene_type == "location-detail":
        slug = _resolve_location_slug(location_ref or pathname.split("/")[-1])
        if slug:
            targets.append((f"location:{slug}", KNOWLEDGE_BASE_ROOT / "locations" / slug / "info.json"))

    if pathname in {"/lugu-lake", "/mosuo-culture"} and not page_slug:
        page_slug = pathname.strip("/")

    if page_slug:
        targets.append((f"page:{page_slug}", KNOWLEDGE_BASE_ROOT / "common" / "pages" / f"{page_slug}.json"))

    if not targets:
        targets.append(("common:overview", KNOWLEDGE_BASE_ROOT / "common" / "overview.json"))

    if scene_type in {"checkin", "home", "guide", "general"}:
        targets.append(("locations:index", KNOWLEDGE_BASE_ROOT / "locations" / "index.json"))
        targets.append(("nearby:index", KNOWLEDGE_BASE_ROOT / "nearby-spots" / "index.json"))
        targets.append(("hotels:index", KNOWLEDGE_BASE_ROOT / "hotels" / "index.json"))

    unique: list[tuple[str, Path]] = []
    seen: set[str] = set()
    for name, path in targets:
        key = f"{name}:{path.as_posix()}"
        if key in seen:
            continue
        seen.add(key)
        unique.append((name, path))
    return unique


def _build_knowledge_context(question: str, scene_context: dict | None, top_k: int = 4) -> str:
    docs: list[tuple[str, str]] = []
    for source_name, path in _knowledge_targets(scene_context):
        data = _read_json_file(path)
        if data is None:
            continue
        plain_text = _to_compact_text(data)
        if not plain_text:
            continue
        for chunk in _chunk_text(plain_text):
            docs.append((source_name, chunk))

    if not docs:
        return ""

    query_tokens = Counter(_tokenize(question))
    scored: list[tuple[float, str, str]] = []
    for source_name, chunk in docs:
        score = _cosine_similarity(query_tokens, Counter(_tokenize(chunk)))
        scored.append((score, source_name, chunk))

    scored.sort(key=lambda item: item[0], reverse=True)
    selected = [item for item in scored if item[0] > 0][:top_k]
    if not selected:
        selected = scored[: min(2, len(scored))]

    lines = []
    for idx, (_, source_name, chunk) in enumerate(selected, start=1):
        lines.append(f"[{idx}] 来源={source_name} 内容={chunk}")

    return "\n".join(lines)


def _extract_dashscope_text(data: dict) -> str:
    output = data.get("output", {}) if isinstance(data, dict) else {}
    choices = output.get("choices", []) if isinstance(output, dict) else []
    if not isinstance(choices, list) or not choices:
        return ""

    message = choices[0].get("message", {}) if isinstance(choices[0], dict) else {}
    content = message.get("content", "") if isinstance(message, dict) else ""

    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        texts: list[str] = []
        for item in content:
            if isinstance(item, str):
                texts.append(item)
            elif isinstance(item, dict):
                text = item.get("text")
                if isinstance(text, str):
                    texts.append(text)
        return "\n".join([x.strip() for x in texts if x and x.strip()]).strip()
    if isinstance(content, dict):
        text = content.get("text")
        if isinstance(text, str):
            return text.strip()

    return ""


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


def chat(message: str, system_prompt: str | None = None, scene_context: dict | None = None) -> str:
    """通用AI对话接口"""
    if not settings.dashscope_api_key:
        raise ValueError("未配置 DashScope API Key")

    messages = []
    knowledge_context = _build_knowledge_context(message, scene_context)
    prompt_parts = []
    if system_prompt:
        prompt_parts.append(system_prompt)
    prompt_parts.append("请优先依据知识库内容回答；若知识库没有相关信息，请明确说明并给出通用建议。")
    if knowledge_context:
        prompt_parts.append(f"知识库检索片段：\n{knowledge_context}")
    final_system_prompt = "\n\n".join(prompt_parts)
    
    # 如果提供了系统提示词，添加到对话上下文
    if final_system_prompt:
        messages.append({
            "role": "system",
            "content": [{"text": final_system_prompt}]
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
        text = _extract_dashscope_text(data)
        return text if text else "抱歉，未获得回复，请稍后重试"
    except Exception as exc:
        raise ValueError("对话失败") from exc
