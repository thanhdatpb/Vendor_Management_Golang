import React from "react";
console.log("force cache bust v3");
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import "antd/dist/reset.css";

import { AuthProvider } from "./context/AuthContext";
import { initSyncService } from "./utils/SyncService";

// Bật đồng bộ ngầm với json-server
initSyncService();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);