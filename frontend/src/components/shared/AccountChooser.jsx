// ════════════════════════════════════════════════════════
//  ACCOUNT CHOOSER — khi 1 email có nhiều tài khoản (role/project khác nhau),
//  hiển thị danh sách để người dùng chọn vào đâu. Dùng chung cho:
//   - Login bằng mật khẩu (Login.jsx)
//   - Login bằng Google (AuthCallback.jsx)
// ════════════════════════════════════════════════════════
const ROLE_LABEL = {
  admin: 'Admin', vendor: 'Vendor', seller: 'Seller', csf: 'CSF', marvel: 'Marvel', pd: 'PD',
};

export default function AccountChooser({ accounts = [], onSelect, busyId = null, error = '' }) {
  return (
    <div style={{ width: '100%' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#1A0F00', marginBottom: 6, textAlign: 'center' }}>
        Chọn nơi đăng nhập
      </div>
      <div style={{ fontSize: 13, color: '#9C7A50', fontWeight: 600, marginBottom: 18, textAlign: 'center' }}>
        Email này được cấp quyền ở nhiều vai trò / dự án. Chọn một để tiếp tục.
      </div>

      {error && (
        <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: '#FFF2F2', border: '1px solid #FFCDD2', color: '#C62828', fontSize: 12.5, fontWeight: 600, textAlign: 'center' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {accounts.map((acc) => {
          const busy = busyId === acc.id;
          const anyBusy = busyId !== null;
          return (
            <button
              key={acc.id}
              onClick={() => !anyBusy && onSelect(acc.id)}
              disabled={anyBusy}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                padding: '14px 16px', borderRadius: 14, textAlign: 'left',
                border: '1.5px solid #FDE8B8', background: busy ? '#FDF3DC' : '#FFFDF9',
                cursor: anyBusy ? 'default' : 'pointer', opacity: anyBusy && !busy ? 0.55 : 1,
                transition: 'all 0.15s', fontFamily: "'Nunito', sans-serif",
              }}
              onMouseEnter={(e) => { if (!anyBusy) { e.currentTarget.style.background = '#FDF3DC'; e.currentTarget.style.borderColor = '#F5A623'; } }}
              onMouseLeave={(e) => { if (!anyBusy) { e.currentTarget.style.background = '#FFFDF9'; e.currentTarget.style.borderColor = '#FDE8B8'; } }}
            >
              <span style={{
                flexShrink: 0, minWidth: 62, textAlign: 'center', padding: '4px 8px', borderRadius: 8,
                background: 'linear-gradient(135deg, #F5A623, #E8890B)', color: '#fff',
                fontSize: 12, fontWeight: 900, letterSpacing: '0.03em',
              }}>
                {ROLE_LABEL[acc.role] || acc.role}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: '#1A0F00' }}>
                  {acc.project || 'Toàn hệ thống'}
                </span>
                {acc.full_name && (
                  <span style={{ display: 'block', fontSize: 12, color: '#9C7A50', fontWeight: 600, marginTop: 1 }}>
                    {acc.full_name}
                  </span>
                )}
              </span>
              <span style={{ flexShrink: 0, fontSize: 16, color: '#C4A05A' }}>
                {busy ? '…' : '→'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
