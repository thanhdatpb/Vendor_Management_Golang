// ════════════════════════════════════════════════════════
//  Dòng "Online · <giờ>" đã BỎ khỏi thẻ tài khoản ở sidebar của MỌI role.
//
//  Dòng này hiển thị mốc thao tác gần nhất đọc từ localStorage `LAST_ACTIVE_*`.
//  Bỏ khỏi UI thì phần state/effect nuôi nó cũng phải đi theo — nếu còn, mỗi
//  cú click vẫn ghi localStorage và setState cho một thứ không ai nhìn thấy.
//
//  Test ở tầng render của TỪNG sidebar: khai báo có gỡ mà quên gỡ khỏi JSX
//  (hoặc ngược lại) thì người dùng vẫn thấy dòng đó.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Sidebar from '../admin/Sidebar';
import SellerSidebar from '../seller/SellerSidebar';
import CsfPdSidebar from '../csfpd/CsfPdSidebar';

// jsdom không có matchMedia; SellerSidebar dùng useIsMobile() nên cần bản giả.
beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false, addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {},
  });
});

vi.mock('../../services/api', () => ({
  notificationApi: { list: vi.fn().mockResolvedValue({ data: [] }) },
  default: { get: vi.fn(), post: vi.fn() },
}));

const noop = () => {};

const commonProps = (role) => ({
  active: 'overview',
  setActive: noop,
  sidebarOpen: true,
  setSidebarOpen: noop,
  user: { role, full_name: 'Nguoi Dung', name: 'Nguoi Dung', project: 'Happy Project' },
  logout: noop,
});

afterEach(() => { vi.unstubAllGlobals(); });

describe('dòng "Online ·" đã bỏ khỏi sidebar mọi role', () => {
  it('Admin sidebar không còn dòng Online', () => {
    render(<Sidebar {...commonProps('admin')} />);

    // Thẻ tài khoản vẫn dựng bình thường...
    expect(screen.getByText('Nguoi Dung')).toBeInTheDocument();
    expect(screen.getByText('Administrator')).toBeInTheDocument();
    // ...nhưng không còn dòng trạng thái Online.
    expect(screen.queryByText(/^Online ·/)).not.toBeInTheDocument();
  });

  it('Seller sidebar không còn dòng Online', () => {
    render(<SellerSidebar {...commonProps('seller')} />);

    expect(screen.getByText('Happy Project')).toBeInTheDocument();
    expect(screen.queryByText(/^Online ·/)).not.toBeInTheDocument();
  });

  it.each(['csf', 'pd', 'marvel'])('%s sidebar không còn dòng Online', (role) => {
    render(
      <CsfPdSidebar
        {...commonProps(role)}
        menu={[{ id: 'happy', icon: null, label: 'Happy Project' }]}
        roleLabel={role.toUpperCase()}
        displayName="Nguoi Dung"
      />
    );

    expect(screen.getByText('Nguoi Dung')).toBeInTheDocument();
    expect(screen.queryByText(/^Online ·/)).not.toBeInTheDocument();
  });

  /**
   * Gỡ dòng hiển thị thì cũng không được ghi localStorage `LAST_ACTIVE_*` nữa
   * — state/effect nuôi nó phải đi theo, không để lại việc chạy ngầm vô nghĩa.
   */
  it('không còn ghi localStorage LAST_ACTIVE_* khi click', async () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', {
      getItem: () => null, setItem, removeItem: noop, clear: noop,
    });

    render(<Sidebar {...commonProps('admin')} />);
    window.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const lastActiveWrites = setItem.mock.calls.filter(([k]) => String(k).startsWith('LAST_ACTIVE_'));
    expect(lastActiveWrites).toHaveLength(0);
  });
});
