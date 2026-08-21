// ════════════════════════════════════════════════════════
//  MỤC 03/05 — AddProductTypeModal liệt kê theo RECORD (mỗi vendor 1 dòng),
//  không còn gộp theo tên và không còn chặn thêm trùng.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddProductTypeModal from '../AddProductTypeModal';

// libIndex tối giản, đã qua indexFromFiles/indexFromRecords — hai record cùng
// tên phôi khác vendor, đúng hình dạng listLibraryRecords cần.
const libIndex = {
  'football jersey': {
    productType: 'Football Jersey', vendor: 'VN3', filename: 'file_happy', sizes: ['S', 'M'], bySize: {},
    records: [
      { recordKey: 'k1', productType: 'Football Jersey', vendorCode: 'VN3', filename: 'file_happy', sizes: ['S', 'M'], bySize: {} },
      { recordKey: 'k2', productType: 'Football Jersey', vendorCode: 'VN7', filename: 'file_happy', sizes: ['S', 'M', 'L'], bySize: {} },
    ],
  },
  'ceramic mug': {
    productType: 'Ceramic Mug', vendor: 'VN3', filename: 'file_happy', sizes: ['11oz'], bySize: {},
    records: [
      { recordKey: 'k3', productType: 'Ceramic Mug', vendorCode: 'VN3', filename: 'file_happy', sizes: ['11oz'], bySize: {} },
    ],
  },
};

const setup = (props = {}) => {
  const onPick = vi.fn();
  const onManual = vi.fn();
  const onClose = vi.fn();
  render(<AddProductTypeModal libIndex={libIndex} onPick={onPick} onManual={onManual} onClose={onClose} {...props} />);
  return { onPick, onManual, onClose };
};

describe('Liệt kê theo record — không gộp theo tên', () => {
  it('2 vendor cùng tên phôi hiện thành 2 dòng riêng', () => {
    setup();
    const list = within(screen.getByTestId('ptm-list'));
    // "Football Jersey" xuất hiện 2 lần (1 dòng cho mỗi vendor)
    const jerseyRows = list.getAllByRole('button').filter((b) => b.textContent.includes('Football Jersey'));
    expect(jerseyRows).toHaveLength(2);
    expect(jerseyRows.some((r) => r.textContent.includes('VN3'))).toBe(true);
    expect(jerseyRows.some((r) => r.textContent.includes('VN7'))).toBe(true);
  });

  it('mỗi dòng hiện đúng số size của RIÊNG vendor đó, không lẫn', () => {
    setup();
    const rows = screen.getAllByRole('button').filter((b) => b.textContent.includes('Football Jersey'));
    expect(rows.find((r) => r.textContent.includes('VN3'))).toHaveTextContent('2 size');
    expect(rows.find((r) => r.textContent.includes('VN7'))).toHaveTextContent('3 size');
  });

  it('chọn 1 dòng gọi onPick với ĐÚNG record (recordKey, vendorCode) chứ không chỉ tên', async () => {
    const user = userEvent.setup();
    const { onPick } = setup();
    const rows = screen.getAllByRole('button').filter((b) => b.textContent.includes('Football Jersey'));
    await user.click(rows.find((r) => r.textContent.includes('VN7')));

    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ recordKey: 'k2', vendorCode: 'VN7' }));
  });
});

describe('Bỏ chặn thêm trùng (mục 03)', () => {
  it('không có prop existingKeys thì cả 2 vendor vẫn hiện đủ — trước đây bị lọc theo tên', () => {
    // Không truyền existingKeys nữa (đã bỏ khỏi component) — component vẫn
    // chạy bình thường, không throw vì prop thiếu.
    setup();
    expect(screen.getAllByText('Football Jersey')).toHaveLength(2);
  });
});

describe('Bộ lọc theo vendor (mục 05)', () => {
  it('có ≥2 vendor thì hiện chip lọc; gõ đúng 1 vendor thì chỉ hiện dòng đó', async () => {
    const user = userEvent.setup();
    setup();

    const group = screen.getByRole('group', { name: 'Lọc theo vendor' });
    await user.click(within(group).getByRole('button', { name: 'VN7' }));

    const list = within(screen.getByTestId('ptm-list'));
    expect(list.getAllByText('Football Jersey')).toHaveLength(1);
    expect(list.getByText('VN7')).toBeInTheDocument();
    expect(list.queryByText('VN3')).not.toBeInTheDocument();
  });

  it('"Tất cả vendor" trả lại đủ danh sách', async () => {
    const user = userEvent.setup();
    setup();
    const group = screen.getByRole('group', { name: 'Lọc theo vendor' });

    await user.click(within(group).getByRole('button', { name: 'VN7' }));
    await user.click(within(group).getByRole('button', { name: 'Tất cả vendor' }));

    expect(within(screen.getByTestId('ptm-list')).getAllByText('Football Jersey')).toHaveLength(2);
  });

  it('chỉ 1 vendor duy nhất trong toàn thư viện thì KHÔNG hiện chip lọc (thừa)', () => {
    const singleVendorIndex = {
      'ceramic mug': libIndex['ceramic mug'],
    };
    setup({ libIndex: singleVendorIndex });
    expect(screen.queryByRole('group', { name: 'Lọc theo vendor' })).not.toBeInTheDocument();
  });
});

describe('Tìm kiếm theo tên hoặc vendor', () => {
  it('gõ tên vendor lọc đúng record của vendor đó', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText('Tìm product type'), 'VN7');

    expect(screen.getAllByText('Football Jersey')).toHaveLength(1);
    expect(screen.queryByText('Ceramic Mug')).not.toBeInTheDocument();
  });
});

describe('Trạng thái rỗng / đang tải', () => {
  it('libIndex null → hiện "Đang tải thư viện…"', () => {
    setup({ libIndex: null });
    expect(screen.getByText('Đang tải thư viện…')).toBeInTheDocument();
  });

  it('thư viện trống → gợi ý "Nhập thủ công"', () => {
    setup({ libIndex: {} });
    expect(screen.getByText(/chưa có Product Type nào/)).toBeInTheDocument();
  });

  it('tìm không ra kết quả → thông báo không tìm thấy (khác thông báo thư viện trống)', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText('Tìm product type'), 'khong-ton-tai-xyz');
    expect(screen.getByText('Không tìm thấy Product Type khớp.')).toBeInTheDocument();
  });
});

describe('Nút Nhập thủ công / Huỷ vẫn hoạt động', () => {
  it('bấm Nhập thủ công gọi onManual', async () => {
    const user = userEvent.setup();
    const { onManual } = setup();
    await user.click(screen.getByRole('button', { name: /Nhập thủ công/ }));
    expect(onManual).toHaveBeenCalled();
  });

  it('bấm Huỷ gọi onClose', async () => {
    const user = userEvent.setup();
    const { onClose } = setup();
    await user.click(screen.getByRole('button', { name: 'Huỷ' }));
    expect(onClose).toHaveBeenCalled();
  });
});
