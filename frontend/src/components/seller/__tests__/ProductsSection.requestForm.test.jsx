// ════════════════════════════════════════════════════════
//  Form "Request phôi mới" (Seller) sau redesign: header sáng kiểu form
//  Admin, media ở cột trái, field chia Section, footer chỉ còn Cancel +
//  Confirm (bỏ dòng ghi chú luồng duyệt). Logic submit giữ nguyên.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductsSection from '../ProductsSection';

// Node 22+ có global  riêng (chưa bật) che mất bản của jsdom;
// ProductsSection gọi thẳng localStorage.removeItem khi mount nên cần shim sớm.
vi.hoisted(() => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
});

vi.mock('../../../hooks/useIsMobile', () => ({ default: () => false }));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { project: 'Happy84 Project', full_name: 'Nhi Hoang' } }),
}));

vi.mock('../../../services/api', () => ({
  productApi: {
    mySubmitted: vi.fn(async () => ({ data: { data: [] } })),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    sendToAdmin: vi.fn(),
  },
}));

vi.mock('../../../services/echo', () => ({
  subscribeProductChanges: vi.fn(() => () => {}),
}));

const openForm = async () => {
  render(<ProductsSection />);
  await userEvent.click(await screen.findByRole('button', { name: /Request sản phẩm mới/ }));
};

describe('Seller — form request phôi mới', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mở form với header mới và đếm mục bắt buộc còn thiếu', async () => {
    await openForm();
    expect(screen.getByRole('heading', { name: /Request phôi mới/ })).toBeTruthy();
    expect(screen.getByText(/Project Happy84 · Request Product Type/)).toBeTruthy();
    expect(screen.getByText('Còn 12 / 12 mục bắt buộc')).toBeTruthy();
  });

  it('chia field thành Section, media nằm riêng cột trái', async () => {
    await openForm();
    ['Thông số sản phẩm', 'Phản hồi khách hàng', 'Đóng gói'].forEach(t => expect(screen.getByText(t)).toBeTruthy());
    expect(screen.getByText('Link hình ảnh')).toBeTruthy();
    expect(screen.getByText('Link video sản phẩm')).toBeTruthy();
    expect(screen.getByPlaceholderText('Dán link rồi Enter')).toBeTruthy();
  });

  it('footer chỉ còn Cancel + Confirm, không còn ghi chú luồng duyệt', async () => {
    await openForm();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(screen.queryByText(/Admin duyệt request rồi Vận hành/)).toBeNull();
  });

  it('đếm lại khi người dùng điền field bắt buộc', async () => {
    await openForm();
    const typeBox = screen.getAllByPlaceholderText('Câu trả lời của bạn')[0];
    await userEvent.type(typeBox, 'Pet AOP TShirt');
    expect(screen.getByText('Còn 11 / 12 mục bắt buộc')).toBeTruthy();
  });
});
