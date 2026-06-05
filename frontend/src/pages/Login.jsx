import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import logoImg from "../assets/logo.png";

export default function Login() {
  const { login, user: contextUser } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState("");

  const handleSubmit = async () => {
    if (!form.email || !form.password) {
      setError("Vui lòng nhập đầy đủ thông tin");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await login(form.email, form.password);
      const user = result || contextUser;

      if (!user) throw new Error("Không lấy được thông tin người dùng");

      const role = typeof user.role === "object"
        ? user.role?.name
        : user.role;

      console.log("Role sau chuẩn hóa:", role);

      if (role === "admin") {
        navigate("/admin");
      } else if (role === "staffa" || role === "staff_a") {
        navigate("/staff-a");
      } else if (role === "staffb" || role === "staff_b") {
        navigate("/staff-b");
      } else {
        navigate("/");
      }

    } catch (err) {
      console.error("Login error:", err);
      setError(err.message || "Đăng nhập thất bại. Vui lòng thử lại.");
    } finally {
      setLoading(false);
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
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%       { opacity: 0.7; transform: scale(1.08); }
        }

        .hc-card   { animation: fadeUp 0.65s ease both; }
        .hc-float-a { animation: floatA 6s ease-in-out infinite; }
        .hc-float-b { animation: floatB 8s ease-in-out infinite 1s; }

        .hc-input {
          width: 100%;
          padding: 13px 16px;
          border-radius: 12px;
          border: 1.5px solid #E8E0D5;
          background: #FFFDF9;
          color: #1a1208;
          font-size: 14px;
          font-family: 'Nunito Sans', sans-serif;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        }
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
        }
        .hc-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(245,166,35,0.45);
        }
        .hc-btn:active:not(:disabled) { transform: translateY(0); }
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
      }}>

        {/* Decorative background circles */}
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

        {/* ── Login Card ── */}
        <div className="hc-card" style={{
          width: "100%",
          maxWidth: 440,
          background: "rgba(255, 253, 249, 0.92)",
          backdropFilter: "blur(12px)",
          borderRadius: 24,
          border: `1.5px solid ${ORANGE_MID}`,
          boxShadow: `0 8px 48px rgba(245,166,35,0.14), 0 2px 12px rgba(0,0,0,0.06)`,
          padding: "44px 40px 36px",
          position: "relative",
          zIndex: 1,
        }}>

          {/* Brand header */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ display: "inline-block", marginBottom: 12 }}>
              <img src={logoImg} alt="Happy Creative Logo" style={{ width: 72, height: 72, objectFit: "contain" }} />
            </div>

            <div style={{
              fontSize: 22,
              fontWeight: 900,
              color: "#d68615",
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
            }}>
              Happy Creative
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
              width: 40, height: 2.5, borderRadius: 99,
              background: `linear-gradient(90deg, ${ORANGE}, ${ORANGE_DARK})`,
              margin: "0 auto 20px",
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
            }}>
              <span style={{ fontSize: 16 }}>⚠️</span> {error}
            </div>
          )}

          {/* Fields */}
          {[
            { label: "Tài khoản", key: "email", type: "text", placeholder: "happyc.admin" },
            { label: "Mật khẩu", key: "password", type: "password", placeholder: "••••••••••" },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 20 }}>
              <label style={{
                display: "block",
                fontSize: 11,
                fontWeight: 800,
                color: focused === f.key ? ORANGE_DARK : "#7A5C32",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 8,
                transition: "color 0.2s",
              }}>
                {f.label}
              </label>
              <input
                className="hc-input"
                type={f.type}
                placeholder={f.placeholder}
                value={form[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                onFocus={() => setFocused(f.key)}
                onBlur={() => setFocused("")}
              />
            </div>
          ))}

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
                boxShadow: loading ? "none" : `0 4px 20px rgba(245,166,35,0.35)`,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "⟳ Đang đăng nhập..." : "Đăng Nhập →"}
            </button>
          </div>

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
            Happy Creative © {new Date().getFullYear()} · #It'sAlwaysDay1
          </div>
        </div>
      </div>
    </>
  );
}