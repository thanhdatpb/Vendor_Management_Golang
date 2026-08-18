import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  // Node 22+ có global `localStorage` riêng (chưa bật) che mất bản của jsdom
  // → luôn đi qua window để lấy đúng storage của môi trường test.
  try { window.localStorage.clear(); } catch { /* môi trường không có DOM */ }
});
