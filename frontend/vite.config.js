import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: "/",
  server: {
    host: "0.0.0.0",       // 👈 đổi từ true -> cái này mạnh hơn
    port: 5173,
    strictPort: true,
    allowedHosts: true,   // 👈 cho phép tất cả các host (bao gồm cả localtunnel)
    cors: true             // 👈 thêm luôn cho chắc
  }
})