// ════════════════════════════════════════════════════════
//  CỬA SỔ MỘT FILE THƯ VIỆN VENDOR
//
//  Trước đây bấm vào một file là bung nội dung NGAY TRONG danh sách: card cao
//  700–1.800px đẩy mọi file khác xuống, mở 2 file là mất dấu hoàn toàn, và cả
//  105 file dùng chung đúng một URL nên không gửi link cho ai được.
//
//  Nay file mở thành cửa sổ gần kín màn hình, nền sau mờ đi, và URL đổi sang
//  /library/:fileId — copy được, F5 được, gửi đi được.
//
//  Vỏ cửa sổ nằm riêng ở đây vì có 3 nơi dùng: danh sách của Admin/Vendor/
//  Seller, danh sách của CSF/PD/Marvel, và trang /library/:fileId khi mở thẳng
//  từ link. Nội dung bên trong do nơi gọi truyền vào.
// ════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState } from 'react';
import { HC } from '../../constants/sellerTheme';

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Ô nhập của chính cửa sổ (tìm kiếm, lọc) — không tính là "đang sửa dở". */
const OPEN_EDITOR = 'input:not([data-modal-safe]), textarea:not([data-modal-safe])';

export default function LibraryFileModal({
  title,
  subtitle,
  badges = null,
  actions = null,
  footer = null,
  onClose,
  children,
  // Vendor/Admin sửa được ngay trong cửa sổ. Đang có ô nhập mở mà bấm ra nền
  // thì KHÔNG đóng — bấm nhầm ra ngoài là chuyện xảy ra hằng ngày, và thao tác
  // đang gõ dở sẽ mất không dấu vết. Cửa sổ chỉ-xem thì đóng thẳng.
  guardWhileEditing = false,
}) {
  const panelRef = useRef(null);
  const scrimRef = useRef(null);
  const [dirtyWarning, setDirtyWarning] = useState(false);

  const requestClose = useCallback(() => {
    const hasOpenEditor = guardWhileEditing && !!panelRef.current?.querySelector(OPEN_EDITOR);
    if (hasOpenEditor) {
      setDirtyWarning(true);
      return;
    }
    onClose?.();
  }, [guardWhileEditing, onClose]);

  useEffect(() => {
    if (!dirtyWarning) return undefined;
    const timer = setTimeout(() => setDirtyWarning(false), 4000);
    return () => clearTimeout(timer);
  }, [dirtyWarning]);

  // ─── Khoá cuộn nền ───────────────────────────────────────────────
  // Danh sách thư viện cuộn trong khung riêng, nhưng body vẫn cuộn được trên
  // màn hẹp — khoá ở đây để nền không trôi dưới cửa sổ rồi khi đóng ra thì
  // người dùng mất chỗ đang lướt.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  // ─── Tiêu điểm: vào cửa sổ khi mở, trả về chỗ cũ khi đóng ─────────
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    panelRef.current?.focus();
    return () => {
      if (previouslyFocused instanceof HTMLElement && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, []);

  // ─── Bàn phím: Esc đóng, Tab quẩn trong cửa sổ ────────────────────
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        // Ảnh phóng to nằm TRONG cửa sổ này. Esc phải đóng từng lớp một:
        // lớp trên cùng tự xử lý và tự đánh dấu bằng [data-esc-layer].
        if (document.querySelector('[data-esc-layer]')) return;
        e.preventDefault();
        requestClose();
        return;
      }

      if (e.key !== 'Tab' || !panelRef.current) return;
      const nodes = Array.from(panelRef.current.querySelectorAll(FOCUSABLE))
        .filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (nodes.length === 0) {
        e.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [requestClose]);

  // Chỉ đóng khi bấm ĐÚNG lớp nền. Dùng mousedown-rồi-click cùng một đích để
  // bôi đen chữ trong bảng rồi thả chuột ra ngoài không làm đóng cửa sổ.
  const pressedOnScrim = useRef(false);
  const handleScrimMouseDown = (e) => { pressedOnScrim.current = e.target === scrimRef.current; };
  const handleScrimClick = (e) => {
    if (e.target === scrimRef.current && pressedOnScrim.current) requestClose();
    pressedOnScrim.current = false;
  };

  return (
    <div
      ref={scrimRef}
      className="hc-lib-scrim-pad"
      onMouseDown={handleScrimMouseDown}
      onClick={handleScrimClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(26,15,0,0.46)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px 1.5cm', boxSizing: 'border-box',
      }}
    >
      <style>{`
        @keyframes hcLibModalIn { from { opacity: 0; transform: scale(0.985); } to { opacity: 1; transform: none; } }
        .hc-lib-modal { animation: hcLibModalIn 140ms ease-out; }
        /* Keep the active section and its column headings visible while browsing rows. */
        .hc-lib-scroll-body {
          --hc-lib-scroll-pad: 16px;
          --hc-lib-section-tabs-height: 46px;
          padding: var(--hc-lib-scroll-pad);
        }
        /* Sticky offsets start at the scroll body's content edge, so pinned layers
           keep the same 16px gap under the file title as before scrolling. The
           solid shadow fills that gap; otherwise scrolled rows show through it. */
        .hc-lib-scroll-body .hc-library-section-tabs {
          position: sticky; top: 0; z-index: 20;
          min-height: var(--hc-lib-section-tabs-height); box-sizing: border-box;
          box-shadow: 0 2px 5px rgba(81, 52, 10, 0.10), 0 calc(-1 * var(--hc-lib-scroll-pad)) 0 0 ${HC.surface};
        }
        /* Tuck the table header 1px under the tabs: at fractional offsets a 0px
           seam still lets anti-aliased text from scrolled rows bleed through. */
        .hc-lib-scroll-body .hc-library-sections { --hc-lib-table-head-top: calc(var(--hc-lib-section-tabs-height) - 1px); }
        /* Sticky on table sections is inconsistent between browsers. Pin each
           header cell instead, so it remains reliable for one- and two-row headers. */
        .hc-lib-scroll-body .hc-library-table > thead > tr > th {
          position: sticky; top: var(--hc-lib-table-head-top, 0px); z-index: 10;
        }
        /* Collapsed borders are painted by the table and stay behind when cells
           pin, leaving see-through grid lines that scrolled text bleeds into.
           Repaint each pinned cell's border in its own colour. (box-shadow is
           not an option: Chrome ignores it on collapsed-border cells.) */
        .hc-lib-scroll-body .hc-library-table > thead > tr > th::after {
          content: ''; position: absolute; inset: -1px; pointer-events: none;
          border: 1px solid; border-color: inherit;
        }
        /* Tables without section tabs pin straight under the title, so they fill the gap themselves. */
        .hc-lib-scroll-body .hc-library-table > thead > tr:first-child > th::before {
          content: ''; position: absolute; left: -1px; right: -1px; bottom: 100%;
          height: calc(var(--hc-lib-scroll-pad) + 1px); background: ${HC.surface}; pointer-events: none;
        }
        /* The table reports its real first-row height, which varies with fonts and zoom. */
        .hc-lib-scroll-body .hc-library-table > thead > .hc-library-header-row--secondary > th {
          top: calc(var(--hc-lib-table-head-top, 0px) + var(--hc-library-header-row-1-height, 30px));
          z-index: 11;
        }
        .hc-lib-scroll-body .hc-library-table > thead > .hc-library-header-row--primary > th[rowspan] {
          z-index: 12;
        }
        /* A nested horizontal scroller would keep the header from following the modal's vertical scroll. */
        .hc-lib-scroll-body .hc-library-table-scroll { overflow: visible !important; }
        @media (prefers-reduced-motion: reduce) { .hc-lib-modal { animation: none; } }
        @media (max-width: 720px) {
          .hc-lib-scrim-pad { padding: 0 !important; }
          .hc-lib-modal { width: 100% !important; height: 100% !important; border-radius: 0 !important; }
        }
      `}</style>

      <div
        ref={panelRef}
        className="hc-lib-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{
          width: '100%', boxSizing: 'border-box',
          height: 'min(92vh, 900px)',
          background: HC.surface,
          border: `1.5px solid ${HC.borderStrong}`,
          borderRadius: 16,
          boxShadow: '0 26px 64px rgba(0,0,0,0.30)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          outline: 'none',
        }}
      >
        {/* Đầu cửa sổ — dính, luôn thấy tên file và nút đóng */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          padding: '12px 16px', flexShrink: 0,
          background: HC.surface2, borderBottom: `1px solid ${HC.border}`,
        }}>
          <span style={{ fontSize: 16 }} aria-hidden="true">📄</span>
          <span style={{ fontWeight: 800, fontSize: 14, color: HC.ink }}>{title}</span>
          {badges}
          {subtitle && <span style={{ fontSize: 11, color: HC.muted }}>{subtitle}</span>}
          <span style={{ flex: 1, minWidth: 8 }} />
          {actions}
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ file"
            title="Đóng (Esc)"
            style={{
              width: 30, height: 30, borderRadius: 9, cursor: 'pointer',
              border: `1.5px solid ${HC.borderStrong}`, background: HC.surface,
              color: HC.brown, fontSize: 13, fontWeight: 800, lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Thân — vùng cuộn duy nhất của cửa sổ */}
        <div style={{
          flex: 1, minHeight: 0, overflow: 'auto', overscrollBehavior: 'contain',
          background: HC.surface,
        }} className="hc-lib-scroll-body">
          {children}
        </div>

        {(footer || dirtyWarning) && (
          <div style={{
            flexShrink: 0, padding: '9px 16px',
            borderTop: `1px solid ${HC.border}`,
            background: dirtyWarning ? '#fffbeb' : HC.surface2,
            color: dirtyWarning ? '#92400e' : HC.muted,
            fontSize: 11, fontWeight: dirtyWarning ? 700 : 400,
            display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
          }}>
            {dirtyWarning
              ? <span role="status">Đang sửa dở — lưu hoặc huỷ ô đang nhập trước, hoặc bấm ✕ để đóng.</span>
              : footer}
          </div>
        )}
      </div>
    </div>
  );
}
