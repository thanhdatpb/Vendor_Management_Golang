// ════════════════════════════════════════════════════════
//  ADMIN — BẢNG TÍNH GIÁ (chỉ xem, theo project)
//
//  Không có endpoint riêng cho Admin: PriceSheetController::seesAllProjects()
//  đã gồm sẵn 'admin' (backend/app/Http/Controllers/Api/PriceSheetController.php)
//  nên GET /price-sheets, /price-sheets/{id}, /price-sheets/{id}/versions của
//  Seller trả đủ dữ liệu MỌI project cho Admin — dùng thẳng priceSheetApi hiện
//  có, không thêm route mới.
//
//  Admin CHỈ xem + export. Không có nút Mở-để-sửa, không có Lưu, không có Xoá.
//  Bảng Seller đang mở trên máy khác không hề biết Admin đang xem cùng lúc.
// ════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { HC } from '../constants';
import AppToast from '../../shared/AppToast';
import { Pagination } from '../../seller/SellerUI';
import { priceSheetApi } from '../../../services/api';
import { usd, pct } from '../../../utils/pricingEngine';
import { normalizeSheetRow, matchesSheetSearch } from '../../../utils/priceSheetSummary';
import { exportSheetToExcel } from '../../../utils/sheetExport';
import { priceSheetPath, copyPriceSheetLink } from '../../../utils/priceSheetLink';
import { fmtVNDate } from '../../../utils/vnTime';
import { PROJECTS } from '../../../constants/projects';

const ITEMS_PER_PAGE = 10;
// Bảng chưa gán được về project nào (tài khoản Seller chưa điền project, hoặc
// project cũ đã bỏ). Gom vào một chip riêng thay vì để chúng biến mất khỏi mọi
// chip — nếu không, tổng các chip nhỏ hơn "Tất cả" mà không ai giải thích được.
const UNASSIGNED = '__unassigned__';

const projectLabel = (key) => {
  if (key === UNASSIGNED) return 'Chưa gán project';
  return PROJECTS.find((p) => p.id === key)?.label || key;
};

// Dòng thuộc chip nào. `projectKey` do normalizeSheetRow chuẩn hoá từ chuỗi thô
// trong DB ("Creative Project" / "creative project" / "creative" → creative):
// cột users.project lưu dạng NHÃN nên so thẳng với id ngắn là trượt hết.
const chipOf = (row) => row.projectKey || UNASSIGNED;

export default function PriceSheetSection() {
  const navigate = useNavigate();
  const [allSheets, setAllSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((type, title, message, duration = 3000) => {
    setToast({ type, title, message, duration });
    setTimeout(() => setToast(null), duration);
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError('');
      const res = await priceSheetApi.list();
      const rows = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.data) ? res.data.data : []);
      setAllSheets(rows);
    } catch (err) {
      console.error('Load price sheets error:', err?.message || err);
      setAllSheets([]);
      setLoadError('Không tải được danh sách bảng tính giá. Kiểm tra kết nối rồi thử lại.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sheets = useMemo(
    () => allSheets.map(normalizeSheetRow).filter(Boolean),
    [allSheets]
  );

  // Đếm theo project cho chip lọc — cùng kiểu chip đang dùng ở Thư Viện Vendor.
  const projectCounts = useMemo(() => {
    const counts = {};
    sheets.forEach((s) => { const k = chipOf(s); counts[k] = (counts[k] || 0) + 1; });
    return counts;
  }, [sheets]);

  const filtered = useMemo(() => {
    let rows = projectFilter === 'all' ? sheets : sheets.filter((s) => chipOf(s) === projectFilter);
    rows = rows.filter((s) => matchesSheetSearch(s, search));
    return rows;
  }, [sheets, projectFilter, search]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleCopyLink = async (id) => {
    try {
      await copyPriceSheetLink(id);
    } catch (err) {
      console.warn('Copy link bảng tính giá thất bại:', err?.message || err);
      showToast('error', 'Copy link thất bại', 'Kiểm tra quyền truy cập clipboard rồi thử lại.');
    }
  };

  const exportRow = async (row) => {
    try {
      const res = await priceSheetApi.get(row.id);
      exportSheetToExcel(res.data, showToast);
    } catch (err) {
      console.error('Không tải được bảng để export:', err?.message || err);
      showToast('error', 'Không export được', 'Kiểm tra kết nối rồi thử lại.', 4000);
    }
  };

  return (
    <div>
      <AppToast toast={toast} onClose={() => setToast(null)} />

      {/* Header — KHÔNG có nút "Tạo bảng mới": Admin chỉ xem + export, không tạo. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 6, height: 24, borderRadius: 99, background: `linear-gradient(to bottom,${HC.orange},${HC.orangeDark})` }} />
        <div style={{ fontWeight: 900, fontSize: 15, color: HC.ink }}>Danh sách bảng tính giá</div>
        <span style={{ padding: '2px 10px', borderRadius: 20, background: HC.orangeLight, color: HC.brown, fontSize: 11, fontWeight: 700 }}>{filtered.length} bảng</span>
        <div style={{ marginLeft: 'auto' }}>
          <input type="text" placeholder="Tìm bảng / vendor / product..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${HC.border}`, fontSize: 12, background: HC.surface, color: HC.ink, outline: 'none', width: 240 }} />
        </div>
      </div>

      {/* Chip lọc theo project — cùng kiểu tab đang dùng ở Thư Viện Vendor / Quản Lý Nhân Sự */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, borderBottom: `1.5px solid ${HC.border}`, paddingBottom: 8, flexWrap: 'wrap' }}>
        {[
          { id: 'all', label: 'Tất cả' },
          ...PROJECTS,
          // Chip "Chưa gán" chỉ hiện khi thật sự có bảng như vậy — không bày
          // thêm một chip 0 cho mọi người phải đọc.
          ...(projectCounts[UNASSIGNED] ? [{ id: UNASSIGNED, label: 'Chưa gán project' }] : []),
        ].map((p) => {
          const count = p.id === 'all' ? sheets.length : (projectCounts[p.id] || 0);
          const active = projectFilter === p.id;
          return (
            <button key={p.id} onClick={() => { setProjectFilter(p.id); setPage(1); }}
              style={{
                padding: '9px 18px', borderRadius: 12, border: `2px solid ${active ? HC.orange : HC.border}`,
                background: active ? HC.orangeLight : HC.surface, color: active ? HC.orangeDark : HC.muted,
                fontSize: 13, fontWeight: active ? 900 : 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              }}>
              {p.label}
              <span style={{
                padding: '1px 8px', borderRadius: 20, fontSize: 11, fontWeight: 800,
                background: active ? HC.orange : HC.surface2, color: active ? '#fff' : HC.muted,
              }}>{count}</span>
            </button>
          );
        })}
      </div>

      {loadError && (
        <div role="alert" style={{
          marginBottom: 16, padding: '12px 16px', borderRadius: 12,
          background: '#FFF2F2', border: '1.5px solid #FFCDD2', color: HC.danger,
          fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ flex: 1 }}>{loadError}</span>
          <button onClick={load} style={{
            padding: '5px 14px', borderRadius: 8, border: `1.5px solid ${HC.danger}`,
            background: HC.surface, color: HC.danger, fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>Thử lại</button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: HC.muted }}>Đang tải...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', background: HC.surface, borderRadius: 14, border: `1px solid ${HC.border}` }}>
          <div style={{ fontSize: 42, marginBottom: 12, opacity: 0.5 }}>🧮</div>
          <div style={{ fontWeight: 700, color: HC.muted2, marginBottom: 6 }}>Chưa có bảng tính giá nào</div>
          <div style={{ fontSize: 13, color: HC.muted }}>
            {projectFilter === 'all' ? 'Chưa Seller nào tạo bảng tính giá.' : `Project "${projectLabel(projectFilter)}" chưa có bảng tính giá nào.`}
          </div>
        </div>
      ) : (
        <>
          <div style={{ borderRadius: 14, border: `1.5px solid ${HC.border}`, background: HC.surface, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12, minWidth: 1000 }}>
                <thead>
                  <tr style={{ background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})` }}>
                    {['Tên bảng', 'Project', 'Vendor', 'PT / Size', 'Khoảng giá', 'Avg Margin', 'Người tạo', 'Cập nhật cuối', 'Thao tác'].map((h, i) => (
                      <th key={h} style={{ padding: '10px 10px', color: '#fff', fontWeight: 700, textAlign: i > 2 ? 'center' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.map((sheet, idx) => (
                    <tr key={sheet.id} style={{ borderBottom: `1px solid ${HC.border}`, background: idx % 2 === 0 ? '#fff' : HC.surface2 }}>
                      <td style={{ padding: '10px' }}>
                        <div style={{ fontWeight: 800, color: HC.ink2 }}>{sheet.name || '—'}</div>
                        {sheet.productTypeNames.length > 0 && (
                          <div style={{ fontSize: 10.5, color: HC.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                            {sheet.productTypeNames.join(', ')}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <span style={{ padding: '2px 10px', borderRadius: 20, background: HC.orangeLight, color: HC.orangeDark, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {projectLabel(sheet.projectKey) || sheet.project || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '10px', fontWeight: 600, color: HC.orange }}>{sheet.vendorRef || '—'}</td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 12, background: HC.orangeLight, color: HC.orangeDark, fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }}>
                          {sheet.productTypeNames.length} PT / {sheet.sizeCount} size
                        </span>
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center', fontWeight: 700, color: HC.ink2, fontVariantNumeric: 'tabular-nums' }}>
                        {sheet.minPrice != null ? (sheet.minPrice === sheet.maxPrice ? usd(sheet.minPrice) : `${usd(sheet.minPrice)} – ${usd(sheet.maxPrice)}`) : <span style={{ color: HC.muted }}>—</span>}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: sheet.avgMargin != null ? (sheet.avgMargin > 25 ? HC.success : HC.warning) : HC.muted }}>
                        {sheet.avgMargin != null ? pct(sheet.avgMargin, 1) : '—'}
                      </td>
                      <td style={{ padding: '10px', fontSize: 11, color: HC.muted, textAlign: 'center' }}>{sheet.createdBy || '—'}</td>
                      <td style={{ padding: '10px', textAlign: 'center', fontSize: 11, color: HC.muted, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtVNDate(sheet.updatedAt, '—')}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button onClick={() => navigate(priceSheetPath(sheet.id))}
                            style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`, color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 800 }}>
                            Xem
                          </button>
                          <button onClick={() => handleCopyLink(sheet.id)} title="Copy link bảng tính giá" style={{ padding: '5px 9px', borderRadius: 6, border: `1px solid ${HC.borderStrong}`, background: HC.surface, color: HC.muted, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>🔗</button>
                          <button onClick={() => exportRow(sheet)} title="Export Excel" style={{ padding: '5px 9px', borderRadius: 6, border: `1px solid ${HC.borderStrong}`, background: HC.surface, color: HC.muted, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>⬇</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {totalPages > 1 && <Pagination currentPage={page} totalPages={totalPages} totalItems={filtered.length} onPageChange={setPage} itemsPerPage={ITEMS_PER_PAGE} />}
        </>
      )}

    </div>
  );
}
