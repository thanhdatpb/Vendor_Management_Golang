// ════════════════════════════════════════════════════════
//  MOCK services/api CHO TEST — không có request mạng nào thật sự chạy.
//  Dùng như sau ở đầu file test:
//      vi.mock('../../services/api', () => import('../../test/apiMock.js'));
//  Fixture thư viện đọc từ src/test/fixtures/vendorLibrary.sample.json.
// ════════════════════════════════════════════════════════
import { vi } from 'vitest';
import libraryFixture from './fixtures/vendorLibrary.sample.json';

/** Cho phép test đổi dữ liệu thư viện trả về (vd: bỏ bớt record để thử ca lỗi). */
export const __setLibraryFixture = (files) => { state.files = files; };
const state = { files: libraryFixture };

export const vendorLibraryApi = {
  get: vi.fn(async () => ({ data: state.files })),
  save: vi.fn(async () => ({ data: { message: 'Library saved successfully' } })),
  updateSampleStatus: vi.fn(async () => ({ data: {} })),
  updateBestSeller: vi.fn(async () => ({ data: {} })),
  uploadImages: vi.fn(async () => ({ data: {} })),
  restoreBackup: vi.fn(async () => ({ data: {} })),
};

export const priceSheetApi = {
  list: vi.fn(async () => ({ data: [] })),
  save: vi.fn(async () => ({ data: { message: 'Đã lưu bảng tính giá' } })),
  remove: vi.fn(async () => ({ data: {} })),
};

export const productApi = {};
export const analyticsApi = {};
export const vendorApi = {};
export const notificationApi = {};
export const feedbackApi = {};
export const sampleDecisionApi = {};
export const vendorSelectionApi = {};
export const newsApi = {};
export const authApi = {};
export const adminUserApi = {};

export default { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
