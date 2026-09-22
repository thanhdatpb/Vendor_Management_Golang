// ════════════════════════════════════════════════════════
//  THỐNG KÊ PHÔI (Admin) — khối đầu trang "Tổng quan Vendor & Sản phẩm"
//
//  Hai số liệu KHÁC NHAU, không lấy số này chia số kia:
//
//  1. Phôi đã duyệt — phôi được duyệt trong quá trình hệ thống hoạt động VÀ
//     đã được cung cấp vendor: Request có `status = approved` và phôi nằm
//     trong `assigned_vendors` (bản chụp lúc Vendor cung cấp). Request đã duyệt
//     nhưng chưa được cung cấp vendor thì không tính, không hiện. Không phụ
//     thuộc file thư viện hiện còn hay đã đổi.
//  2. Phôi trong thư viện — dòng "Thông tin chung về phôi" (`generalInfo`)
//     của các file vendor đang có trong Thư viện.
//
//  Thuần, không dính React, để test được.
// ════════════════════════════════════════════════════════
import { groupAssignedByRow } from './libraryAssign';
import { PROJECTS, projectNameToKey } from '../constants/projects';
import { timeValue } from './vnTime';

const clean = (value) => (value ?? '').toString().trim();

/** So tên vendor không phân biệt hoa/thường và khoảng trắng hai đầu. */
export const vendorKey = (name) => clean(name).toUpperCase();

/** "Happy Project" / "happy" → "Happy"; không nhận ra thì giữ nguyên chuỗi gốc. */
function projectLabel(raw) {
  const key = projectNameToKey(raw);
  if (key) return PROJECTS.find((p) => p.id === key)?.shortLabel || raw;
  return clean(raw);
}

/**
 * Danh sách phôi đã duyệt — mỗi phần tử là MỘT phôi được cung cấp cho MỘT
 * Request đã duyệt, mới duyệt nhất lên đầu.
 *
 * @param {Array} products  Request (dạng `/products-approved` trả về)
 * @returns {Array<{ key, phoiKey, phoi, vendor, vendorKey, projectKey, project,
 *   requestedAt, approvedAt, providedAt, productId, requestName }>}
 */
export function collectApprovedPhoi(products) {
  const out = [];
  (Array.isArray(products) ? products : []).forEach((product) => {
    if (!product || product.status !== 'approved') return;
    const assigned = Array.isArray(product.assigned_vendors)
      ? product.assigned_vendors.filter((v) => v && typeof v === 'object')
      : [];
    // Đã duyệt nhưng chưa được cung cấp vendor → không tính.
    if (assigned.length === 0) return;

    const rawProject = clean(product.project);
    groupAssignedByRow(assigned).forEach((group) => {
      const vendor = clean(group.name) || '—';
      out.push({
        key: `${product.id}::${group.key}`,
        phoiKey: group.key,
        phoi: clean(group.productType) || '—',
        vendor,
        vendorKey: vendorKey(vendor),
        projectKey: projectNameToKey(rawProject),
        project: projectLabel(rawProject),
        requestedAt: product.submitted_at || product.created_at || null,
        approvedAt: product.reviewed_at || null,
        providedAt: group.providedAt || null,
        productId: product.id,
        requestName: clean(product.product_type),
      });
    });
  });

  return out.sort((a, b) =>
    timeValue(b.approvedAt) - timeValue(a.approvedAt)
    || timeValue(b.providedAt) - timeValue(a.providedAt)
    || String(a.key).localeCompare(String(b.key)));
}

/**
 * Phôi đang có trong thư viện của MỘT vendor — mỗi dòng generalInfo là một
 * phôi, file mới nhập lên đầu.
 *
 * @param {Array}  files  file thư viện đang hoạt động (đã lọc project nếu cần)
 * @param {string} key    vendorKey của vendor cần xem
 * @returns {Array<{ key, phoi, fileName, importedAt }>}
 */
export function libraryPhoiOfVendor(files, key) {
  if (!key) return [];
  const out = [];
  (Array.isArray(files) ? files : []).forEach((file, fileIndex) => {
    if (!file) return;
    (file.generalInfo || []).forEach((row, rowIndex) => {
      if (!row) return;
      const name = clean(row.vendorName) || clean(row.kyHieu);
      if (vendorKey(name) !== key) return;
      out.push({
        key: `${file.id ?? `f${fileIndex}`}::${row.id ?? rowIndex}`,
        phoi: clean(row.productType) || '—',
        fileName: clean(file.filename) || clean(file.title),
        importedAt: file.importedAt || null,
      });
    });
  });
  return out.sort((a, b) => timeValue(b.importedAt) - timeValue(a.importedAt)
    || a.phoi.localeCompare(b.phoi, undefined, { numeric: true, sensitivity: 'base' }));
}

/** Chỉ giữ phôi đã duyệt cho `projectId` ('' = mọi project). */
export function filterApprovedByProject(list, projectId) {
  if (!projectId) return list;
  return list.filter((item) => item.projectKey === projectId);
}

/**
 * Số liệu cho khối thống kê.
 *
 * `approved` đếm theo PHÔI, không theo lượt duyệt: một phôi được cung cấp cho
 * hai Request vẫn là một phôi. Danh sách "Mới duyệt" thì liệt kê từng lượt.
 *
 * @param {Array} approvedList  kết quả collectApprovedPhoi (đã lọc project nếu cần)
 * @param {Array} files         file thư viện đang hoạt động (đã lọc project nếu cần)
 * @returns {{ approved: number, library: number, fileCount: number,
 *   vendors: Array<{ key, name, approved, library }> }}
 */
export function summarizePhoi(approvedList, files) {
  const byVendor = new Map();
  const vendorEntry = (name) => {
    const key = vendorKey(name);
    if (!byVendor.has(key)) byVendor.set(key, { key, name: clean(name), approvedKeys: new Set(), library: 0 });
    return byVendor.get(key);
  };

  const approvedKeys = new Set();
  (approvedList || []).forEach((item) => {
    approvedKeys.add(item.phoiKey);
    if (item.vendor && item.vendor !== '—') vendorEntry(item.vendor).approvedKeys.add(item.phoiKey);
  });

  let library = 0;
  const activeFiles = Array.isArray(files) ? files.filter(Boolean) : [];
  activeFiles.forEach((file) => {
    (file.generalInfo || []).forEach((row) => {
      if (!row) return;
      library += 1;
      const name = clean(row.vendorName) || clean(row.kyHieu);
      if (!name) return;
      const entry = vendorEntry(name);
      // Tên hiển thị lấy theo lần đầu gặp trong thư viện: bấm vendor là đặt ô
      // "Tất cả vendor", ô đó so khớp đúng tên như trong file.
      if (!entry.fromLibrary) { entry.name = name; entry.fromLibrary = true; }
      entry.library += 1;
    });
  });

  const vendors = [...byVendor.values()]
    .filter((v) => v.key)
    .map((v) => ({ key: v.key, name: v.name, approved: v.approvedKeys.size, library: v.library }))
    .sort((a, b) => b.approved - a.approved || b.library - a.library
      || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

  return { approved: approvedKeys.size, library, fileCount: activeFiles.length, vendors };
}
