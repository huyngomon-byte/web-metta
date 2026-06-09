import react from '@vitejs/plugin-react';
import crypto from 'node:crypto';
import { defineConfig, loadEnv } from 'vite';

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwt(payload, secret, header = {}) {
  const encodedHeader = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT', ...header }));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();
  return `${encodedHeader}.${encodedPayload}.${base64Url(signature)}`;
}

function localStringeeTokenPlugin() {
  let env = {};
  return {
    name: 'metta-local-stringee-token',
    config(_, { mode }) {
      env = loadEnv(mode, process.cwd(), '');
    },
    configureServer(server) {
      server.middlewares.use('/api/call/token', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }
        let raw = '';
        req.on('data', (chunk) => { raw += chunk; });
        req.on('end', () => {
          try {
            const body = raw ? JSON.parse(raw) : {};
            const sid = env.STRINGEE_API_SID || process.env.STRINGEE_API_SID;
            const secret = env.STRINGEE_API_SECRET || process.env.STRINGEE_API_SECRET;
            const userId = String(body.stringeeUserId || body.crmUserId || '').trim();
            if (!sid || !secret) throw new Error('Missing local Stringee SID/secret.');
            if (!userId) throw new Error('Missing Stringee userId.');
            const exp = Math.floor(Date.now() / 1000) + 3600;
            const token = signJwt({
              jti: `${sid}-${Date.now()}`,
              iss: sid,
              exp,
              userId,
            }, secret, { cty: 'stringee-api;v=1' });
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ token, userId, expiresAt: new Date(exp * 1000).toISOString(), localDev: true }));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Cannot issue local Stringee token.' }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [localStringeeTokenPlugin(), react()],
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
        target: 'https://www.metta.edu.vn',
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

