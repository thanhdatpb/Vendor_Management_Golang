// ════════════════════════════════════════════════════════
//  ADMIN — modal "Chi tiết sản phẩm" (mở từ bảng Form Chờ Duyệt / thông báo).
//
//  Deadline do role Vendor đặt (kèm gán vendor) chỉ SAU KHI Admin duyệt request.
//  Test chốt: form chưa duyệt (chờ duyệt / từ chối) không hiện dòng Deadline lẫn
//  badge deadline ở header thẻ "Thông tin sản phẩm"; form đã duyệt thì hiện đủ.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import ProductViewerModal from '../ProductViewerModal';
import { fmtDate } from '../../utils';

const DEADLINE = '2026-08-26T02:00:00.000Z';

const product = (overrides = {}) => ({
  id: 7,
  project: 'Hapify84 Project',
  product_type: 'Comfort Colors Shirt',
  status: 'pending',
  seller_name: 'Nhi Hoang',
  created_at: '2026-09-14T02:00:00.000Z',
  deadline_date: null,
  ...overrides,
});

const renderModal = (p) => render(
  <ProductViewerModal product={p} onClose={vi.fn()} onApprove={vi.fn()} onReject={vi.fn()} />
);

// Header thẻ = div chứa [icon, khối tiêu đề, badge?].
const cardHeader = () => screen.getByText('Thông tin sản phẩm').parentElement.parentElement;

describe('ProductViewerModal — Deadline chỉ có sau khi duyệt', () => {
  it.each(['pending', 'rejected'])('form %s: không có dòng Deadline và badge deadline', (status) => {
    renderModal(product({ status }));

    expect(screen.getByText('Date Request')).toBeInTheDocument();
    expect(screen.queryByText('Deadline')).not.toBeInTheDocument();
    expect(within(cardHeader()).queryByText('—')).not.toBeInTheDocument();
  });

  it('form đã duyệt: hiện dòng Deadline và badge ngày deadline', () => {
    renderModal(product({ status: 'approved', deadline_date: DEADLINE }));

    expect(screen.getByText('Deadline')).toBeInTheDocument();
    expect(within(cardHeader()).getByText(fmtDate(DEADLINE))).toBeInTheDocument();
  });
});
