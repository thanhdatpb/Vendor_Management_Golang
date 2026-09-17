import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProvideVendorsDrawer from './ProvideVendorsDrawer';
import { productApi, vendorLibraryApi } from '../../../../services/api';

vi.mock('../../../../services/api', () => ({
  productApi: {
    getById: vi.fn(),
    assignVendors: vi.fn(),
  },
  vendorLibraryApi: {
    listFiles: vi.fn(),
    getFile: vi.fn(),
    getFileByName: vi.fn(),
  },
}));

const file = {
  id: 'file_wood',
  filename: 'HC_Wooden Ornament',
  importedAt: '2026-09-17T04:00:00.000Z',
  generalInfo: [
    { id: 'g_cn1', kyHieu: 'CN1', vendorName: 'CN1', productType: 'Wooden Ornament', chatLieu: 'Wood' },
  ],
  pricing: [
    { kyHieu: 'CN1', productType: 'Wooden Ornament', size: '3in', eco_total: 4.85 },
  ],
};

const product = {
  id: 12,
  product_type: 'Wooden Ornament',
  total_cost: '5-6',
  assigned_vendors: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vendorLibraryApi.listFiles.mockResolvedValue({ data: [{
    id: file.id,
    filename: file.filename,
    importedAt: file.importedAt,
    productTypes: ['Wooden Ornament'],
    vendors: ['CN1'],
    counts: { generalInfo: 1, pricing: 1 },
  }] });
  vendorLibraryApi.getFile.mockResolvedValue({ data: file });
  productApi.assignVendors.mockResolvedValue({ data: { success: true } });
});

describe('ProvideVendorsDrawer', () => {
  it('tìm file, chọn sẵn phôi và giữ vendor do máy khác vừa cung cấp trước khi lưu', async () => {
    const concurrent = { id: 99, name: 'Vendor đang có', vendor_type: 'Other' };
    productApi.getById.mockResolvedValue({ data: { ...product, assigned_vendors: [concurrent] } });
    const onProvided = vi.fn();
    const user = userEvent.setup();

    render(
      <ProvideVendorsDrawer
        product={product}
        requesterName="Seller A"
        onClose={vi.fn()}
        onProvided={onProvided}
      />,
    );

    await screen.findByText('HC_Wooden Ornament');
    await user.click(screen.getByRole('button', { name: '+ Thêm' }));
    await screen.findByRole('checkbox', { name: 'Chọn CN1' });

    await user.click(screen.getByRole('button', { name: 'Cung cấp 1 vendor cho Seller' }));

    await waitFor(() => expect(productApi.assignVendors).toHaveBeenCalledTimes(1));
    const [, saved] = productApi.assignVendors.mock.calls[0];
    expect(saved).toEqual(expect.arrayContaining([
      concurrent,
      expect.objectContaining({
        name: 'CN1',
        excel_row_id: 'g_cn1',
        source_file_id: 'file_wood',
        eco_total: 4.85,
      }),
    ]));
    expect(onProvided).toHaveBeenCalledWith(expect.objectContaining({ added: 1, removed: 0, refreshed: 0 }));
  });
});
