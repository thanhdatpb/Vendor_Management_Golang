import { describe, it, expect, beforeEach } from 'vitest';
import { rememberPostLoginRedirect, postLoginPath } from '../postLoginRedirect';

describe('postLoginRedirect', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('nhớ link bảng tính giá hợp lệ và trả lại đúng link đó sau khi có role', () => {
    rememberPostLoginRedirect('/price-sheets/sheet_ab12cd');
    expect(postLoginPath('seller')).toBe('/price-sheets/sheet_ab12cd');
  });

  it('chỉ đọc được MỘT LẦN — lần gọi thứ hai rơi về route theo role', () => {
    rememberPostLoginRedirect('/price-sheets/sheet_ab12cd');
    postLoginPath('seller');
    expect(postLoginPath('seller')).toBe('/seller');
  });

  it('không nhớ path lạ (chống open-redirect qua sessionStorage)', () => {
    rememberPostLoginRedirect('/admin');
    expect(postLoginPath('seller')).toBe('/seller');

    rememberPostLoginRedirect('https://evil.example.com');
    expect(postLoginPath('admin')).toBe('/admin');
  });

  it('không có gì đã lưu thì dùng roleRoute bình thường', () => {
    expect(postLoginPath('vendor')).toBe('/vendor');
    expect(postLoginPath('role-khong-ton-tai')).toBe('/');
  });
});
