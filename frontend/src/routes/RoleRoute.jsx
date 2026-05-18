import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";


const normalizeRole = (role) => {
  if (!role) return "";

  return role
    .toString()
    .toLowerCase()
    .replace(/[_\-\s]/g, ""); 
};

export default function RoleRoute({ children, allow = [] }) {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;

  if (!user) {
    return <Navigate to="/" replace />;
  }
  const rawRole =
    typeof user.role === "object"
      ? user.role?.name
      : user.role;
  const userRole = normalizeRole(rawRole);
  const allowRoles = allow.map(normalizeRole);
  console.log("USER ROLE:", userRole);
  console.log("ALLOW:", allowRoles);
  if (!allowRoles.includes(userRole)) {
    console.warn("ACCESS DENIED:", userRole);
    return <Navigate to="/" replace />;
  }
  return children;
}