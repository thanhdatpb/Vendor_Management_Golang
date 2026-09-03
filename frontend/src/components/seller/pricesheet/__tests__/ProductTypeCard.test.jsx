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

describe('Dải thông tin phôi trên đầu card — đúng một dòng của bảng Thư viện Vendor', () => {
  const libEntry = {
    vendor: 'VN3', sizes: [],
    chatLieu: 'Giấy ảnh 200gsm', chiTietSize: '8x12" - 24x36"',
    image: 'https://cdn.example/poster.jpg',
    images: ['https://cdn.example/poster.jpg', 'https://cdn.example/poster-2.jpg'],
    avgTimeVendor: '3-5 ngày', avgTimeActual: '4 ngày',
  };

  it('libEntry đủ field → hiện đủ nhãn cột và giá trị, AVG TG là CHỮ chứ không còn nằm trong tooltip', () => {
    const pt = { id: 'pt1', name: 'Poster', vendorCode: 'VN3', sizes: [], customizeInfos: [] };
    render(<ProductTypeCard {...baseProps} pt={pt} libEntry={libEntry} />);

    expect(screen.getByText('Chất liệu')).toBeInTheDocument();
    expect(screen.getByText('Chi tiết Size')).toBeInTheDocument();
    expect(screen.getByText('AVG TG (Vendor)')).toBeInTheDocument();
    expect(screen.getByText('AVG TG (Thực tế)')).toBeInTheDocument();

    expect(screen.getByText(/Giấy ảnh 200gsm/)).toBeInTheDocument();
    expect(screen.getByText(/8x12" - 24x36"/)).toBeInTheDocument();
    expect(screen.getByText('3-5 ngày')).toBeInTheDocument();
    expect(screen.getByText('4 ngày')).toBeInTheDocument();
  });

  it('nhiều ảnh → render đủ thumbnail (không chỉ ảnh đầu tiên như cụm chip cũ)', () => {
    const pt = { id: 'pt1', name: 'Poster', vendorCode: 'VN3', sizes: [], customizeInfos: [] };
    const { container } = render(<ProductTypeCard {...baseProps} pt={pt} libEntry={libEntry} />);

    // MediaThumb (dùng chung với Thư viện Vendor) render <img alt=""> — ảnh
    // trang trí, role "presentation" chứ không phải "img" — nên hỏi thẳng DOM.
    const srcs = [...container.querySelectorAll('img')].map((i) => i.getAttribute('src'));
    expect(srcs).toEqual([
      'https://cdn.example/poster.jpg',
      'https://cdn.example/poster-2.jpg',
    ]);
  });

  it('index bản cũ chỉ có `image` (backend chưa deploy) → vẫn hiện ảnh đại diện', () => {
    const pt = { id: 'pt1', name: 'Poster', vendorCode: 'VN3', sizes: [], customizeInfos: [] };
    const { container } = render(<ProductTypeCard {...baseProps} pt={pt}
      libEntry={{ vendor: 'VN3', sizes: [], image: 'https://cdn.example/poster.jpg' }} />);

    const srcs = [...container.querySelectorAll('img')].map((i) => i.getAttribute('src'));
    expect(srcs).toEqual(['https://cdn.example/poster.jpg']);
  });

  it('libEntry không có info phôi nào → vẫn có dải (vendor + tên phôi), ô trống hiện dấu gạch', () => {
    const pt = { id: 'pt1', name: 'Football Jersey', vendorCode: 'VN7', sizes: [], customizeInfos: [] };
    const { container } = render(<ProductTypeCard {...baseProps} pt={pt} libEntry={{ vendor: 'VN7', sizes: [] }} />);
    expect(container.querySelectorAll('img')).toHaveLength(0);

    expect(screen.getByText('Vendor Name')).toBeInTheDocument();
    expect(screen.getByText('Không có ảnh')).toBeInTheDocument();
  });

  it('Product Type nhập tay (không có libEntry) → KHÔNG render dải', () => {
    const pt = { id: 'pt1', name: 'Phôi tự nhập', sizes: [], customizeInfos: [] };
    const { container } = render(<ProductTypeCard {...baseProps} pt={pt} libEntry={null} />);

    expect(screen.queryByText('Vendor Name')).not.toBeInTheDocument();
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });
});

describe('Badge "So sánh" khi nhiều block cùng tên phôi (vấn đề #3, mindmap 2026-08-28)', () => {
  it('compareCount > 1 → hiện badge "So sánh · N"', () => {
    const pt = { id: 'pt1', name: 'Poster', vendorCode: 'VN3', sizes: [], customizeInfos: [] };
    render(<ProductTypeCard {...baseProps} pt={pt} libEntry={null} compareCount={2} />);

    expect(screen.getByText(/So sánh · 2/)).toBeInTheDocument();
  });

  it('compareCount = 1 (không trùng ai) → KHÔNG hiện badge', () => {
    const pt = { id: 'pt1', name: 'Poster', vendorCode: 'VN3', sizes: [], customizeInfos: [] };
    render(<ProductTypeCard {...baseProps} pt={pt} libEntry={null} compareCount={1} />);

    expect(screen.queryByText(/So sánh/)).not.toBeInTheDocument();
  });

  it('không truyền compareCount (mặc định 0) → không hiện badge, không crash', () => {
    const pt = { id: 'pt1', name: 'Poster', vendorCode: 'VN3', sizes: [], customizeInfos: [] };
    render(<ProductTypeCard {...baseProps} pt={pt} libEntry={null} />);

    expect(screen.queryByText(/So sánh/)).not.toBeInTheDocument();
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
