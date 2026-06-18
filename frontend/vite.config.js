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
        entryFileNames: `assets/[name]-[hash]-v5.js`,
        chunkFileNames: `assets/[name]-[hash]-v5.js`,
        assetFileNames: `assets/[name]-[hash]-v5.[ext]`,
        manualChunks: {
          // React core — load đầu tiên, cache lâu dài
          'vendor-react': ['react', 'react-dom'],

          // Ant Design icons — ~300KB, tách riêng để cache
          'vendor-antd-icons': ['@ant-design/icons'],

          // XLSX — ~500KB, chỉ dùng khi export
          'vendor-xlsx': ['xlsx'],
        },
      },
    },
  },
})