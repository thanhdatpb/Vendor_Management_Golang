// ════════════════════════════════════════════════════════
//  Một file đã nhận diện (từ ô tìm hoặc link dán vào) trong ngăn kéo cung cấp
//  vendor: chọn phôi nào sẽ cung cấp cho Seller, xem trước giá so với Target.
// ════════════════════════════════════════════════════════
import { useMemo } from 'react';
import { HC } from '../../utils/constants';
import { buildAssignedVendors, assignedRowKey, productTypeOverlap } from '../../../../utils/libraryAssign';
import { libraryFilePath } from '../../../../utils/libraryFileLink';
import { fmtVNDate } from '../../../../utils/vnTime';
import { Pill, Banner, ExternalLinkGlyph, FileGlyph, Thumb, TierPrices } from './ui';
import { btn } from './uiStyles';

const INVALID_MESSAGE = {
  'price-sheet': 'Đây là link bảng tính giá, không phải file Thư viện Vendor. Mở file trong Thư viện rồi bấm “Copy link”.',
  'not-library': 'Không phải link file Thư viện Vendor. Link đúng có dạng …/library/<mã file>/<tên file>.',
};

const cardStyle = (tone) => ({
  border: `1.5px solid ${tone === 'bad' ? '#fecaca' : tone === 'warn' ? '#fde68a' : HC.border}`,
  borderRadius: 14, overflow: 'hidden', background: HC.surface,
});

const headStyle = {
  display: 'flex', gap: '6px 10px', alignItems: 'center', flexWrap: 'wrap',
  padding: '10px 14px', background: HC.surface2, borderBottom: `1px solid ${HC.border}`,
};

function RawLink({ raw }) {
  if (!raw) return null;
  return (
    <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, Consolas, monospace", fontSize: 10.5, color: HC.muted, padding: '6px 14px', borderBottom: `1px solid ${HC.border}`, overflowWrap: 'anywhere' }}>
      {raw}
    </div>
  );
}

const TH = { fontSize: 9.5, fontWeight: 900, letterSpacing: '0.07em', textTransform: 'uppercase', color: HC.muted, textAlign: 'left', padding: '8px 10px', borderBottom: `1px solid ${HC.border}`, background: HC.surface, whiteSpace: 'nowrap' };
const TD = { padding: 10, borderBottom: `1px solid ${HC.border}`, verticalAlign: 'top', fontSize: 12, color: HC.ink2 };

export default function LinkedFileCard({
  entry, requestType, target, selected, providedKeys, duplicateOfName,
  onToggleRow, onSetRows, onRemove, onRetry,
}) {
  const { link, detail } = entry;
  const file = detail?.status === 'ok' ? detail.file : null;
  const rows = useMemo(() => (Array.isArray(file?.generalInfo) ? file.generalInfo : []), [file]);

  // Xem trước đúng cách sẽ lưu: các phôi đang chọn dựng CHUNG một lần (như lúc
  // bấm cung cấp), phôi chưa chọn dựng riêng để vẫn thấy giá.
  const previewByRow = useMemo(() => {
    const map = new Map();
    if (!file) return map;
    const chosen = rows.filter((r) => selected.has(String(r.id))).map((r) => r.id);
    buildAssignedVendors(file, chosen).forEach((v) => {
      const k = String(v.excel_row_id);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(v);
    });
    rows.forEach((r) => {
      if (!map.has(String(r.id))) map.set(String(r.id), buildAssignedVendors(file, [r.id]));
    });
    return map;
  }, [file, rows, selected]);

  if (link.kind === 'invalid') {
    return (
      <article style={cardStyle('bad')}>
        <div style={headStyle}>
          <span style={{ fontWeight: 800, fontSize: 13 }}>Link không đọc được</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <Pill tone="bad">Sai loại link</Pill>
            <button type="button" style={btn('line')} onClick={onRemove}>Bỏ</button>
          </span>
        </div>
        <RawLink raw={link.raw} />
        <Banner tone="bad">{INVALID_MESSAGE[link.reason] || INVALID_MESSAGE['not-library']}</Banner>
      </article>
    );
  }

  const label = link.kind === 'name' ? link.filename : link.id;

  if (!detail || detail.status === 'loading') {
    return (
      <article style={cardStyle()} aria-busy="true">
        <div style={headStyle}>
          <span style={{ fontWeight: 700, fontSize: 12, fontFamily: "'JetBrains Mono', ui-monospace, Consolas, monospace" }}>{label}</span>
          <span style={{ marginLeft: 'auto' }}><Pill tone="brand">Đang đọc file…</Pill></span>
        </div>
        <RawLink raw={link.raw} />
        <div style={{ padding: 14, display: 'grid', gap: 8 }} aria-hidden="true">
          {[100, 82, 64].map((w) => <div key={w} style={{ height: 12, width: `${w}%`, borderRadius: 6, background: HC.cream }} />)}
        </div>
      </article>
    );
  }

  if (detail.status !== 'ok') {
    const copy = {
      notFound: { pill: '404', text: 'Không tìm thấy file — file đã bị xoá hoặc link sai. Tìm lại file theo tên ở trên.' },
      forbidden: { pill: '403', text: 'Tài khoản của bạn không được xem file này.' },
      error: { pill: 'Lỗi mạng', text: 'Không tải được file. Kiểm tra kết nối rồi thử lại.' },
    }[detail.status] || { pill: 'Lỗi', text: 'Không tải được file.' };
    return (
      <article style={cardStyle('bad')}>
        <div style={headStyle}>
          <span style={{ fontWeight: 800, fontSize: 13 }}>{detail.status === 'notFound' ? 'Không tìm thấy file' : 'Không mở được file'}</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
            <Pill tone="bad">{copy.pill}</Pill>
            {detail.status === 'error' && <button type="button" style={btn('soft')} onClick={onRetry}>Thử lại</button>}
            <button type="button" style={btn('line')} onClick={onRemove}>Bỏ</button>
          </span>
        </div>
        <RawLink raw={link.raw} />
        <Banner tone="bad">{copy.text}</Banner>
      </article>
    );
  }

  const vendorNames = [...new Set(rows.map((r) => r.vendorName || r.kyHieu).filter(Boolean))];
  const productTypes = [...new Set(rows.map((r) => r.productType).filter(Boolean))];
  const overlap = productTypeOverlap(requestType, [file.filename, file.title, ...productTypes]);
  const rowKeyOf = (r) => assignedRowKey({ is_excel: true, source_file_id: file.id, excel_row_id: r.id });
  const selectableIds = rows.filter((r) => !providedKeys.has(rowKeyOf(r))).map((r) => String(r.id));
  const allOn = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const focusRow = link.rowId ? rows.find((r) => String(r.id) === String(link.rowId)) : null;

  if (duplicateOfName) {
    return (
      <article style={cardStyle()}>
        <div style={headStyle}>
          <span style={{ fontWeight: 800, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 5 }}><FileGlyph /> {file.filename}</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <Pill tone="info">Trùng file phía trên</Pill>
            <button type="button" style={btn('line')} onClick={onRemove}>Bỏ</button>
          </span>
        </div>
        <RawLink raw={link.raw} />
      </article>
    );
  }

  return (
    <article style={cardStyle(overlap > 0 || !requestType ? null : 'warn')}>
      <div style={headStyle}>
        <span style={{ fontWeight: 800, fontSize: 13.5, color: HC.ink, display: 'inline-flex', alignItems: 'center', gap: 5 }}><FileGlyph /> {file.filename}</span>
        {vendorNames.length > 0 && <Pill tone="brand" upper>{vendorNames.join(', ')}</Pill>}
        <span style={{ fontSize: 11, color: HC.muted }}>
          {rows.length} phôi · {Array.isArray(file.pricing) ? file.pricing.length : 0} dòng giá
          {file.importedAt && ` · nhập ${fmtVNDate(file.importedAt)}`}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {requestType && <Pill tone={overlap > 0 ? 'ok' : 'warn'}>{overlap > 0 ? 'Khớp Product Type' : 'Khác Product Type'}</Pill>}
          {selectableIds.length > 0 && (
            <button type="button" style={btn('link')} onClick={() => onSetRows(allOn ? [] : selectableIds)}>
              {allOn ? 'Bỏ chọn hết' : 'Chọn hết'}
            </button>
          )}
          <a href={libraryFilePath(file.id, file.filename)} target="_blank" rel="noopener noreferrer" style={{ ...btn('link'), cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>Mở file <ExternalLinkGlyph /></a>
          <button type="button" style={btn('line')} onClick={onRemove}>Bỏ file</button>
        </span>
      </div>
      <RawLink raw={link.raw} />
      {requestType && overlap === 0 && (
        <Banner tone="warn">
          File là <b>{productTypes.slice(0, 3).join(', ') || file.filename}</b>, request cần <b>{requestType}</b>. Vẫn cung cấp được — kiểm tra lại cho chắc.
        </Banner>
      )}
      {link.rowId && (focusRow
        ? <Banner tone="info">Link trỏ tới phôi <b>{focusRow.vendorName || focusRow.kyHieu || focusRow.productType}</b> nên chỉ phôi đó được chọn sẵn.</Banner>
        : <Banner tone="warn">Phôi trong link không còn trong file — đang chọn sẵn cả file.</Banner>)}

      {rows.length === 0 ? (
        <div style={{ padding: '14px', fontSize: 12, color: HC.muted }}>File chưa có phôi nào.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
            <thead>
              <tr>
                <th style={{ ...TH, width: 34 }}><span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Chọn</span></th>
                <th style={TH}>Ảnh</th>
                <th style={TH}>Vendor</th>
                <th style={TH}>Chất liệu</th>
                <th style={TH}>Size</th>
                <th style={TH}>T.gian vendor</th>
                <th style={TH}>Giá &amp; so sánh target</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const id = String(r.id);
                const provided = providedKeys.has(rowKeyOf(r));
                const on = !provided && selected.has(id);
                const dim = provided || !on ? 0.5 : 1;
                const inputId = `provide-row-${file.id}-${id}`;
                return (
                  <tr key={id} style={{ background: on ? HC.surface : HC.surface2 }}>
                    <td style={TD}>
                      <input
                        id={inputId}
                        type="checkbox"
                        checked={on}
                        disabled={provided}
                        onChange={() => onToggleRow(id)}
                        style={{ width: 18, height: 18, accentColor: HC.orangeDark, cursor: provided ? 'not-allowed' : 'pointer', margin: '2px 0 0' }}
                        aria-label={`Chọn ${r.vendorName || r.kyHieu || r.productType || 'phôi'}`}
                      />
                    </td>
                    <td style={{ ...TD, opacity: dim }}><Thumb src={Array.isArray(r.images) ? r.images[0] : ''} /></td>
                    <td style={{ ...TD, opacity: provided ? 1 : dim }}>
                      <label htmlFor={inputId} style={{ fontWeight: 900, fontSize: 13, color: HC.ink, cursor: provided ? 'default' : 'pointer' }}>
                        {r.vendorName || r.kyHieu || '—'}
                      </label>
                      {r.productType && <div style={{ fontSize: 10.5, color: HC.muted }}>{r.productType}</div>}
                      {provided && <div style={{ marginTop: 4 }}><Pill tone="info">Đã cung cấp</Pill></div>}
                    </td>
                    <td style={{ ...TD, opacity: dim, maxWidth: 200 }}>{r.chatLieu || <span style={{ color: HC.muted2 }}>—</span>}</td>
                    <td style={{ ...TD, opacity: dim, whiteSpace: 'pre-line' }}>{r.chiTietSize || <span style={{ color: HC.muted2 }}>—</span>}</td>
                    <td style={{ ...TD, opacity: dim, fontSize: 11, color: '#047857', whiteSpace: 'pre-line', maxWidth: 170 }}>{r.avgTimeVendor || <span style={{ color: HC.muted2 }}>—</span>}</td>
                    <td style={{ ...TD, opacity: dim }}><TierPrices items={previewByRow.get(id) || []} target={target} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
