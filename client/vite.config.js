// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',                 // listen on all network interfaces
    port: 5173,                      // your dev port
    hmr: {
      host: '192.168.189.175',       // replace with your machine’s LAN IP
      protocol: 'ws',
      port: 5173
    }
  }
});
