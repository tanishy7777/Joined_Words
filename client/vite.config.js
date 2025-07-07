import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss()
  ],
  server: {
    // the server is accessible from other devices on the LAN
    host: '0.0.0.0',               
    port: 5173,                      
    hmr: {
      // Without hmr.host: remote devices try to connect to localhost and fail.
      host: '192.168.189.175',
      // hot module replacement (HMR) protocol using WebSocket
      protocol: 'ws',
      port: 5173
    }
  }
});
