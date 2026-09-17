// Mảnh giao diện dùng chung của ngăn kéo "Cung cấp vendor".
import { HC } from '../../utils/constants';
import { tierRanges, foldText } from '../../../../utils/libraryAssign';
import { FileOutlined, ExportOutlined } from '@ant-design/icons';
import { money } from './uiStyles';

const TONES = {
  ok: { color: '#15803d', bg: '#ecfdf5', border: '#a7f3d0' },
  warn: { color: '#92400e', bg: '#fffbeb', border: '#fde68a' },
  bad: { color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
  info: { color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd' },
  brand: { color: HC.orangeDeep, bg: HC.orangeLight, border: HC.orangeMid },
  neutral: { color: HC.brown, bg: HC.cream, border: HC.border },
};

export function Pill({ tone = 'neutral', children, title, upper = false }) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
        padding: '2px 8px', borderRadius: 99, border: `1px solid ${t.border}`,
        background: t.bg, color: t.color, fontSize: 10, fontWeight: 800,
        letterSpacing: upper ? '0.05em' : '0.02em', textTransform: upper ? 'uppercase' : 'none',
      }}
    >
      {children}
    </span>
  );
}

export function Banner({ tone = 'warn', children }) {
  const t = TONES[tone] || TONES.warn;
  return (
    <div role={tone === 'bad' ? 'alert' : undefined} style={{
      padding: '9px 14px', fontSize: 12, lineHeight: 1.5,
      background: t.bg, color: t.color, borderBottom: `1px solid ${t.border}`,
    }}>
      {children}
    </div>
  );
}

export function SectionLabel({ htmlFor, title, hint, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
      <label htmlFor={htmlFor} style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: HC.ink2 }}>
        {title}
      </label>
      {hint && <span style={{ fontSize: 11, color: HC.muted }}>{hint}</span>}
      {right && <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8, alignItems: 'center' }}>{right}</span>}
    </div>
  );
}

export function FileGlyph({ size = 14 }) {
  return <FileOutlined aria-hidden="true" style={{ fontSize: size, flexShrink: 0 }} />;
}

export function ExternalLinkGlyph({ size = 11 }) {
  return <ExportOutlined aria-hidden="true" style={{ fontSize: size, flexShrink: 0 }} />;
}

/** Ảnh nhỏ của phôi; ảnh hỏng thì về ô trống thay vì icon vỡ. */
export function Thumb({ src, size = 40 }) {
  const box = { width: size, height: size, borderRadius: 8, border: `1px solid ${HC.border}`, flexShrink: 0 };
  if (!src) return <div aria-hidden="true" style={{ ...box, background: HC.cream }} />;
  return (
    <img
      src={src} alt="" loading="lazy"
      style={{ ...box, objectFit: 'cover', display: 'block', background: HC.cream }}
      onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
    />
  );
}

/** Giá theo hạng ship, hạng đầu so với trần Target Cost của request. */
export function TierPrices({ items, target }) {
  const tiers = tierRanges(items);
  if (tiers.length === 0) {
    return <span style={{ fontSize: 11, color: HC.muted2, fontStyle: 'italic' }}>Chưa có giá</span>;
  }
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      {tiers.map((t, i) => {
        const label = t.min === t.max ? money(t.min) : `${money(t.min)} – ${money(t.max)}`;
        const delta = i === 0 && target != null ? t.min - target : null;
        return (
          <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: 9, fontWeight: 900, color: t.color, background: t.bg, border: `1px solid ${t.border}`, padding: '1px 6px', borderRadius: 4, minWidth: 34, textAlign: 'center' }}>{t.short}</span>
            <span style={{ fontWeight: i === 0 ? 900 : 700, fontSize: i === 0 ? 13 : 12, color: t.color, fontVariantNumeric: 'tabular-nums' }}>{label}</span>
            {delta != null && (
              <Pill tone={delta <= 0 ? 'ok' : 'bad'}>
                {delta <= 0 ? `−${money(Math.abs(delta))} dưới target` : `+${money(delta)} trên target`}
              </Pill>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Tô sáng các từ khoá trong chuỗi — so khớp không dấu, không phân biệt hoa
 * thường. Bỏ dấu TỪNG ký tự để vị trí trong chuỗi gốc và chuỗi đã chuẩn hoá
 * trùng nhau.
 */
export function Highlight({ text, tokens }) {
  const value = String(text ?? '');
  if (!tokens?.length || !value) return value;
  const chars = [...value];
  const folded = chars.map((c) => foldText(c)[0] ?? c).join('');
  const on = new Array(chars.length).fill(false);
  tokens.forEach((t) => {
    for (let i = folded.indexOf(t); i >= 0 && t; i = folded.indexOf(t, i + t.length)) on.fill(true, i, i + t.length);
  });
  const parts = [];
  let buf = '';
  let mark = on[0];
  chars.forEach((c, i) => {
    if (on[i] !== mark) {
      parts.push({ mark, text: buf });
      buf = '';
      mark = on[i];
    }
    buf += c;
  });
  parts.push({ mark, text: buf });
  return parts.map((p, i) => (p.mark
    ? <mark key={i} style={{ background: HC.orangeMid, color: HC.ink, borderRadius: 3, padding: '0 1px' }}>{p.text}</mark>
    : <span key={i}>{p.text}</span>));
}
