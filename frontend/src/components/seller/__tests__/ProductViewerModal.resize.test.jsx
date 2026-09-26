// ════════════════════════════════════════════════════════
//  Modal chi tiết request (Seller): khung "thông tin request" ở nửa trên kéo
//  cao/thấp được và thu gọn được — giống màn Admin/Vendor — để Seller đọc
//  thông tin request trước rồi dồn chỗ cho bảng so sánh nhà phân phối.
// ════════════════════════════════════════════════════════
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductViewerModal from '../ProductViewerModal';
import { PANE_MIN_BOTTOM_PX, PANE_MIN_TOP_PX } from '../../../utils/paneResize';

// Node 22+ có global `localStorage` riêng (chưa bật) che mất bản của jsdom.
const fakeStorage = (initial = {}) => {
  const store = { ...initial };
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  };
};

const PANE_KEY = 'REQUEST_DETAIL_PANE_V1';
const CONTAINER_HEIGHT = 800;
const CONTAINER_TOP = 100;
const pct = (px) => (px / CONTAINER_HEIGHT) * 100;

const desktop = () => { window.matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }); };

beforeAll(desktop);

// jsdom không layout → getBoundingClientRect luôn 0. Giả một khung cao 800px để
// phép kẹp biên (min top/bottom) chạy đúng như trên trình duyệt.
beforeEach(() => {
  desktop();
  vi.stubGlobal('localStorage', fakeStorage());
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    top: CONTAINER_TOP, left: 0, bottom: CONTAINER_TOP + CONTAINER_HEIGHT, right: 1200,
    width: 1200, height: CONTAINER_HEIGHT, x: 0, y: CONTAINER_TOP, toJSON: () => {},
  });
});
afterEach(() => { vi.unstubAllGlobals(); });

const product = {
  id: 7,
  product_type: 'Pet AOP TShirt',
  created_at: '2026-09-16T03:00:00Z',
  total_cost: '10-12',
  material: '100% Polyester',
  print_area: 'AOP',
  assigned_vendors: [
    { id: 1, name: 'Hangzhou PetWear', vendor_type: 'AOP', overview: 'Polyester', size: 'M', eco_total: 10.4 },
  ],
};

const renderModal = () => render(
  <ProductViewerModal product={product} productVendors={{}} onClose={() => {}} getStatus={() => 'approved'} />
);
const getResizer = () => screen.getByRole('separator');

// Nửa trên = khung grid chứa cột ảnh + các Section thông tin request.
const topPaneStyle = () => {
  let el = screen.getByText('Thông số sản phẩm').parentElement;
  while (el && !(el.style?.gridTemplateColumns || '').includes('300px')) el = el.parentElement;
  return el?.style;
};
// CSSOM rút gọn '52.00%' thành '52%' → đọc ra số phần trăm để so sánh.
const topPanePct = () => parseFloat(topPaneStyle().height);

describe('Seller ProductViewerModal — khung thông tin request kéo/thu gọn được', () => {
  it('có thanh chia đọc được bằng bàn phím giữa 2 nửa', () => {
    renderModal();
    const bar = getResizer();
    expect(bar).toHaveAttribute('aria-orientation', 'horizontal');
    expect(bar).toHaveAttribute('tabindex', '0');
    expect(Number(bar.getAttribute('aria-valuenow'))).toBe(52); // mặc định = 52vh như màn Admin/Vendor
  });

  it('nửa trên cao theo tỷ lệ chứ không cuộn chung một mạch với bảng vendor', () => {
    renderModal();
    expect(topPanePct()).toBeCloseTo(52, 5);
    expect(topPaneStyle().maxHeight).toBe('');
  });

  it('kéo thanh chia xuống thì nửa trên cao lên', () => {
    renderModal();
    fireEvent.mouseDown(getResizer(), { button: 0, clientY: CONTAINER_TOP + 416 });
    fireEvent.mouseMove(window, { clientY: CONTAINER_TOP + 560 }); // 560/800 = 70%
    fireEvent.mouseUp(window);

    expect(topPanePct()).toBeCloseTo(70.00, 5);
    expect(Number(getResizer().getAttribute('aria-valuenow'))).toBe(70);
  });

  it('kéo quá tay vẫn chừa chỗ tối thiểu cho bảng vendor', () => {
    renderModal();
    fireEvent.mouseDown(getResizer(), { button: 0, clientY: CONTAINER_TOP + 416 });
    fireEvent.mouseMove(window, { clientY: CONTAINER_TOP + 5000 });
    fireEvent.mouseUp(window);

    expect(topPanePct()).toBeCloseTo(pct(CONTAINER_HEIGHT - PANE_MIN_BOTTOM_PX), 5);
  });

  it('kéo ngược lên hết cỡ vẫn giữ tối thiểu cho thông tin request', () => {
    renderModal();
    fireEvent.mouseDown(getResizer(), { button: 0, clientY: CONTAINER_TOP + 416 });
    fireEvent.mouseMove(window, { clientY: CONTAINER_TOP - 5000 });
    fireEvent.mouseUp(window);

    expect(topPanePct()).toBeCloseTo(pct(PANE_MIN_TOP_PX), 5);
  });

  it('thả chuột rồi thì di chuyển tiếp không làm đổi chiều cao nữa', () => {
    renderModal();
    fireEvent.mouseDown(getResizer(), { button: 0, clientY: CONTAINER_TOP + 416 });
    fireEvent.mouseMove(window, { clientY: CONTAINER_TOP + 480 }); // 60%
    fireEvent.mouseUp(window);
    fireEvent.mouseMove(window, { clientY: CONTAINER_TOP + 700 });

    expect(topPanePct()).toBeCloseTo(60.00, 5);
  });

  it('nút Thu gọn ẩn hẳn nửa trên để dành chỗ cho bảng vendor, bấm lại thì mở ra', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: /Thu gọn/ }));
    expect(topPaneStyle().display).toBe('none');
    expect(screen.getByText('Thông tin request đang thu gọn')).toBeTruthy();
    expect(Number(getResizer().getAttribute('aria-valuenow'))).toBe(0);

    await user.click(screen.getByRole('button', { name: /Mở thông tin/ }));
    expect(topPaneStyle().display).toBe('grid');
    expect(topPanePct()).toBeCloseTo(52.00, 5);
  });

  it('thu gọn rồi vẫn xem được bảng so sánh nhà phân phối', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('button', { name: /Thu gọn/ }));

    expect(screen.getByText('So sánh nhà phân phối')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Giá & So sánh Target' })).toBeTruthy();
    expect(screen.getByText('Hangzhou PetWear')).toBeTruthy();
  });

  it('phím mũi tên / Home / End đổi chiều cao, Enter thu gọn', () => {
    renderModal();
    const bar = getResizer();

    fireEvent.keyDown(bar, { key: 'ArrowDown' });
    expect(topPanePct()).toBeCloseTo(55.00, 5);
    fireEvent.keyDown(bar, { key: 'ArrowUp' });
    expect(topPanePct()).toBeCloseTo(52.00, 5);
    fireEvent.keyDown(bar, { key: 'PageDown' });
    expect(topPanePct()).toBeCloseTo(62.00, 5);

    fireEvent.keyDown(bar, { key: 'Home' });
    expect(topPanePct()).toBeCloseTo(pct(PANE_MIN_TOP_PX), 5);
    fireEvent.keyDown(bar, { key: 'End' });
    expect(topPanePct()).toBeCloseTo(pct(CONTAINER_HEIGHT - PANE_MIN_BOTTOM_PX), 5);

    fireEvent.keyDown(bar, { key: 'Enter' });
    expect(topPaneStyle().display).toBe('none');
  });

  it('nhấp đúp thanh chia để trả về chiều cao mặc định', () => {
    renderModal();
    fireEvent.keyDown(getResizer(), { key: 'PageDown' });
    expect(topPanePct()).toBeCloseTo(62.00, 5);

    fireEvent.doubleClick(getResizer());
    expect(topPanePct()).toBeCloseTo(52.00, 5);
  });

  it('nhớ chiều cao + trạng thái thu gọn cho lần mở sau', async () => {
    const user = userEvent.setup();
    const first = renderModal();
    fireEvent.keyDown(getResizer(), { key: 'PageDown' });
    await user.click(screen.getByRole('button', { name: /Thu gọn/ }));

    const saved = JSON.parse(localStorage.getItem(PANE_KEY));
    expect(saved.collapsed).toBe(true);
    expect(saved.ratio).toBeCloseTo(0.62, 5);

    first.unmount();
    renderModal();
    expect(topPaneStyle().display).toBe('none');
    await user.click(screen.getByRole('button', { name: /Mở thông tin/ }));
    expect(topPanePct()).toBeCloseTo(62.00, 5);
  });

  it('điện thoại (màn hẹp) không có thanh chia — giữ bố cục cuộn dọc như cũ', () => {
    window.matchMedia = () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} });
    renderModal();
    expect(screen.queryByRole('separator')).toBeNull();
  });
});
