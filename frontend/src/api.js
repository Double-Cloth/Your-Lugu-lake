import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
  timeout: 15000,
});

export function getUserToken() {
  return localStorage.getItem("user_token") || "";
}

export function getAdminToken() {
  return localStorage.getItem("admin_token") || "";
}

function authHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchLocations() {
  const { data } = await api.get("/api/locations");
  return data;
}

export async function fetchLocationById(id) {
  const { data } = await api.get(`/api/locations/${id}`);
  return data;
}

export async function registerUser(payload) {
  const { data } = await api.post("/api/auth/register", payload);
  return data;
}

export async function loginUser(payload) {
  const { data } = await api.post("/api/auth/login", payload);
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

export async function downloadQrcodeZip(token) {
  const response = await api.get("/api/admin/qrcodes/batch-export", {
    headers: authHeader(token),
    responseType: "blob",
  });
  return response.data;
}

export default api;
