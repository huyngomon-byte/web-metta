import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  // server.* chi ap dung khi `npm run dev` - KHONG anh huong production build
  server: {
    proxy: {
      // Chuyen tiep /api sang serverless functions tren production de dang nhap admin /
      // CAPI / leads chay duoc khi dev bang `npm run dev` (Vite khong chay /api).
      '/api': {
        target: 'https://metta-academy.gg99.vn',
        changeOrigin: true,
        secure: true
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/');
          if (!normalized.includes('node_modules')) return undefined;
          if (normalized.includes('firebase')) return 'firebase';
          if (normalized.includes('recharts') || normalized.includes('/d3')) return 'charts';
          if (normalized.includes('framer-motion')) return 'motion';
          return 'vendor';
        }
      }
    }
  }
});
