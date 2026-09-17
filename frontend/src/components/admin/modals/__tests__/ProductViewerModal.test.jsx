// ════════════════════════════════════════════════════════
//  ADMIN — modal "Chi tiết request" (mở từ bảng Form Chờ Duyệt / danh sách sản phẩm).
//
//  Deadline do role Vendor đặt (kèm gán vendor) chỉ SAU KHI Admin duyệt request.
//  Test chốt: form chưa duyệt (chờ duyệt / từ chối) không hiện chip Deadline ở
//  header; form đã duyệt thì hiện. Kèm các hành vi của bố cục 2 cột: tách Đặc tính
//  KT thành danh sách, footer chỉ có 1 nút chính, Esc để đóng.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import ProductViewerModal from '../ProductViewerModal';
import { fmtDate } from '../../utils';

const CREATED = '2026-09-14T02:00:00.000Z';
const DEADLINE = '2026-08-26T02:00:00.000Z';

// jsdom không có matchMedia; modal dùng useIsMobile() nên cần bản giả (desktop).
// Hàm thường thay vì vi.fn(): config reset mock giữa các test sẽ xoá mockReturnValue.
beforeAll(() => {
  window.matchMedia = () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
});

const product = (overrides = {}) => ({
  id: 7,
  project: 'Hapify84 Project',
  product_type: 'Comfort Colors Shirt',
  status: 'pending',
  seller_name: 'Nhi Hoang',
  created_at: CREATED,
  deadline_date: null,
  ...overrides,
});

const renderModal = (p, props = {}) => render(
  <ProductViewerModal product={p} onClose={vi.fn()} onApprove={vi.fn()} onReject={vi.fn()} {...props} />
);

describe('ProductViewerModal — Deadline chỉ có sau khi duyệt', () => {
  it.each(['pending', 'rejected'])('form %s: có ngày gửi, không có chip Deadline', (status) => {
    renderModal(product({ status }));

    expect(screen.getByText(`Gửi ${fmtDate(CREATED)}`)).toBeInTheDocument();
    expect(screen.queryByText('Deadline')).not.toBeInTheDocument();
  });

  it('form đã duyệt: hiện chip Deadline kèm ngày', () => {
    renderModal(product({ status: 'approved', deadline_date: DEADLINE }));

    expect(screen.getByText('Deadline')).toBeInTheDocument();
    expect(screen.getByText(fmtDate(DEADLINE))).toBeInTheDocument();
  });
});

describe('ProductViewerModal — bố cục thông tin request', () => {
  it('header lấy Product Type làm tiêu đề, kèm Seller và Project', () => {
    renderModal(product());

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Comfort Colors Shirt');
    expect(screen.getByText('Nhi Hoang')).toBeInTheDocument();
    expect(screen.getByText('Hapify84 Project')).toBeInTheDocument();
  });

  it('Đặc tính KT nối bằng ♦ được tách thành từng dòng', () => {
    renderModal(product({ other_specs: '♦ Soft-washed garment-dyed fabric ♦ Double-needle collar ♦ Twill taped neck and shoulders' }));

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[1]).toHaveTextContent('Double-needle collar');
  });

  it('Đặc tính KT không có ký tự tách thì hiện nguyên đoạn', () => {
    renderModal(product({ other_specs: 'Vải dày 250gsm' }));

    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.getByText('Vải dày 250gsm')).toBeInTheDocument();
  });

  it('link hình ảnh / video hiện theo loại, giữ URL đầy đủ ở href', () => {
    const img = 'https://i.etsystatic.com/37788861/r/il/9d2a7e/7821107482/il_794xN.jpg';
    const vid = 'https://www.etsy.com/listing/4474370045/comfort-colors-personalized';
    renderModal(product({ product_type_links: JSON.stringify([img]), product_video_links: [vid] }));

    expect(screen.getByRole('link', { name: /Link hình ảnh/ })).toHaveAttribute('href', img);
    expect(screen.getByRole('link', { name: /Video sản phẩm/ })).toHaveAttribute('href', vid);
    expect(screen.getByText('etsy.com/listing/4474370045/comfort-colors-personalized')).toBeInTheDocument();
  });
});

describe('ProductViewerModal — footer và đóng modal', () => {
  it('form chờ duyệt: có Từ chối + Duyệt request, không có nút Đóng ở footer', () => {
    const onApprove = vi.fn();
    const p = product();
    renderModal(p, { onApprove });

    // Chỉ còn nút ✕ ở header mang tên "Đóng".
    expect(screen.getAllByRole('button', { name: 'Đóng' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Từ chối' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Duyệt request/ }));
    expect(onApprove).toHaveBeenCalledWith(p);
  });

  it('không truyền thao tác duyệt (chỉ xem): footer chỉ có nút Đóng', () => {
    const onClose = vi.fn();
    render(<ProductViewerModal product={product({ status: 'approved' })} onClose={onClose} />);

    expect(screen.queryByRole('button', { name: /Duyệt request/ })).not.toBeInTheDocument();
    const closeButtons = screen.getAllByRole('button', { name: 'Đóng' });
    expect(closeButtons).toHaveLength(2);
    fireEvent.click(closeButtons[1]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('bấm Esc thì đóng modal', () => {
    const onClose = vi.fn();
    renderModal(product(), { onClose });

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('không có ảnh thì hiện trạng thái trống', () => {
    renderModal(product());

    expect(within(screen.getByRole('dialog')).getByText('Chưa có ảnh')).toBeInTheDocument();
  });
});
