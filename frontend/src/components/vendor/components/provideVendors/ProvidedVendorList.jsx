// ════════════════════════════════════════════════════════
//  "Đã cung cấp trước đó" — vendor Seller đang xem cho request này.
//
//  Cung cấp thêm là GỘP: danh sách này giữ nguyên, trừ phôi Vendor bấm Gỡ.
//  Mỗi phôi đối chiếu với file gốc: giá trong file đã đổi thì cho chọn cập nhật
//  (Seller vẫn thấy giá cũ cho tới khi Vendor chủ động cập nhật).
// ════════════════════════════════════════════════════════
import { HC } from '../../utils/constants';
import { assignedSourceState } from '../../../../utils/libraryAssign';
import { libraryFilePath } from '../../../../utils/libraryFileLink';
import { fmtVNDate } from '../../../../utils/vnTime';
import { ExternalLinkGlyph, FileGlyph, Pill, SectionLabel, Thumb, TierPrices } from './ui';
import { btn } from './uiStyles';

export default function ProvidedVendorList({ groups, removed, refresh, sources, target, onToggleRemove, onToggleRefresh }) {
  if (groups.length === 0) return null;

  return (
    <section>
      <SectionLabel title="Đã cung cấp trước đó" hint="Giữ nguyên, trừ vendor bạn gỡ" />
      <div style={{ border: `1.5px solid ${HC.border}`, borderRadius: 14, background: HC.surface2, padding: '0 14px' }}>
        {groups.map((g, i) => {
          const isRemoved = removed.has(g.key);
          const { state, fresh } = assignedSourceState(g, sources);
          const willRefresh = state === 'stale' && refresh.has(g.key) && !isRemoved;
          const sizes = [...new Set(g.items.map((v) => v.size).filter(Boolean))];
          return (
            <div
              key={g.key}
              style={{
                display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '11px 0',
                borderBottom: i === groups.length - 1 ? 'none' : `1px dashed ${HC.border}`,
              }}
            >
              <div style={{ opacity: isRemoved ? 0.45 : 1 }}><Thumb src={g.items[0]?.media_url} size={36} /></div>
              <div style={{ flex: '1 1 220px', minWidth: 0, opacity: isRemoved ? 0.45 : 1, textDecoration: isRemoved ? 'line-through' : 'none' }}>
                <div style={{ fontWeight: 900, fontSize: 13, color: HC.ink }}>
                  {g.name}
                  {g.productType && g.productType !== g.name && <span style={{ fontWeight: 600, fontSize: 11, color: HC.muted }}> · {g.productType}</span>}
                </div>
                <div style={{ fontSize: 11, color: HC.muted, marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {g.fileId
                    ? <a href={libraryFilePath(g.fileId, g.fileName)} target="_blank" rel="noopener noreferrer" style={{ color: HC.orangeDeep, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><FileGlyph /> {g.fileName || 'File gốc'} <ExternalLinkGlyph /></a>
                    : <span>Không rõ file gốc</span>}
                  {sizes.length > 0 && <span>· {sizes.length} size</span>}
                  {g.providedAt && <span>· cung cấp {fmtVNDate(g.providedAt)}</span>}
                </div>
              </div>
              <div style={{ flex: '0 1 auto', opacity: isRemoved ? 0.45 : 1 }}>
                <TierPrices items={willRefresh ? fresh : g.items} target={target} />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginLeft: 'auto' }}>
                {!isRemoved && state === 'stale' && (
                  willRefresh
                    ? <Pill tone="info">Sẽ cập nhật giá mới</Pill>
                    : <Pill tone="warn" title="Giá hoặc size trong file thư viện đã khác bản Seller đang xem">Giá trong file đã đổi</Pill>
                )}
                {!isRemoved && state === 'stale' && (
                  <button type="button" style={btn('soft')} onClick={() => onToggleRefresh(g.key)}>
                    {willRefresh ? 'Giữ giá cũ' : 'Cập nhật theo file'}
                  </button>
                )}
                {!isRemoved && state === 'fileGone' && <Pill tone="bad">File gốc đã xoá</Pill>}
                {!isRemoved && state === 'rowGone' && <Pill tone="warn">Phôi không còn trong file</Pill>}
                <button type="button" style={btn('link')} onClick={() => onToggleRemove(g.key)}>
                  {isRemoved ? 'Hoàn tác' : 'Gỡ'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
