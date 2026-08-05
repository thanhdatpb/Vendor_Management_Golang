import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../services/api";
import AccountChooser from "../components/shared/AccountChooser";
import logoImg from "../assets/logo.png";

const ERROR_MESSAGES = {
  account_not_found:   "Tài khoản Gmail này chưa được cấp phép. Vui lòng liên hệ Admin.",
  account_disabled:    "Tài khoản của bạn đã bị khoá. Vui lòng liên hệ Admin.",
  identity_mismatch:   "Gmail không khớp với tài khoản đã đăng ký. Vui lòng liên hệ Admin.",
  email_not_verified:  "Gmail của bạn chưa được Google xác minh.",
  oauth_failed:        "Xác thực Google thất bại. Vui lòng thử lại.",
};

function resolveRoleRoute(role) {
  const r = (role || "").toLowerCase().replace(/[_\-\s]/g, "");
  if (r === "admin")  return "/admin";
  if (r === "vendor" || r === "staffb") return "/vendor";
  if (r === "csf") return "/csf";
  if (r === "marvel") return "/marvel";
  if (r === "pd")  return "/pd";
  return "/seller"; // seller / staffa
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // loading | select | error
  const [errorMsg, setErrorMsg] = useState("");
  const [ticket, setTicket] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [selectBusyId, setSelectBusyId] = useState(null);

  const ORANGE = "#F5A623";

  // Lưu token + user rồi điều hướng theo vai trò (full reload để AuthContext re-init).
  const finishLogin = (userData, token) => {
    if (userData.seller_name) userData.sellerName = userData.seller_name;
    localStorage.setItem("auth_token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    window.location.href = resolveRoleRoute(userData.role);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error  = params.get("error");
    const token  = params.get("token");
    const select = params.get("select");   // vé chọn tài khoản (email nhiều role/project)

    if (error) {
      const msg = ERROR_MESSAGES[error] || "Đăng nhập thất bại. Vui lòng thử lại.";
      setErrorMsg(msg);
      setStatus("error");
      setTimeout(() => navigate("/?error=" + encodeURIComponent(msg), { replace: true }), 3000);
      return;
    }

    // Nhiều tài khoản → hiện bước chọn
    if (select) {
      try {
        const raw = params.get("accounts") || "";
        const list = JSON.parse(atob(raw));
        window.history.replaceState({}, document.title, "/auth/callback");
        setTicket(select);
        setAccounts(Array.isArray(list) ? list : []);
        setStatus("select");
      } catch {
        setErrorMsg("Dữ liệu chọn tài khoản không hợp lệ. Vui lòng đăng nhập lại.");
        setStatus("error");
        setTimeout(() => navigate("/", { replace: true }), 3000);
      }
      return;
    }

    if (!token) {
      navigate("/", { replace: true });
      return;
    }

    window.history.replaceState({}, document.title, "/auth/callback");
    localStorage.setItem("auth_token", token);

    authApi.me()
      .then((res) => {
        const userData = res.data?.user || res.data;
        if (!userData) throw new Error("No user data");
        finishLogin(userData, token);
      })
      .catch(() => {
        localStorage.removeItem("auth_token");
        setErrorMsg("Không lấy được thông tin tài khoản. Vui lòng thử lại.");
        setStatus("error");
        setTimeout(() => navigate("/", { replace: true }), 3000);
      });
  }, [navigate]);

  const handleSelect = async (accountId) => {
    setSelectBusyId(accountId);
    setErrorMsg("");
    try {
      const res = await authApi.selectAccount(ticket, accountId);
      const userData = res.data?.user;
      const token = res.data?.token;
      if (!userData || !token) throw new Error("Invalid response");
      finishLogin(userData, token);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || "Không hoàn tất được đăng nhập. Vui lòng đăng nhập lại.");
      setSelectBusyId(null);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "radial-gradient(ellipse at 60% 40%, #FDE8B8 0%, #FFF8EE 45%, #FFFBF4 100%)",
      fontFamily: "'Nunito', sans-serif",
      padding: 16,
    }}>
      <div style={{
        background: "rgba(255,253,249,0.95)",
        backdropFilter: "blur(16px)",
        borderRadius: 28,
        border: "1.5px solid #FDE8B8",
        boxShadow: "0 12px 56px rgba(245,166,35,0.18), 0 2px 16px rgba(0,0,0,0.06)",
        padding: "44px 40px",
        textAlign: "center",
        maxWidth: 420,
        width: "100%",
      }}>
        <div style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: "linear-gradient(135deg, #FFF8EE 0%, #FDE8B8 100%)",
          border: "2px solid #FDE8B8", borderRadius: 18, padding: 10, marginBottom: 20,
        }}>
          <img src={logoImg} alt="Logo" style={{ width: 56, height: 56, objectFit: "contain" }} />
        </div>

        {status === "loading" && (
          <>
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              border: `4px solid #FDE8B8`,
              borderTopColor: ORANGE,
              animation: "hc-spin 0.8s linear infinite",
              margin: "0 auto 20px",
            }} />
            <div style={{ fontSize: 18, fontWeight: 800, color: "#1A0F00", marginBottom: 8 }}>
              Đang xác thực...
            </div>
            <div style={{ fontSize: 13, color: "#9C7A50", fontWeight: 600 }}>
              Vui lòng chờ trong giây lát
            </div>
          </>
        )}

        {status === "select" && (
          <AccountChooser accounts={accounts} onSelect={handleSelect} busyId={selectBusyId} error={errorMsg} />
        )}

        {status === "error" && (
          <>
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              background: "#FFF2F2", border: "2px solid #FFCDD2",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px", fontSize: 22,
            }}>
              ✕
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#C62828", marginBottom: 8 }}>
              Đăng nhập thất bại
            </div>
            <div style={{
              fontSize: 13, color: "#9C7A50", fontWeight: 600, lineHeight: 1.6,
              marginBottom: 16,
            }}>
              {errorMsg}
            </div>
            <div style={{ fontSize: 11, color: "#C4B49A" }}>
              Tự động quay về trang đăng nhập...
            </div>
          </>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800&display=swap');
        @keyframes hc-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
