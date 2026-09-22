import axios from "axios";
import {
  accessTokenNeedsRefresh,
  clearSessionTokens,
  getAccessToken,
  getRefreshToken,
  hydrateSessionFromCookies,
  setSessionTokens,
} from "@/utils/session";

hydrateSessionFromCookies();

const baseURL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://reimburse-api.trimind.studio/api";

const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

export function clearSession() {
  clearSessionTokens();
  localStorage.removeItem("user");
}

let refreshPromise = null;

async function refreshSession() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  const { data } = await axios.post(
    `${baseURL}/auth/refresh`,
    { refreshToken },
    { headers: { "Content-Type": "application/json" } },
  );
  const token = data?.token;
  const nextRefresh = data?.refreshToken;
  if (!token) return null;
  setSessionTokens({
    token,
    refreshToken: nextRefresh || refreshToken,
  });
  return token;
}

export async function ensureSession() {
  hydrateSessionFromCookies();
  const token = getAccessToken();
  const refreshToken = getRefreshToken();
  if (!token && !refreshToken) return false;
  if (token && !accessTokenNeedsRefresh(token)) return true;
  if (!refreshToken) return !!token;
  try {
    if (!refreshPromise) {
      refreshPromise = refreshSession().finally(() => {
        refreshPromise = null;
      });
    }
    const next = await refreshPromise;
    return !!next;
  } catch {
    return false;
  }
}

// Add token to requests
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config;
    const status = err.response?.status;
    const url = String(original?.url || "");
    const isAuthRoute = /\/auth\/(login|refresh|logout)/.test(url);

    if (status !== 401 || !original || original._retry || isAuthRoute) {
      return Promise.reject(err);
    }

    original._retry = true;
    try {
      if (!refreshPromise) {
        refreshPromise = refreshSession().finally(() => {
          refreshPromise = null;
        });
      }
      const token = await refreshPromise;
      if (!token) throw new Error("refresh failed");
      original.headers = original.headers || {};
      original.headers.Authorization = `Bearer ${token}`;
      return api(original);
    } catch {
      clearSession();
      if (!location.pathname.startsWith("/sso")) {
        const { redirectToPortalLogin } = await import("../utils/portal.js");
        redirectToPortalLogin();
      }
      return Promise.reject(err);
    }
  },
);

export default {
  // Auth
  async login(email, password) {
    const response = await api.post("/auth/login", { email, password });
    return response.data;
  },

  async exchangeSso(code) {
    const response = await api.post("/auth/sso/exchange", { code });
    return response.data;
  },

  async refresh(refreshToken) {
    const response = await api.post("/auth/refresh", { refreshToken });
    return response.data;
  },

  async logout(refreshToken) {
    const response = await api.post("/auth/logout", { refreshToken });
    return response.data;
  },

  async register(email, password, name) {
    const response = await api.post("/auth/register", {
      email,
      password,
      name,
    });
    return response.data;
  },

  // Lists
  async getLists(params = {}) {
    const response = await api.get("/lists", { params });
    return response.data;
  },

  async getList(id) {
    const response = await api.get(`/lists/${id}`);
    return response.data;
  },

  async createList(name) {
    const response = await api.post("/lists", { name });
    return response.data;
  },

  async updateList(id, data) {
    const response = await api.put(`/lists/${id}`, data);
    return response.data;
  },

  async deleteList(id) {
    const response = await api.delete(`/lists/${id}`);
    return response.data;
  },

  // Image upload (multipart/form-data)
  async uploadImage(file) {
    const formData = new FormData();
    formData.append("image", file);

    const response = await api.post("/upload-image", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  // Parse receipt with OCR.space (multipart)
  async parseReceipt(file, params = {}) {
    const formData = new FormData();
    formData.append("image", file);
    const response = await api.post("/parse-receipt", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      params,
    });
    return response.data;
  },

  // Delete entry
  async deleteEntry(id) {
    const response = await api.delete(`/entries/${id}`);
    return response.data;
  },

  async updateEntry(id, data) {
    const response = await api.put(`/entries/${id}`, data);
    return response.data;
  },

  // Update User Name
  async updateUserName(name) {
    const response = await api.put("/users/name", { name });
    return response.data;
  },

  // Profile
  async getProfile() {
    const response = await api.get("/users/me");
    return response.data;
  },

  async updateProfile(data) {
    const response = await api.put("/users/profile", data);
    return response.data;
  },

  // Management admin
  async getAdminUsers(params = {}) {
    const response = await api.get("/admin/users", { params });
    return response.data;
  },

  async createAdminUser(data) {
    const response = await api.post("/admin/users", data);
    return response.data;
  },

  async updateAdminUser(id, data) {
    const response = await api.put(`/admin/users/${id}`, data);
    return response.data;
  },

  async deleteAdminUser(id) {
    const response = await api.delete(`/admin/users/${id}`);
    return response.data;
  },

  // Analytics
  async getAnalytics(params = {}) {
    const response = await api.get("/analytics", { params });
    return response.data;
  },

  // Categories
  async getCategories(params = {}) {
    const response = await api.get("/categories", { params });
    return response.data;
  },

  async createCategory(data) {
    const response = await api.post("/categories", data);
    return response.data;
  },

  async updateCategory(id, data) {
    const response = await api.put(`/categories/${id}`, data);
    return response.data;
  },

  async deleteCategory(id) {
    const response = await api.delete(`/categories/${id}`);
    return response.data;
  },

  // Superadmin companies
  async getCompanies() {
    const response = await api.get("/superadmin/companies");
    return response.data;
  },

  async createCompany(data) {
    const response = await api.post("/superadmin/companies", data);
    return response.data;
  },

  async getCompany(id) {
    const response = await api.get(`/superadmin/companies/${id}`);
    return response.data;
  },

  async updateCompany(id, data) {
    const response = await api.put(`/superadmin/companies/${id}`, data);
    return response.data;
  },

  async deleteCompany(id) {
    const response = await api.delete(`/superadmin/companies/${id}`);
    return response.data;
  },

  async bootstrapCompany(id, data) {
    const response = await api.post(
      `/superadmin/companies/${id}/bootstrap`,
      data,
    );
    return response.data;
  },

  // Purchasing (purchase orders)
  async getPurchasing(params = {}) {
    const response = await api.get("/purchasing", { params });
    return response.data;
  },

  async getPurchasingColleagues(params = {}) {
    const response = await api.get("/purchasing/colleagues", { params });
    return response.data;
  },

  async getPurchasingOrder(id) {
    const response = await api.get(`/purchasing/${id}`);
    return response.data;
  },

  async createPurchasing(data) {
    const response = await api.post("/purchasing", data);
    return response.data;
  },

  async updatePurchasing(id, data) {
    const response = await api.put(`/purchasing/${id}`, data);
    return response.data;
  },

  async deletePurchasing(id) {
    const response = await api.delete(`/purchasing/${id}`);
    return response.data;
  },
};
