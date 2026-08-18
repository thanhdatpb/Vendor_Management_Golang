// ════════════════════════════════════════════════════════
//  VITEST — bộ test CHẶN MERGE (đã xanh với code hiện tại).
//
//  Ở đây chỉ chứa test mô tả hành vi ĐANG CÓ + lưới an toàn hồi quy (golden
//  test T1). Test mô tả mục tiêu CHƯA làm nằm ở *.pending.test.* và chạy bằng
//  vitest.pending.config.js — xem docs/TESTING.md.
// ════════════════════════════════════════════════════════
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', 'src/**/*.pending.test.{js,jsx}'],
    restoreMocks: true,
  },
});
