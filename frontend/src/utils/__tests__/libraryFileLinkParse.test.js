// ════════════════════════════════════════════════════════
//  Đọc link file thư viện người dùng dán vào — parseLibraryFileLinks
//
//  Người dán link lấy từ đủ nơi: nút "Copy link", thanh địa chỉ (có slug,
//  có ?row=), Slack (link cũ by-name), thậm chí dán nhầm link bảng tính giá
//  hay Google Drive. Mỗi loại phải ra đúng kết quả để UI báo đúng lỗi.
// ════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { parseLibraryFileLinks, parseLibraryFileToken } from '../libraryFileLink';

describe('parseLibraryFileToken', () => {
  it('link đầy đủ có slug', () => {
    expect(parseLibraryFileToken('https://vendorhub.viehana.com/library/1785132153942_46e3q61mpsm/hc-comfort-colors-1717'))
      .toMatchObject({ kind: 'file', id: '1785132153942_46e3q61mpsm', rowId: null });
  });

  it('không slug, đường dẫn tương đối, origin khác (dev)', () => {
    expect(parseLibraryFileToken('/library/file_1')).toMatchObject({ kind: 'file', id: 'file_1' });
    expect(parseLibraryFileToken('http://localhost:5173/library/file_1/')).toMatchObject({ kind: 'file', id: 'file_1' });
  });

  it('?row= trỏ tới một phôi', () => {
    expect(parseLibraryFileToken('https://x.com/library/file_1/baby-bodysuit?row=row-lx8p2b#pricing'))
      .toMatchObject({ kind: 'file', id: 'file_1', rowId: 'row-lx8p2b' });
  });

  it('id có ký tự đã mã hoá thì giải mã', () => {
    expect(parseLibraryFileToken('/library/file%201/abc')).toMatchObject({ kind: 'file', id: 'file 1' });
  });

  it('link cũ theo tên file', () => {
    expect(parseLibraryFileToken('https://x.com/library/by-name/HC_Pillow%20P.Happy'))
      .toMatchObject({ kind: 'name', filename: 'HC_Pillow P.Happy', key: 'name:hc_pillow p.happy' });
  });

  it('link bảng tính giá và link ngoài hệ thống là invalid, kèm lý do', () => {
    expect(parseLibraryFileToken('https://vendorhub.viehana.com/price-sheets/128'))
      .toMatchObject({ kind: 'invalid', reason: 'price-sheet' });
    expect(parseLibraryFileToken('https://drive.google.com/drive/folders/1AbC'))
      .toMatchObject({ kind: 'invalid', reason: 'not-library' });
    expect(parseLibraryFileToken('xin-chao')).toMatchObject({ kind: 'invalid', reason: 'not-library' });
  });

  it('URL có escape sequence hỏng không làm vỡ ô dán link', () => {
    expect(parseLibraryFileToken('/library/%E0%A4%A')).toMatchObject({ kind: 'invalid', reason: 'not-library' });
    expect(parseLibraryFileToken('/library/by-name/%E0%A4%A')).toMatchObject({ kind: 'invalid', reason: 'not-library' });
  });
});

describe('parseLibraryFileLinks', () => {
  it('mỗi dòng một link, bỏ dòng trống', () => {
    const { links } = parseLibraryFileLinks('\n/library/a\n\n  /library/b  \n');
    expect(links.map((l) => l.key)).toEqual(['a', 'b']);
  });

  it('gộp link trùng file và đếm số link đã gộp', () => {
    const { links, duplicates } = parseLibraryFileLinks('/library/a/slug-1 https://x.com/library/a/khac');
    expect(links).toHaveLength(1);
    expect(duplicates).toBe(1);
  });

  it('một bản trỏ cả file + một bản trỏ một phôi → lấy cả file', () => {
    const { links } = parseLibraryFileLinks('/library/a?row=r1\n/library/a');
    expect(links[0].rowId).toBeNull();
  });

  it('chuỗi rỗng → không có link', () => {
    expect(parseLibraryFileLinks('')).toEqual({ links: [], duplicates: 0 });
  });
});
