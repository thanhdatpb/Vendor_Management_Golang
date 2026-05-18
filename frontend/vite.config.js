import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: "/",
  server: {
    host: "0.0.0.0",       // 👈 đổi từ true -> cái này mạnh hơn
    port: 5173,
    strictPort: true,
    allowedHosts: "all",   // 👈 bắt buộc
    cors: true             // 👈 thêm luôn cho chắc
  }
})