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

// Tự động xóa Content-Type khi gửi FormData
// để browser/axios tự set multipart boundary đúng
api.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  return config;
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
      const token = localStorage.getItem("auth_token");
      // Nếu đang dùng mock token cho local demo, không tự động văng ra login
      if (token && token.startsWith("mock_token_")) {
        console.warn("⚠️ API trả về 401 nhưng đang dùng mock_token, bỏ qua auto-logout.");
      } else {
        localStorage.removeItem("auth_token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// ===============================
// PRODUCT API MOCK CHO DEMO
// ===============================
const getMockProducts = () => JSON.parse(localStorage.getItem('MOCK_PRODUCTS') || '[]');
const saveMockProducts = (products) => {
  localStorage.setItem('MOCK_PRODUCTS', JSON.stringify(products));
  window.dispatchEvent(new Event('storage'));
};

const withMock = (apiCall, mockCall) => {
  return async (...args) => {
    const token = localStorage.getItem("auth_token");
    if (token && token.startsWith("mock_token_")) {
      // Simulate network delay
      await new Promise(r => setTimeout(r, 300));
      return mockCall(...args);
    }
    return apiCall(...args);
  };
};

export const productApi = {
  list: withMock(
    (params) => api.get("/products", { params }),
    () => {
      const all = getMockProducts();
      return { data: { data: all } };
    }
  ),

  mySubmitted: withMock(
    (params) => api.get("/products", { params }),
    () => {
      const all = getMockProducts();
      const user = JSON.parse(localStorage.getItem("user") || '{}');
      const mine = all.filter(p => p.project === user.project || p.seller_name === user.sellerName);
      return { data: { data: mine } };
    }
  ),

  getApprovedProducts: withMock(
    () => api.get("/products-approved"),
    () => {
      const all = getMockProducts();
      return { data: { data: all.filter(p => p.status === 'approved') } };
    }
  ),

  getById: withMock(
    (id) => api.get(`/products/${id}`),
    (id) => {
      const all = getMockProducts();
      const p = all.find(x => String(x.id) === String(id));
      if (!p) throw new Error("Not found");
      return { data: { data: p } };
    }
  ),

  create: withMock(
    (data) => api.post("/products", data),
    (data) => {
      const all = getMockProducts();
      const newProduct = {
        id: Date.now(),
        status: 'draft',
        created_at: new Date().toISOString(),
      };
      if (data instanceof FormData) {
        for (let [key, value] of data.entries()) {
          if (key !== 'media[]') newProduct[key] = value;
        }
      } else {
        Object.assign(newProduct, data);
      }
      all.unshift(newProduct);
      saveMockProducts(all);
      return { data: { data: newProduct, message: "Created successfully" } };
    }
  ),

  update: withMock(
    (id, data) => {
      if (data instanceof FormData) {
        data.append("_method", "PUT");
        return api.post(`/products/${id}`, data);
      }
      return api.put(`/products/${id}`, data);
    },
    (id, data) => {
      const all = getMockProducts();
      const idx = all.findIndex(x => String(x.id) === String(id));
      if (idx === -1) throw new Error("Not found");
      
      if (data instanceof FormData) {
        for (let [key, value] of data.entries()) {
          if (key !== 'media[]' && key !== '_method') all[idx][key] = value;
        }
      } else {
        Object.assign(all[idx], data);
      }
      saveMockProducts(all);
      return { data: { message: "Updated successfully", data: all[idx] } };
    }
  ),

  delete: withMock(
    (id) => api.delete(`/products/${id}`),
    (id) => {
      let all = getMockProducts();
      all = all.filter(x => String(x.id) !== String(id));
      saveMockProducts(all);
      return { data: { message: "Deleted successfully" } };
    }
  ),

  pendingApprovals: withMock(
    (params) => api.get("/admin/product-approvals", { params }),
    () => {
      const all = getMockProducts();
      return { data: { data: all.filter(p => p.status === 'pending') } };
    }
  ),

  approve: withMock(
    (id, data) => api.post(`/admin/products/${id}/approve`, data),
    (id, data) => {
      const all = getMockProducts();
      const p = all.find(x => String(x.id) === String(id));
      if (p) {
        p.status = data.approved ? 'approved' : 'rejected';
        if (!data.approved) p.reason = data.reason;
        saveMockProducts(all);
      }
      return { data: { message: "Success" } };
    }
  ),

  reject: withMock(
    (id, data) => api.post(`/admin/products/${id}/reject`, data),
    (id, data) => {
      const all = getMockProducts();
      const p = all.find(x => String(x.id) === String(id));
      if (p) {
        p.status = 'rejected';
        p.reason = data.reason;
        saveMockProducts(all);
      }
      return { data: { message: "Success" } };
    }
  ),

  sendToAdmin: withMock(
    (id) => api.post(`/products/${id}/submit`),
    (id) => {
      const all = getMockProducts();
      const p = all.find(x => String(x.id) === String(id));
      if (p) {
        p.status = 'pending';
        saveMockProducts(all);
      }
      return { data: { message: "Success" } };
    }
  ),

  sendFeedback: withMock(
    (id, data) => api.post(`/products/${id}/feedback`, data),
    () => ({ data: { message: "Success" } })
  ),

  assignVendor: withMock(
    (id, data) => api.post(`/admin/products/${id}/select-vendor`, data),
    () => ({ data: { message: "Success" } })
  ),
  
  updateDeadline: withMock(
    (id, data) => api.put(`/products/${id}/deadline`, data),
    (id, data) => {
      const all = getMockProducts();
      const p = all.find(x => String(x.id) === String(id));
      if (p) {
        p.deadline_date = data.deadline_date;
        saveMockProducts(all);
      }
      return { data: { message: "Success" } };
    }
  ),
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
// VENDOR API MOCK CHO DEMO
// ===============================
const getMockVendors = () => JSON.parse(localStorage.getItem('MOCK_VENDORS') || '[]');
const saveMockVendors = (vendors) => {
  localStorage.setItem('MOCK_VENDORS', JSON.stringify(vendors));
  window.dispatchEvent(new Event('storage'));
};

export const vendorApi = {
  list: withMock(
    (params) => api.get("/vendors", { params }),
    () => {
      const all = getMockVendors();
      return { data: { data: all } };
    }
  ),

  listByProductType: withMock(
    (productType) => api.get("/vendors", { params: { product_type: productType } }),
    (productType) => {
      const all = getMockVendors();
      // Lọc cơ bản cho demo (tuỳ ý)
      return { data: { data: all } };
    }
  ),

  getById: withMock(
    (id) => api.get(`/vendors/${id}`),
    (id) => {
      const all = getMockVendors();
      const v = all.find(x => String(x.id) === String(id));
      if (!v) throw new Error("Not found");
      return { data: { data: v } };
    }
  ),

  compare: withMock(
    (params) => api.get("/vendors/compare", { params }),
    () => ({ data: { data: [] } })
  ),

  importBulk: withMock(
    (vendors) => api.post("/vendors/import", { vendors }),
    (payload) => {
      const all = getMockVendors();
      const newVendors = payload.vendors || payload;
      const combined = [...newVendors, ...all];
      // Loại bỏ trùng lặp đơn giản theo email hoặc name
      const unique = combined.filter((v, i, a) => a.findIndex(t => (t.email === v.email)) === i);
      saveMockVendors(unique);
      return { data: { message: "Imported successfully" } };
    }
  ),

  create: withMock(
    (data) => api.post("/vendors", data),
    (data) => {
      const all = getMockVendors();
      const newVendor = {
        id: Date.now(),
        created_at: new Date().toISOString(),
        ...data
      };
      all.unshift(newVendor);
      saveMockVendors(all);
      return { data: { data: newVendor, message: "Created successfully" } };
    }
  ),

  update: withMock(
    (id, data) => api.put(`/vendors/${id}`, data),
    (id, data) => {
      const all = getMockVendors();
      const idx = all.findIndex(x => String(x.id) === String(id));
      if (idx === -1) throw new Error("Not found");
      Object.assign(all[idx], data);
      saveMockVendors(all);
      return { data: { message: "Updated successfully", data: all[idx] } };
    }
  ),

  delete: withMock(
    (id) => api.delete(`/vendors/${id}`),
    (id) => {
      let all = getMockVendors();
      all = all.filter(x => String(x.id) !== String(id));
      saveMockVendors(all);
      return { data: { message: "Deleted successfully" } };
    }
  ),
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