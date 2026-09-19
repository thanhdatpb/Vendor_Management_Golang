// ════════════════════════════════════════════════════════
//  Modal chi tiết request (Seller) sau khi redesign theo form Admin:
//  header là Product Type, thông tin chia Section, bảng so sánh vendor
//  vẫn giữ nguyên cột + mốc so target.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProductViewerModal from '../ProductViewerModal';

vi.mock('../../../hooks/useIsMobile', () => ({ default: () => false }));

const product = {
  id: 7,
  product_type: 'Pet AOP TShirt',
  project: 'Happy84 Project',
  seller_name: 'Nhi Hoang',
  created_at: '2026-09-16T03:00:00Z',
  deadline_date: '2026-09-22T03:00:00Z',
  total_cost: '10-12',
  production_time: '2-4',
  shipping_time: '4-6',
  material: '100% Polyester',
  print_area: 'AOP',
  other_specs: 'Giặt máy♦Size XS–5XL',
  good_review: 'Vải authentic',
  bad_review: 'Form hơi rộng',
  packaging_links: 'Không',
  other_packaging: 'Không',
  product_type_links: ['https://i.etsystatic.com/a.jpg'],
  product_video_links: ['https://drive.google.com/file/d/abc/view'],
  assigned_vendors: [
    { id: 1, name: 'Hangzhou PetWear', vendor_type: 'AOP', overview: 'Polyester', size: 'M', eco_total: 10.4, link_folder: 'https://drive.google.com/x' },
    { id: 2, name: 'Yiwu PawPrint', vendor_type: 'AOP', overview: 'Spandex', size: 'L', eco_total: 13.2 },
  ],
};

const renderModal = (p = product) => render(
  <ProductViewerModal product={p} productVendors={{}} onClose={() => {}} getStatus={() => 'approved'} />
);

describe('Seller ProductViewerModal — redesign', () => {
  it('lấy Product Type làm tiêu đề và gom meta trên header', () => {
    renderModal();
    expect(screen.getByRole('heading', { name: /Pet AOP TShirt/ })).toBeTruthy();
    expect(screen.getByText('Happy84 Project')).toBeTruthy();
    expect(screen.getByText('Nhi Hoang')).toBeTruthy();
    expect(screen.getByText('Deadline')).toBeTruthy();
  });

  it('chia thông tin thành Section và tách đặc tính kỹ thuật thành danh sách', () => {
    renderModal();
    ['Thông số sản phẩm', 'Phản hồi khách hàng', 'Đóng gói', 'Tham khảo', 'So sánh nhà phân phối']
      .forEach(t => expect(screen.getByText(t)).toBeTruthy());
    expect(screen.getByText('Giặt máy')).toBeTruthy();
    expect(screen.getByText('Size XS–5XL')).toBeTruthy();
  });

  it('giữ bảng vendor 7 cột và mốc so với target', () => {
    renderModal();
    ['Ảnh', 'Vendor', 'Chất liệu', 'Size', 'T.gian Vendor', 'Folder', 'Giá & So sánh Target']
      .forEach(h => expect(screen.getByRole('columnheader', { name: h })).toBeTruthy());
    expect(screen.getByText('✓ Trong target')).toBeTruthy();
    expect(screen.getByText('Vượt target')).toBeTruthy();
  });

  it('báo rỗng khi chưa có vendor nào được gán', () => {
    renderModal({ ...product, assigned_vendors: [] });
    expect(screen.getByText('Chưa có nhà phân phối được gán')).toBeTruthy();
  });
});
