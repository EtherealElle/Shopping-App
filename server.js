import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { STORES, publicStore } from './lib/stores.js';
import { getDeals } from './lib/deals.js';

const PORT = Number(process.env.PORT) || 4321;
const PUBLIC_DIR = path.join(import.meta.dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function serveStatic(res, pathname) {
  const file = path.normalize(path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return sendJson(res, 403, { error: 'Forbidden' });
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch {
    sendJson(res, 404, { error: 'Not found' });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    // Same paths as the files the static build writes, so the page works unchanged on GitHub Pages.
    if (url.pathname === '/data/stores.json') return sendJson(res, 200, { mode: 'local', stores: STORES.map(publicStore) });
    const dealsPath = url.pathname.match(/^\/data\/deals\/([^/]+)\.json$/);
    if (dealsPath) {
      const store = STORES.find((s) => s.id === dealsPath[1]);
      if (!store) return sendJson(res, 404, { error: 'Unknown store' });
      return sendJson(res, 200, await getDeals(store, { refresh: url.searchParams.has('refresh') }));
    }
    await serveStatic(res, decodeURIComponent(url.pathname));
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
});

// Bound to localhost only: this is a personal tool, not a public service.
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Shopping Tool running at http://localhost:${PORT}`);
});
