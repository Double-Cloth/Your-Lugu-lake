const USER_SESSION_MARKER_KEY = "lugu_user_session_active";

let userSessionActive = false;
let userNameMemory = "";
let adminSessionActive = false;
let adminNameMemory = "";

function getWindow() {
  return typeof window !== "undefined" ? window : null;
}

function normalizeText(value) {
  if (typeof value !== "string") return "";
  const next = value.trim();
  if (!next || next === "null" || next === "undefined") return "";
  return next;
}

function readStorageFlag(key) {
  const win = getWindow();
  if (!win?.localStorage) return false;
  try {
    return win.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeStorageFlag(key, active) {
  const win = getWindow();
  if (!win?.localStorage) return;
  try {
    if (active) {
      win.localStorage.setItem(key, "1");
      return;
    }
    win.localStorage.removeItem(key);
  } catch {
    // ignore storage exceptions
  }
}

function decodeUriSafe(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getPathname() {
  const win = getWindow();
  return win?.location?.pathname || "";
}

function readUsernameFromPath() {
  const match = getPathname().match(/^\/me\/([^/]+)$/);
  if (!match?.[1]) return "";
  return normalizeText(decodeUriSafe(match[1]));
}

function readAdminNameFromPath() {
  const pathname = getPathname();
  if (pathname === "/admin/login") return "";
  const match = pathname.match(/^\/admin\/([^/]+)$/);
  if (!match?.[1]) return "";
  return normalizeText(decodeUriSafe(match[1]));
}

function isUserSessionPath() {
  return getPathname().startsWith("/me");
}

function isAdminSessionPath() {
  const pathname = getPathname();
  return pathname === "/admin" || /^\/admin\/[^/]+$/.test(pathname);
}

function sessionMarker(active) {
  return active ? "cookie-session" : "";
}

export function setUserSession(_token, username) {
  userSessionActive = true;
  writeStorageFlag(USER_SESSION_MARKER_KEY, true);
  const normalizedUsername = normalizeText(username);
  if (normalizedUsername) {
    userNameMemory = normalizedUsername;
    return;
  }
  const fromPath = readUsernameFromPath();
  if (fromPath) {
    userNameMemory = fromPath;
  }
}

export function clearUserSession() {
  userSessionActive = false;
  userNameMemory = "";
  writeStorageFlag(USER_SESSION_MARKER_KEY, false);
}

export function hasUserSession() {
  if (userSessionActive) return true;
  const restored = readStorageFlag(USER_SESSION_MARKER_KEY);
  userSessionActive = restored;
  return restored;
}

export function getUserSessionToken() {
  return sessionMarker(hasUserSession());
}

export function getUserSessionUsername() {
  if (userNameMemory) return userNameMemory;
  const fromPath = readUsernameFromPath();
  if (fromPath) {
    userNameMemory = fromPath;
  }
  return userNameMemory;
}

export function withUserSessionPath(path) {
  return path;
}

export function buildUserProfilePath() {
  const username = getUserSessionUsername();
  return username ? `/me/${encodeURIComponent(username)}` : "/me";
}

export function setAdminSession(_token, username) {
  adminSessionActive = true;
  const normalizedUsername = normalizeText(username);
  if (normalizedUsername) {
    adminNameMemory = normalizedUsername;
    return;
  }
  const fromPath = readAdminNameFromPath();
  if (fromPath) {
    adminNameMemory = fromPath;
  }
}

export function clearAdminSession() {
  adminSessionActive = false;
  adminNameMemory = "";
}

export function getAdminSessionToken() {
  return sessionMarker(adminSessionActive || isAdminSessionPath());
}

export function getAdminSessionUsername() {
  if (adminNameMemory) return adminNameMemory;
  const fromPath = readAdminNameFromPath();
  if (fromPath) {
    adminNameMemory = fromPath;
  }
  return adminNameMemory;
}

export function withAdminSessionPath(path) {
  return path;
}

export function buildAdminDashboardPath() {
  const username = getAdminSessionUsername();
  return username ? `/admin/${encodeURIComponent(username)}` : "/admin";
}
