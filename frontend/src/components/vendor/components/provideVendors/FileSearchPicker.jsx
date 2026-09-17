// ════════════════════════════════════════════════════════
//  Ô "Tìm file trong thư viện" của ngăn kéo cung cấp vendor
//
//  Ô trống → gợi ý file trùng Product Type của request. Có chữ → mọi từ (không
//  dấu) phải có trong tên file / Product Type / tên vendor. ↑ ↓ chọn, Enter
//  thêm, Esc xoá ô tìm (Esc lần sau mới đóng ngăn kéo).
// ════════════════════════════════════════════════════════
import { useMemo, useState } from 'react';
import { HC } from '../../utils/constants';
import { foldText, productTypeOverlap } from '../../../../utils/libraryAssign';
import { timeValue, fmtVNDate } from '../../../../utils/vnTime';
import { FileGlyph, Pill, SectionLabel, Highlight } from './ui';
import { btn } from './uiStyles';

const MAX_RESULTS = 40;
const MAX_SUGGESTIONS = 8;

export default function FileSearchPicker({ catalog, requestType, addedFileIds, onAdd, onRetry, onBrowseLibrary }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const { tokens, results } = useMemo(() => {
    const files = catalog.files || [];
    const toks = foldText(query).split(/\s+/).filter(Boolean);
    const byNewest = (a, b) => timeValue(b.file.importedAt) - timeValue(a.file.importedAt);

    if (toks.length === 0) {
      const suggested = files
        .map((file) => ({ file, overlap: productTypeOverlap(requestType, [file.filename, file.title, ...(file.productTypes || [])]) }))
        .filter((x) => x.overlap > 0)
        .sort((a, b) => b.overlap - a.overlap || byNewest(a, b))
        .slice(0, MAX_SUGGESTIONS);
      return { tokens: toks, results: suggested };
    }

    const matched = files
      .map((file) => {
        const name = foldText(file.filename);
        const hay = `${name} ${foldText(file.title)} ${foldText((file.productTypes || []).join(' '))} ${foldText((file.vendors || []).join(' '))}`;
        if (!toks.every((t) => hay.includes(t))) return null;
        const overlap = productTypeOverlap(requestType, [file.filename, ...(file.productTypes || [])]);
        const score = (toks.every((t) => name.includes(t)) ? 4 : 0)
          + overlap * 2
          + (name.replace(/^hc_/, '').startsWith(toks[0]) ? 1 : 0);
        return { file, overlap, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || byNewest(a, b));
    return { tokens: toks, results: matched.slice(0, MAX_RESULTS) };
  }, [catalog.files, query, requestType]);

  const safeActive = Math.min(active, Math.max(results.length - 1, 0));

  const add = (file) => {
    if (!file || addedFileIds.has(String(file.id))) return;
    onAdd(file);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' && results.length) { e.preventDefault(); setActive((safeActive + 1) % results.length); }
    else if (e.key === 'ArrowUp' && results.length) { e.preventDefault(); setActive((safeActive - 1 + results.length) % results.length); }
    else if (e.key === 'Enter' && results.length) { e.preventDefault(); add(results[safeActive].file); }
    else if (e.key === 'Escape' && query) { e.preventDefault(); e.stopPropagation(); setQuery(''); setActive(0); }
  };

  const hint = catalog.status === 'loading'
    ? 'Đang tải danh sách file…'
    : tokens.length
      ? `${results.length} file khớp “${query.trim()}”${results.length >= MAX_RESULTS ? ` (hiện ${MAX_RESULTS} file đầu)` : ''}`
      : `Gợi ý theo Product Type “${requestType || '—'}” · gõ để tìm trong ${(catalog.files || []).length} file`;

  return (
    <section>
      <SectionLabel
        htmlFor="provide-file-search"
        title="Tìm file trong thư viện"
        hint={hint}
        right={onBrowseLibrary && (
          <button type="button" onClick={onBrowseLibrary} style={btn('link')}>Duyệt Thư viện Vendor</button>
        )}
      />

      <div style={{ position: 'relative' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={HC.muted} strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" />
        </svg>
        <input
          id="provide-file-search"
          type="text"
          autoComplete="off"
          spellCheck={false}
          autoFocus
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActive(0); }}
          onKeyDown={onKeyDown}
          placeholder="Gõ tên file — vd: wooden, jersey, comfort colors"
          role="combobox"
          aria-expanded="true"
          aria-controls="provide-file-results"
          aria-autocomplete="list"
          aria-activedescendant={results.length ? `provide-file-${results[safeActive].file.id}` : undefined}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '10px 70px 10px 36px', borderRadius: 12,
            border: `1.5px solid ${HC.borderStrong}`, background: HC.surface2, fontSize: 13, color: HC.ink2,
            outline: 'none', fontFamily: "'Inter',sans-serif",
          }}
          onFocus={(e) => { e.target.style.borderColor = HC.orange; e.target.style.boxShadow = '0 0 0 3px rgba(245,166,35,0.18)'; }}
          onBlur={(e) => { e.target.style.borderColor = HC.borderStrong; e.target.style.boxShadow = 'none'; }}
        />
        {query && (
          <button type="button" onClick={() => { setQuery(''); setActive(0); }}
            style={{ ...btn('line', { position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', padding: '3px 9px', fontSize: 11, border: 'none', background: HC.cream }) }}>
            Xoá
          </button>
        )}
      </div>

      <div
        id="provide-file-results"
        role="listbox"
        aria-label="File trong thư viện"
        style={{ marginTop: 8, border: `1.5px solid ${HC.border}`, borderRadius: 12, background: HC.surface, maxHeight: 300, overflowY: 'auto' }}
      >
        {catalog.status === 'error' ? (
          <div style={{ padding: '16px 12px', fontSize: 12, color: '#b91c1c', textAlign: 'center' }}>
            Không tải được danh sách file.{' '}
            <button type="button" onClick={onRetry} style={btn('link')}>Thử lại</button>
          </div>
        ) : catalog.status === 'loading' ? (
          <div style={{ padding: '16px 12px', fontSize: 12, color: HC.muted, textAlign: 'center' }}>Đang tải danh sách file…</div>
        ) : results.length === 0 ? (
          <div style={{ padding: '16px 12px', fontSize: 12, color: HC.muted, textAlign: 'center' }}>
            {tokens.length
              ? `Không có file nào khớp “${query.trim()}”. Thử bớt từ, gõ không dấu, hoặc dán link bên dưới.`
              : 'Chưa có file nào trùng Product Type của request. Gõ tên file để tìm.'}
          </div>
        ) : results.map(({ file, overlap }, i) => {
          const added = addedFileIds.has(String(file.id));
          const isActive = i === safeActive;
          return (
            <div
              key={file.id}
              id={`provide-file-${file.id}`}
              role="option"
              aria-selected={isActive}
              onMouseEnter={() => setActive(i)}
              onClick={() => add(file)}
              className="hc-provide-result"
              style={{
                display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '4px 10px', alignItems: 'center',
                padding: '9px 12px', borderBottom: i === results.length - 1 ? 'none' : `1px solid ${HC.border}`,
                cursor: added ? 'default' : 'pointer',
                background: isActive ? HC.orangePale : HC.surface,
                boxShadow: isActive ? `inset 3px 0 0 ${HC.orange}` : 'none',
              }}
            >
              <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 8, background: HC.orangeLight, border: `1px solid ${HC.orangeMid}`, display: 'grid', placeItems: 'center', color: HC.orangeDeep }}><FileGlyph /></span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 12.5, color: added ? HC.muted : HC.ink, overflowWrap: 'anywhere' }}>
                  <Highlight text={(file.filename || '').replace(/\.xlsx?$/i, '')} tokens={tokens} />
                </div>
                <div style={{ fontSize: 10.5, color: HC.muted, marginTop: 1 }}>
                  {(file.productTypes || []).length > 0 && <><Highlight text={file.productTypes.slice(0, 3).join(', ')} tokens={tokens} /> · </>}
                  {(file.vendors || []).length > 0 && <><Highlight text={file.vendors.join(', ')} tokens={tokens} /> · </>}
                  {file.counts?.generalInfo ?? 0} phôi
                  {file.importedAt && ` · nhập ${fmtVNDate(file.importedAt)}`}
                </div>
              </div>
              <div className="hc-provide-result-actions" style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                {requestType && (
                  <Pill tone={overlap > 0 ? 'ok' : 'warn'}>{overlap > 0 ? 'Khớp Product Type' : 'Khác Product Type'}</Pill>
                )}
                {added
                  ? <Pill tone="ok">✓ Đã thêm</Pill>
                  : (
                    <button type="button" style={btn('soft')} onClick={(e) => { e.stopPropagation(); add(file); }}>
                      + Thêm
                    </button>
                  )}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: HC.muted }}>↑ ↓ chọn · Enter thêm · Esc xoá ô tìm</div>
    </section>
  );
}
