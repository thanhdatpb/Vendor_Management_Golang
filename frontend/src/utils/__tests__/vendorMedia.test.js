import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MediaThumb } from '../../components/vendor/sections/VendorLibraryViewer';
import api from '../../services/api';
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

  it('tải ảnh nội bộ qua API client có interceptor xác thực', async () => {
    const imageBlob = new Blob(['image']);
    const apiMock = vi.spyOn(api, 'get').mockResolvedValue({ data: imageBlob });
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:vendor-image'),
      revokeObjectURL: vi.fn(),
    });

    render(React.createElement(MediaThumb, {
      url: 'http://localhost/storage/vendor-library/a.jpg',
    }));

    await waitFor(() => expect(document.querySelector('img')).toHaveAttribute('src', 'blob:vendor-image'));
    expect(apiMock).toHaveBeenCalledWith('/vendor-library/images/a.jpg', expect.objectContaining({
      responseType: 'blob',
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

  it('bấm ảnh link ngoài mở lightbox tại chỗ, không bọc thẻ <a> điều hướng ra ngoài', () => {
    // Một số CDN ngoài trả Content-Disposition: attachment cho link ảnh dán
    // trong Excel — nếu còn bọc <a href target=_blank>, bấm vào sẽ bị tải
    // file xuống thay vì xem ngay. Ảnh phải render qua <img> (mở lightbox khi
    // bấm), không được điều hướng thẳng tới link CDN gốc.
    render(React.createElement(MediaThumb, {
      url: 'https://cdn.example.com/anh-tham-khao.png',
    }));

    expect(document.querySelector('a')).toBeNull();

    fireEvent.click(document.querySelector('img'));

    expect(document.querySelectorAll('img')).toHaveLength(2);
  });

  it('nhận diện link Google Drive là media của Chi tiết Size', () => {
    const drive = 'https://drive.google.com/file/d/abc/view?usp=drive_link';
    expect(isGoogleDriveUrl(drive)).toBe(true);
    expect(isSizeGuideMediaUrl(drive)).toBe(true);
    expect(isSizeGuideMediaUrl('https://cdn.example.com/chart.PNG?download=1')).toBe(true);
    expect(isSizeGuideMediaUrl('size chart.png')).toBe(false);
  });
});
