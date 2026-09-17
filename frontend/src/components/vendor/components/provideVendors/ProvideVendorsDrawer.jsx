// ════════════════════════════════════════════════════════
//  NGĂN KÉO "CUNG CẤP VENDOR" CHO MỘT REQUEST ĐÃ DUYỆT
//
//  Trước đây Vendor phải rời trang Quản Lý Form Duyệt, sang Thư viện, bung file
//  rồi tick phôi. Từ khi mỗi file mở thành cửa sổ riêng (/library/:fileId) thì
//  chỗ tick biến mất và không gán được nữa.
//
//  Nay Vendor làm tại chỗ: tìm file theo tên (hoặc dán link file), chọn phôi,
//  xem trước giá so với Target, rồi cung cấp. Cung cấp thêm là GỘP với danh
//  sách đang có — gỡ từng vendor được, giá đổi trong file thì cập nhật được.
// ════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CloseOutlined } from '@ant-design/icons';
import { HC, LS_PRODUCT_VENDORS } from '../../utils/constants';
import { lsGet, lsSet, getMediaUrls, fmtDate } from '../../utils/helpers';
import { productApi, vendorLibraryApi } from '../../../../services/api';
import { targetCostCeiling } from '../../../../utils/targetCost';
import { parseLibraryFileLinks, parseLibraryFileToken, libraryFileUrl } from '../../../../utils/libraryFileLink';
import {
  buildAssignedVendors, assignedRowKey, assignedSourceState, groupAssignedByRow,
  mergeAssignedVendors, removeAssignedRows,
} from '../../../../utils/libraryAssign';
import FileSearchPicker from './FileSearchPicker';
import LinkedFileCard from './LinkedFileCard';
import ProvidedVendorList from './ProvidedVendorList';
import { SectionLabel, Thumb } from './ui';
import { btn } from './uiStyles';

const parseAssigned = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const statusOfError = (err) => {
  const status = err?.response?.status;
  if (status === 404) return 'notFound';
  if (status === 403) return 'forbidden';
  return 'error';
};

const rowKeyIn = (file, rowId) => assignedRowKey({ is_excel: true, source_file_id: file.id, excel_row_id: rowId });

export default function ProvideVendorsDrawer({ product, requesterName, onClose, onProvided, onBrowseLibrary }) {
  const assigned = useMemo(() => parseAssigned(product?.assigned_vendors), [product?.assigned_vendors]);
  const groups = useMemo(() => groupAssignedByRow(assigned), [assigned]);
  const target = targetCostCeiling(product?.total_cost);

  // ── Danh sách file gọn cho ô tìm ─────────────────────────────────
  const [catalog, setCatalog] = useState({ status: 'loading', files: [] });
  const [catalogNonce, setCatalogNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    vendorLibraryApi.listFiles()
      .then((r) => { if (alive) setCatalog({ status: 'ready', files: Array.isArray(r.data) ? r.data : [] }); })
      .catch(() => { if (alive) setCatalog({ status: 'error', files: [] }); });
    return () => { alive = false; };
  }, [catalogNonce]);
  const retryCatalog = () => {
    setCatalog({ status: 'loading', files: [] });
    setCatalogNonce((n) => n + 1);
  };

  // ── Ô dán link — nguồn sự thật duy nhất của "file đã chọn" ────────
  // File chọn từ ô tìm cũng được ghi thành một dòng link ở đây, để chỉ có
  // một nơi liệt kê file và người dùng thấy đúng cái sẽ được đọc.
  const [linkText, setLinkText] = useState('');
  const [parsed, setParsed] = useState({ links: [], duplicates: 0 });
  useEffect(() => {
    const timer = setTimeout(() => setParsed(parseLibraryFileLinks(linkText)), 250);
    return () => clearTimeout(timer);
  }, [linkText]);

  const updateLinks = useCallback((text) => {
    setLinkText(text);
    setParsed(parseLibraryFileLinks(text));
  }, []);

  // ── Nội dung từng file (đã lọc giá theo role ở server) ────────────
  const [details, setDetails] = useState({});
  const requested = useRef(new Set());
  const fetchDetail = useCallback((link) => {
    requested.current.add(link.key);
    setDetails((d) => ({ ...d, [link.key]: { status: 'loading' } }));
    const request = link.kind === 'name'
      ? vendorLibraryApi.getFileByName(link.filename)
      : vendorLibraryApi.getFile(link.id);
    request
      .then((r) => setDetails((d) => ({ ...d, [link.key]: { status: 'ok', file: r.data } })))
      .catch((err) => setDetails((d) => ({ ...d, [link.key]: { status: statusOfError(err) } })));
  }, []);
  useEffect(() => {
    parsed.links.forEach((link) => {
      if (link.kind !== 'invalid' && !requested.current.has(link.key)) fetchDetail(link);
    });
  }, [parsed, fetchDetail]);

  // ── File gốc của các vendor đã cung cấp — để phát hiện giá đã đổi ──
  const [sources, setSources] = useState({});
  useEffect(() => {
    let alive = true;
    const ids = [...new Set(groups.map((g) => g.fileId).filter(Boolean))].slice(0, 20);
    ids.forEach((id) => {
      setSources((s) => (s[id] ? s : { ...s, [id]: { status: 'loading' } }));
      vendorLibraryApi.getFile(id)
        .then((r) => { if (alive) setSources((s) => ({ ...s, [id]: { status: 'ok', file: r.data } })); })
        .catch((err) => { if (alive) setSources((s) => ({ ...s, [id]: { status: statusOfError(err) } })); });
    });
    return () => { alive = false; };
  }, [groups]);

  // ── Lựa chọn ─────────────────────────────────────────────────────
  const [removed, setRemoved] = useState(() => new Set());
  const [refresh, setRefresh] = useState(() => new Set());
  const [selection, setSelection] = useState({});
  const providedKeys = useMemo(
    () => new Set(groups.map((g) => g.key).filter((k) => !removed.has(k))),
    [groups, removed],
  );

  const entries = useMemo(() => {
    const seen = new Map();
    return parsed.links.map((link) => {
      const detail = details[link.key];
      let duplicateOfName = null;
      if (detail?.status === 'ok') {
        const id = String(detail.file.id);
        if (seen.has(id)) duplicateOfName = seen.get(id);
        else seen.set(id, detail.file.filename);
      }
      return { link, detail, duplicateOfName };
    });
  }, [parsed, details]);

  const addedFileIds = useMemo(() => new Set(
    entries.flatMap((e) => [e.link.id, e.detail?.file?.id]).filter(Boolean).map(String),
  ), [entries]);

  // File vừa đọc xong mặc định chọn mọi phôi chưa cung cấp; link có `?row=`
  // chỉ chọn đúng phôi đó. Không ghi mặc định vào state trong effect: lựa chọn
  // được suy ra từ dữ liệu hiện tại, còn state chỉ giữ thao tác tay của người dùng.
  const selectedRowsOf = (entry, overrides = selection) => {
    if (Object.prototype.hasOwnProperty.call(overrides, entry.link.key)) {
      return overrides[entry.link.key] || [];
    }
    if (entry.detail?.status !== 'ok' || entry.duplicateOfName) return [];
    const file = entry.detail.file;
    const rows = Array.isArray(file.generalInfo) ? file.generalInfo : [];
    const free = rows.filter((r) => !providedKeys.has(rowKeyIn(file, r.id)));
    const focusExists = entry.link.rowId && rows.some((r) => String(r.id) === String(entry.link.rowId));
    const chosen = focusExists ? free.filter((r) => String(r.id) === String(entry.link.rowId)) : free;
    return chosen.map((r) => String(r.id));
  };

  const newRowsOf = (entry) => {
    if (entry.detail?.status !== 'ok' || entry.duplicateOfName) return [];
    const file = entry.detail.file;
    return selectedRowsOf(entry).filter((id) => !providedKeys.has(rowKeyIn(file, id)));
  };

  const loadingCount = entries.filter((e) => e.link.kind !== 'invalid' && (!e.detail || e.detail.status === 'loading')).length;
  const okCount = entries.filter((e) => e.detail?.status === 'ok').length;
  const newCount = entries.reduce((n, e) => n + newRowsOf(e).length, 0);
  const removedCount = removed.size;
  const refreshCount = [...refresh].filter((k) => !removed.has(k)).length;
  const keptCount = groups.length - removedCount;
  const dirty = newCount > 0 || removedCount > 0 || refreshCount > 0 || linkText.trim() !== '';

  // ── Thao tác ─────────────────────────────────────────────────────
  const appendLink = (url) => updateLinks(linkText.trim() ? `${linkText.trim()}\n${url}` : url);

  const removeLink = (key) => {
    const text = linkText
      .split('\n')
      .map((line) => line.split(/\s+/).filter((tok) => tok && parseLibraryFileToken(tok).key !== key).join(' '))
      .filter((line) => line.trim())
      .join('\n');
    updateLinks(text);
    setSelection((s) => {
      const next = { ...s };
      delete next[key];
      return next;
    });
  };

  const retryLink = (link) => {
    requested.current.delete(link.key);
    fetchDetail(link);
  };

  const toggleRow = (entry, rowId) => setSelection((s) => {
    const key = entry.link.key;
    const current = new Set(selectedRowsOf(entry, s));
    if (current.has(rowId)) current.delete(rowId); else current.add(rowId);
    return { ...s, [key]: [...current] };
  });

  const toggleIn = (setter) => (key) => setter((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  // ── Lưu ──────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const submit = async () => {
    if (saving) return;
    const providedAt = new Date().toISOString();
    setSaving(true);
    setSaveError('');
    try {
      // Lấy lại bản mới nhất ngay trước lúc ghi để không xoá nhầm vendor mà một
      // máy khác vừa cung cấp trong lúc drawer đang mở. Nếu mạng chỉ lỗi ở bước
      // đọc, vẫn cho lưu dựa trên bản chụp khi mở drawer như trước.
      let latest = assigned;
      try {
        const response = await productApi.getById(product.id);
        const freshProduct = response?.data?.data ?? response?.data;
        if (freshProduct && Object.prototype.hasOwnProperty.call(freshProduct, 'assigned_vendors')) {
          latest = parseAssigned(freshProduct.assigned_vendors);
        }
      } catch {
        // `assignVendors` bên dưới vẫn là nguồn xác nhận cuối cùng.
      }

      let next = removeAssignedRows(latest, [...removed]);
      groups.forEach((g) => {
        if (!refresh.has(g.key) || removed.has(g.key)) return;
        const { state, fresh } = assignedSourceState(g, sources);
        if (state === 'stale') next = mergeAssignedVendors(next, fresh.map((v) => ({ ...v, provided_at: providedAt })));
      });
      entries.forEach((entry) => {
        const ids = newRowsOf(entry);
        if (ids.length === 0) return;
        next = mergeAssignedVendors(next, buildAssignedVendors(entry.detail.file, ids, { providedAt }));
      });

      await productApi.assignVendors(product.id, next);
      const all = lsGet(LS_PRODUCT_VENDORS, {});
      all[product.id] = next;
      lsSet(LS_PRODUCT_VENDORS, all);
      window.dispatchEvent(new StorageEvent('storage', { key: LS_PRODUCT_VENDORS }));
      onProvided?.({ product, vendors: next, added: newCount, removed: removedCount, refreshed: refreshCount });
    } catch (err) {
      setSaveError(err?.response?.data?.message || err?.message || 'Không lưu được. Thử lại sau.');
      setSaving(false);
    }
  };

  // ── Đóng: Esc / bấm nền không được làm mất lựa chọn đang dở ────────
  const [closeWarning, setCloseWarning] = useState(false);
  const dialogRef = useRef(null);
  const previousFocus = useRef(null);
  const requestClose = useCallback(() => {
    if (saving) return;
    if (dirty) { setCloseWarning(true); return; }
    onClose();
  }, [saving, dirty, onClose]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = [...dialogRef.current.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )].filter((node) => node.getClientRects().length > 0);
        if (focusable.length > 0) {
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
        return;
      }
      if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('[data-esc-layer]')) {
        e.preventDefault();
        requestClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [requestClose]);

  useEffect(() => {
    previousFocus.current = document.activeElement;
    const frame = requestAnimationFrame(() => dialogRef.current?.querySelector('#provide-file-search')?.focus());
    return () => {
      cancelAnimationFrame(frame);
      previousFocus.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    if (!closeWarning) return undefined;
    const timer = setTimeout(() => setCloseWarning(false), 4000);
    return () => clearTimeout(timer);
  }, [closeWarning]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  const pressedOnScrim = useRef(false);
  const scrimRef = useRef(null);

  if (!product) return null;

  const facts = [
    product.project,
    requesterName && requesterName !== '—' ? requesterName : null,
    product.production_time ? `T.gian SX ${product.production_time}` : null,
    product.shipping_time ? `T.gian ship ${product.shipping_time}` : null,
    product.deadline_date ? `Deadline ${fmtDate(product.deadline_date)}` : null,
  ].filter(Boolean);

  const summary = loadingCount > 0
    ? `Đang đọc ${loadingCount} file…`
    : [
      `${newCount} vendor mới`,
      groups.length > 0 ? `${keptCount} giữ lại` : null,
      removedCount ? `${removedCount} gỡ` : null,
      refreshCount ? `${refreshCount} cập nhật giá` : null,
    ].filter(Boolean).join(' · ');
  const emptiesList = groups.length > 0 && keptCount === 0 && newCount === 0;
  const canSubmit = !saving && loadingCount === 0 && (newCount > 0 || removedCount > 0 || refreshCount > 0);

  return (
    <div
      ref={scrimRef}
      onMouseDown={(e) => { pressedOnScrim.current = e.target === scrimRef.current; }}
      onClick={(e) => {
        if (e.target === scrimRef.current && pressedOnScrim.current) requestClose();
        pressedOnScrim.current = false;
      }}
      style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(26,15,0,0.46)', display: 'flex', justifyContent: 'flex-end' }}
    >
      <style>{`@keyframes hcProvideIn { from { transform: translateX(28px); opacity: .6 } to { transform: none; opacity: 1 } }
        @media (prefers-reduced-motion: reduce) { .hc-provide-drawer { animation: none !important; } }
        @media (max-width: 640px) {
          .hc-provide-drawer input, .hc-provide-drawer textarea { font-size: 16px !important; }
          .hc-provide-result { grid-template-columns: auto minmax(0, 1fr) !important; }
          .hc-provide-result-actions { grid-column: 2; justify-content: flex-start !important; }
        }`}</style>
      <div
        ref={dialogRef}
        className="hc-provide-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="provide-vendors-title"
        style={{
          width: 'min(940px, 100vw)', height: '100%', background: HC.surface, display: 'flex', flexDirection: 'column',
          boxShadow: '0 26px 64px rgba(26,15,0,0.22)', animation: 'hcProvideIn .2s ease-out', fontFamily: "'Inter',sans-serif",
        }}
      >
        {/* Đầu: request đang được cung cấp vendor */}
        <div style={{ padding: '16px 20px', borderBottom: `1.5px solid ${HC.border}`, background: HC.surface2, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <Thumb src={getMediaUrls(product)[0]} size={56} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: HC.muted }}>Cung cấp vendor cho request</div>
            <h2 id="provide-vendors-title" style={{ margin: '2px 0 6px', fontFamily: "'Nunito','Inter',sans-serif", fontWeight: 900, fontSize: 19, color: HC.ink }}>
              {product.product_type || `Request #${product.id}`}
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {facts.map((f) => (
                <span key={f} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 99, background: HC.cream, border: `1px solid ${HC.border}`, color: HC.ink2, fontWeight: 600 }}>{f}</span>
              ))}
              {product.total_cost != null && product.total_cost !== '' && (
                <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 99, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#15803d', fontWeight: 800 }}>
                  Target ${product.total_cost}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Đóng"
            title="Đóng"
            style={{ width: 40, height: 40, borderRadius: 10, border: `1.5px solid ${HC.borderStrong}`, background: HC.surface, color: HC.brown, fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}
          ><CloseOutlined aria-hidden="true" /></button>
        </div>

        {/* Thân */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 20px 28px', display: 'grid', gap: 22, alignContent: 'start' }}>
          <FileSearchPicker
            catalog={catalog}
            requestType={product.product_type || ''}
            addedFileIds={addedFileIds}
            onAdd={(file) => appendLink(libraryFileUrl(file.id, file.filename))}
            onRetry={retryCatalog}
            onBrowseLibrary={onBrowseLibrary}
          />

          <section>
            <SectionLabel htmlFor="provide-links" title="Hoặc dán link file" hint="Mỗi dòng một link · lấy từ nút “Copy link” trong Thư viện Vendor" />
            <textarea
              id="provide-links"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              spellCheck={false}
              placeholder={`${window.location.origin}/library/…`}
              rows={3}
              style={{
                display: 'block', width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: '10px 12px',
                borderRadius: 12, border: `1.5px solid ${HC.borderStrong}`, background: HC.surface2, color: HC.ink2,
                fontFamily: "'JetBrains Mono', ui-monospace, Consolas, monospace", fontSize: 12, lineHeight: 1.6, outline: 'none',
              }}
              onFocus={(e) => { e.target.style.borderColor = HC.orange; }}
              onBlur={(e) => { e.target.style.borderColor = HC.borderStrong; }}
            />
          </section>

          {entries.length > 0 && (
            <section>
              <SectionLabel
                title="File đã chọn"
                hint={`${okCount}/${entries.length} link đọc được${parsed.duplicates ? ` · đã gộp ${parsed.duplicates} link trùng` : ''}`}
              />
              <div style={{ display: 'grid', gap: 12 }}>
                {entries.map((entry) => (
                  <LinkedFileCard
                    key={entry.link.key}
                    entry={entry}
                    requestType={product.product_type || ''}
                    target={target}
                    selected={new Set(selectedRowsOf(entry))}
                    providedKeys={providedKeys}
                    duplicateOfName={entry.duplicateOfName}
                    onToggleRow={(rowId) => toggleRow(entry, rowId)}
                    onSetRows={(ids) => setSelection((s) => ({ ...s, [entry.link.key]: ids }))}
                    onRemove={() => removeLink(entry.link.key)}
                    onRetry={() => retryLink(entry.link)}
                  />
                ))}
              </div>
            </section>
          )}

          <ProvidedVendorList
            groups={groups}
            removed={removed}
            refresh={refresh}
            sources={sources}
            target={target}
            onToggleRemove={toggleIn(setRemoved)}
            onToggleRefresh={toggleIn(setRefresh)}
          />
        </div>

        {/* Chân */}
        <div style={{ borderTop: `1.5px solid ${HC.border}`, background: closeWarning || saveError ? '#fffbeb' : HC.cream, padding: '12px 20px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 240px', fontSize: 12, color: HC.ink2, lineHeight: 1.5 }} aria-live="polite">
            {saveError
              ? <span role="alert" style={{ color: '#b91c1c', fontWeight: 700 }}>Chưa lưu được: {saveError}</span>
              : closeWarning
                ? <span role="status" style={{ color: '#92400e', fontWeight: 700 }}>Còn thay đổi chưa lưu — bấm “Huỷ” để bỏ, hoặc lưu trước khi đóng.</span>
                : (
                  <>
                    <b style={{ color: HC.orangeDeep }}>{summary}</b>
                    {requesterName && requesterName !== '—' && canSubmit && <span> · {requesterName} sẽ nhận thông báo</span>}
                    {emptiesList && <div style={{ color: '#92400e', fontWeight: 700 }}>Request sẽ không còn vendor nào.</div>}
                  </>
                )}
          </div>
          <button type="button" onClick={() => { if (!saving) onClose(); }} disabled={saving} style={btn('line', { padding: '10px 18px', fontSize: 13, borderRadius: 10 })}>Huỷ</button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            style={btn('primary', {
              padding: '10px 20px', fontSize: 13, borderRadius: 10,
              opacity: canSubmit ? 1 : 0.45, cursor: canSubmit ? 'pointer' : 'not-allowed',
            })}
          >
            {saving ? 'Đang lưu…' : newCount > 0 ? `Cung cấp ${newCount} vendor cho Seller` : 'Lưu thay đổi'}
          </button>
        </div>
      </div>
    </div>
  );
}
