import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: 'http://35.207.196.68:3000',
    port: 5173,
    host: true, 
    hmr: {
      host: 'localhost', 
      port: 5173, 
    },
  },

})
