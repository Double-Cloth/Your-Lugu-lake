const STORAGE_PREFIX = "lugu_checkin_tracking_v1_";

const DEFAULT_STATE = {
	tracking: false,
	gps: { lat: "", lon: "" },
	trackPoints: [],
	updatedAt: "",
};

const cache = new Map();
const listeners = new Map();

function getStorageKey(username) {
	const normalizedUsername = String(username || "guest").trim() || "guest";
	return `${STORAGE_PREFIX}${normalizedUsername}`;
}

function normalizeGps(gps) {
	return {
		lat: gps?.lat !== undefined && gps?.lat !== null ? String(gps.lat) : "",
		lon: gps?.lon !== undefined && gps?.lon !== null ? String(gps.lon) : "",
	};
}

function normalizeTrackPoints(trackPoints) {
	if (!Array.isArray(trackPoints)) {
		return [];
	}

	return trackPoints
		.map((point) => {
			const lat = Number(point?.lat);
			const lon = Number(point?.lon);
			if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
				return null;
			}
			return {
				lat,
				lon,
				t: Number.isFinite(Number(point?.t)) ? Number(point.t) : Date.now(),
			};
		})
		.filter(Boolean);
}

function normalizeTrackingState(state) {
	const source = state && typeof state === "object" ? state : {};
	return {
		tracking: Boolean(source.tracking),
		gps: normalizeGps(source.gps),
		trackPoints: normalizeTrackPoints(source.trackPoints),
		updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : "",
	};
}

function readTrackingState(username) {
	if (typeof window === "undefined") {
		return JSON.parse(JSON.stringify(DEFAULT_STATE));
	}

	const key = getStorageKey(username);
	try {
		const raw = window.localStorage.getItem(key);
		if (!raw) {
			return JSON.parse(JSON.stringify(DEFAULT_STATE));
		}
		return normalizeTrackingState(JSON.parse(raw));
	} catch {
		return JSON.parse(JSON.stringify(DEFAULT_STATE));
	}
}

function writeTrackingState(username, state) {
	const normalizedState = normalizeTrackingState(state);
	cache.set(getStorageKey(username), normalizedState);

	if (typeof window !== "undefined") {
		try {
			window.localStorage.setItem(getStorageKey(username), JSON.stringify(normalizedState));
		} catch {
			// ignore storage quota / availability errors
		}
	}

	return normalizedState;
}

function emitTrackingState(username) {
	const key = getStorageKey(username);
	const snapshot = getTrackingState(username);
	const bucket = listeners.get(key);
	if (!bucket) {
		return;
	}

	for (const listener of bucket) {
		try {
			listener(snapshot);
		} catch {
			// ignore listener failures
		}
	}
}

export function getTrackingState(username) {
	const key = getStorageKey(username);
	if (cache.has(key)) {
		return cache.get(key);
	}

	const state = readTrackingState(username);
	cache.set(key, state);
	return state;
}

export function subscribeTrackingState(username, listener) {
	const key = getStorageKey(username);
	if (!listeners.has(key)) {
		listeners.set(key, new Set());
	}

	const bucket = listeners.get(key);
	bucket.add(listener);
	listener(getTrackingState(username));

	return () => {
		bucket.delete(listener);
		if (bucket.size === 0) {
			listeners.delete(key);
		}
	};
}

export function setTrackingState(username, nextState) {
	const currentState = getTrackingState(username);
	const resolvedState = typeof nextState === "function" ? nextState(currentState) : nextState;
	const normalizedState = writeTrackingState(username, resolvedState);
	emitTrackingState(username);
	return normalizedState;
}

export function setTrackingActive(username, tracking) {
	return setTrackingState(username, (currentState) => ({
		...currentState,
		tracking: Boolean(tracking),
		updatedAt: new Date().toISOString(),
	}));
}

export function setTrackingLocation(username, lat, lon) {
	return setTrackingState(username, (currentState) => ({
		...currentState,
		gps: {
			lat: String(lat),
			lon: String(lon),
		},
		updatedAt: new Date().toISOString(),
	}));
}

export function toTrackingApiPayload(state) {
	const source = state && typeof state === "object" ? state : {};
	const gps = source.gps && typeof source.gps === "object" ? source.gps : { lat: "", lon: "" };
	const trackPoints = Array.isArray(source.trackPoints) ? source.trackPoints : [];

	return {
		tracking: Boolean(source.tracking),
		gps: {
			lat: gps.lat !== undefined && gps.lat !== null ? String(gps.lat) : "",
			lon: gps.lon !== undefined && gps.lon !== null ? String(gps.lon) : "",
		},
		track_points: trackPoints.map((point) => ({
			lat: Number(point.lat),
			lon: Number(point.lon),
			t: Number.isFinite(Number(point.t)) ? Number(point.t) : Date.now(),
		})),
	};
}

export function recordTrackingPoint(username, lat, lon) {
	return setTrackingState(username, (currentState) => ({
		...currentState,
		tracking: true,
		gps: {
			lat: String(lat),
			lon: String(lon),
		},
		trackPoints: [
			...normalizeTrackPoints(currentState.trackPoints),
			{ lat: Number(lat), lon: Number(lon), t: Date.now() },
		],
		updatedAt: new Date().toISOString(),
	}));
}

export function resetTrackingState(username) {
	return setTrackingState(username, {
		...DEFAULT_STATE,
		updatedAt: new Date().toISOString(),
	});
}

