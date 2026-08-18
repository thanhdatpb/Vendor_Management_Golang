// ════════════════════════════════════════════════════════
//  VITEST — bộ test MỤC TIÊU CHƯA ĐẠT ("pending", ĐỎ là đúng).
//
//  Mỗi file ở đây là một nhánh "Mục tiêu đạt được" trong mindmap feedback đã
//  được viết thành assertion, nhưng tính năng tương ứng chưa làm. Chạy:
//      npm run test:pending
//  CI chạy job này ở chế độ thông tin (không chặn merge).
//
//  Khi PR tương ứng hoàn thành: đổi tên file bỏ hậu tố `.pending` → test lập
//  tức trở thành cổng chặn merge của `npm test`. Danh sách ánh xạ ở
//  docs/TESTING.md.
// ════════════════════════════════════════════════════════
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.pending.test.{js,jsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    restoreMocks: true,
  },
});
