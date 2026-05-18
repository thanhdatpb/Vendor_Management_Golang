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
      // Đảm bảo role được chuẩn hóa
      if (parsedUser.role) {
        // Chuyển đổi staff_a -> staffa nếu cần cho các kiểm tra
        const normalizedRole = parsedUser.role === "staff_a" ? "staffa" :
          parsedUser.role === "staff_b" ? "staffb" :
            parsedUser.role;
        parsedUser.role = normalizedRole;
      }
      setUser(parsedUser);
    }

    setLoading(false);
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      console.log("Login attempt with:", { email, password });
      const res = await authApi.login(email, password);
      console.log("Login response:", res);

      // Dựa vào cấu trúc response thực tế, có thể là res.data.user hoặc res.data.data.user...
      let userData = null;
      let token = null;

      if (res.data.user && res.data.token) {
        userData = res.data.user;
        token = res.data.token;
      } else if (res.data.data && res.data.data.user && res.data.data.token) {
        userData = res.data.data.user;
        token = res.data.data.token;
      } else if (res.data) {
        // Nếu không có, thử lấy từ res.data trực tiếp (nếu backend trả về user và token)
        userData = res.data.user || res.data;
        token = res.data.token;
      }

      if (!userData || !token) {
        throw new Error("Invalid response structure: missing user or token");
      }

      // CHUẨN HÓA ROLE: chuyển staff_a -> staffa, staff_b -> staffb
      if (userData.role) {
        console.log("Original role from server:", userData.role);

        // Chuyển đổi role để đồng bộ với các kiểm tra trong app
        const normalizedRole = userData.role === "staff_a" ? "staffa" :
          userData.role === "staff_b" ? "staffb" :
            userData.role;
        userData.role = normalizedRole;
        console.log("Normalized role:", userData.role);
      }

      // ← THÊM: Đảm bảo seller_name được lưu
      if (userData.seller_name) {
        console.log("Seller name from server:", userData.seller_name);
        userData.sellerName = userData.seller_name;  // ← Thêm trường sellerName cho dễ dùng
      }

      localStorage.setItem("auth_token", token);
      localStorage.setItem("user", JSON.stringify(userData));
      setUser(userData);

      return userData;

    } catch (error) {
      console.error("Login error:", error);
      // Hiển thị lỗi chi tiết
      const message = error.response?.data?.message
        || error.response?.data?.error
        || error.message
        || "Login failed";
      throw new Error(message);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
    setUser(null);
  }, []);

  // Lấy role đã chuẩn hóa
  const userRole = user?.role;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAdmin: userRole === "admin",
        isStaff: userRole === "staffa", // Đã được chuẩn hóa
        isStaffC: userRole === "staffb", // Đã được chuẩn hóa
        isAuthenticated: !!user,
        // ← THÊM: Lấy sellerName từ user
        sellerName: user?.sellerName || user?.seller_name || null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);