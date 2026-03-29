import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "",
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function parseJwtPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4 || 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function readTokenFromStorage(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return "";

  const token = String(raw).trim();
  if (!token || token === "null" || token === "undefined") {
    localStorage.removeItem(key);
    return "";
  }

  const payload = parseJwtPayload(token);
  const exp = Number(payload?.exp);
  if (Number.isFinite(exp) && Date.now() >= exp * 1000) {
    localStorage.removeItem(key);
    return "";
  }

  return token;
}

export function getUserToken() {
  return readTokenFromStorage("user_token");
}

export function getAdminToken() {
  return readTokenFromStorage("admin_token");
}

function authHeader(token) {
  const normalized = typeof token === "string" ? token.trim() : "";
  return normalized ? { Authorization: `Bearer ${normalized}` } : {};
}

export function buildAssetUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function fetchLocations() {
  const { data } = await api.get("/api/locations");
  return data;
}

export async function fetchLocationById(id) {
  const { data } = await api.get(`/api/locations/${id}`);
  return data;
}

/**
 * 从知识库加载景点详情 (info.json)
 * @param {string} slug - 景点slug (如 'lugu-lake')
 * @returns {Promise<object>} 景点详细信息
 */
export async function fetchKnowledgeBaseLocationBySlug(slug) {
  try {
    const response = await fetch(`/knowledge-base/locations/${slug}/info.json`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.warn(`Failed to load knowledge base location: ${slug}`, error);
    return null;
  }
}

/**
 * 获取知识库中景点的图片列表
 * @param {string} slug - 景点slug
 * @returns {Promise<string[]>} 图片URL列表
 */
export async function fetchKnowledgeBaseLocationImages(slug) {
  try {
    const locationInfo = await fetchKnowledgeBaseLocationBySlug(slug);
    if (!locationInfo || !locationInfo.images || !locationInfo.images.files) {
      return [];
    }
    const basePath = `/knowledge-base/locations/${slug}/${locationInfo.images.basePath}`;
    return locationInfo.images.files.map(file => `${basePath}${file}`);
  } catch (error) {
    console.warn(`Failed to load knowledge base location images: ${slug}`, error);
    return [];
  }
}

/**
 * 从后端API加载知识库景点数据
 * @param {string} slug - 景点标识
 * @returns {Promise<object>} 景点详细信息
 */
export async function fetchKnowledgeBaseLocationFromAPI(slug) {
  try {
    const { data } = await api.get(`/api/locations/knowledge-base/${slug}`);
    return data;
  } catch (error) {
    console.warn(`Failed to load KB location from API: ${slug}`, error);
    return null;
  }
}

export async function fetchKnowledgeBaseCommonConfig() {
  try {
    const response = await fetch("/knowledge-base/common/config.json");
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.warn("Failed to load knowledge base common config", error);
    return null;
  }
}

export async function fetchKnowledgeBaseOverview() {
  try {
    const response = await fetch("/knowledge-base/common/overview.json");
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.warn("Failed to load knowledge base overview", error);
    return null;
  }
}

/**
 * 加载 common/pages 下的专题页面数据
 * @param {string} pageSlug - 专题slug，如 lugu-lake / mosuo-culture
 * @returns {Promise<object|null>}
 */
export async function fetchKnowledgeBaseCommonPage(pageSlug) {
  if (!pageSlug) return null;

  // 新结构优先：common/pages/{slug}.json
  try {
    const response = await fetch(`/knowledge-base/common/pages/${pageSlug}.json`);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.warn(`Failed to load KB common page (new path): ${pageSlug}`, error);
  }

  // 兼容旧结构：common/{slug}.json
  try {
    const legacyResponse = await fetch(`/knowledge-base/common/${pageSlug}.json`);
    if (!legacyResponse.ok) return null;
    return await legacyResponse.json();
  } catch (error) {
    console.warn(`Failed to load KB common page (legacy path): ${pageSlug}`, error);
    return null;
  }
}

export async function fetchKnowledgeBaseLocationsIndex() {
  try {
    const response = await fetch("/knowledge-base/locations/index.json");
    if (!response.ok) return [];

    const indexJson = await response.json();
    const entries = Array.isArray(indexJson?.locations) ? indexJson.locations : [];
    if (entries.length === 0) return [];

    const loadedFromIndex = await Promise.all(
      entries.map(async (entry) => {
        const slug = typeof entry?.slug === "string" ? entry.slug : "";
        if (!slug) return null;
        const item = await fetchKnowledgeBaseLocationBySlug(slug);
        if (!item) return null;
        return { ...item, slug };
      })
    );

    const valid = loadedFromIndex.filter(Boolean);
    if (valid.length > 0) return valid;
    return [];
  } catch (error) {
    console.warn("Failed to load locations index", error);
    return [];
  }
}

async function resolveKbSlugById(idOrSlug) {
  if (typeof idOrSlug === "string" && /[^\d]/.test(idOrSlug)) {
    return idOrSlug;
  }

  const idNum = Number(idOrSlug);
  if (!Number.isFinite(idNum)) return null;

  try {
    const response = await fetch("/knowledge-base/locations/index.json");
    if (!response.ok) return null;
    const indexJson = await response.json();
    const entries = Array.isArray(indexJson?.locations) ? indexJson.locations : [];
    const hit = entries.find((entry) => Number(entry?.id) === idNum);
    return typeof hit?.slug === "string" ? hit.slug : null;
  } catch {
    return null;
  }
}

async function resolveKbSlugByIdOrDatabase(idOrSlug, dbLocation) {
  const fromIndex = await resolveKbSlugById(idOrSlug);
  if (fromIndex) return fromIndex;
  if (typeof dbLocation?.slug === "string" && dbLocation.slug) {
    return dbLocation.slug;
  }
  return null;
}

/**
 * 综合获取景点信息：优先使用知识库，回退到数据库
 * 
 * 优先级：
 * 1. 静态知识库文件 (前端 /knowledge-base/)
 * 2. 后端知识库API (/api/locations/knowledge-base/{slug})
 * 3. 数据库 (/api/locations/{id})
 * 
 * @param {number|string} idOrSlug - 景点ID或slug
 * @returns {Promise<object>} 完整景点信息
 */
export async function fetchLocationDetail(idOrSlug) {
  // 如果是数字ID，先从数据库获取基础数据和slug
  if (typeof idOrSlug === 'number' || /^\d+$/.test(idOrSlug)) {
    try {
      const dbLocation = await fetchLocationById(idOrSlug);
      
      // 尝试从知识库获取扩展信息
      if (dbLocation) {
        const mappedSlug = await resolveKbSlugByIdOrDatabase(dbLocation.id, dbLocation);

        // 1. 先通过index映射出的slug从静态知识库获取
        let kbData = mappedSlug ? await fetchKnowledgeBaseLocationBySlug(mappedSlug) : null;
        
        // 2. 如果没有，尝试从后端API获取
        if (!kbData) {
          kbData = mappedSlug ? await fetchKnowledgeBaseLocationFromAPI(mappedSlug) : null;
        }
        
        if (kbData) {
          return { ...dbLocation, ...kbData, slug: kbData.slug || mappedSlug || dbLocation.slug, _source: 'hybrid' };
        }
      }
      return { ...dbLocation, _source: 'database' };
    } catch (error) {
      console.error("Failed to fetch location by ID:", error);
      return null;
    }
  }

  // 如果是string slug，优先从知识库获取
  try {
    // 1. 尝试静态知识库文件
    let kbData = await fetchKnowledgeBaseLocationBySlug(idOrSlug);
    
    // 2. 如果没有，尝试从后端API
    if (!kbData) {
      kbData = await fetchKnowledgeBaseLocationFromAPI(idOrSlug);
    }
    
    if (kbData) {
      return { ...kbData, _source: 'knowledge-base' };
    }

    // 回退：返回null如果都找不到
    return null;
  } catch (error) {
    console.error("Failed to fetch location by slug:", error);
    return null;
  }
}

export async function registerUser(payload) {
  if (!payload || !payload.username || !payload.password) {
    throw new Error("Username and password are required");
  }
  try {
    const { data } = await api.post("/api/auth/register", {
      username: String(payload.username).trim(),
      password: String(payload.password),
    });
    return data;
  } catch (error) {
    console.error("Register error:", error.response?.status, error.response?.data);
    // 提取可读的错误消息
    const errorMsg = extractErrorMessage(error);
    const newError = new Error(errorMsg);
    newError.response = error.response;
    throw newError;
  }
}

export async function loginUser(payload) {
  if (!payload || !payload.username || !payload.password) {
    throw new Error("Username and password are required");
  }
  try {
    const { data } = await api.post("/api/auth/login", {
      username: String(payload.username).trim(),
      password: String(payload.password),
    });
    return data;
  } catch (error) {
    console.error("Login error:", error.response?.status, error.response?.data);
    // 提取可读的错误消息
    const errorMsg = extractErrorMessage(error);
    const newError = new Error(errorMsg);
    newError.response = error.response;
    throw newError;
  }
}

/**
 * 从 API 错误响应中提取可读的错误消息
 */
function extractErrorMessage(error) {
  // 如果是 FastAPI Pydantic 验证错误
  const detail = error?.response?.data?.detail;
  
  if (Array.isArray(detail)) {
    // 多个验证错误：[{loc, msg, type, ...}, ...]
    const messages = detail.map(err => {
      const field = Array.isArray(err.loc) ? err.loc[err.loc.length - 1] : 'field';
      return `${field}: ${err.msg}`;
    });
    return messages.join('; ') || '请求格式错误';
  }
  
  if (typeof detail === 'string') {
    // 单个错误消息
    return detail;
  }
  
  // 其他错误格式
  return error?.message || '请求失败，请重试';
}

export async function fetchCurrentUser(token) {
  const { data } = await api.get("/api/auth/me", {
    headers: authHeader(token),
  });
  return data;
}

export async function updateCurrentUser(payload, token) {
  const { data } = await api.put("/api/auth/me", payload, {
    headers: authHeader(token),
  });
  return data;
}

export async function generateRoute(payload, token) {
  const { data } = await api.post("/api/routes/generate", payload, {
    headers: authHeader(token),
  });
  return data;
}

export async function createFootprint(formData, token) {
  const { data } = await api.post("/api/footprints", formData, {
    headers: {
      ...authHeader(token),
      "Content-Type": "multipart/form-data",
    },
  });
  return data;
}

export async function fetchMyFootprints(token) {
  const { data } = await api.get("/api/footprints/me", {
    headers: authHeader(token),
  });
  return data;
}

export async function fetchAdminStats(token) {
  const { data } = await api.get("/api/admin/stats", {
    headers: authHeader(token),
  });
  return data;
}

export async function createAdminLocation(payload, token) {
  const { data } = await api.post("/api/admin/locations", payload, {
    headers: authHeader(token),
  });
  return data;
}

export async function updateAdminLocation(locationId, payload, token) {
  const { data } = await api.put(`/api/admin/locations/${locationId}`, payload, {
    headers: authHeader(token),
  });
  return data;
}

export async function deleteAdminLocation(locationId, token) {
  const { data } = await api.delete(`/api/admin/locations/${locationId}`, {
    headers: authHeader(token),
  });
  return data;
}

export async function generateLocationQr(locationId, token) {
  const { data } = await api.post(`/api/admin/qrcodes/generate/${locationId}`, {}, {
    headers: authHeader(token),
  });
  return data;
}

export async function sceneChat(message, systemPrompt, token, sceneContext = null, sessionKey = null) {
  const { data } = await api.post("/api/routes/chat", 
    {
      message,
      system_prompt: systemPrompt,
      scene_context: sceneContext,
      session_key: sessionKey,
    },
    {
      headers: authHeader(token),
      timeout: 70000,
    }
  );
  return data;
}

export async function fetchChatHistory(token) {
  const { data } = await api.get("/api/routes/chat/history", {
    headers: authHeader(token),
  });
  return data;
}

export async function deleteChatSession(sessionKey, token) {
  await api.delete(`/api/routes/chat/history/${sessionKey}`, {
    headers: authHeader(token),
  });
}

export async function downloadQrcodeZip(token) {
  const response = await api.get("/api/admin/qrcodes/batch-export", {
    headers: authHeader(token),
    responseType: "blob",
  });
  return response.data;
}

export async function fetchKnowledgeBaseHotels() {
  try {
    const response = await fetch("/knowledge-base/hotels/index.json");
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data?.hotels) ? data.hotels : [];
  } catch (error) {
    console.warn("Failed to load knowledge base hotels", error);
    return [];
  }
}

export async function fetchKnowledgeBaseNearbySpots() {
  try {
    const response = await fetch("/knowledge-base/nearby-spots/index.json");
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data?.spots) ? data.spots : [];
  } catch (error) {
    console.warn("Failed to load knowledge base nearby spots", error);
    return [];
  }
}

export default api;
