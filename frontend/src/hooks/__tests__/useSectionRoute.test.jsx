// ════════════════════════════════════════════════════════
//  useSectionRoute — mục đang mở của dashboard nằm trên URL
//
//  Bọc bằng MemoryRouter thật (không mock react-router-dom) để kiểm đúng thứ
//  quan trọng: URL nào ra mục nào, và bấm sang mục khác thì URL đi đâu.
// ════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import useSectionRoute from '../useSectionRoute';

const SECTIONS = [
  { id: 'products', slug: 'products', title: 'Danh Sách Sản Phẩm' },
  { id: 'vendors', slug: 'vendors', title: 'Thư Viện Vendor' },
  { id: 'setup_price', slug: 'price-sheets', title: 'Bảng Tính Giá' },
];

function Probe({ sections = SECTIONS, fallback = 'products' }) {
  const [active, setActive] = useSectionRoute({ basePath: '/seller', sections, fallback });
  const { pathname } = useLocation();
  return (
    <>
      <span data-testid="active">{active ?? '(none)'}</span>
      <span data-testid="path">{pathname}</span>
      <button onClick={() => setActive('setup_price')}>Bảng tính giá</button>
    </>
  );
}

const renderAt = (url, props) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/seller/:section?" element={<Probe {...props} />} />
      </Routes>
    </MemoryRouter>,
  );

describe('đọc mục từ URL', () => {
  it('slug hợp lệ → mở đúng mục', async () => {
    renderAt('/seller/price-sheets');

    expect(screen.getByTestId('active')).toHaveTextContent('setup_price');
    expect(screen.getByTestId('path')).toHaveTextContent('/seller/price-sheets');
  });

  it('thiếu mục (/seller) → viết lại URL về mục mặc định', async () => {
    renderAt('/seller');

    expect(await screen.findByText('/seller/products')).toBeInTheDocument();
    expect(screen.getByTestId('active')).toHaveTextContent('products');
  });

  it('slug lạ → về mục mặc định, không hiện mục rỗng', async () => {
    renderAt('/seller/khong-ton-tai');

    expect(await screen.findByText('/seller/products')).toBeInTheDocument();
    expect(screen.getByTestId('active')).toHaveTextContent('products');
  });
});

describe('đổi mục', () => {
  it('setActive đẩy URL sang slug của mục đó', async () => {
    renderAt('/seller/products');
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Bảng tính giá' }));

    expect(screen.getByTestId('path')).toHaveTextContent('/seller/price-sheets');
    expect(screen.getByTestId('active')).toHaveTextContent('setup_price');
  });
});

describe('danh sách mục theo quyền (PD)', () => {
  const allowed = [{ id: 'creative', slug: 'creative', title: 'Creative' }];

  it('slug ngoài danh sách được cấp → rơi về mục đầu tiên hợp lệ', async () => {
    renderAt('/seller/happy', { sections: allowed, fallback: undefined });

    expect(await screen.findByText('/seller/creative')).toBeInTheDocument();
    expect(screen.getByTestId('active')).toHaveTextContent('creative');
  });

  it('không có mục nào → active null, URL để nguyên', () => {
    renderAt('/seller', { sections: [], fallback: undefined });

    expect(screen.getByTestId('active')).toHaveTextContent('(none)');
    expect(screen.getByTestId('path')).toHaveTextContent('/seller');
  });
});
