import { useState, useEffect, useCallback } from 'react';
import { PlusOutlined, EditOutlined, LockOutlined, UnlockOutlined, LoadingOutlined, ExclamationCircleFilled } from '@ant-design/icons';
import { HC } from '../constants';
import { adminUserApi } from '../../../services/api';
import { formatLastSeen } from '../lastSeen';

// ─────────────────────────────────────────────
const PROJECTS = ['Happy Project', 'Creative Project', 'Global Project', 'Hapify84 Project'];
// PD KHÔNG còn nằm trong tab project: PD tra cứu thư viện của mọi project nên
// gán project cho PD không còn ý nghĩa. Tab project giờ chỉ còn Seller.
const TABS = [
  ...PROJECTS.map(p => ({ key: p, label: p.replace(' Project', ''), type: 'seller' })),
  { key: '__pd__', label: 'PD', type: 'pd' },
  { key: '__csf__', label: 'CSF', type: 'csf' },
  { key: '__marvel__', label: 'Marvel', type: 'marvel' },
  { key: '__admin_vendor__', label: 'Admin & Vendor', type: 'admin_vendor' },
];

// Tab chỉ chứa đúng 1 role → modal Thêm/Sửa khoá cứng role, không cho chọn.
// `type` của tab trùng luôn với giá trị role để dùng trực tiếp làm fixedRole.
const SINGLE_ROLE_TABS = ['pd', 'csf', 'marvel'];

const ROLE_BADGE = {
  admin:  { bg: '#FEF3DC', color: HC.orangeDark, label: 'Admin' },
  vendor: { bg: '#E8F4FF', color: '#1d4ed8',     label: 'Vendor' },
  seller: { bg: '#ECFDF5', color: '#065f46',      label: 'Seller' },
  pd:     { bg: '#F3E8FF', color: '#7e22ce',      label: 'PD' },
  csf:    { bg: '#FCE7F3', color: '#be185d',      label: 'CSF' },
  marvel: { bg: '#FEE2E2', color: '#b91c1c',      label: 'Marvel' },
};

// Role options theo từng loại tab, dùng cho select trong modal Thêm/Sửa nhân sự
const ROLE_OPTIONS_BY_TAB = {
  admin_vendor: [{ value: 'admin', label: 'Admin' }, { value: 'vendor', label: 'Vendor' }],
  seller:       [{ value: 'seller', label: 'Seller' }],
};

// Suy ra loại tab tương ứng với 1 role hiện có (dùng khi Sửa nhân sự)
function tabTypeForRole(role) {
  if (role === 'seller') return 'seller';
  if (SINGLE_ROLE_TABS.includes(role)) return role;
  return 'admin_vendor';
}

// ─── Shared styles ────────────────────────────
const card = {
  background: HC.surface,
  borderRadius: 16,
  border: `1.5px solid ${HC.border}`,
  boxShadow: HC.shadow,
  overflow: 'hidden',
};
const thStyle = {
  padding: '11px 16px',
  fontSize: 11,
  fontWeight: 800,
  color: HC.muted,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  background: HC.orangePale,
  borderBottom: `1.5px solid ${HC.border}`,
  textAlign: 'left',
  whiteSpace: 'nowrap',
};
const tdStyle = {
  padding: '12px 16px',
  fontSize: 13,
  color: HC.ink,
  borderBottom: `1px solid ${HC.border}`,
  verticalAlign: 'middle',
};

// ─── Small modal ──────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: HC.surface, borderRadius: 20,
        border: `1.5px solid ${HC.border}`,
        boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
        width: '100%', maxWidth: 460, padding: '28px 32px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: HC.ink, fontFamily: "'Inter',sans-serif" }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: HC.muted, lineHeight: 1 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormField({ label, error, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: HC.brown, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7 }}>{label}</label>
      {children}
      {error && <div style={{ marginTop: 5, fontSize: 11, color: HC.danger, fontWeight: 600 }}>{error}</div>}
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '11px 14px', borderRadius: 10,
  border: `1.5px solid ${HC.border}`, background: HC.surface2,
  fontSize: 13, color: HC.ink, fontFamily: "'Inter',sans-serif",
  outline: 'none', boxSizing: 'border-box',
};

// ─── Add / Edit Modal ─────────────────────────
function UserFormModal({ mode, initialData, fixedProject, fixedRole, roleOptions, onSave, onClose, saving, serverError }) {
  const [form, setForm] = useState({
    email:     initialData?.email     || '',
    full_name: initialData?.full_name || '',
    role:      initialData?.role      || fixedRole || roleOptions?.[0]?.value || 'admin',
    project:   initialData?.project   || fixedProject || '',
  });
  const [errors, setErrors] = useState({});

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const effectiveRole = fixedRole || form.role;
  // PD xem mọi project nên không cần gán project; chỉ Seller còn cần.
  const roleNeedsProject = effectiveRole === 'seller';

  const validate = () => {
    const e = {};
    if (mode === 'add') {
      if (!form.email.trim()) e.email = 'Email là bắt buộc';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Email không hợp lệ';
    }
    if (!form.full_name.trim()) e.full_name = 'Tên nhân sự là bắt buộc';
    if (roleNeedsProject && !fixedProject && !form.project) e.project = 'Project là bắt buộc';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSave({
      email:     form.email.trim().toLowerCase(),
      full_name: form.full_name.trim(),
      role:      effectiveRole,
      project:   roleNeedsProject ? (fixedProject || form.project) : null,
    });
  };

  const isAdminRole = effectiveRole === 'admin';

  return (
    <Modal title={mode === 'add' ? 'Thêm nhân sự mới' : 'Sửa thông tin'} onClose={onClose}>
      {isAdminRole && mode === 'add' && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: '#FFFBEB', border: '1.5px solid #FDE68A', marginBottom: 18, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <ExclamationCircleFilled style={{ color: HC.warning, fontSize: 16, flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 12, color: '#92400E', fontWeight: 600, lineHeight: 1.5 }}>
            Bạn đang cấp quyền Admin — đây là quyền cao nhất trong hệ thống. Xác nhận trước khi tiếp tục.
          </span>
        </div>
      )}

      {serverError && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: '#FFF2F2', border: '1.5px solid #FFCDD2', marginBottom: 18, fontSize: 12, color: HC.danger, fontWeight: 600 }}>
          {serverError}
        </div>
      )}

      {mode === 'add' && (
        <FormField label="Gmail" error={errors.email}>
          <input
            style={inputStyle} type="email" placeholder="ten@gmail.com hoặc ten@happy-creative.vn"
            value={form.email} onChange={e => set('email', e.target.value)}
          />
        </FormField>
      )}

      <FormField label="Tên nhân sự" error={errors.full_name}>
        <input
          style={inputStyle} type="text" placeholder="Nguyen Van A"
          value={form.full_name} onChange={e => set('full_name', e.target.value)}
        />
      </FormField>

      {!fixedRole && roleOptions && (
        <FormField label="Role" error={errors.role}>
          <select
            style={{ ...inputStyle, cursor: 'pointer' }}
            value={form.role} onChange={e => set('role', e.target.value)}
          >
            {roleOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </FormField>
      )}

      {roleNeedsProject && !fixedProject && (
        <FormField label="Project" error={errors.project}>
          <select
            style={{ ...inputStyle, cursor: 'pointer' }}
            value={form.project} onChange={e => set('project', e.target.value)}
          >
            <option value="">— Chọn project —</option>
            {PROJECTS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </FormField>
      )}

      {fixedProject && (
        <FormField label="Project">
          <div style={{ ...inputStyle, background: HC.orangePale, color: HC.muted, cursor: 'not-allowed' }}>{fixedProject}</div>
        </FormField>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 12, border: `1.5px solid ${HC.border}`, background: HC.surface, color: HC.muted, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>
          Huỷ
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          style={{ flex: 2, padding: '11px', borderRadius: 12, border: 'none', background: saving ? HC.muted2 : `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`, color: '#fff', fontSize: 13, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'Inter',sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {saving ? <><LoadingOutlined spin /> Đang lưu...</> : (mode === 'add' ? 'Thêm nhân sự' : 'Lưu thay đổi')}
        </button>
      </div>
    </Modal>
  );
}

// ─── Confirm lock/unlock modal ────────────────
function ConfirmModal({ user, onConfirm, onClose, saving }) {
  const willLock = user.is_active;
  return (
    <Modal title={willLock ? 'Khoá tài khoản' : 'Mở khoá tài khoản'} onClose={onClose}>
      <div style={{ textAlign: 'center', padding: '8px 0 24px' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>{willLock ? '🔒' : '🔓'}</div>
        <div style={{ fontSize: 14, color: HC.ink, fontWeight: 700, marginBottom: 8 }}>
          {willLock ? 'Khoá tài khoản này?' : 'Mở khoá tài khoản này?'}
        </div>
        <div style={{ fontSize: 13, color: HC.muted, lineHeight: 1.6 }}>
          <strong>{user.full_name || user.email}</strong>
          <br />{user.email}
        </div>
        {willLock && (
          <div style={{ marginTop: 14, padding: '8px 14px', borderRadius: 10, background: '#FFF2F2', border: '1px solid #FFCDD2', fontSize: 12, color: HC.danger, fontWeight: 600 }}>
            Phiên đăng nhập hiện tại sẽ bị đăng xuất ngay lập tức.
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 12, border: `1.5px solid ${HC.border}`, background: HC.surface, color: HC.muted, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>Huỷ</button>
        <button
          onClick={onConfirm}
          disabled={saving}
          style={{ flex: 2, padding: '11px', borderRadius: 12, border: 'none', background: willLock ? HC.danger : HC.success, color: '#fff', fontSize: 13, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'Inter',sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {saving ? <><LoadingOutlined spin /> Đang xử lý...</> : (willLock ? 'Xác nhận khoá' : 'Xác nhận mở khoá')}
        </button>
      </div>
    </Modal>
  );
}

// ─── Ô "Lần truy cập cuối" ────────────────────
function LastSeenCell({ iso }) {
  const { text, stale } = formatLastSeen(iso);
  return (
    <span
      title={iso ? new Date(iso).toLocaleString('vi-VN') : 'Chưa có lần truy cập nào được ghi nhận'}
      style={{ fontSize: 12, fontWeight: 600, color: stale ? '#94a3b8' : HC.brown, fontVariantNumeric: 'tabular-nums' }}>
      {text}
    </span>
  );
}

// ─── User table ───────────────────────────────
function UserTable({ users, tabType, onAdd, onEdit, onToggle, loading }) {
  const showRoleColumn = tabType === 'admin_vendor' || tabType === 'seller';

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: HC.muted }}>
        <LoadingOutlined style={{ fontSize: 28, color: HC.orange }} spin />
        <div style={{ marginTop: 12, fontSize: 13, fontWeight: 600 }}>Đang tải...</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Tên nhân sự</th>
              <th style={thStyle}>Gmail</th>
              {showRoleColumn && <th style={thStyle}>Role</th>}
              <th style={thStyle}>Lần truy cập cuối</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={showRoleColumn ? 5 : 4} style={{ ...tdStyle, textAlign: 'center', color: HC.muted, padding: '48px 16px' }}>
                  Chưa có nhân sự nào trong nhóm này
                </td>
              </tr>
            ) : (
              users.map(u => (
                <tr key={u.id} style={{ transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = HC.orangePale}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${HC.border}` }} />
                      ) : (
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                          {(u.full_name || u.email || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span style={{ fontWeight: 600, color: HC.ink }}>{u.full_name || '—'}</span>
                      {/* Cột "Trạng thái" đã nhường chỗ cho "Lần truy cập cuối" —
                          tài khoản bị khoá vẫn phải nhận ra được ngay ở đây. */}
                      {!u.is_active && (
                        <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                          Đã khoá
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: HC.brown }}>{u.email}</span>
                  </td>
                  {showRoleColumn && (
                    <td style={tdStyle}>
                      <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: ROLE_BADGE[u.role]?.bg, color: ROLE_BADGE[u.role]?.color }}>
                        {ROLE_BADGE[u.role]?.label || u.role}
                      </span>
                    </td>
                  )}
                  <td style={tdStyle}>
                    <LastSeenCell iso={u.last_seen_at} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => onEdit(u)}
                        style={{ padding: '5px 12px', borderRadius: 8, border: `1.5px solid ${HC.border}`, background: HC.surface, color: HC.brown, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = HC.orange; e.currentTarget.style.color = HC.orangeDark; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = HC.border; e.currentTarget.style.color = HC.brown; }}>
                        <EditOutlined style={{ fontSize: 11 }} /> Sửa
                      </button>
                      <button
                        onClick={() => onToggle(u)}
                        style={{ padding: '5px 12px', borderRadius: 8, border: `1.5px solid ${u.is_active ? '#FFCDD2' : '#bbf7d0'}`, background: u.is_active ? '#FFF2F2' : '#f0fdf4', color: u.is_active ? HC.danger : HC.success, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s' }}>
                        {u.is_active ? <><LockOutlined style={{ fontSize: 11 }} /> Khoá</> : <><UnlockOutlined style={{ fontSize: 11 }} /> Mở</>}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Trả về danh sách user thuộc 1 tab (project tab gồm cả Seller lẫn PD)
function usersForTab(tab, users) {
  if (!tab) return [];
  if (tab.type === 'admin_vendor') return users.filter(u => u.role === 'admin' || u.role === 'vendor');
  if (SINGLE_ROLE_TABS.includes(tab.type)) return users.filter(u => u.role === tab.type);
  return users.filter(u => u.project === tab.key && u.role === 'seller');
}

// ─── Main section ─────────────────────────────
export default function StaffManagementSection() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(TABS[0].key);

  const [addModal, setAddModal]     = useState(null); // { project?, role? }
  const [editModal, setEditModal]   = useState(null); // user object
  const [confirmModal, setConfirmModal] = useState(null); // user object
  const [saving, setSaving]         = useState(false);
  const [serverError, setServerError] = useState('');

  const [loadError, setLoadError] = useState('');

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError('');
      const res = await adminUserApi.list();
      setUsers(res.data?.users || []);
    } catch (err) {
      // KHÔNG nuốt lỗi thành danh sách rỗng. Trước đây chỉ console.error rồi để
      // `users` là [], nên mọi tab hiện "0 nhân sự" — Admin nhìn vào tưởng đã
      // mất sạch tài khoản. Sự cố thật 2026-08-18: API trả 500 vì thiếu cột DB,
      // dữ liệu còn nguyên, nhưng màn hình trông y như bị xoá.
      console.error('Load users error:', err?.message || err);
      setUsers([]);
      setLoadError(
        err?.response?.status
          ? `Không tải được danh sách nhân sự (lỗi ${err.response.status}). Dữ liệu KHÔNG bị mất — đây là lỗi tải.`
          : 'Không tải được danh sách nhân sự. Kiểm tra kết nối rồi thử lại.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const currentTab = TABS.find(t => t.key === activeTab);

  const visibleUsers = usersForTab(currentTab, users);

  // ── Handlers ──────────────────────────────
  const handleAdd = async (data) => {
    setSaving(true);
    setServerError('');
    try {
      await adminUserApi.create(data);
      await loadUsers();
      setAddModal(null);
    } catch (err) {
      setServerError(err.response?.data?.message || err.response?.data?.errors?.email?.[0] || 'Lỗi khi thêm nhân sự');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (data) => {
    setSaving(true);
    setServerError('');
    try {
      await adminUserApi.update(editModal.id, data);
      await loadUsers();
      setEditModal(null);
    } catch (err) {
      setServerError(err.response?.data?.message || 'Lỗi khi cập nhật');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    setSaving(true);
    try {
      await adminUserApi.toggleStatus(confirmModal.id);
      await loadUsers();
      setConfirmModal(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi thay đổi trạng thái');
    } finally {
      setSaving(false);
    }
  };

  // ── Derive add config from current tab ────
  const openAdd = () => {
    if (currentTab.type === 'seller') {
      setAddModal({ fixedProject: currentTab.key, fixedRole: null, roleOptions: ROLE_OPTIONS_BY_TAB.seller });
    } else if (SINGLE_ROLE_TABS.includes(currentTab.type)) {
      setAddModal({ fixedProject: null, fixedRole: currentTab.type, roleOptions: null });
    } else {
      setAddModal({ fixedProject: null, fixedRole: null, roleOptions: ROLE_OPTIONS_BY_TAB.admin_vendor });
    }
    setServerError('');
  };

  return (
    <div style={{ fontFamily: "'Inter',sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: HC.ink, fontFamily: "'Inter',sans-serif" }}>
            Quản Lý Nhân Sự
          </div>
          <div style={{ fontSize: 12, color: HC.muted, marginTop: 3, fontWeight: 600 }}>
            Thêm, sửa hoặc khoá tài khoản nhân sự theo từng dự án
          </div>
        </div>
        <button
          onClick={openAdd}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`, color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: "'Inter',sans-serif", boxShadow: `0 4px 14px rgba(245,166,35,0.35)`, transition: 'transform 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
          <PlusOutlined /> Thêm nhân sự
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.key;
          const count = usersForTab(tab, users).length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '8px 16px', borderRadius: 10, border: `1.5px solid ${isActive ? HC.orange : HC.border}`,
                background: isActive ? HC.orangeLight : HC.surface,
                color: isActive ? HC.orangeDark : HC.muted,
                fontSize: 12, fontWeight: isActive ? 800 : 600,
                cursor: 'pointer', fontFamily: "'Inter',sans-serif",
                display: 'flex', alignItems: 'center', gap: 7,
                transition: 'all 0.15s',
              }}>
              {tab.label}
              <span style={{ padding: '1px 7px', borderRadius: 99, background: isActive ? HC.orange : HC.border, color: isActive ? '#fff' : HC.muted, fontSize: 10, fontWeight: 800 }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Lỗi tải danh sách — phải nói rõ là LỖI TẢI, không phải mất dữ liệu */}
      {loadError && (
        <div role="alert" style={{
          marginBottom: 12, padding: '12px 16px', borderRadius: 12,
          background: '#FFF2F2', border: '1.5px solid #FFCDD2', color: HC.danger,
          fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <ExclamationCircleFilled />
          <span style={{ flex: 1 }}>{loadError}</span>
          <button onClick={loadUsers} style={{
            padding: '5px 14px', borderRadius: 8, border: `1.5px solid ${HC.danger}`,
            background: HC.surface, color: HC.danger, fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>Thử lại</button>
        </div>
      )}

      {/* Table card */}
      <div style={card}>
        <UserTable
          users={visibleUsers}
          tabType={currentTab?.type}
          loading={loading}
          onAdd={openAdd}
          onEdit={u => { setEditModal(u); setServerError(''); }}
          onToggle={u => setConfirmModal(u)}
        />
      </div>

      {/* Add modal */}
      {addModal && (
        <UserFormModal
          mode="add"
          fixedProject={addModal.fixedProject}
          fixedRole={addModal.fixedRole}
          roleOptions={addModal.roleOptions}
          onSave={handleAdd}
          onClose={() => setAddModal(null)}
          saving={saving}
          serverError={serverError}
        />
      )}

      {/* Edit modal */}
      {editModal && (() => {
        const editTabType = tabTypeForRole(editModal.role);
        const editFixedProject = editTabType === 'seller' ? editModal.project : null;
        const editSingleRole = SINGLE_ROLE_TABS.includes(editTabType);
        const editFixedRole = editSingleRole ? editTabType : null;
        const editRoleOptions = editSingleRole ? null : ROLE_OPTIONS_BY_TAB[editTabType];
        return (
          <UserFormModal
            mode="edit"
            initialData={editModal}
            fixedProject={editFixedProject}
            fixedRole={editFixedRole}
            roleOptions={editRoleOptions}
            onSave={handleEdit}
            onClose={() => setEditModal(null)}
            saving={saving}
            serverError={serverError}
          />
        );
      })()}

      {/* Confirm lock/unlock modal */}
      {confirmModal && (
        <ConfirmModal
          user={confirmModal}
          onConfirm={handleToggleStatus}
          onClose={() => setConfirmModal(null)}
          saving={saving}
        />
      )}
    </div>
  );
}
