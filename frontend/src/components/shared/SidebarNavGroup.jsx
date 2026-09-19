// ════════════════════════════════════════════════════════
//  MỤC SIDEBAR CÓ SUBMENU — dùng chung cho sidebar của mọi role
//
//  Sidebar của Admin / Seller / Vendor / CSF-PD được viết riêng từng file nhưng
//  cùng một bộ token màu tối và cùng kiểu dòng nav. Phần submenu (Thư Viện
//  Vendor → Tổng quan / New Arrivals / Best Seller kèm badge số file) để ở đây
//  để bốn nơi không trôi lệch nhau mỗi lần chỉnh.
//
//  Cách dùng: truyền chính component dòng nav của sidebar đó vào `NavItem` —
//  dòng cha vẫn giữ nguyên giao diện sẵn có, chỉ thêm mũi tên đóng/mở ở cuối
//  (prop `trailing`).
// ════════════════════════════════════════════════════════
import React, { useState, useEffect } from 'react';
import { DownOutlined } from '@ant-design/icons';
import { formatVendorLibraryCount } from '../../utils/vendorLibraryNavigation';

const DARK = {
  bgHover:   'var(--hc-dark-bg-hover)',
  border:    'var(--hc-dark-border)',
  text:      'var(--hc-dark-text)',
  textMuted: 'var(--hc-dark-text-muted)',
};

/** Một dòng submenu: chấm tròn · nhãn · (tuỳ chọn) badge số file. */
function SubNavItem({ item, isActive, countLabel, accent, accentInk, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-current={isActive ? 'page' : undefined}
      style={{
        width: '100%',
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '9px 8px 9px 12px',
        marginTop: 2,
        borderRadius: 8,
        border: 'none',
        background: isActive ? `${accent}1F` : hovered ? DARK.bgHover : 'transparent',
        cursor: 'pointer', textAlign: 'left',
        fontFamily: "'Inter',sans-serif",
        transition: 'background 0.18s ease',
      }}
    >
      <span style={{
        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
        background: isActive ? accent : DARK.textMuted,
        opacity: isActive ? 1 : 0.55,
        boxShadow: isActive ? `0 0 0 3px ${accent}30` : 'none',
        transition: 'all 0.18s ease',
      }} />
      <span style={{
        flex: 1, minWidth: 0,
        fontSize: 12.5, fontWeight: isActive ? 700 : 500,
        color: isActive ? accent : hovered ? DARK.text : DARK.textMuted,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        transition: 'color 0.18s ease',
      }}>
        {item.label}
      </span>
      {countLabel != null && (
        <span
          aria-label={`${item.label}: ${countLabel} file`}
          style={{
            minWidth: 22, height: 20, padding: '0 7px', borderRadius: 99, flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
            background: isActive ? accent : 'rgba(255,255,255,0.10)',
            color: isActive ? accentInk : '#f1f5f9',
            transition: 'all 0.18s ease',
          }}
        >
          {countLabel}
        </span>
      )}
    </button>
  );
}

/**
 * @param {object}   props.item       mục nav như sidebar vẫn dùng ({ id, icon, label })
 * @param {object}   props.submenu    { items, activeId, counts, countsPending, onSelect }
 *   • counts        — { [itemId]: number }, hoặc null khi chưa tải lần nào
 *   • countsPending — đang tải lần đầu: badge hiện "…" thay vì ẩn
 * @param {Function} props.NavItem    component dòng nav của sidebar gọi tới
 * @param {string}   props.accent     màu nhấn của sidebar đó
 * @param {string=}  props.accentInk  màu chữ trên nền accent (badge mục đang chọn)
 */
export default function SidebarNavGroup({
  item, submenu, isActive, isCollapsed, onClick,
  NavItem, accent, accentInk = '#1A0F00',
}) {
  const [expanded, setExpanded] = useState(isActive);

  // Vào mục này (kể cả qua URL/Back) thì tự mở submenu.
  useEffect(() => { if (isActive) setExpanded(true); }, [isActive]);

  // Sidebar thu gọn chỉ còn icon — không đủ chỗ cho submenu.
  if (isCollapsed) {
    return <NavItem item={item} isActive={isActive} isCollapsed onClick={onClick} />;
  }

  const chevron = (
    <span
      role="button"
      tabIndex={0}
      aria-label={expanded ? `Thu gọn ${item.label}` : `Mở rộng ${item.label}`}
      aria-expanded={expanded}
      onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          setExpanded((v) => !v);
        }
      }}
      style={{
        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, color: isActive ? accent : DARK.textMuted,
        transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
        transition: 'transform 0.2s ease, color 0.18s ease',
      }}
    >
      <DownOutlined />
    </span>
  );

  const { counts, countsPending } = submenu;

  return (
    <div style={{
      marginBottom: 4,
      borderRadius: 12,
      border: `1px solid ${expanded ? DARK.border : 'transparent'}`,
      background: expanded ? 'rgba(255,255,255,0.02)' : 'transparent',
      transition: 'all 0.18s ease',
    }}>
      {/* Dòng nav sẵn có tự chừa marginBottom cho mục kế tiếp — trong nhóm thì
          submenu nằm ngay dưới nên bù lại cho khít. */}
      <div style={{ marginBottom: -4 }}>
        <NavItem item={item} isActive={isActive} isCollapsed={false} onClick={onClick} trailing={chevron} />
      </div>

      {expanded && (
        <div role="group" aria-label={item.label} style={{ padding: '6px 4px' }}>
          {submenu.items.map((sub) => {
            let countLabel = null;
            if (sub.hasCount) {
              if (counts) countLabel = formatVendorLibraryCount(counts[sub.id]);
              else if (countsPending) countLabel = formatVendorLibraryCount(NaN);
            }
            return (
              <SubNavItem
                key={sub.id}
                item={sub}
                isActive={isActive && submenu.activeId === sub.id}
                countLabel={countLabel}
                accent={accent}
                accentInk={accentInk}
                onClick={() => submenu.onSelect(sub.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
