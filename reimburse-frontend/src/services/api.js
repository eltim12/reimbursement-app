import axios from "axios";

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ||
    "https://reimburse-api.trimind.studio/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default {
  // Auth
  async login(email, password) {
    const response = await api.post("/auth/login", { email, password });
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
};
