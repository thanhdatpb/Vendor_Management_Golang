// ════════════════════════════════════════════════════════
//  HISTORY PANEL — drawer phải, restyle theo design system mới.
//  Giữ nguyên hành vi: export từng version, restore (trừ bản mới nhất).
//
//  Mục 17: lịch sử KHÔNG còn đi kèm bảng tính giá. Mỗi snapshot là một bản sao
//  đầy đủ (settings + productTypes) và có tới 20 bản — kéo theo cả bảng thì mở
//  danh sách nào cũng tải 21 lần nội dung. Giờ nạp đúng lúc mở panel này.
// ════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { PS, marginTone, toneColor } from './tokens';
import { Btn, IconBtn, Badge, Dot } from './primitives';
import { usd, pct } from '../../../utils/pricingEngine';
import { fmtVNDateTime } from '../../../utils/vnTime';
import { priceSheetApi } from '../../../services/api';

// `readOnly`: Admin xem lịch sử của bảng Seller — chỉ Export, không Khôi phục
// (Admin không được sửa/xoá dữ liệu của Seller).
export default function HistoryPanel({ sheet, onClose, onRestore, onExportVersion, readOnly = false }) {
  // Bảng vừa tạo ở máy này (chưa lưu) vẫn mang sẵn history — dùng luôn.
  const [hist, setHist] = useState(() => sheet.history || []);
  // Bảng đã lưu trên server thì chắc chắn có một lượt nạp — vào thẳng trạng
  // thái "đang tải" ngay từ lần render đầu, thay vì setState trong effect.
  const [loading, setLoading] = useState(() => !!sheet.id);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sheet.id) return undefined;

    let alive = true;
    priceSheetApi.versions(sheet.id)
      .then((res) => {
        if (!alive) return;
        setHist(Array.isArray(res.data) ? res.data : []);
      })
      .catch((err) => {
        if (!alive) return;
        // Không xoá những gì đang hiện: thà cho xem bản đang có còn hơn trắng panel.
        console.warn('Không tải được lịch sử phiên bản:', err?.message || err);
        setError('Không tải được lịch sử. Kiểm tra kết nối rồi mở lại.');
      })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [sheet.id]);

  return (
    <div className="ps-overlay" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 2100, display: 'flex', justifyContent: 'flex-end' }}>
      <div role="dialog" aria-modal="true" aria-label="Lịch sử phiên bản" onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(520px, 94vw)', height: '100%', background: PS.bgSurface,
          boxShadow: PS.shadowModal, display: 'flex', flexDirection: 'column',
        }}>
        <div style={{
          padding: '14px 18px', borderBottom: `1px solid ${PS.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: PS.text }}>Lịch sử phiên bản</div>
            <div style={{ fontSize: 12, color: PS.textMuted, marginTop: 2 }}>{sheet.name} · {hist.length} bản đã lưu</div>
          </div>
          <IconBtn title="Đóng" onClick={onClose}>✕</IconBtn>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading && hist.length === 0 && (
            <div style={{ textAlign: 'center', color: PS.textMuted, padding: 40, fontSize: 13 }}>
              Đang tải lịch sử…
            </div>
          )}
          {error && (
            <div role="alert" style={{
              textAlign: 'center', color: PS.textSecondary, padding: '12px 14px', fontSize: 12.5,
              border: `1px solid ${PS.border}`, borderRadius: 10, background: PS.bgApp,
            }}>{error}</div>
          )}
          {!loading && !error && hist.length === 0 && (
            <div style={{ textAlign: 'center', color: PS.textMuted, padding: 40, fontSize: 13, lineHeight: 1.6 }}>
              Chưa có phiên bản nào.<br />Bấm "Lưu bảng tính giá" để tạo mốc so sánh.
            </div>
          )}
          {hist.map((snap, i) => {
            const tone = marginTone(snap.avgMargin);
            return (
              <div key={snap.savedAt + i} style={{
                border: `1px solid ${i === 0 ? PS.brandBorder : PS.border}`, borderRadius: 12,
                padding: '12px 14px', background: i === 0 ? PS.brandSubtle : PS.bgSurface,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: PS.text }}>v{snap.version}</span>
                    {i === 0 && <Badge tone="warning" style={{ background: PS.brandSubtle, color: PS.brandDeep, border: `1px solid ${PS.brandBorder}` }}>mới nhất</Badge>}
                    <span style={{ fontSize: 11.5, color: PS.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtVNDateTime(snap.savedAt, '—')}
                    </span>
                  </div>
                  <span style={{ fontSize: 11.5, color: PS.textMuted }}>{snap.savedBy}</span>
                </div>
                <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 12.5, color: PS.textSecondary, fontVariantNumeric: 'tabular-nums', flexWrap: 'wrap' }}>
                  <span>Avg margin{' '}
                    <b style={{ color: toneColor[tone] }}>
                      <Dot tone={tone} />{snap.avgMargin != null ? pct(snap.avgMargin, 1) : '—'}
                    </b>
                  </span>
                  <span>Giá <b style={{ color: PS.text }}>{snap.minPrice != null ? `${usd(snap.minPrice)}–${usd(snap.maxPrice)}` : '—'}</b></span>
                  <span>{snap.count} size</span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <Btn size="sm" onClick={() => onExportVersion(snap)}>⬇ Export</Btn>
                  {!readOnly && i !== 0 && <Btn size="sm" variant="outline" style={{ color: PS.brandDeep, borderColor: PS.brandBorder }} onClick={() => onRestore(snap)}>↩ Khôi phục</Btn>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
