import axios from "axios";

// Nếu VITE_API_URL để trống → dùng "" (relative URL) → Vite proxy forward đến Laravel
// Nếu VITE_API_URL có giá trị (ví dụ khi deploy) → dùng URL đó
const API_BASE = import.meta.env.VITE_API_URL || "";
const API_URL = `${API_BASE}/api`;
const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});


// ===============================
// AXIOS REQUEST INTERCEPTOR
// tự động gắn token
// ===============================
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);


// ===============================
// AXIOS RESPONSE INTERCEPTOR
// tự động logout nếu token hết hạn
// ===============================
// Thêm vào cuối file api.js, trước export default
// Thêm vào cuối file api.js, trước export default
api.interceptors.response.use(
  (response) => {
    // Log response để debug ảnh
    if (response.config.url === '/products' || response.config.url === '/products-approved') {
      console.log('API Response from', response.config.url, ':', response.data);
      if (response.data && response.data.data) {
        const products = response.data.data.data || response.data.data;
        if (Array.isArray(products)) {
          products.forEach(p => {
            console.log(`  Product ${p.id}: media_path=${p.media_path}, media_url=${p.media_url}`);
          });
        }
      }
    }
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("auth_token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// ===============================
// PRODUCT API
// ===============================
export const productApi = {

  // Lấy toàn bộ sản phẩm (admin)
  list: (params) => api.get("/products", { params }),

  // Lấy sản phẩm của staff hiện tại
  mySubmitted: (params) => api.get("/products", { params }),

  getApprovedProducts: () => api.get("/products-approved"),

  getById: (id) => api.get(`/products/${id}`),

  create: (data) =>
    api.post(
      "/products",
      data,
      data instanceof FormData
        ? { headers: { "Content-Type": "multipart/form-data" } }
        : undefined
    ),

  update: (id, data) =>
    api.put(
      `/products/${id}`,
      data,
      data instanceof FormData
        ? { headers: { "Content-Type": "multipart/form-data" } }
        : undefined
    ),

  delete: (id) => api.delete(`/products/${id}`),

  pendingApprovals: (params) => api.get("/admin/product-approvals", { params }),

  approve: (id, data) => api.post(`/admin/products/${id}/approve`, data), // ✅ ĐÃ SỬA: thêm data
  reject: (id, data) => api.post(`/admin/products/${id}/reject`, data),
  sendToAdmin: (id) => api.post(`/products/${id}/submit`),

  // Staff B gửi phản hồi về sản phẩm → Staff A nhận thông báo
  sendFeedback: (id, data) => api.post(`/products/${id}/feedback`, data),

  // Gán vendor cho sản phẩm (admin)
  assignVendor: (id, data) => api.post(`/admin/products/${id}/select-vendor`, data),
  updateDeadline: (id, data) => api.put(`/products/${id}/deadline`, data),
};


// ===============================
// CUSTOMER API
// ===============================
export const customerApi = {
  list: (params) => api.get("/customers", { params }),
};


// ===============================
// ANALYTICS API
// ===============================
export const analyticsApi = {
  revenue: (period = "month") => api.get(`/analytics/revenue?period=${period}`),
  topProducts: () => api.get("/analytics/top-products"),
  conversion: () => api.get("/analytics/conversion"),
  profit: () => api.get("/analytics/profit"),
};


// ===============================
// DASHBOARD API
// ===============================
export const dashboardApi = {
  overview: () => api.get("/dashboard/overview"),
  stats: () => api.get("/dashboard/stats"),
};


// ===============================
// INVENTORY API
// ===============================
export const inventoryApi = {
  list: () => api.get("/inventory"),
  lowStock: () => api.get("/inventory/low-stock"),
  importStock: (data) => api.post("/inventory/import", data),
};


// ===============================
// ORDER API
// ===============================
export const orderApi = {
  list: (params) => api.get("/orders", { params }),
  getById: (id) => api.get(`/orders/${id}`),
  create: (data) => api.post("/orders", data),
  update: (id, data) => api.put(`/orders/${id}`, data),
  delete: (id) => api.delete(`/orders/${id}`),
};


// ===============================
// PAYMENT API
// ===============================
export const paymentApi = {
  list: () => api.get("/payments"),
  getById: (id) => api.get(`/payments/${id}`),
  create: (data) => api.post("/payments", data),
  update: (id, data) => api.put(`/payments/${id}`, data),
  refund: (id) => api.post(`/payments/${id}/refund`),
  delete: (id) => api.delete(`/payments/${id}`),
};


// ===============================
// VENDOR API
// ===============================
export const vendorApi = {
  // Lấy tất cả vendor
  list: (params) => api.get("/vendors", { params }),

  // Lọc theo product_type — dùng cho modal Gán Vendor
  listByProductType: (productType) =>
    api.get("/vendors", { params: { product_type: productType } }),

  getById: (id) => api.get(`/vendors/${id}`),

  // ⚠️ Dùng api instance (có token), KHÔNG dùng axios trực tiếp
  compare: (params) => api.get("/vendors/compare", { params }),

  create: (data) => api.post("/vendors", data),
  update: (id, data) => api.put(`/vendors/${id}`, data),
  delete: (id) => api.delete(`/vendors/${id}`),
};


// ===============================
// NOTIFICATION API
// ===============================
export const notificationApi = {
  list: () => api.get("/notifications"),
  readAll: () => api.post("/notifications/read-all"),
  readOne: (id) => api.post(`/notifications/${id}/read`),
};


// ===============================
// AUTH API
// ===============================
export const authApi = {
  login: (email, password) => api.post("/login", { email, password }),
  logout: () => api.post("/logout"),
  me: () => api.get("/me"),
};


export default api;