from app.services.tracking_state_service import merge_track_points, normalize_track_points


def test_normalize_track_points_filters_invalid_rows():
    points = normalize_track_points([
        {"lat": "27.8", "lon": "100.1", "t": "1710000000000"},
        {"lat": None, "lon": 100.2, "t": 1710000001000},
        {"lat": "bad", "lon": "bad", "t": "bad"},
        "not-a-dict",
    ])

    assert len(points) == 1
    assert points[0]["lat"] == 27.8
    assert points[0]["lon"] == 100.1
    assert points[0]["t"] == 1710000000000


def test_merge_track_points_deduplicates_by_time_and_position():
    existing = [
        {"lat": 27.81, "lon": 100.11, "t": 1710000000000},
        {"lat": 27.82, "lon": 100.12, "t": 1710000001000},
    ]
    incoming = [
        {"lat": 27.82, "lon": 100.12, "t": 1710000001000},
        {"lat": 27.83, "lon": 100.13, "t": 1710000002000},
    ]

    merged = merge_track_points(existing, incoming)

    assert len(merged) == 3
    assert merged[-1]["lat"] == 27.83
    assert merged[-1]["lon"] == 100.13
    assert merged[-1]["t"] == 1710000002000


def test_merge_track_points_keeps_chronological_order():
    existing = [
        {"lat": 27.81, "lon": 100.11, "t": 1710000003000},
    ]
    incoming = [
        {"lat": 27.80, "lon": 100.10, "t": 1710000001000},
        {"lat": 27.82, "lon": 100.12, "t": 1710000002000},
    ]

    merged = merge_track_points(existing, incoming)

    timestamps = [point["t"] for point in merged]
    assert timestamps == sorted(timestamps)
