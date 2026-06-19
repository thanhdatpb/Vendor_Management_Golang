import React from "react";
console.log("force cache bust v3");
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import "antd/dist/reset.css";

import { AuthProvider } from "./context/AuthContext";

// Xóa dữ liệu localStorage cũ từ hệ thống mock/local để API là source of truth
const OLD_LS_KEYS = [
  'STAFF_PRODUCT_VENDORS_V1',
  'STAFF_B_NOTIFICATIONS',
  'STAFF_A_NOTIFICATIONS',
  'SELLER_NOTIFICATIONS',
  'STAFF_B_NEWS_V1',
  'MOCK_PRODUCTS',
];
OLD_LS_KEYS.forEach(key => localStorage.removeItem(key));

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);