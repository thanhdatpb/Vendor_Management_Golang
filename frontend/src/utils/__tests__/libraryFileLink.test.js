// ════════════════════════════════════════════════════════
//  Link riêng cho 1 file Thư viện Vendor
//
//  Link này đi vào Slack, email và thông báo — sai một chỗ là người nhận mở ra
//  404 mà không ai biết tại sao. Bộ test giữ 3 điều:
//    • id luôn là thứ dùng để tra cứu, slug chỉ để đọc;
//    • tên file tiếng Việt / ký tự lạ vẫn ra link sạch;
//    • thông báo cũ (chỉ có filename) vẫn có đường mở.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  libraryFileSlug,
  libraryFilePath,
  libraryFileByNamePath,
  libraryFileUrl,
  parseLibraryFilePath,
  libraryTargetFromNotification,
  copyLibraryFileLink,
} from '../libraryFileLink';

describe('slug đọc được trong URL', () => {
  it('bỏ dấu tiếng Việt và hạ chữ thường', () => {
    expect(libraryFileSlug('Áo Thun Cổ Tròn')).toBe('ao-thun-co-tron');
  });

  it('bỏ đuôi .xlsx và gom ký tự lạ thành một dấu gạch', () => {
    expect(libraryFileSlug('QC_VN3_Quilt  Christmas//Tree.xlsx')).toBe('qc-vn3-quilt-christmas-tree');
  });

  it('không để lại dấu gạch thừa ở hai đầu, kể cả khi bị cắt ngắn', () => {
    const slug = libraryFileSlug('A'.repeat(80));
    expect(slug.startsWith('-')).toBe(false);
    expect(slug.endsWith('-')).toBe(false);
    expect(slug.length).toBeLessThanOrEqual(60);
  });

  it('tên toàn ký tự lạ thì trả chuỗi rỗng, không phải một chuỗi gạch', () => {
    expect(libraryFileSlug('###')).toBe('');
  });
});

describe('đường dẫn', () => {
  it('ghép id với slug', () => {
    expect(libraryFilePath('1757936_ax7q2', 'Baby Bodysuit'))
      .toBe('/library/1757936_ax7q2/baby-bodysuit');
  });

  it('không có tên file thì vẫn ra link mở được', () => {
    expect(libraryFilePath('abc')).toBe('/library/abc');
  });

  it('id có ký tự đặc biệt được mã hoá', () => {
    expect(libraryFilePath('a b/c')).toBe('/library/a%20b%2Fc');
  });

  it('url là origin + path', () => {
    expect(libraryFileUrl('abc', 'Baby Bodysuit'))
      .toBe(`${window.location.origin}/library/abc/baby-bodysuit`);
  });
});

describe('đọc ngược từ URL', () => {
  it('lấy đúng id dù có slug hay không', () => {
    expect(parseLibraryFilePath('/library/abc')).toEqual({ id: 'abc', slug: '' });
    expect(parseLibraryFilePath('/library/abc/baby-bodysuit')).toEqual({ id: 'abc', slug: 'baby-bodysuit' });
  });

  it('giải mã id đã mã hoá', () => {
    expect(parseLibraryFilePath('/library/a%20b')).toEqual({ id: 'a b', slug: '' });
  });

  it('URL khác trả null — danh sách dựa vào đây để biết KHÔNG mở cửa sổ', () => {
    expect(parseLibraryFilePath('/admin/vendors')).toBeNull();
    expect(parseLibraryFilePath('/library')).toBeNull();
    expect(parseLibraryFilePath('/library/abc/slug/thua')).toBeNull();
  });
});

describe('đích của nút "Mở file" trong thông báo', () => {
  it('có file_id thì đi thẳng tới file', () => {
    expect(libraryTargetFromNotification({ file_id: 'abc', filename: 'Baby Bodysuit' }))
      .toBe('/library/abc/baby-bodysuit');
  });

  it('đọc được cả khi còn nguyên trong `data` của API', () => {
    expect(libraryTargetFromNotification({ data: { file_id: 'abc', filename: 'X' } }))
      .toBe('/library/abc/x');
  });

  it('thông báo cũ chỉ có tên file → đi đường tra theo tên', () => {
    expect(libraryTargetFromNotification({ filename: 'Baby Bodysuit' }))
      .toBe(libraryFileByNamePath('Baby Bodysuit'));
  });

  it('thông báo gộp nhiều file không trỏ đi đâu cả', () => {
    expect(libraryTargetFromNotification({ actor_label: 'Vendor' })).toBeNull();
    expect(libraryTargetFromNotification(null)).toBeNull();
  });
});

describe('copy link', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('dùng clipboard khi có', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const url = await copyLibraryFileLink('abc', 'Baby Bodysuit');

    expect(writeText).toHaveBeenCalledWith(url);
    expect(url).toContain('/library/abc/baby-bodysuit');
  });

  it('clipboard bị chặn (HTTP nội bộ) thì vẫn copy được bằng execCommand', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('not allowed')) } });
    const execCommand = vi.fn();
    document.execCommand = execCommand;

    const url = await copyLibraryFileLink('abc', 'Baby Bodysuit');

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(url).toContain('/library/abc');
    // Textarea tạm phải được dọn, không để lại rác trong DOM.
    expect(document.querySelector('textarea')).toBeNull();
  });
});
