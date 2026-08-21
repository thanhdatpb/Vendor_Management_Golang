import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MediaThumb } from '../../components/vendor/sections/VendorLibraryViewer';
import { isGoogleDriveUrl, isSizeGuideMediaUrl, normalizeVendorMediaUrl } from '../vendorMedia';

describe('vendor media URLs', () => {
  it('đưa URL storage tuyệt đối cũ về cùng origin', () => {
    expect(normalizeVendorMediaUrl('http://localhost/storage/vendor-library/a.jpg'))
      .toBe('/storage/vendor-library/a.jpg');
    expect(normalizeVendorMediaUrl('https://api.example.com/storage/vendor-library/a.jpg'))
      .toBe('/storage/vendor-library/a.jpg');
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
