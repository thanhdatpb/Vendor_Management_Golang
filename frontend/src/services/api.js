import axios from "axios";

// Nếu VITE_API_URL để trống → dùng "" (relative URL) → Vite proxy forward đến Laravel
// Nếu VITE_API_URL có giá trị (ví dụ khi deploy) → dùng URL đó
const API_BASE = import.meta.env.VITE_API_URL || "";
const API_URL = `${API_BASE}/api`;
const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json",
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
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      const token = localStorage.getItem("auth_token");
      // Nếu đang dùng mock token cho local demo, không tự động văng ra login
      if (token && token.startsWith("mock_token_")) {
        console.warn("⚠️ API trả về 401 nhưng đang dùng mock_token, bỏ qua auto-logout.");
      } else if (window.location.pathname !== "/login") {
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

  assignVendors: (id, vendors) => api.post(`/products/${id}/assign-vendors`, { vendors }),
  getAssignedVendors: (id) => api.get(`/products/${id}/assigned-vendors`),

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
// ANALYTICS API
// ===============================
export const analyticsApi = {
  conversion: () => api.get("/analytics/conversion"),
  profit: () => api.get("/analytics/profit"),
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
  list: (params) => api.get("/vendors", { params }),
  listByProductType: (productType) => api.get("/vendors", { params: { product_type: productType } }),
  getById: (id) => api.get(`/vendors/${id}`),
  compare: (params) => api.get("/vendors/compare", { params }),
  importBulk: (formData) => {
    return api.post("/vendors/import", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
  },
  create: (data) => api.post("/vendors", data),
  update: (id, data) => api.put(`/vendors/${id}`, data),
  delete: (id) => api.delete(`/vendors/${id}`),
  uploadMedia: (id, formData) => api.post(`/vendors/${id}/upload-media`, formData),
  deleteMedia: (id, index) => api.delete(`/vendors/${id}/delete-media`, { data: { index } }),
};

export const vendorLibraryApi = {
  get: (mode = 'all') => api.get(`/vendor-library?mode=${mode}`),
  save: (data, mode = 'all') => api.post(`/vendor-library?mode=${mode}`, data),
  // Cập nhật nhẹ trạng thái Sample của 1 dòng generalInfo (không gửi cả blob)
  setSampleStatus: (rowId, sampleStatus) =>
    api.post('/vendor-library/sample-status', { rowId, sampleStatus }),
  // Cập nhật nhẹ cờ Best Seller của 1 dòng generalInfo — lưu server, chia sẻ mọi role
  setBestSeller: (rowId, isBestSeller) =>
    api.post('/vendor-library/best-seller', { rowId, isBestSeller }),
  restoreBackup: () => api.post('/vendor-library/restore-backup'),
  // Upload hàng loạt ảnh trích xuất từ Excel (ảnh nhúng trực tiếp vào ô) khi import
  uploadImages: (formData) => api.post('/vendor-library/upload-images', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};


// ===============================
// NOTIFICATION API
// ===============================
export const notificationApi = {
  list: (params) => api.get("/notifications", { params }),
  create: (data) => api.post("/notifications", data),
  readAll: () => api.post("/notifications/read-all"),
  readOne: (id) => api.post(`/notifications/${id}/read`),
  deleteOne: (id) => api.delete(`/notifications/${id}`),
};

// ===============================
// VENDOR FEEDBACK API
// ===============================
export const feedbackApi = {
  get: (productId) => api.get(`/products/${productId}/vendor-feedback`),
  create: (productId, data) => api.post(`/products/${productId}/vendor-feedback`, data),
  respond: (productId, vendorKey, data) => api.put(`/products/${productId}/vendor-feedback/${encodeURIComponent(vendorKey)}`, data),
};

// ===============================
// SAMPLE DECISION API
// ===============================
export const sampleDecisionApi = {
  get: (productId) => api.get(`/products/${productId}/sample-decisions`),
  save: (productId, data) => api.post(`/products/${productId}/sample-decisions`, data),
};

// ===============================
// VENDOR SELECTION API
// ===============================
export const vendorSelectionApi = {
  get: (productId, role) => api.get(`/products/${productId}/vendor-selections`, { params: { role } }),
  save: (productId, role, data) => api.post(`/products/${productId}/vendor-selections`, { role, selections: data }),
};

// ===============================
// PRICE SHEETS (Bảng tính giá) — lưu server, đồng bộ mọi máy theo project
// ===============================
export const priceSheetApi = {
  list:   ()      => api.get("/price-sheets"),
  save:   (sheet) => api.post("/price-sheets", sheet),
  remove: (id)    => api.delete(`/price-sheets/${id}`),
};

// ===============================
// NEWS (Quản Lý Thông Báo — Vendor tạo) — lưu server thay localStorage
// ===============================
export const newsApi = {
  list:   ()            => api.get("/news"),
  create: (data)         => api.post("/news", data),
  update: (id, data)     => api.put(`/news/${id}`, data),
  remove: (id)           => api.delete(`/news/${id}`),
};


// ===============================
// AUTH API
// ===============================
export const authApi = {
  login: (email, password) => api.post("/login", { email, password }),
  logout: () => api.post("/logout"),
  me: () => api.get("/me"),
};


// ===============================
// ADMIN — NHÂN SỰ API
// ===============================
export const adminUserApi = {
  list:         ()            => api.get("/admin/users"),
  create:       (data)        => api.post("/admin/users", data),
  update:       (id, data)    => api.patch(`/admin/users/${id}`, data),
  toggleStatus: (id)          => api.patch(`/admin/users/${id}/status`),
};


export default api;