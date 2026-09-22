// ════════════════════════════════════════════════════════
//  PRICE SHEET PRIMITIVES — Button / Input / Badge / Segmented /
//  ModalShell / ConfirmDialog. Mọi màu lấy từ tokens (PS).
// ════════════════════════════════════════════════════════
import { useEffect, useRef, useId } from 'react';
import { PS, PS_CSS, toneColor, toneBg } from './tokens';

/** Inject stylesheet .ps-* một lần (đặt trong root workspace). */
export function PsStyles() {
  return <style>{PS_CSS}</style>;
}

// ─── Button ──────────────────────────────────────────────
const BTN_BASE = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  fontSize: 13, fontWeight: 650, borderRadius: 8, cursor: 'pointer',
  padding: '8px 14px', whiteSpace: 'nowrap', lineHeight: 1.2,
};
const BTN_VARIANTS = {
  primary: { background: PS.brand, border: `1px solid ${PS.brand}`, color: '#fff', fontWeight: 700 },
  outline: { background: PS.bgSurface, border: `1px solid ${PS.border}`, color: PS.textSecondary },
  ghost: { background: 'transparent', border: '1px solid transparent', color: PS.textSecondary },
  dashed: { background: PS.bgSurface, border: `1.5px dashed ${PS.borderStrong}`, color: PS.textSecondary },
  dangerghost: { background: 'transparent', border: '1px solid transparent', color: PS.textMuted },
};

export function Btn({ variant = 'outline', size, style, children, ...rest }) {
  const sizeStyle = size === 'sm' ? { padding: '5px 10px', fontSize: 12 } : null;
  return (
    <button type="button" className={`ps-btn ps-btn-${variant}`}
      style={{ ...BTN_BASE, ...BTN_VARIANTS[variant], ...sizeStyle, ...style }} {...rest}>
      {children}
    </button>
  );
}

export function IconBtn({ title, style, children, variant = 'ghost', ...rest }) {
  return (
    <Btn variant={variant} title={title} aria-label={title}
      style={{ width: 32, height: 32, padding: 0, fontSize: 14, ...style }} {...rest}>
      {children}
    </Btn>
  );
}

// ─── Badge (meta / margin) ───────────────────────────────
export function Badge({ tone = 'muted', style, children, ...rest }) {
  const neutral = tone === 'muted';
  return (
    <span {...rest} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 10px',
      borderRadius: 999, fontSize: 12, fontWeight: 650, whiteSpace: 'nowrap',
      fontVariantNumeric: 'tabular-nums',
      background: neutral ? PS.bgSubtle : toneBg[tone],
      color: neutral ? PS.textSecondary : toneColor[tone],
      border: `1px solid ${neutral ? PS.border : 'transparent'}`,
      ...style,
    }}>
      {children}
    </span>
  );
}

/** Chấm màu nhỏ theo ngưỡng — dùng cạnh giá trị Margin/After Promo. */
export function Dot({ tone }) {
  return <span aria-hidden style={{
    display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
    background: toneColor[tone] || PS.textMuted, marginRight: 6, verticalAlign: 'middle',
  }} />;
}

// ─── Field: label + input có prefix/suffix ───────────────
export function NumField({ label, tooltip, prefix, suffix, invalid, inputStyle, ...rest }) {
  const id = useId();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }} title={tooltip || undefined}>
      <label htmlFor={id} style={{
        fontSize: 11, fontWeight: 650, color: PS.textSecondary,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{label}</label>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {prefix && <span aria-hidden style={{ position: 'absolute', left: 10, fontSize: 12.5, color: PS.textMuted, pointerEvents: 'none' }}>{prefix}</span>}
        <input id={id} className={`ps-input ps-input--num${invalid ? ' ps-input--invalid' : ''}`}
          style={{ paddingLeft: prefix ? 24 : 10, paddingRight: suffix ? 26 : 10, ...inputStyle }} {...rest} />
        {suffix && <span aria-hidden style={{ position: 'absolute', right: 10, fontSize: 12.5, color: PS.textMuted, pointerEvents: 'none' }}>{suffix}</span>}
      </div>
    </div>
  );
}

// ─── Segmented control ───────────────────────────────────
export function Segmented({ options, value, onChange, label, size = 'sm' }) {
  return (
    <div role="group" aria-label={label} style={{
      display: 'inline-flex', alignItems: 'center', gap: 2, padding: 3,
      background: PS.bgSubtle, border: `1px solid ${PS.border}`, borderRadius: 9,
    }}>
      {options.map((o) => {
        const on = value === o.key;
        return (
          <button key={o.key} type="button" aria-pressed={on} onClick={() => onChange(o.key)}
            className={`ps-seg${on ? ' ps-seg--on' : ''}`}
            style={{
              fontSize: size === 'sm' ? 11.5 : 12.5, fontWeight: on ? 700 : 600,
              padding: size === 'sm' ? '4px 9px' : '6px 12px', borderRadius: 7, cursor: 'pointer',
              border: `1px solid ${on ? PS.brandBorder : 'transparent'}`,
              background: on ? PS.brandSubtle : 'transparent',
              color: on ? PS.brandDeep : PS.textSecondary, whiteSpace: 'nowrap',
            }}>
            {o.label}
            {/* Chú thích phụ (VD khoảng giá của phương thức ship) — tuỳ chọn */}
            {o.hint && (
              <span style={{
                marginLeft: 6, fontSize: 10.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                color: on ? PS.brandDeep : PS.textMuted, opacity: on ? 0.85 : 1,
              }}>{o.hint}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── ModalShell: overlay + focus trap + Esc + aria ───────
export function ModalShell({ title, onClose, width = 400, children, footer, zIndex = 2200 }) {
  const boxRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const box = boxRef.current;
    // focus phần tử nhập đầu tiên (hoặc chính hộp thoại)
    const focusables = () => box.querySelectorAll(
      'button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
    );
    (box.querySelector('input, textarea, select') || focusables()[0] || box)?.focus?.();

    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab') {
        const list = Array.from(focusables()).filter((el) => !el.disabled);
        if (!list.length) return;
        const first = list[0], last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    box.addEventListener('keydown', onKey);
    return () => box.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="ps-overlay" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
      <div ref={boxRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          width, maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column',
          background: PS.bgSurface, borderRadius: 12, boxShadow: PS.shadowModal, overflow: 'hidden', outline: 'none',
        }}>
        <div style={{
          padding: '14px 16px', borderBottom: `1px solid ${PS.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexShrink: 0,
        }}>
          <div id={titleId} style={{ fontSize: 15, fontWeight: 700, color: PS.text }}>{title}</div>
          <IconBtn title="Đóng" onClick={onClose} style={{ width: 28, height: 28 }}>✕</IconBtn>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{children}</div>
        {footer && (
          <div style={{
            padding: '12px 16px', borderTop: `1px solid ${PS.border}`, background: PS.bgApp,
            display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', flexShrink: 0,
          }}>{footer}</div>
        )}
      </div>
    </div>
  );
}

// ─── ConfirmDialog (thay window.confirm) ─────────────────
export function ConfirmDialog({ title, message, confirmLabel = 'Xoá', onConfirm, onClose }) {
  return (
    <ModalShell title={title} onClose={onClose} width={360} zIndex={2400}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Huỷ</Btn>
        <Btn variant="primary" style={{ background: PS.negative, borderColor: PS.negative }}
          onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Btn>
      </>}>
      <p style={{ margin: 0, padding: 16, fontSize: 13.5, color: PS.textSecondary, lineHeight: 1.6 }}>{message}</p>
    </ModalShell>
  );
}
