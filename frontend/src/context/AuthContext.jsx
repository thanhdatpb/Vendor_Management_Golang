import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    const token = localStorage.getItem("auth_token");

    if (savedUser && token) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
    }

    setLoading(false);
  }, []);

  // Lưu token + user vào localStorage và state (dùng chung login / selectAccount).
  const applyAuth = useCallback((userData, token) => {
    if (userData.seller_name) userData.sellerName = userData.seller_name;
    localStorage.setItem("auth_token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
    return userData;
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const res = await authApi.login(email, password);

      // 1 email có nhiều tài khoản → chưa cấp token, yêu cầu chọn.
      if (res.data?.needs_selection) {
        return { needsSelection: true, ticket: res.data.ticket, accounts: res.data.accounts || [] };
      }

      let userData = null, token = null;
      if (res.data.user && res.data.token) {
        userData = res.data.user; token = res.data.token;
      } else if (res.data.data?.user && res.data.data?.token) {
        userData = res.data.data.user; token = res.data.data.token;
      } else if (res.data) {
        userData = res.data.user || res.data; token = res.data.token;
      }

      if (!userData || !token) throw new Error("Invalid response structure: missing user or token");

      return applyAuth(userData, token);
    } catch (error) {
      const message = error.response?.data?.message
        || error.response?.data?.error
        || error.message
        || "Login failed";
      throw new Error(message);
    }
  }, [applyAuth]);

  // Hoàn tất đăng nhập sau khi người dùng chọn tài khoản (email có nhiều role/project).
  const selectAccount = useCallback(async (ticket, accountId) => {
    try {
      const res = await authApi.selectAccount(ticket, accountId);
      const userData = res.data?.user;
      const token = res.data?.token;
      if (!userData || !token) throw new Error("Invalid response structure");
      return applyAuth(userData, token);
    } catch (error) {
      const message = error.response?.data?.message || error.message || "Không hoàn tất được đăng nhập";
      throw new Error(message);
    }
  }, [applyAuth]);

  const logout = useCallback(() => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
    setUser(null);
  }, []);

  // Lấy role đã chuẩn hóa (bỏ dấu _/-, chữ thường) để khớp cả tên role cũ (staff_a/staff_b) và mới (seller/vendor)
  const userRole = (user?.role || "").toLowerCase().replace(/[_\-\s]/g, "");

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        selectAccount,
        logout,
        isAdmin: userRole === "admin",
        isStaff: userRole === "seller" || userRole === "staffa",
        isStaffC: userRole === "vendor" || userRole === "staffb",
        isCSF: userRole === "csf",
        isPD: userRole === "pd",
        isAuthenticated: !!user,
        sellerName: user?.sellerName || user?.seller_name || null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);