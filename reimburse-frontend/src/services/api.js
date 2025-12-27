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
  async getLists() {
    const response = await api.get("/lists");
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

    // We need to let the browser set Content-Type for multipart/form-data
    // but axios might need help or simply not setting it manually
    // The interceptor might override? No, usually fine.
    // Important: Don't manually set Content-Type to multipart/form-data with axios,
    // let it generate the boundary.
    const response = await api.post("/upload-image", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  // Delete entry
  async deleteEntry(id) {
    const response = await api.delete(`/entries/${id}`);
    return response.data;
  },
};
