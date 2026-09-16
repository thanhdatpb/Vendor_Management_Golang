// ════════════════════════════════════════════════════════════════════════════
//  SHARE PROJECTS MODAL — chọn project nào được xem một file thư viện Vendor
//
//  Trước đây quyền xem suy ra từ ký hiệu `P.xxx` trong TÊN FILE: muốn đổi ai
//  được xem là phải đổi tên file, và không diễn tả được "2 project cùng xem".
//  Nay Vendor/Admin chọn tường minh ở đây, ghi vào `file.projects`.
//
//  Quy ước lưu (xem constants/projects.js):
//    • không chọn project nào → [] → MỌI project đều thấy
//    • chọn 1..n project      → chỉ các project đó thấy
//  File chưa từng chia sẻ (`projects` chưa có) sẽ được nạp sẵn theo ký hiệu
//  `P.xxx` đang có trong tên, để lần lưu đầu tiên không đổi ai đang thấy nó.
// ════════════════════════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { PROJECTS, extractFileProject, fileSharedProjects } from '../../constants/projects';

export default function ShareProjectsModal({ HC, entry, saving = false, onConfirm, onClose }) {
  const [selected, setSelected] = useState(() => {
    const shared = fileSharedProjects(entry);
    if (shared) return new Set(shared);
    const fromName = extractFileProject(entry?.filename);
    return new Set(fromName ? [fromName] : []);
  });

  const allProjects = selected.size === 0;

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filename = (entry?.filename || '').replace(/\.xlsx?$/i, '');

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
        backdropFilter: 'blur(3px)', zIndex: 3000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 460, maxWidth: '100%', background: '#fff', borderRadius: 16,
          overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.28)',
          animation: 'shareModalIn 0.18s ease-out',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 22px', background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`,
          color: '#fff', display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5V18a7.5 7.5 0 0 1 7.5-7.5h6" />
              <polyline points="13.5 6 18 10.5 13.5 15" />
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 900, fontFamily: "'Inter',sans-serif", lineHeight: 1.2 }}>
              Chia sẻ file cho project
            </div>
            <div style={{
              fontSize: 11, opacity: 0.9, marginTop: 3,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {filename}
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 22px' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: HC.ink, marginBottom: 10 }}>
            Project được xem file này
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PROJECTS.map(p => {
              const checked = selected.has(p.id);
              return (
                <label
                  key={p.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                    padding: '10px 12px', borderRadius: 10,
                    border: `1.5px solid ${checked ? HC.orange : HC.border}`,
                    background: checked ? HC.orangeLight : HC.surface,
                    transition: 'all 0.15s',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(p.id)}
                    style={{ width: 15, height: 15, accentColor: HC.orange, cursor: 'pointer' }}
                  />
                  <span style={{
                    fontSize: 12.5, fontWeight: checked ? 800 : 600,
                    color: checked ? HC.orangeDark : HC.ink,
                  }}>
                    {p.shortLabel || p.label}
                  </span>
                </label>
              );
            })}
          </div>

          <div style={{
            marginTop: 14, padding: '10px 12px', borderRadius: 10,
            background: allProjects ? '#ecfdf5' : '#f8fafc',
            border: `1.5px solid ${allProjects ? '#a7f3d0' : HC.border}`,
            fontSize: 11, color: allProjects ? '#047857' : HC.muted, lineHeight: 1.5,
          }}>
            {allProjects
              ? '🌐 Không chọn project nào → MỌI project đều xem được file này.'
              : `👥 Chỉ ${selected.size} project được chọn xem được file này. Bỏ chọn hết để chia sẻ cho mọi project.`}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 22px', background: HC.cream, borderTop: `1.5px solid ${HC.border}`,
          display: 'flex', justifyContent: 'flex-end', gap: 10,
        }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '9px 20px', borderRadius: 10, border: `1.5px solid ${HC.border}`,
              background: HC.surface, color: HC.ink, fontSize: 12, fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
            }}
          >
            Hủy
          </button>
          <button
            onClick={() => onConfirm(Array.from(selected))}
            disabled={saving}
            style={{
              padding: '9px 24px', borderRadius: 10, border: 'none',
              background: saving ? HC.muted2 : `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`,
              color: '#fff', fontSize: 12, fontWeight: 900,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Đang lưu...' : '✓ Lưu chia sẻ'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes shareModalIn { from { transform: scale(0.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
}
