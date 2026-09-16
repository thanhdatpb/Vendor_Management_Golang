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

describe('link riêng của file Thư viện Vendor', () => {
  beforeEach(() => { sessionStorage.clear(); });

  it('nhớ link file, cả dạng có slug lẫn không', () => {
    rememberPostLoginRedirect('/library/file_1');
    expect(postLoginPath('csf')).toBe('/library/file_1');

    rememberPostLoginRedirect('/library/file_1/baby-bodysuit');
    expect(postLoginPath('csf')).toBe('/library/file_1/baby-bodysuit');
  });

  it('GIỮ ?row= và #tab — link trỏ tới một phôi cụ thể phải mở đúng phôi đó', () => {
    rememberPostLoginRedirect({
      pathname: '/library/file_1/baby-bodysuit',
      search: '?row=row-lx8p2b',
      hash: '#pricing',
    });

    expect(postLoginPath('pd')).toBe('/library/file_1/baby-bodysuit?row=row-lx8p2b#pricing');
  });

  it('nhận cả object location của react-router lẫn chuỗi path', () => {
    rememberPostLoginRedirect({ pathname: '/price-sheets/sheet_1', search: '', hash: '' });
    expect(postLoginPath('seller')).toBe('/price-sheets/sheet_1');
  });

  it('vẫn chặn path lạ và query có ký tự ngoài whitelist', () => {
    rememberPostLoginRedirect('/library/../../etc/passwd');
    expect(postLoginPath('csf')).toBe('/csf');

    rememberPostLoginRedirect({ pathname: '/library/file_1', search: '?next=//evil.example.com', hash: '' });
    expect(postLoginPath('csf')).toBe('/csf');
  });
});
