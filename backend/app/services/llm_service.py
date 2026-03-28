import json
import logging
import math
import re
import time
from collections import Counter
from pathlib import Path

import requests

from app.core.config import settings


PROJECT_ROOT = Path(__file__).resolve().parents[3]
KNOWLEDGE_BASE_ROOT = PROJECT_ROOT / "knowledge-base"
logger = logging.getLogger(__name__)


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


_KB_LINE_RE = re.compile(r"^\[(\d+)\]\s*来源=([^\s]+)\s+内容=(.*)$")


def _build_offline_quick_plan(scene_context: dict | None) -> str:
    lines: list[str] = []

    locations_index = _read_json_file(KNOWLEDGE_BASE_ROOT / "locations" / "index.json")
    locations = locations_index.get("locations", []) if isinstance(locations_index, dict) else []
    spot_names = [str(item.get("name")) for item in locations if isinstance(item, dict) and item.get("name")]
    if spot_names:
        lines.append(f"可先走精华线：{' -> '.join(spot_names[:3])}")

    overview = _read_json_file(KNOWLEDGE_BASE_ROOT / "common" / "overview.json")
    overview_root = overview.get("overview", {}) if isinstance(overview, dict) else {}
    lake_info = overview_root.get("lake", {}) if isinstance(overview_root, dict) else {}
    lake_description = lake_info.get("description") if isinstance(lake_info, dict) else ""
    if isinstance(lake_description, str) and lake_description.strip():
        lines.append(f"行程节奏建议：{lake_description.strip()}")

    culture_info = overview_root.get("culture", {}) if isinstance(overview_root, dict) else {}
    highlights = culture_info.get("highlights", []) if isinstance(culture_info, dict) else []
    highlight_texts = [str(item).strip() for item in highlights if str(item).strip()]
    if highlight_texts:
        lines.append(f"推荐优先体验：{'；'.join(highlight_texts[:2])}")

    scene_type = str((scene_context or {}).get("scene_type") or "").strip()
    if scene_type == "checkin":
        lines.append("打卡建议：优先里格半岛观景台与草海，光线好的时段集中拍摄。")
    elif scene_type == "location-detail":
        lines.append("景点页建议：先看交通与开放时段，再决定停留时长与下一站。")

    return "\n".join(lines)


def _clean_kb_snippet_text(text: str) -> str:
    compact = re.sub(r"\s+", " ", text or "").strip()
    if not compact:
        return ""

    if ":" in compact:
        key, value = compact.split(":", 1)
        key_norm = key.strip().lower()
        if re.match(r"^[a-z0-9_\[\]\.\-]+$", key_norm):
            compact = value.strip()

    if compact.startswith("暂无"):
        return ""

    compact = re.sub(r"\s*([，。；：！？])\s*", r"\1", compact)
    return compact[:120]


def _build_chat_fallback_reply(message: str, knowledge_context: str, scene_context: dict | None = None) -> str:
    snippets: list[str] = []
    ignored_prefixes = ("version:", "lastupdated:", "overview.summary:")
    for raw_line in (knowledge_context or "").splitlines():
        line = raw_line.strip()
        if not line:
            continue
        match = _KB_LINE_RE.match(line)
        if not match:
            continue
        text = re.sub(r"\s+", " ", match.group(3)).strip()
        if text.lower().startswith(ignored_prefixes):
            continue
        clean_text = _clean_kb_snippet_text(text)
        if clean_text:
            snippets.append(clean_text)
        if len(snippets) >= 2:
            break

    offline_plan = _build_offline_quick_plan(scene_context)

    if snippets:
        joined = "\n".join(f"- {item}" for item in snippets)
        extra_line = f"\n{offline_plan}" if offline_plan else ""
        return (
            "当前 AI 在线服务暂不可用，我先基于本地知识库给你参考：\n"
            f"{joined}{extra_line}\n"
            "如果你愿意，我也可以继续按你的问题给出更细的行程或玩法建议。"
        )

    brief = (message or "").strip()
    if len(brief) > 40:
        brief = f"{brief[:40]}..."
    if not brief:
        brief = "当前问题"

    if offline_plan:
        return (
            "当前 AI 在线服务暂不可用，我先基于本地知识库给你一个可执行建议：\n"
            f"{offline_plan}\n"
            f"如果你愿意，我可以再按“{brief}”细化成半天/一天版本。"
        )

    return (
        "当前 AI 在线服务暂不可用。"
        f"你提到的“{brief}”，建议先补充出行时间、人数和偏好（人文/拍照/亲子/徒步），"
        "我会基于本地知识库继续给你具体建议。"
    )


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
    knowledge_context = _build_knowledge_context(message, scene_context)

    if not settings.dashscope_api_key:
        return _build_chat_fallback_reply(message, knowledge_context, scene_context)

    messages = []
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

    request_payload = {
        "model": settings.dashscope_model,
        "input": {"messages": messages},
        "parameters": {"result_format": "message"},
    }

    last_error_code = ""
    last_error_message = ""

    for attempt in range(2):
        try:
            resp = requests.post(
                "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
                headers={
                    "Authorization": f"Bearer {settings.dashscope_api_key}",
                    "Content-Type": "application/json",
                },
                json=request_payload,
                timeout=60,
            )
            resp.raise_for_status()
            data = resp.json()
            text = _extract_dashscope_text(data)
            return text if text else "抱歉，未获得回复，请稍后重试"
        except Exception as exc:
            if isinstance(exc, requests.HTTPError) and exc.response is not None:
                try:
                    error_data = exc.response.json()
                    if isinstance(error_data, dict):
                        last_error_code = str(error_data.get("code") or "")
                        last_error_message = str(error_data.get("message") or "")
                except Exception:
                    last_error_code = ""
                    last_error_message = ""

            if (
                last_error_code == "InvalidParameter"
                and "url error" in (last_error_message or "").lower()
                and request_payload.get("model") != "qwen-plus"
            ):
                logger.warning(
                    "DashScope model '%s' incompatible for this endpoint, fallback to qwen-plus",
                    request_payload.get("model"),
                )
                request_payload["model"] = "qwen-plus"
                continue

            if last_error_code == "Arrearage":
                logger.warning("DashScope account arrearage: %s", last_error_message)
                return (
                    "当前云端 AI 服务暂不可用：DashScope 账户欠费或不可用。"
                    "请充值/检查账户状态后重试；当前先为你提供本地知识库参考。\n"
                    + _build_chat_fallback_reply(message, knowledge_context, scene_context)
                )

            if attempt == 0:
                logger.warning("DashScope chat attempt 1 failed: %s", exc)
                time.sleep(0.8)
                continue
            logger.warning("DashScope chat fallback after retries: %s", exc)
            return _build_chat_fallback_reply(message, knowledge_context, scene_context)

    return _build_chat_fallback_reply(message, knowledge_context, scene_context)
