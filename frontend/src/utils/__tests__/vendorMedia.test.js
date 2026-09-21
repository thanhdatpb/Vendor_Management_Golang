import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MediaThumb } from '../../components/vendor/sections/VendorLibraryViewer';
import { MergedInfoTable } from '../../components/csfpd/VendorLibraryView';
import api from '../../services/api';
import {
  getExternalMediaLink,
  isGoogleDriveUrl,
  isSizeGuideMediaUrl,
  normalizeVendorMediaUrl,
} from '../vendorMedia';

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

  it('lấy nhãn link media ngoài từ phần đầu hostname và chỉ nhận HTTP(S)', () => {
    expect(getExternalMediaLink('https://printwayfulfillment.jp.larksuite.com/file/abc'))
      .toEqual({
        href: 'https://printwayfulfillment.jp.larksuite.com/file/abc',
        label: 'printwayfulfillment',
      });
    expect(getExternalMediaLink('https://www.example.com/video')).toEqual({
      href: 'https://www.example.com/video',
      label: 'example',
    });
    expect(getExternalMediaLink('javascript:alert(1)')).toBeNull();
    expect(getExternalMediaLink('không-phải-url')).toBeNull();
  });

  it('đưa URL object storage (Cloudflare R2/S3, không có tiền tố /storage/) về endpoint có xác thực', () => {
    // Ảnh Vendor Library khi MEDIA_DISK=s3 được lưu URL R2 công khai dạng
    // 'https://<bucket-host>/vendor-library/a.jpg' — không đi qua '/storage/' như
    // đĩa server. Nếu không nhận diện được case này, ảnh sẽ lộ thẳng qua URL R2
    // công khai thay vì route xác thực.
    expect(normalizeVendorMediaUrl('https://pub-xxxx.r2.dev/vendor-library/a.jpg'))
      .toBe('/api/vendor-library/images/a.jpg');
    expect(normalizeVendorMediaUrl('https://cdn.vendorhub.viehana.com/vendor-library/a%20b.jpg?X-Amz-Signature=abc'))
      .toBe('/api/vendor-library/images/a%20b.jpg');
  });

  it('hiển thị logo Drive thay vì thẻ ảnh bị vỡ', () => {
    render(React.createElement(MediaThumb, {
      url: 'https://drive.google.com/file/d/abc/view?usp=drive_link',
    }));

    expect(screen.getByLabelText('Google Drive')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('ảnh ngoài tải lỗi thì hiện link tên miền và mở ở tab mới', () => {
    const url = 'https://printwayfulfillment.jp.larksuite.com/file/video-id';
    const { container } = render(React.createElement(MediaThumb, { url }));

    fireEvent.error(container.querySelector('img'));

    const link = screen.getByRole('link', { name: 'printwayfulfillment' });
    expect(link).toHaveAttribute('href', url);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(container.querySelector('img')).toBeNull();
  });

  it('không biến URL không an toàn thành link khi ảnh tải lỗi', () => {
    const { container } = render(React.createElement(MediaThumb, { url: 'not-a-valid-url' }));

    fireEvent.error(container.querySelector('img'));

    expect(screen.getByText('Không thể hiển thị')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('màn hình CSF/PD/Marvel cũng dùng fallback link tên miền', () => {
    const url = 'https://printwayfulfillment.jp.larksuite.com/file/video-id';
    const { container } = render(React.createElement(MergedInfoTable, {
      generalInfo: [{ id: 'row-1', vendorName: 'VN3', productType: 'Suncatcher', images: [url] }],
      pricing: [],
      showLeadTime: false,
    }));

    fireEvent.error(container.querySelector('img'));

    const link = screen.getByRole('link', { name: 'printwayfulfillment' });
    expect(link).toHaveAttribute('href', url);
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('bấm ảnh link ngoài mở lightbox tại chỗ, không bọc thẻ <a> điều hướng ra ngoài', async () => {
    // Một số CDN ngoài trả Content-Disposition: attachment cho link ảnh dán
    // trong Excel — nếu còn bọc <a href target=_blank>, bấm vào sẽ bị tải
    // file xuống thay vì xem ngay. Ảnh phải render qua <img> (mở lightbox khi
    // bấm), không được điều hướng thẳng tới link CDN gốc.
    render(React.createElement(MediaThumb, {
      url: 'https://cdn.example.com/anh-tham-khao.png',
    }));

    expect(document.querySelector('a')).toBeNull();

    fireEvent.click(document.querySelector('img'));

    // openLightbox resolve sibling URLs qua Promise.all (mục nút chuyển ảnh
    // qua/về) nên mở ra là bất đồng bộ — phải đợi thay vì assert ngay.
    await waitFor(() => expect(document.querySelectorAll('img')).toHaveLength(2));
  });

  it('nhận diện link Google Drive là media của Chi tiết Size', () => {
    const drive = 'https://drive.google.com/file/d/abc/view?usp=drive_link';
    expect(isGoogleDriveUrl(drive)).toBe(true);
    expect(isSizeGuideMediaUrl(drive)).toBe(true);
    expect(isSizeGuideMediaUrl('https://cdn.example.com/chart.PNG?download=1')).toBe(true);
    expect(isSizeGuideMediaUrl('size chart.png')).toBe(false);
  });
});
