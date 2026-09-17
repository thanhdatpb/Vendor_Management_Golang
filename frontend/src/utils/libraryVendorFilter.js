// ════════════════════════════════════════════════════════
//  Lọc MỘT file Thư viện Vendor theo vendor (ô "Tất cả vendor")
//
//  Một file Excel có thể chứa phôi của nhiều vendor (VD: CN1, VN1, VN3). Chọn
//  VN1 ở ô lọc thì cả card lẫn cửa sổ file chỉ được hiện phôi + dòng giá của
//  VN1 — trước đây ô lọc chỉ chọn FILE, mở ra vẫn thấy đủ mọi vendor.
//
//  Bản lọc là một "view": lưu từ view (sửa ô, xoá/thêm dòng giá, đổi tên file)
//  phải ghép lại với các dòng đang bị ẩn của vendor khác, nếu không sẽ xoá mất
//  chúng khỏi server. generalInfo đã có mergeGeneralInfoById (khớp id); "Về
//  giá" import từ Excel KHÔNG có id nên ghép theo vendor của từng dòng.
// ════════════════════════════════════════════════════════

// Đánh dấu entry là view đã lọc theo vendor nào. Dùng Symbol để dấu này không
// bao giờ lọt vào JSON gửi lên server, kể cả khi quên gỡ.
const VENDOR_VIEW = Symbol('libraryVendorView');

// Bỏ ngoặc/nháy/khoảng trắng thừa để "Canvas (1.5")" khớp "Canvas 1.5""
const normStr = (s) => (s || '').toString().trim().toLowerCase().replace(/[()'"""'']/g, '').replace(/\s+/g, ' ').trim();

/**
 * Vendor của từng dòng "Về giá" — đúng thứ tự ưu tiên của cột Vendor Name
 * trong bảng giá, để ô lọc và cột hiển thị không bao giờ lệch nhau.
 *
 * @returns {{ kyHieu: string, vendor: string }[]} cùng thứ tự với `rows`;
 *   `kyHieu` là ký hiệu hiệu lực (có lan xuống các dòng trống), `vendor` rỗng
 *   khi không suy ra được (bảng hiện N/A).
 */
export function pricingRowOwners(rows, generalInfo) {
  const general = (generalInfo || []).filter(Boolean);

  const kyHieuToVendor = {};
  general.forEach((g) => { if (g.kyHieu) kyHieuToVendor[g.kyHieu] = g.vendorName || g.kyHieu || ''; });

  // productType → vendorName (dùng khi dòng giá không có kyHieu)
  const ptToVendor = {};
  general.forEach((g) => { if (g.productType && g.vendorName) ptToVendor[normStr(g.productType)] = g.vendorName; });

  // Vendor không có kyHieu trong generalInfo → mặc định cho dòng giá không kyHieu
  const untaggedVendorNames = [...new Set(general.filter((g) => !g.kyHieu && g.vendorName).map((g) => g.vendorName))];
  const untaggedVendorName = untaggedVendorNames.length === 1 ? untaggedVendorNames[0] : '';

  const uniqueVendorNames = [...new Set(general.map((g) => g.vendorName || g.kyHieu).filter(Boolean))];

  const vendorOf = (row, kyHieu) => {
    // 1. Ký hiệu hiệu lực
    if (kyHieu) return kyHieuToVendor[kyHieu] || kyHieu;
    // 2. Tra theo productType
    const rpt = normStr(row?.productType);
    if (rpt) {
      if (ptToVendor[rpt]) return ptToVendor[rpt];
      const matchKey = Object.keys(ptToVendor).find((k) => k.includes(rpt) || rpt.includes(k));
      if (matchKey) return ptToVendor[matchKey];
    }
    // 3. generalInfo chỉ có 1 vendor không kyHieu
    if (untaggedVendorName) return untaggedVendorName;
    // 4. Cả file chỉ có 1 vendor
    if (uniqueVendorNames.length === 1) return uniqueVendorNames[0];
    return '';
  };

  // Nhiều Excel chỉ ghi kyHieu ở dòng đầu mỗi khối vendor → lan xuống các dòng sau
  let lastKyHieu = '';
  return (rows || []).map((row) => {
    const own = (row?.kyHieu || '').trim();
    if (own) lastKyHieu = own;
    const kyHieu = own || lastKyHieu;
    return { kyHieu, vendor: vendorOf(row, kyHieu) };
  });
}

/**
 * View của một file chỉ gồm phôi + dòng giá của `vendor`.
 * `vendor` rỗng → trả nguyên entry.
 */
export function filterLibraryEntryByVendor(entry, vendor) {
  if (!entry || !vendor) return entry;
  const owners = pricingRowOwners(entry.pricing, entry.generalInfo);
  const pricing = [];
  (entry.pricing || []).forEach((row, i) => {
    if (owners[i].vendor !== vendor) return;
    // Dòng trống kyHieu đang "mượn" ký hiệu của dòng phía trên. Tách khỏi khối
    // của nó thì ghi hẳn ký hiệu vào, để khi ghép lại (có thể lệch chỗ vì xoá
    // dòng) nó không mượn nhầm ký hiệu của vendor khác.
    const needsKyHieu = !(row?.kyHieu || '').trim() && owners[i].kyHieu;
    pricing.push(needsKyHieu ? { ...row, kyHieu: owners[i].kyHieu } : row);
  });
  return {
    ...entry,
    generalInfo: (entry.generalInfo || []).filter((row) => row?.vendorName === vendor),
    pricing,
    [VENDOR_VIEW]: vendor,
  };
}

/**
 * Dòng giá để LƯU khi view lọc vendor gửi lên `viewRows`: dòng của vendor
 * khác giữ nguyên chỗ; các chỗ của vendor này lần lượt nhận dòng của view
 * (thiếu = đã xoá); dòng thêm mới chèn ngay sau dòng cuối của vendor.
 */
function mergeVendorPricing(rawEntry, vendor, viewRows) {
  const rawRows = rawEntry.pricing || [];
  const owners = pricingRowOwners(rawRows, rawEntry.generalInfo);
  const pending = [...(viewRows || [])];
  const merged = [];
  let blockEnd = -1;
  rawRows.forEach((row, i) => {
    if (owners[i].vendor !== vendor) { merged.push(row); return; }
    if (pending.length) { merged.push(pending.shift()); blockEnd = merged.length; }
  });
  if (!pending.length) return merged;
  if (blockEnd < 0) return [...merged, ...pending];
  merged.splice(blockEnd, 0, ...pending);
  return merged;
}

/**
 * Entry để lưu từ một entry có thể là view lọc vendor: gỡ dấu view và ghép
 * "Về giá" lại với dòng của vendor khác trong `rawEntry` (bản gốc trên server).
 * Entry không phải view → trả nguyên. generalInfo để nơi gọi ghép theo id.
 */
export function unwrapLibraryVendorView(rawEntry, entry) {
  if (!entry || !entry[VENDOR_VIEW]) return entry;
  const { [VENDOR_VIEW]: vendor, ...rest } = entry;
  if (!rawEntry) return rest;
  return { ...rest, pricing: mergeVendorPricing(rawEntry, vendor, rest.pricing) };
}
