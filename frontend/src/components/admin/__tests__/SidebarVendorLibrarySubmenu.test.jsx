// ════════════════════════════════════════════════════════
//  Sidebar Admin — submenu Thư Viện Vendor kèm badge số file
//  (mockups/vendor-library-sidebar-submenu-counts-v2.png)
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sidebar from '../Sidebar';
import { VENDOR_LIBRARY_SUBMENU } from '../../../utils/vendorLibraryNavigation';
import { VENDOR_LIBRARY_MODES } from '../../../utils/vendorLibraryMode';

const noop = () => {};

const renderSidebar = ({ active = 'vendors', sidebarOpen = true, submenu = {}, setActive = noop } = {}) =>
  render(
    <Sidebar
      active={active}
      setActive={setActive}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={noop}
      user={{ role: 'admin', full_name: 'Technical HappyC' }}
      logout={noop}
      submenus={{
        vendors: {
          items: VENDOR_LIBRARY_SUBMENU,
          activeId: VENDOR_LIBRARY_MODES.ALL,
          counts: { [VENDOR_LIBRARY_MODES.NEW_PRODUCTS]: 2, [VENDOR_LIBRARY_MODES.BEST_SELLER]: 8 },
          countsPending: false,
          onSelect: noop,
          ...submenu,
        },
      }}
    />,
  );

const group = () => screen.getByRole('group', { name: 'Thư Viện Vendor' });

describe('submenu Thư Viện Vendor', () => {
  it('đang ở Thư Viện Vendor: mở sẵn ba mục, badge số file của New Arrivals / Best Seller', () => {
    renderSidebar();

    const g = within(group());
    expect(g.getByRole('button', { name: /Tổng quan Vendor & Sản phẩm/ })).toHaveAttribute('aria-current', 'page');
    expect(g.getByLabelText('New Arrivals: 2 file')).toHaveTextContent('2');
    expect(g.getByLabelText('Best Seller: 8 file')).toHaveTextContent('8');
    // Tổng quan không có badge
    expect(g.queryByLabelText(/Tổng quan Vendor & Sản phẩm:/)).not.toBeInTheDocument();
  });

  it('bấm mục con gọi onSelect với đúng chế độ', async () => {
    const onSelect = vi.fn();
    renderSidebar({ submenu: { onSelect } });

    await userEvent.click(within(group()).getByRole('button', { name: /Best Seller/ }));
    expect(onSelect).toHaveBeenCalledWith(VENDOR_LIBRARY_MODES.BEST_SELLER);
  });

  it('mục đang chọn theo activeId', () => {
    renderSidebar({ submenu: { activeId: VENDOR_LIBRARY_MODES.NEW_PRODUCTS } });

    const g = within(group());
    expect(g.getByRole('button', { name: /New Arrivals/ })).toHaveAttribute('aria-current', 'page');
    expect(g.getByRole('button', { name: /Tổng quan Vendor & Sản phẩm/ })).not.toHaveAttribute('aria-current');
  });

  it('đang tải lần đầu thì badge hiện "…", chưa có số và không tải thì ẩn badge', () => {
    const { unmount } = renderSidebar({ submenu: { counts: null, countsPending: true } });
    expect(within(group()).getByLabelText('New Arrivals: … file')).toBeInTheDocument();
    unmount();

    renderSidebar({ submenu: { counts: null, countsPending: false } });
    expect(within(group()).queryByLabelText(/New Arrivals:/)).not.toBeInTheDocument();
  });

  it('mũi tên thu gọn/mở rộng submenu mà không điều hướng', async () => {
    const setActive = vi.fn();
    renderSidebar({ setActive });

    await userEvent.click(screen.getByRole('button', { name: 'Thu gọn Thư Viện Vendor' }));
    expect(screen.queryByRole('group', { name: 'Thư Viện Vendor' })).not.toBeInTheDocument();
    expect(setActive).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Mở rộng Thư Viện Vendor' }));
    expect(group()).toBeInTheDocument();
  });

  it('ở mục khác thì submenu đóng sẵn; bấm dòng cha thì điều hướng', async () => {
    const setActive = vi.fn();
    renderSidebar({ active: 'overview', setActive });

    expect(screen.queryByRole('group', { name: 'Thư Viện Vendor' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByText('Thư Viện Vendor'));
    expect(setActive).toHaveBeenCalledWith('vendors');
  });

  it('sidebar thu gọn chỉ còn icon, không có submenu', () => {
    renderSidebar({ sidebarOpen: false });
    expect(screen.queryByRole('group', { name: 'Thư Viện Vendor' })).not.toBeInTheDocument();
  });
});
