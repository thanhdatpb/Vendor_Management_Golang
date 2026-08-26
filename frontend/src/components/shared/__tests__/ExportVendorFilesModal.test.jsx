// ════════════════════════════════════════════════════════
//  ExportVendorFilesModal — chọn file Vendor cần export.
//  Test hành vi: liệt kê file, tìm kiếm lọc đúng, Chọn tất cả, và Export
//  chỉ gọi onConfirm với ĐÚNG danh sách id đã tick — không export nhầm file
//  chưa chọn.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExportVendorFilesModal from '../ExportVendorFilesModal';

const HC = {
  orange: '#F5A623', orangeDark: '#E09415', orangeLight: '#FEF3DC', orangeMid: '#FDE8B8',
  orangePale: '#FFFBF4', ink: '#1A0F00', ink2: '#3D2B0F', muted: '#B8956A', muted2: '#D4B896',
  surface: '#FFFFFF', surface2: '#FFFDF9', border: '#F0E4CC', borderStrong: '#E8D4A8',
  brown: '#7A5C32', shadowStrong: '0 20px 50px rgba(245,166,35,0.14)',
};

const files = [
  { id: 'f1', filename: 'Coir Doormat', title: 'COIR DOORMAT', generalInfo: [{}], pricing: [{}, {}] },
  { id: 'f2', filename: 'HC_Croptop_P.Happy', title: 'GENERAL CROPTOP', generalInfo: [{}, {}, {}], pricing: [{}] },
];

describe('ExportVendorFilesModal', () => {
  it('liệt kê đủ file, Export vô hiệu khi chưa chọn gì', () => {
    render(<ExportVendorFilesModal HC={HC} files={files} onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Coir Doormat')).toBeInTheDocument();
    expect(screen.getByText('HC_Croptop_P.Happy')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export \(0\)/i })).toBeDisabled();
  });

  it('tìm kiếm lọc đúng theo tên file', async () => {
    const user = userEvent.setup();
    render(<ExportVendorFilesModal HC={HC} files={files} onConfirm={vi.fn()} onClose={vi.fn()} />);
    await user.type(screen.getByPlaceholderText(/tìm theo tên file/i), 'croptop');
    expect(screen.queryByText('Coir Doormat')).not.toBeInTheDocument();
    expect(screen.getByText('HC_Croptop_P.Happy')).toBeInTheDocument();
  });

  it('tick đúng 1 file rồi Export → onConfirm chỉ nhận đúng id đó', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ExportVendorFilesModal HC={HC} files={files} onConfirm={onConfirm} onClose={vi.fn()} />);

    const row = screen.getByText('Coir Doormat').closest('label');
    await user.click(row.querySelector('input[type="checkbox"]'));

    const exportBtn = screen.getByRole('button', { name: /export \(1\)/i });
    expect(exportBtn).toBeEnabled();
    await user.click(exportBtn);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(['f1']);
  });

  it('Chọn tất cả → Export nhận đủ mọi id đang hiển thị', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ExportVendorFilesModal HC={HC} files={files} onConfirm={onConfirm} onClose={vi.fn()} />);

    await user.click(screen.getByLabelText(/chọn tất cả/i));
    await user.click(screen.getByRole('button', { name: /export \(2\)/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const arg = onConfirm.mock.calls[0][0];
    expect(new Set(arg)).toEqual(new Set(['f1', 'f2']));
  });

  it('bấm nút Huỷ thì đóng modal, không gọi onConfirm', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(<ExportVendorFilesModal HC={HC} files={files} onConfirm={onConfirm} onClose={onClose} />);

    await user.click(screen.getByText('Huỷ'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
