import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AccountChooser from "../components/shared/AccountChooser";
import logoImg from "../assets/logo.png";
import useIsMobile from "../hooks/useIsMobile";

const API_BASE = import.meta.env.VITE_API_URL || "";
const GOOGLE_OAUTH_URL = `${API_BASE}/api/auth/google/redirect`;

const OAUTH_ERROR_MESSAGES = {
  account_not_found:  "Tài khoản Gmail này chưa được cấp phép. Vui lòng liên hệ Admin.",
  account_disabled:   "Tài khoản của bạn đã bị khoá. Vui lòng liên hệ Admin.",
  identity_mismatch:  "Gmail không khớp với tài khoản đã đăng ký. Vui lòng liên hệ Admin.",
  email_not_verified: "Gmail của bạn chưa được Google xác minh.",
  oauth_failed:       "Xác thực Google thất bại. Vui lòng thử lại.",
};
import {
  UserOutlined,
  LockOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  ExclamationCircleFilled,
  LoadingOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";

export default function Login() {
  const { login, selectAccount, user: contextUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (contextUser) {
      const rawRole = typeof contextUser.role === "object" ? contextUser.role?.name : contextUser.role;
      const role = rawRole ? rawRole.toString().toLowerCase().replace(/[_\-\s]/g, "") : "";

      if (role === "admin") navigate("/admin");
      else if (role === "staffa" || role === "staff" || role === "seller") navigate("/seller");
      else if (role === "staffb" || role === "vendor") navigate("/vendor");
      else if (role === "csf") navigate("/csf");
      else if (role === "pd") navigate("/pd");
    }
  }, [contextUser, navigate]);

  // Đọc lỗi OAuth từ URL params (nếu redirect từ Google callback)
  const oauthErrorKey = searchParams.get("error") || "";
  const oauthErrorMsg = OAUTH_ERROR_MESSAGES[oauthErrorKey] || (oauthErrorKey ? decodeURIComponent(oauthErrorKey) : "");

  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(oauthErrorMsg);
  const [focused, setFocused] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selection, setSelection] = useState(null);       // { ticket, accounts } khi 1 email có nhiều tài khoản
  const [selectBusyId, setSelectBusyId] = useState(null); // id account đang được chọn

  const goByRole = (user) => {
    const rawRole = typeof user.role === "object" ? user.role?.name : user.role;
    const role = rawRole ? rawRole.toString().toLowerCase().replace(/[_\-\s]/g, "") : "";
    if (role === "admin") navigate("/admin");
    else if (role === "staffa" || role === "staff" || role === "seller") navigate("/seller");
    else if (role === "staffb" || role === "vendor") navigate("/vendor");
    else if (role === "csf") navigate("/csf");
    else if (role === "pd") navigate("/pd");
    else navigate("/");
  };

  const handleSubmit = async () => {
    if (!form.email || !form.password) {
      setError("Vui lòng nhập đầy đủ thông tin");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await login(form.email, form.password);

      // 1 email có nhiều tài khoản → hiện bước chọn thay vì vào thẳng.
      if (result?.needsSelection) {
        setSelection({ ticket: result.ticket, accounts: result.accounts });
        return;
      }

      const user = result || contextUser;
      if (!user) throw new Error("Không lấy được thông tin người dùng");
      goByRole(user);
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message || "Đăng nhập thất bại. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAccount = async (accountId) => {
    setSelectBusyId(accountId);
    setError("");
    try {
      const user = await selectAccount(selection.ticket, accountId);
      goByRole(user);
    } catch (err) {
      setError(err.message || "Không hoàn tất được đăng nhập.");
      setSelectBusyId(null);
    }
  };

  const ORANGE = "#F5A623";
  const ORANGE_DARK = "#E09415";
  const ORANGE_MID = "#FDE8B8";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Nunito+Sans:wght@400;600;700&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        @keyframes floatA {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50%       { transform: translateY(-18px) rotate(5deg); }
        }
        @keyframes floatB {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50%       { transform: translateY(-12px) rotate(-4deg); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }

        .hc-card   { animation: fadeUp 0.65s ease both; }
        .hc-float-a { animation: floatA 6s ease-in-out infinite; }
        .hc-float-b { animation: floatB 8s ease-in-out infinite 1s; }

        .hc-input-wrap {
          position: relative;
          width: 100%;
        }
        .hc-input-icon {
          position: absolute;
          left: 13px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 15px;
          color: #C4B49A;
          pointer-events: none;
          transition: color 0.2s;
          display: flex;
          align-items: center;
        }
        .hc-input-icon.focused { color: #F5A623; }

        .hc-eye-btn {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: #C4B49A;
          font-size: 15px;
          padding: 2px 4px;
          display: flex;
          align-items: center;
          transition: color 0.2s;
          line-height: 1;
        }
        .hc-eye-btn:hover { color: #F5A623; }

        .hc-input {
          width: 100%;
          padding: 13px 16px 13px 40px;
          border-radius: 12px;
          border: 1.5px solid #E8E0D5;
          background: #FFFDF9;
          color: #1a1208;
          font-size: 14px;
          font-family: 'Nunito Sans', sans-serif;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        }
        .hc-input.has-eye { padding-right: 42px; }
        .hc-input:focus {
          border-color: #F5A623;
          background: #fff;
          box-shadow: 0 0 0 4px rgba(245,166,35,0.12);
        }
        .hc-input::placeholder { color: #C4B49A; }

        .hc-btn {
          width: 100%;
          padding: 14px;
          border: none;
          border-radius: 14px;
          font-family: 'Nunito', sans-serif;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
          letter-spacing: 0.02em;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .hc-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(245,166,35,0.45);
        }
        .hc-btn:active:not(:disabled) { transform: translateY(0); }

        .hc-logo-wrap {
          border-radius: 18px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #FFF8EE 0%, #FDE8B8 100%);
          border: 2px solid #FDE8B8;
          padding: 10px;
        }

        .hc-divider-line {
          background: linear-gradient(90deg, transparent, #F5A623, transparent);
          height: 1px;
          border: none;
          margin: 16px 0;
          opacity: 0.4;
        }
      `}</style>

      {/* Full-page background */}
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Nunito', sans-serif",
        background: `radial-gradient(ellipse at 60% 40%, ${ORANGE_MID} 0%, #FFF8EE 45%, #FFFBF4 100%)`,
        position: "relative",
        overflow: "hidden",
        padding: isMobile ? "20px" : 0,
      }}>

        {/* Decorative background circles */}
        {!isMobile && (
          <>
            <div style={{
              position: "absolute", top: -100, left: -100,
              width: 360, height: 360, borderRadius: "50%",
              border: `32px solid ${ORANGE}18`,
              animation: "spinSlow 30s linear infinite",
              pointerEvents: "none",
            }} />
            <div style={{
              position: "absolute", bottom: -80, right: -80,
              width: 280, height: 280, borderRadius: "50%",
              border: `24px solid ${ORANGE}14`,
              animation: "spinSlow 22s linear infinite reverse",
              pointerEvents: "none",
            }} />
            <div style={{
              position: "absolute", top: "20%", right: "6%",
              width: 120, height: 120, borderRadius: "50%",
              border: `16px solid ${ORANGE}10`,
              animation: "spinSlow 18s linear infinite",
              pointerEvents: "none",
            }} />
            <div className="hc-float-b" style={{
              position: "absolute", top: "12%", right: "8%",
              width: 52, height: 52, borderRadius: "50%",
              background: `${ORANGE}28`, pointerEvents: "none",
            }} />
            <div className="hc-float-a" style={{
              position: "absolute", bottom: "14%", left: "7%",
              width: 36, height: 36, borderRadius: "50%",
              background: `${ORANGE}38`, pointerEvents: "none",
            }} />
            <div className="hc-float-b" style={{
              position: "absolute", bottom: "30%", right: "12%",
              width: 20, height: 20, borderRadius: "50%",
              background: `${ORANGE}50`, pointerEvents: "none",
            }} />
          </>
        )}

        {/* ── Login Card ── */}
        <div className="hc-card" style={{
          width: "100%",
          maxWidth: 440,
          background: "rgba(255, 253, 249, 0.95)",
          backdropFilter: "blur(16px)",
          borderRadius: isMobile ? 20 : 28,
          border: `1.5px solid ${ORANGE_MID}`,
          boxShadow: `0 12px 56px rgba(245,166,35,0.18), 0 2px 16px rgba(0,0,0,0.06)`,
          padding: isMobile ? "34px 26px 26px" : "44px 40px 36px",
          position: "relative",
          zIndex: 1,
        }}>

          {/* Brand header */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ display: "inline-block", marginBottom: 14 }}>
              <div className="hc-logo-wrap">
                <img src={logoImg} alt="Happy Creative Logo" style={{ width: 64, height: 64, objectFit: "contain" }} />
              </div>
            </div>

            <div style={{
              fontSize: 22,
              fontWeight: 900,
              color: "#d68615",
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
            }}>
              Happy Creative LLC
            </div>

            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color: ORANGE,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              marginTop: 4,
              marginBottom: 20,
            }}>
              #It'sAlwaysDay1
            </div>

            {/* Divider */}
            <div style={{
              width: 48, height: 3, borderRadius: 99,
              background: `linear-gradient(90deg, ${ORANGE}, ${ORANGE_DARK})`,
              margin: "0 auto 20px",
              boxShadow: `0 2px 8px ${ORANGE}40`,
            }} />

            <div style={{ fontSize: 26, fontWeight: 900, color: "#1A0F00", letterSpacing: "-0.02em" }}>
              Vendor&nbsp;<span style={{ color: ORANGE }}>Management</span>
            </div>
            <div style={{
              marginTop: 6, fontSize: 13, color: "#9C7A50",
              fontFamily: "'Nunito Sans', sans-serif", fontWeight: 600,
            }}>
              Đăng nhập để tiếp tục quá trình quản lý
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: "11px 16px",
              borderRadius: 12,
              background: "#FFF2F2",
              border: "1.5px solid #FFCDD2",
              color: "#C62828",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 20,
              fontFamily: "'Nunito Sans', sans-serif",
              display: "flex",
              alignItems: "center",
              gap: 8,
              animation: "fadeUp 0.3s ease",
            }}>
              <ExclamationCircleFilled style={{ fontSize: 16, color: "#EF4444", flexShrink: 0 }} />
              {error}
            </div>
          )}

          {selection ? (
            <div>
              <AccountChooser accounts={selection.accounts} onSelect={handleSelectAccount} busyId={selectBusyId} />
              <button
                onClick={() => { setSelection(null); setSelectBusyId(null); setError(""); }}
                style={{ display: "block", margin: "18px auto 0", background: "none", border: "none", color: "#9C7A50", fontSize: 12.5, fontWeight: 700, cursor: "pointer", textDecoration: "underline", fontFamily: "'Nunito', sans-serif" }}
              >
                ← Đăng nhập bằng email khác
              </button>
            </div>
          ) : (
          <>
          {/* Fields */}
          {/* Tài khoản */}
          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: "block",
              fontSize: 11,
              fontWeight: 800,
              color: focused === "email" ? ORANGE_DARK : "#7A5C32",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 8,
              transition: "color 0.2s",
            }}>
              Tài khoản
            </label>
            <div className="hc-input-wrap">
              <span className={`hc-input-icon${focused === "email" ? " focused" : ""}`}>
                <UserOutlined />
              </span>
              <input
                className="hc-input"
                type="text"
                placeholder=""
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused("")}
              />
            </div>
          </div>

          {/* Mật khẩu */}
          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: "block",
              fontSize: 11,
              fontWeight: 800,
              color: focused === "password" ? ORANGE_DARK : "#7A5C32",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 8,
              transition: "color 0.2s",
            }}>
              Mật khẩu
            </label>
            <div className="hc-input-wrap">
              <span className={`hc-input-icon${focused === "password" ? " focused" : ""}`}>
                <LockOutlined />
              </span>
              <input
                className="hc-input has-eye"
                type={showPassword ? "text" : "password"}
                placeholder=""
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused("")}
              />
              <button
                className="hc-eye-btn"
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(v => !v)}
              >
                {showPassword ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <div style={{ marginTop: 28 }}>
            <button
              className="hc-btn"
              onClick={handleSubmit}
              disabled={loading}
              style={{
                background: loading
                  ? "#D4C4A8"
                  : `linear-gradient(135deg, ${ORANGE} 0%, ${ORANGE_DARK} 100%)`,
                color: loading ? "#9C8870" : "#fff",
                boxShadow: loading ? "none" : `0 4px 20px rgba(245,166,35,0.40)`,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? (
                <>
                  <LoadingOutlined spin style={{ fontSize: 16 }} />
                  Đang đăng nhập...
                </>
              ) : (
                <>
                  Đăng Nhập
                  <ArrowRightOutlined />
                </>
              )}
            </button>
          </div>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0 0" }}>
            <div style={{ flex: 1, height: 1, background: ORANGE_MID }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#C4B49A", letterSpacing: "0.12em" }}>
              HOẶC
            </span>
            <div style={{ flex: 1, height: 1, background: ORANGE_MID }} />
          </div>

          {/* Google Sign In */}
          <div style={{ marginTop: 14 }}>
            <button
              className="hc-btn"
              onClick={() => { window.location.href = GOOGLE_OAUTH_URL; }}
              disabled={loading}
              style={{
                background: "#fff",
                color: "#3c4043",
                border: "1.5px solid #E8E0D5",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                fontWeight: 700,
                fontSize: 14,
                cursor: loading ? "not-allowed" : "pointer",
                gap: 10,
              }}
            >
              {/* Google G logo */}
              <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                <path fill="none" d="M0 0h48v48H0z"/>
              </svg>
              Đăng nhập bằng Google
            </button>
            <p style={{
              textAlign: "center", marginTop: 10,
              fontSize: 10, color: "#C4B49A",
              fontFamily: "'Nunito Sans', sans-serif", fontWeight: 600,
            }}>
              Dành cho nhân sự — tài khoản phải được Admin cấp phép
            </p>
          </div>
          </>
          )}

          {/* Footer */}
          <div style={{
            marginTop: 28,
            paddingTop: 20,
            borderTop: `1px solid ${ORANGE_MID}`,
            textAlign: "center",
            fontSize: 11,
            color: "#d89435",
            fontFamily: "'Nunito Sans', sans-serif",
            fontWeight: 600,
            letterSpacing: "0.06em",
          }}>
            Happy Creative LLC © {new Date().getFullYear()} · #It'sAlwaysDay1
          </div>
        </div>
      </div>
    </>
  );
}