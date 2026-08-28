import { describe, it, expect, vi, afterEach } from 'vitest';
import { priceSheetPath, priceSheetUrl, copyPriceSheetLink } from '../priceSheetLink';

describe('priceSheetPath / priceSheetUrl', () => {
  it('build đúng path và url tuyệt đối', () => {
    expect(priceSheetPath('sheet_ab12cd')).toBe('/price-sheets/sheet_ab12cd');
    expect(priceSheetUrl('sheet_ab12cd')).toBe(`${window.location.origin}/price-sheets/sheet_ab12cd`);
  });
});

describe('copyPriceSheetLink', () => {
  const originalClipboard = navigator.clipboard;

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', { value: originalClipboard, configurable: true });
    vi.restoreAllMocks();
  });

  it('dùng Clipboard API khi có sẵn', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    const url = await copyPriceSheetLink('sheet_ab12cd');

    expect(writeText).toHaveBeenCalledWith(url);
    expect(url).toContain('/price-sheets/sheet_ab12cd');
  });

  it('rơi xuống textarea + execCommand khi không có Clipboard API', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    document.execCommand = vi.fn().mockReturnValue(true);

    const url = await copyPriceSheetLink('sheet_ab12cd');

    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(url).toContain('/price-sheets/sheet_ab12cd');
  });

  it('Clipboard API ném lỗi thì vẫn rơi xuống fallback, không throw', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    document.execCommand = vi.fn().mockReturnValue(true);

    await expect(copyPriceSheetLink('sheet_ab12cd')).resolves.toContain('/price-sheets/sheet_ab12cd');
    expect(document.execCommand).toHaveBeenCalledWith('copy');
  });
});
