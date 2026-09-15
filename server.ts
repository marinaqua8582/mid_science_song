import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import adminLogin from './api/admin/login';
import adminLogout from './api/admin/logout';
import adminSession from './api/admin/session';
import studentLogin from './api/student/login';
import studentLogout from './api/student/logout';
import publicSettings from './api/settings/public';
import adminSettings from './api/settings/admin';
import sheetHandler from './api/sheet';
import geminiHandler from './api/gemini/generate-lyrics';
import healthHandler from './api/health';
import gasCodeHandler from './api/gas-code';

dotenv.config();

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '1mb' }));

  app.all('/api/admin/login', adminLogin);
  app.all('/api/admin/logout', adminLogout);
  app.all('/api/admin/session', adminSession);
  app.all('/api/student/login', studentLogin);
  app.all('/api/student/logout', studentLogout);
  app.all('/api/settings/public', publicSettings);
  app.all('/api/settings/admin', adminSettings);
  app.all('/api/sheet', sheetHandler);
  app.all('/api/gemini/generate-lyrics', geminiHandler);
  app.all('/api/health', healthHandler);
  app.all('/api/gas-code', gasCodeHandler);

  app.all('/api/*', (_req, res) => {
    res.status(404).json({ status: 'error', message: '요청한 API를 찾을 수 없습니다.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`[Science Song Server] running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((error) => {
  console.error('[Science Song Server] failed to start', error);
  process.exitCode = 1;
});
