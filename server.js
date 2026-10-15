import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleAdminBootstrapApi } from './server/adminApi.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, 'dist');
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8'
};

function serveFile(res, filePath, contentType) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return false;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = contentType || MIME_TYPES[ext] || 'application/octet-stream';

    // Cache headers: immutable cache for hashed assets, no-cache for html & manifest
    if (ext === '.html' || ext === '.webmanifest') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (filePath.includes('/assets/') || ext === '.woff2' || ext === '.png') {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Length', stat.size);

    const stream = fs.createReadStream(filePath);
    stream.on('error', (err) => {
      console.error('Stream error:', err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('Server error reading file');
      }
    });
    stream.pipe(res);
    return true;
  } catch (err) {
    return false;
  }
}

const server = http.createServer((req, res) => {
  // CORS & Security headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // Health check endpoints for Google Cloud Run
  const urlPath = req.url ? req.url.split('?')[0] : '/';
  if (urlPath === '/_health' || urlPath === '/api/health' || urlPath === '/healthz' || urlPath === '/health') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'healthy', uptime: process.uptime(), time: new Date().toISOString() }));
    return;
  }

  // API routing
  if (urlPath.startsWith('/api/admin/bootstrap-owner')) {
    handleAdminBootstrapApi(req, res);
    return;
  }

  // Static files handling (SPA routing)
  let safePath = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || !safePath) safePath = '/index.html';

  let targetFile = path.join(DIST_DIR, safePath);

  // If file exists in dist, serve it
  if (fs.existsSync(targetFile) && fs.statSync(targetFile).isFile()) {
    if (serveFile(res, targetFile)) return;
  }

  // SPA Fallback: Serve index.html for all other routes
  const indexFile = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexFile)) {
    if (serveFile(res, indexFile, 'text/html; charset=utf-8')) return;
  }

  // Fallback if index.html is missing
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end('<!DOCTYPE html><html lang="bn"><head><meta charset="UTF-8"><title>Madrasah Management System</title><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="font-family: sans-serif; display:flex; justify-content:center; align-items:center; height:100vh; margin:0; background:#f8fafc;"><div style="text-align:center; padding:2rem;"><h1 style="color:#0f172a;">মাদ্রাসা ও শিক্ষা ব্যবস্থাপনা প্ল্যাটফর্ম</h1><p style="color:#64748b;">লোড হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...</p></div></body></html>');
});

server.on('error', (err) => {
  console.error('[Production Server Error]', err);
});

server.listen(PORT, HOST, () => {
  console.log(`[Production Server] Madrasah Management System listening on http://${HOST}:${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
