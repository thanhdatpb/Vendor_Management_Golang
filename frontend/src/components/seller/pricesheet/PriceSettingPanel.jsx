// ════════════════════════════════════════════════════════
//  PRICE SETTING PANEL — spec §3.2
//  Card trắng, field nhóm theo ngữ nghĩa, prefix/suffix inline,
//  collapsible (collapse → summary 1 dòng). Không đổi key/logic.
// ════════════════════════════════════════════════════════
import { useState } from 'react';
import { PS } from './tokens';
import { NumField, Btn } from './primitives';
import { SETTING_FIELDS, usd, pct, num } from '../../../utils/pricingEngine';

// Nhóm field theo ngữ nghĩa — key giữ NGUYÊN như pricingEngine.SETTING_FIELDS
const GROUPS = [
  { title: 'Giá & Số lượng', keys: ['price', 'quantity'] },
  { title: 'Shipping', keys: ['shipPerOrder', 'shipPerItem'] },
  { title: 'Khuyến mãi', keys: ['couponUsd', 'couponPct'] },
  { title: 'Phí', keys: ['variableFeePct', 'amzFeePct', 'importTax'] },
];

const FIELD_BY_KEY = Object.fromEntries(SETTING_FIELDS.map((f) => [f.key, f]));

function affix(f) {
  if (f.unit === '$') return { prefix: '$' };
  if (f.unit === '%') return { suffix: '%' };
  return { suffix: f.unit }; // pcs
}

export default function PriceSettingPanel({ settings, onSet }) {
  const [open, setOpen] = useState(true);

  const summary = [
    `Price ${usd(num(settings.price))}`,
    `Qty ${num(settings.quantity) > 0 ? num(settings.quantity) : 1}`,
    `Ship ${usd(num(settings.shipPerOrder) + num(settings.shipPerItem))}`,
    `Coupon ${usd(num(settings.couponUsd))} + ${pct(num(settings.couponPct), 1)}`,
    `AMZ ${pct(num(settings.amzFeePct), 1)}`,
    `Tax ${usd(num(settings.importTax))}`,
  ].join(' · ');

  return (
    <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
      <section aria-label="Price Setting" style={{
        background: PS.bgSurface, border: `1px solid ${PS.border}`, borderRadius: 12,
        boxShadow: PS.shadowCard, overflow: 'hidden',
      }}>
        {/* Tiêu đề + toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: open ? '12px 16px 0' : '10px 16px' }}>
          <span style={{
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: PS.textSecondary,
          }}>Price Setting</span>
          {!open && (
            <span style={{
              fontSize: 12, color: PS.textMuted, fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0,
            }}>{summary}</span>
          )}
          <Btn variant="ghost" size="sm" onClick={() => setOpen(!open)} aria-expanded={open}
            style={{ marginLeft: 'auto' }}>
            {open ? 'Thu gọn ▴' : 'Mở rộng ▾'}
          </Btn>
        </div>

        {/* Các nhóm field */}
        {open && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px 28px', padding: '10px 16px 16px' }}>
            {GROUPS.map((g) => (
              <fieldset key={g.title} style={{ border: 'none', margin: 0, padding: 0, minWidth: 0 }}>
                <legend style={{
                  fontSize: 10.5, fontWeight: 650, color: PS.textMuted, padding: 0,
                  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
                }}>{g.title}</legend>
                <div style={{ display: 'flex', gap: 10 }}>
                  {g.keys.map((k) => {
                    const f = FIELD_BY_KEY[k];
                    const invalid = k !== 'quantity' && num(settings[k]) < 0;
                    return (
                      <div key={k} style={{ width: 118 }}>
                        <NumField
                          label={f.label} tooltip={f.tooltip} {...affix(f)}
                          type="number" step={k === 'quantity' ? '1' : '0.01'}
                          min={k === 'quantity' ? '0' : undefined}
                          value={settings[k] ?? ''} invalid={invalid}
                          placeholder={k === 'importTax' ? '0' : ''}
                          onChange={(e) => onSet(k, e.target.value)}
                          onWheel={(e) => e.target.blur()}
                        />
                      </div>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
