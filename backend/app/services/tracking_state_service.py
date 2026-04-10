from datetime import UTC, datetime

TRACK_POINTS_LIMIT = 3000


def parse_point_timestamp(raw_value: object) -> int | None:
    if raw_value is None:
        return None
    try:
        value = int(float(raw_value))
    except (TypeError, ValueError):
        return None
    return value if value > 0 else None


def normalize_track_points(points_source: object) -> list[dict]:
    points = points_source if isinstance(points_source, list) else []
    normalized_points: list[dict] = []

    for point in points:
        if not isinstance(point, dict):
            continue
        try:
            lat = float(point.get("lat"))
            lon = float(point.get("lon"))
        except (TypeError, ValueError):
            continue
        normalized_points.append({
            "lat": lat,
            "lon": lon,
            "t": parse_point_timestamp(point.get("t")),
        })

    return normalized_points


def merge_track_points(existing_points: list[dict], incoming_points: list[dict]) -> list[dict]:
    merged: list[dict] = []
    seen_keys: set[tuple[float, float, int]] = set()
    now_ms = int(datetime.now(UTC).timestamp() * 1000)

    for index, point in enumerate([*existing_points, *incoming_points]):
        timestamp = parse_point_timestamp(point.get("t")) if isinstance(point, dict) else None
        if timestamp is None:
            timestamp = now_ms + index

        key = (round(float(point["lat"]), 7), round(float(point["lon"]), 7), timestamp)
        if key in seen_keys:
            continue
        seen_keys.add(key)

        merged.append({
            "lat": float(point["lat"]),
            "lon": float(point["lon"]),
            "t": timestamp,
        })

    merged.sort(key=lambda item: item["t"])
    return merged[-TRACK_POINTS_LIMIT:]
