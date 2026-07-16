import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: "/",
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    cors: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        secure: false,
      },
      "/storage": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    // Tăng warning threshold lên 600KB (mỗi chunk sau split)
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // v6: bump cache-bust suffix để buộc mọi trình duyệt tải lại asset mới.
        // (Sự cố 2026-07-16: bundle -v5 hỏng đã bị cache 7 ngày dưới cùng tên file
        //  → phải đổi tên file mới cache-bust được cho toàn bộ user.)
        entryFileNames: `assets/[name]-[hash]-v6.js`,
        chunkFileNames: `assets/[name]-[hash]-v6.js`,
        assetFileNames: `assets/[name]-[hash]-v6.[ext]`,
        manualChunks: {
          // React core — load đầu tiên, cache lâu dài
          'vendor-react': ['react', 'react-dom'],

          // Ant Design UI — ~800KB, tách riêng để cache lâu dài
          'vendor-antd': ['antd'],

          // Ant Design icons — ~300KB, tách riêng để cache
          'vendor-antd-icons': ['@ant-design/icons'],

          // XLSX — ~500KB, chỉ dùng khi export
          'vendor-xlsx': ['xlsx'],
        },
      },
    },
  },
})