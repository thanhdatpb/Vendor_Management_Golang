// ════════════════════════════════════════════════════════
//  MỤC 03/04 — badge Vendor và cảnh báo "record nguồn không còn" trên
//  Product Type Card. Đây là chỗ Seller nhìn thấy đang gõ giá cho vendor nào
//  khi có nhiều block cùng tên phôi.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProductTypeCard from '../ProductTypeCard';

const settings = { price: 10, quantity: 1, shipPerOrder: 0, shipPerItem: 0, couponUsd: 0, couponPct: 0, variableFeePct: 0, amzFeePct: 17, importTax: 0 };
const noop = vi.fn();
const baseProps = {
  settings,
  onPT: noop, onRemovePT: noop, onAddSize: noop, onUpdateSize: noop, onRemoveSize: noop,
  onUpdateCustomize: noop, onAddCustomize: noop, onRenameCustomize: noop, onRemoveCustomize: noop,
};

describe('Badge mã vendor (mục 03/04)', () => {
  it('PT gắn libRef, resolveSheet đã gán pt.vendorCode → badge hiện đúng vendor', () => {
    const pt = { id: 'pt1', name: 'Football Jersey', vendorCode: 'VN7', sizes: [], customizeInfos: [] };
    render(<ProductTypeCard {...baseProps} pt={pt} libEntry={{ vendor: 'VN7', sizes: [] }} />);

    expect(screen.getByText(/Từ thư viện vendor · VN7 · 0 size/)).toBeInTheDocument();
  });

  it('bảng CŨ chưa có pt.vendorCode → rơi về libEntry.vendor (đường lùi)', () => {
    const pt = { id: 'pt1', name: 'Football Jersey', sizes: [], customizeInfos: [] };
    render(<ProductTypeCard {...baseProps} pt={pt} libEntry={{ vendor: 'VN3', sizes: [] }} />);

    expect(screen.getByText(/Từ thư viện vendor · VN3 · 0 size/)).toBeInTheDocument();
  });

  it('Product Type nhập tay (không có libEntry) → không hiện mã vendor nào', () => {
    const pt = { id: 'pt1', name: 'Phôi tự nhập', sizes: [], customizeInfos: [] };
    render(<ProductTypeCard {...baseProps} pt={pt} libEntry={null} />);

    expect(screen.getByText('Nhập thủ công · 0 size')).toBeInTheDocument();
  });
});

describe('Cảnh báo record nguồn không còn (mục 03)', () => {
  it('pt.warning === "record-missing" → hiện badge cảnh báo', () => {
    const pt = { id: 'pt1', name: 'Football Jersey', vendorCode: 'VN9', warning: 'record-missing', sizes: [], customizeInfos: [] };
    render(<ProductTypeCard {...baseProps} pt={pt} libEntry={null} />);

    expect(screen.getByText(/Record nguồn không còn/)).toBeInTheDocument();
  });

  it('record vẫn còn (không có warning) → KHÔNG hiện badge cảnh báo', () => {
    const pt = { id: 'pt1', name: 'Football Jersey', vendorCode: 'VN7', sizes: [], customizeInfos: [] };
    render(<ProductTypeCard {...baseProps} pt={pt} libEntry={{ vendor: 'VN7', sizes: [] }} />);

    expect(screen.queryByText(/Record nguồn không còn/)).not.toBeInTheDocument();
  });
});
