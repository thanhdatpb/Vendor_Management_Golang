// ════════════════════════════════════════════════════════
//  Import Thư viện Vendor mất Vendor Name + link Drive không gọn (2026-08-29)
//
//  Ca lỗi thật: sheet không có cột "Vendor Name" riêng (chỉ có "Ký hiệu" làm
//  định danh, VD: CN1/VN1) và ô "Chi tiết Size" dán thẳng link Google Drive
//  (không phải =IMAGE(...) hay URL đuôi .jpg/.png). Sau khi import qua
//  parseHappyCreativeLibrary, Vendor Name hiện "N/A" và Chi tiết Size hiện
//  nguyên URL thô thay vì icon Drive gọn — trong khi UI (VendorLibraryViewer)
//  đã biết render icon Drive nếu có isGoogleDriveUrl(chiTietSizeImage).
// ════════════════════════════════════════════════════════
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseHappyCreativeLibrary } from '../vendorExcel';

function workbookFile(name, rows) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'CROPTOP');
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new File([bytes], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

// Sheet chỉ có "Ký hiệu" (không có "Vendor Name") + Chi tiết Size là link Drive thô.
const rows = [
  ['', '', '', 'CROPTOP'], [], [], [],
  ['Thông tin chung về phôi'],
  [
    'Ký hiệu', 'Hình ảnh đại diện - Video', 'Product Type', '', '', '',
    'Chất liệu', 'Chi tiết Size', 'AVG thời gian sx+ ship theo vendor', '',
    'AVG thời gian sx+ ship thực tế', 'Notes', '', '', '', 'Link Folder',
  ],
  [
    'CN1', '', 'A - Mesh Fabric', '', '', '', '90%poly+10%spandex',
    'https://drive.google.com/file/d/abc123/view?usp=drive_link',
    '1-5 BDS', '', '1-3 BDS', 'ghi chu', '', '', '', 'https://drive.example/folder',
  ],
  ['Về giá'],
];

describe('parseHappyCreativeLibrary — Vendor Name & link Drive khi thiếu cột Vendor Name', () => {
  it('fallback Vendor Name về Ký hiệu khi sheet không có cột Vendor Name', async () => {
    const result = await parseHappyCreativeLibrary(workbookFile('croptop.xlsx', rows));

    expect(result.generalInfo).toHaveLength(1);
    expect(result.generalInfo[0].kyHieu).toBe('CN1');
    expect(result.generalInfo[0].vendorName).toBe('CN1');
  });

  it('nhận link Google Drive dán thẳng vào ô Chi tiết Size thành chiTietSizeImage', async () => {
    const result = await parseHappyCreativeLibrary(workbookFile('croptop.xlsx', rows));

    expect(result.generalInfo[0].chiTietSizeImage).toBe(
      'https://drive.google.com/file/d/abc123/view?usp=drive_link',
    );
    // Text trùng URL ảnh thì bỏ qua text, để UI chỉ render 1 icon Drive gọn.
    expect(result.generalInfo[0].chiTietSize).toBe('');
  });
});
