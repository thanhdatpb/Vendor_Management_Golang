import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MediaThumb } from '../../components/vendor/sections/VendorLibraryViewer';
import { isGoogleDriveUrl, isSizeGuideMediaUrl, normalizeVendorMediaUrl } from '../vendorMedia';

describe('vendor media URLs', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('đưa URL vendor-library cũ về endpoint ảnh có xác thực', () => {
    expect(normalizeVendorMediaUrl('http://localhost/storage/vendor-library/a.jpg'))
      .toBe('/api/vendor-library/images/a.jpg');
    expect(normalizeVendorMediaUrl('https://api.example.com/storage/vendor-library/a.jpg'))
      .toBe('/api/vendor-library/images/a.jpg');
  });

  it('tải ảnh nội bộ bằng token đăng nhập', async () => {
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => 'secret-token') });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['image']),
    });
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:vendor-image'),
      revokeObjectURL: vi.fn(),
    });

    render(React.createElement(MediaThumb, {
      url: 'http://localhost/storage/vendor-library/a.jpg',
    }));

    await waitFor(() => expect(document.querySelector('img')).toHaveAttribute('src', 'blob:vendor-image'));
    expect(fetchMock).toHaveBeenCalledWith('/api/vendor-library/images/a.jpg', expect.objectContaining({
      headers: { Authorization: 'Bearer secret-token' },
    }));
  });
  it('giữ nguyên URL ngoài storage', () => {
    expect(normalizeVendorMediaUrl('https://cdn.example.com/a.jpg'))
      .toBe('https://cdn.example.com/a.jpg');
  });

  it('hiển thị logo Drive thay vì thẻ ảnh bị vỡ', () => {
    render(React.createElement(MediaThumb, {
      url: 'https://drive.google.com/file/d/abc/view?usp=drive_link',
    }));

    expect(screen.getByLabelText('Google Drive')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('nhận diện link Google Drive là media của Chi tiết Size', () => {
    const drive = 'https://drive.google.com/file/d/abc/view?usp=drive_link';
    expect(isGoogleDriveUrl(drive)).toBe(true);
    expect(isSizeGuideMediaUrl(drive)).toBe(true);
    expect(isSizeGuideMediaUrl('https://cdn.example.com/chart.PNG?download=1')).toBe(true);
    expect(isSizeGuideMediaUrl('size chart.png')).toBe(false);
  });
});
