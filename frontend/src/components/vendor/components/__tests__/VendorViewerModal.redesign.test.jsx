// ════════════════════════════════════════════════════════
//  Modal chi tiết request (Vendor) sau khi đồng bộ với bản redesign của
//  Seller: header là Product Type, thông tin chia Section, bảng so sánh
//  vendor vẫn giữ nguyên cột + mốc so target; nút "So sánh Matrix" chuyển
//  vào header actions.
// ════════════════════════════════════════════════════════
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VendorViewerModal from '../VendorViewerModal';

// jsdom không có matchMedia; modal dùng useIsMobile() nên cần bản giả (desktop).
beforeAll(() => {
  window.matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
});

const product = {
  id: 9,
  product_type: 'Wooden Ornament',
  created_at: '2026-09-16T03:00:00Z',
  deadline_date: '2026-09-22T03:00:00Z',
  total_cost: '7-9',
  production_time: '1-3',
  shipping_time: '4-6',
  material: '2 chất liệu riêng biệt Arcrylic/Wooden (ưu tiên Wooden)',
  print_area: 'Mặt trước',
  other_specs: 'Có khoảng in đủ dài♦1 Layer hoặc 2 layer',
  good_review: 'Đẹp mắt, cute',
  bad_review: 'Khá mỏng, dễ bị gãy',
  packaging_links: 'Có thể có hộp',
  other_packaging: '',
  product_type_links: ['https://i.etsystatic.com/wooden-ornament.jpg'],
  product_video_links: ['https://drive.google.com/file/d/xyz/view'],
  assigned_vendors: [
    { id: 1, name: 'Yiwu WoodCraft', vendor_type: 'Wooden Ornament', overview: 'Gỗ tự nhiên', size: 'M', eco_total: 7.4, link_folder: 'https://drive.google.com/x' },
    { id: 2, name: 'Ningbo Craft', vendor_type: 'Wooden Ornament', overview: 'Acrylic trong', size: 'L', eco_total: 10.5 },
  ],
};

const renderModal = (p = product) => render(<VendorViewerModal product={p} onClose={() => {}} />);

describe('Vendor VendorViewerModal — đồng bộ redesign', () => {
  it('lấy Product Type làm tiêu đề, gom ngày gửi/deadline vào header', () => {
    renderModal();
    expect(screen.getByRole('heading', { name: /Wooden Ornament/ })).toBeTruthy();
    expect(screen.getByText('Deadline')).toBeTruthy();
  });

  it('chia thông tin thành Section giống màn Seller', () => {
    renderModal();
    ['Thông số sản phẩm', 'Phản hồi khách hàng', 'Đóng gói', 'Tham khảo', 'So sánh nhà phân phối']
      .forEach(t => expect(screen.getByText(t)).toBeTruthy());
  });

  it('giữ bảng vendor 7 cột và mốc so với target', () => {
    renderModal();
    ['Ảnh', 'Vendor', 'Chất liệu', 'Size', 'T.gian Vendor', 'Folder', 'Giá & So sánh Target']
      .forEach(h => expect(screen.getByRole('columnheader', { name: h })).toBeTruthy());
    expect(screen.getByText('✓ Trong target')).toBeTruthy();
  });

  it('vẫn bấm được nút So sánh Matrix để chuyển view', async () => {
    renderModal();
    const btn = screen.getByRole('button', { name: 'So sánh Matrix' });
    await userEvent.click(btn);
    expect(screen.getByRole('button', { name: 'Xem danh sách' })).toBeTruthy();
  });

  it('báo rỗng khi chưa có vendor nào được gán', () => {
    renderModal({ ...product, assigned_vendors: [] });
    expect(screen.getByText('Chưa có nhà phân phối được gán')).toBeTruthy();
  });
});
